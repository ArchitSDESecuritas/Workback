import { pool, sql, poolConnect } from '../DatabaseConfig/DB.js'

export const AdminRequestProgress = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Expect { fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD" } in body
    const { fromDate, toDate } = req.body || {};

    if (!fromDate || !toDate) {
        return res.status(400).json({ message: "Both fromDate and toDate are required in the request body." });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('fromDate', sql.DateTime2, fromDate);
        request.input('toDate', sql.DateTime2, toDate);

        const query = `
            SELECT 
                CAST(CreatedAt AS DATE) AS CaseDate,
                COUNT(CASE WHEN Status = 'Downloaded' THEN 1 END) AS CompletedCases,
                COUNT(CASE WHEN Status <> 'Downloaded' THEN 1 END) AS LoggedCases
            FROM WorktrailclientData
            WHERE CreatedAt >= @fromDate
              AND CreatedAt < @toDate
            GROUP BY CAST(CreatedAt AS DATE)
            ORDER BY CaseDate
        `;

        const result = await request.query(query);

        return res.status(200).json({ data: result.recordset });
    } catch (error) {
        console.error('AdminRequestProgress error:', error);
        return res.status(500).json({ message: 'Database query failed.' });
    }
};