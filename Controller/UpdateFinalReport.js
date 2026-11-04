import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const UpdateFinalReport = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { Contributor, EmployeeCode, Status, DownloadStatus } = req.body || {};

    if (!Contributor || !EmployeeCode || (Status === undefined) || (DownloadStatus === undefined)) {
        return res.status(400).json({ message: 'Contributor, EmployeeCode, Status, and DownloadStatus are required in request body.' });
    }

    // Ensure DownloadStatus is always an integer before passing to SQL
    let downloadStatusInt;
    try {
        downloadStatusInt = parseInt(DownloadStatus, 10);
        if (isNaN(downloadStatusInt)) {
            return res.status(400).json({ message: 'DownloadStatus must be an integer.' });
        }
    } catch (e) {
        return res.status(400).json({ message: 'Invalid DownloadStatus value.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Status', sql.VarChar(100), Status);
        request.input('DownloadStatus', sql.Int, downloadStatusInt);
        request.input('Contributor', sql.VarChar(500), Contributor);
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode);

        const result = await request.query(`
            UPDATE WorktrailclientData 
            SET Status = @Status, DownloadStatus = @DownloadStatus
            WHERE Contributor = @Contributor AND EmployeeCode = @EmployeeCode
        `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'No matching record found to update.' });
        }

        return res.status(200).json({ message: 'Final report status updated successfully.' });
    } catch (error) {
        console.error('Error updating final report:', error);
        return res.status(500).json({ message: error.message || 'Unable to update final report.' });
    }
};