import { pool, sql, poolConnect } from '../DatabaseConfig/DB.js'

export const PaymentAdminData = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { fromDate, toDate } = req.body || {};

    if (!fromDate || !toDate) {
        return res.status(400).json({ message: "Both fromDate and toDate are required in the request body." });
    }

    try {
        await poolConnect;
        const request = pool.request();
        // API expects ISO 8601 - could add validation here if needed.
        request.input('fromDate', sql.DateTime2, fromDate);
        request.input('toDate', sql.DateTime2, toDate);

        const query = `
            SELECT 
                CAST(CreatedAt AS DATE) AS PaymentDate,
                COUNT(*) AS TotalTransactions,
                SUM(Amount) AS TotalAmount
            FROM PaymentTransactions
            WHERE Status = 'Paid'
              AND CreatedAt >= @fromDate
              AND CreatedAt < @toDate
            GROUP BY CAST(CreatedAt AS DATE)
            ORDER BY PaymentDate
        `;

        const result = await request.query(query);

        return res.status(200).json({ data: result.recordset });
    } catch (error) {
        console.error('PaymentAdminData error:', error);
        return res.status(500).json({ message: 'Database query failed.' });
    }
};