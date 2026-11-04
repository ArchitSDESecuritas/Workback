import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'

export const ContributorDash = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { Contributor } = req.body;
    if (!Contributor) {
        return res.status(400).json({ message: 'Missing required field: Contributor' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Contributor', sql.NVarChar(100), Contributor);

        const query = `
            SELECT 'ContributorCount' AS ColumnName,
                   CAST((SELECT COUNT(*) FROM WorktrailcontributorData WHERE Contributor = @Contributor) AS VARCHAR(20)) AS Value
            UNION ALL
            SELECT 'TotalRequest',
                   CAST(COUNT(*) AS VARCHAR(20))
            FROM WorktrailclientData
            WHERE Contributor = @Contributor
            UNION ALL
            SELECT 'CompletedRequest',
                   CAST(COUNT(*) AS VARCHAR(20))
            FROM WorktrailclientData
            WHERE Contributor = @Contributor
              AND Status = 'Downloaded'
              AND ISNULL(DownloadStatus,0) = 0
            UNION ALL
            SELECT 'PendingRequest',
                   CAST(COUNT(*) AS VARCHAR(20))
            FROM WorktrailclientData
            WHERE Contributor = @Contributor
              AND Status = 'Pending'
              AND DownloadStatus IS NULL
            UNION ALL
            SELECT 'InProgressRequest',
                   CAST(COUNT(*) AS VARCHAR(20))
            FROM WorktrailclientData
            WHERE Contributor = @Contributor
              AND (
                    (Status = 'InProgress' AND DownloadStatus IS NULL)
                    OR (Status = 'Rejected' AND DownloadStatus = 1)
                    OR (Status = 'Approved' AND DownloadStatus = 1)
                  );
        `;

        const result = await request.query(query);

        return res.status(200).json({
            data: result.recordset || [],
            message: 'Dashboard data fetched successfully'
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message || error
        });
    }
}