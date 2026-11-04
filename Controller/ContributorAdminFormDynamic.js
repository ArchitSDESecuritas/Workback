import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'

export const ContributorAdminFormDynamic = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Contributor is now taken from request body, defaulting to 'Naggaro' if not given
    const { Contributor } = req.body;

    if (!Contributor) {
        return res.status(400).json({
            message: "Missing required field: Contributor must be provided in the request body."
        });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Contributor', sql.NVarChar(100), Contributor);

        const selectQuery = `
            SELECT DBFieldName, DisplayFieldName
            FROM WorktrailColumnsmap
            WHERE Contributor = @Contributor
        `;

        const result = await request.query(selectQuery);

        return res.status(200).json({
            data: result.recordset || [],
            message: 'Fields fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching fields from WorktrailColumnsmap:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message || error
        });
    }
}