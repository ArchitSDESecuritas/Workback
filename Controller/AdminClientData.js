import { pool, poolConnect } from '../DatabaseConfig/DB.js';

export const AdminClientData = async (req, res) => {
    // Accept only GET
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        await poolConnect;
        const request = pool.request();

        // contributor is optional, coming from req.params.contributor
        const contributor = req.params && req.params.contributor;

        let queryText = "SELECT * FROM WorktrailclientData";
        if (contributor) {
            queryText += " WHERE Contributor = @Contributor";
            request.input('Contributor', contributor);
        }
        queryText += " ORDER BY Sno DESC";

        const result = await request.query(queryText);

        return res.status(200).json({ data: result.recordset });
    } catch (error) {
        console.error('Error fetching client data:', error);
        return res.status(500).json({ message: 'Database query failed.' });
    }
}