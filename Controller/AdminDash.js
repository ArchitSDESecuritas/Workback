import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const AdminDash = async (req, res) => {
    // Accept only GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        await poolConnect;
        const request = pool.request();

        const query = `
            SELECT 'TotalCases' AS ColumnName,
                   CAST(COUNT(*) AS VARCHAR(20)) AS Value
              FROM WorktrailclientData
            UNION ALL
            SELECT 'CasePending',
                   CAST(COUNT(*) AS VARCHAR(20))
              FROM WorktrailclientData
             WHERE Status = 'Pending'
               AND DownloadStatus IS NULL
            UNION ALL
            SELECT 'CaseResponded',
                   CAST(COUNT(*) AS VARCHAR(20))
              FROM WorktrailclientData
             WHERE Status IN ('InProgress', 'Approved')
            UNION ALL
            SELECT 'CaseRejected',
                   CAST(COUNT(*) AS VARCHAR(20))
              FROM WorktrailclientData
             WHERE Status = 'Rejected'
            UNION ALL
            SELECT 'RequestsPending',
                   CAST(COUNT(*) AS VARCHAR(20))
              FROM WorktrailclientData
             WHERE Status IN ('Approved', 'Rejected')
               AND DownloadStatus = 1
            UNION ALL
            SELECT 'RequestsResponded',
                   CAST(COUNT(*) AS VARCHAR(20))
              FROM WorktrailclientData
             WHERE Status = 'Downloaded';
        `;

        const result = await request.query(query);

        return res.status(200).json({ data: result.recordset });
    } catch (error) {
        console.error('AdminSummaryStats error:', error);
        return res.status(500).json({ message: 'Database query failed.' });
    }
};