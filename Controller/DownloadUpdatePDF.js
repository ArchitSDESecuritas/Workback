import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const DownloadUpdatePDF = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { Contributor, EmployeeCode } = req.body || {};

    if (!Contributor || !EmployeeCode) {
        return res.status(400).json({ message: 'Contributor and EmployeeCode are required in the request body.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Contributor', sql.VarChar(500), Contributor);
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode);

        // First, fetch the data
        const result = await request.query(`
            SELECT 
                c.*,
                cl.Status
            FROM WorktrailcontributorData c
            LEFT JOIN WorktrailclientData cl
                ON c.Contributor = cl.Contributor
                AND c.EmployeeCode = cl.EmployeeCode
            WHERE c.Contributor = @Contributor
                AND c.EmployeeCode = @EmployeeCode
        `);

        // If no records found
        if (!result.recordset || result.recordset.length === 0) {
            return res.status(404).json({ message: 'No data found for the provided Contributor and EmployeeCode.' });
        }

        // After fetching, update the Status and DownloadStatus in WorktrailclientData
        const updateRequest = pool.request();
        updateRequest.input('Contributor', sql.VarChar(500), Contributor);
        updateRequest.input('EmployeeCode', sql.VarChar(50), EmployeeCode);

        // Set Status='Downloaded', DownloadStatus=0
        await updateRequest.query(`
            UPDATE WorktrailclientData 
            SET Status = 'Downloaded', DownloadStatus = 0 
            WHERE Contributor = @Contributor AND EmployeeCode = @EmployeeCode
        `);

        // Send the found records
        return res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error('Error fetching PDF update data:', error);
        return res.status(500).json({ message: 'Unable to fetch data for PDF update.' });
    }
}