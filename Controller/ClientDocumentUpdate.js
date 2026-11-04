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

const saveDocument = async (value, folder) => {
    if (!value) return null;
    const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
    if (!match) throw new Error(`${folder} must be a PDF, JPG, or PNG base64 document.`);
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error(`${folder} must be 5 MB or smaller.`);
    await fs.mkdir(folders[folder], { recursive: true });
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${types[match[1]]}`;
    await fs.writeFile(path.join(folders[folder], fileName), buffer, { flag: 'wx' });
    return `${folder}/${fileName}`;
};

export const updateClientDocuments = async (req, res) => {
    const { EmployeeCode, orderId, Contributor, LOA, SupportingDocs } = req.body || {};
    if (!EmployeeCode || !orderId || !Contributor || !LOA) {
        return res.status(400).json({ message: 'EmployeeCode, orderId, Contributor, and LOA are required.' });
    }
    const savedPaths = [];
    try {
        const loaPath = await saveDocument(LOA, 'LOA');
        const supportingPath = await saveDocument(SupportingDocs, 'SupportingDocs');
        savedPaths.push(loaPath, supportingPath);
        await poolConnect;
        const request = pool.request();
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode);
        request.input('OrderID', sql.VarChar(500), orderId);
        request.input('Contributor', sql.VarChar(500), Contributor);
        request.input('LOA', sql.VarChar(sql.MAX), loaPath);
        request.input('SupportingDocs', sql.VarChar(sql.MAX), supportingPath);
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
        if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Candidate record was not found.' });
        return res.status(200).json({ message: 'Documents uploaded successfully.', EmployeeCode, orderId });
    } catch (error) {
        await Promise.all(savedPaths.filter(Boolean).map(async (filePath) => {
            try { await fs.unlink(path.join(backendRoot, filePath)); } catch { /* best effort cleanup */ }
        }));
        console.error('Error updating client documents:', error);
        return res.status(500).json({ message: error.message || 'Unable to upload documents.' });
    }
};