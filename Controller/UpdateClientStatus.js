import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const UpdateClientStatus = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { Contributor, EmployeeCode } = req.body || {};

    if (!Contributor || !EmployeeCode) {
        return res.status(400).json({ message: 'Contributor and EmployeeCode are required.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Contributor', sql.VarChar(500), Contributor);
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode);

        const result = await request.query(`
            UPDATE WorktrailclientData
            SET status = 'Approved', Downloadstatus = '1'
            WHERE Contributor = @Contributor
              AND EmployeeCode = @EmployeeCode
        `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'No matching record found to update.' });
        }

        return res.status(200).json({ message: 'Client status updated successfully.' });
    } catch (error) {
        console.error('Error updating client status:', error);
        return res.status(500).json({ message: error.message || 'Unable to update client status.' });
    }
};