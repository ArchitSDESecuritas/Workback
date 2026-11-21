import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folders = {
    LOA: path.join(backendRoot, 'LOA'),
    SupportingDocs: path.join(backendRoot, 'SupportingDocs')
};
const types = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const allowedFolders = new Set(Object.keys(folders));
const generatedFileNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png)$/i;

const resolveGeneratedDocumentPath = (folder, fileName) => {
    if (!allowedFolders.has(folder) || !generatedFileNamePattern.test(fileName)) {
        throw new Error('Invalid generated document path.');
    }

    const folderPath = folders[folder];
    const resolvedPath = path.resolve(folderPath, fileName);
    const relativePath = path.relative(folderPath, resolvedPath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Generated document path is outside the document folder.');
    }

    return resolvedPath;
};

const saveDocument = async (value, folder) => {
    if (!value) return null;
    if (!allowedFolders.has(folder)) throw new Error('Invalid document folder.');
    const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
    if (!match) throw new Error(`${folder} must be a PDF, JPG, or PNG base64 document.`);
    const encodedDocument = match[2].replace(/\s/g, '');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedDocument)) {
        throw new Error(`${folder} must contain valid base64 data.`);
    }
    const buffer = Buffer.from(encodedDocument, 'base64');
    if (buffer.toString('base64') !== encodedDocument) {
        throw new Error(`${folder} must contain valid base64 data.`);
    }
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error(`${folder} must be 5 MB or smaller.`);
    await fs.mkdir(folders[folder], { recursive: true });
    const fileName = `${crypto.randomUUID()}.${types[match[1]]}`;
    const absolutePath = resolveGeneratedDocumentPath(folder, fileName);
    await fs.writeFile(absolutePath, buffer, { flag: 'wx' });
    return {
        databasePath: `${folder}/${fileName}`,
        absolutePath
    };
};

const cleanupSavedDocuments = async (savedDocuments) => {
    await Promise.all(savedDocuments.map(async ({ absolutePath }) => {
        try {
            await fs.unlink(absolutePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Unable to remove an unreferenced client document:', error.message);
            }
        }
    }));
};

export const updateClientDocuments = async (req, res) => {
    const { EmployeeCode, orderId, Contributor, LOA, SupportingDocs } = req.body || {};
    if (!EmployeeCode || !orderId || !Contributor || !LOA) {
        return res.status(400).json({ message: 'EmployeeCode, orderId, Contributor, and LOA are required.' });
    }
    const savedDocuments = [];
    try {
        const loaDocument = await saveDocument(LOA, 'LOA');
        if (loaDocument) savedDocuments.push(loaDocument);
        const supportingDocument = await saveDocument(SupportingDocs, 'SupportingDocs');
        if (supportingDocument) savedDocuments.push(supportingDocument);
        await poolConnect;
        const request = pool.request();
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode);
        request.input('OrderID', sql.VarChar(500), orderId);
        request.input('Contributor', sql.VarChar(500), Contributor);
        request.input('LOA', sql.VarChar(sql.MAX), loaDocument?.databasePath ?? null);
        request.input('SupportingDocs', sql.VarChar(sql.MAX), supportingDocument?.databasePath ?? null);
        const result = await request.query(`
            UPDATE WorktrailclientData
            SET LOA = @LOA,
                SupportingDocs = COALESCE(@SupportingDocs, SupportingDocs),
                Status = 'InProgress',
                UpdatedDate = GETDATE()
            WHERE EmployeeCode = @EmployeeCode
              AND OrderID = @OrderID
              AND Contributor = @Contributor
        `);
        if (!result.rowsAffected[0]) {
            await cleanupSavedDocuments(savedDocuments);
            return res.status(404).json({ message: 'Candidate record was not found.' });
        }
        return res.status(200).json({ message: 'Documents uploaded successfully.', EmployeeCode, orderId });
    } catch (error) {
        await cleanupSavedDocuments(savedDocuments);
        console.error('Error updating client documents:', error);
        return res.status(500).json({ message: 'Unable to upload documents.' });
    }
};