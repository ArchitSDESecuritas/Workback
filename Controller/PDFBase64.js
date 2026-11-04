import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documentFolders = {
    LOA: path.join(backendRoot, 'LOA'),
    SupportingDocs: path.join(backendRoot, 'SupportingDocs')
};

const getDocumentBase64 = async (storedPath, folderName) => {
    if (!storedPath) return null;

    const normalizedPath = String(storedPath).replace(/\\/g, '/');
    const expectedPrefix = `${folderName}/`;
    if (!normalizedPath.startsWith(expectedPrefix)) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const fileName = normalizedPath.slice(expectedPrefix.length);
    if (!fileName || fileName === '.' || fileName === '..' || fileName.includes('/')) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const folderPath = documentFolders[folderName];
    const resolvedFilePath = path.resolve(folderPath, fileName);
    const relativePath = path.relative(folderPath, resolvedFilePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const actualFolderPath = await fs.realpath(folderPath);
    const actualFilePath = await fs.realpath(resolvedFilePath);
    const actualRelativePath = path.relative(actualFolderPath, actualFilePath);
    if (!actualRelativePath || actualRelativePath.startsWith('..') || path.isAbsolute(actualRelativePath)) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const buffer = await fs.readFile(actualFilePath);
    const extension = path.extname(fileName).toLowerCase();
    const mimeType = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png'
    }[extension];

    if (!mimeType) throw new Error(`Unsupported ${folderName} document type.`);

    return {
        fileName,
        mimeType,
        base64: buffer.toString('base64')
    };
};

export const PDFBase64 = async (req, res) => {
    const { OrderID, EmployeeCode, Contributor } = req.body || {};
    if (
        typeof OrderID !== 'string' || !OrderID.trim() ||
        typeof EmployeeCode !== 'string' || !EmployeeCode.trim() ||
        typeof Contributor !== 'string' || !Contributor.trim()
    ) {
        return res.status(400).json({
            message: 'OrderID, EmployeeCode, and Contributor are required.'
        });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('OrderID', sql.VarChar(500), OrderID.trim());
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode.trim());
        request.input('Contributor', sql.VarChar(500), Contributor.trim());

        const result = await request.query(`
            SELECT LOA, SupportingDocs
            FROM WorktrailclientData
            WHERE OrderID = @OrderID
              AND EmployeeCode = @EmployeeCode
              AND Contributor = @Contributor
        `);

        if (!result.recordset?.length) {
            return res.status(404).json({ message: 'Candidate document record was not found.' });
        }

        const record = result.recordset[0];
        const [loa, supportingDocs] = await Promise.all([
            getDocumentBase64(record.LOA, 'LOA'),
            getDocumentBase64(record.SupportingDocs, 'SupportingDocs')
        ]);

        return res.status(200).json({
            message: 'Candidate documents retrieved successfully.',
            data: {
                LOA: loa,
                SupportingDocs: supportingDocs
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'A requested document file was not found.' });
        }
        console.error('Error retrieving candidate documents as Base64:', error);
        return res.status(500).json({ message: 'Unable to retrieve candidate documents.' });
    }
};

export default PDFBase64;
