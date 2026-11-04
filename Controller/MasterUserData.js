import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

// GET API to retrieve master user records from Worktrialusers
export const MasterManage = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        await poolConnect;
        const request = pool.request();

        const query = `
            SELECT id,
                username,
                password,
                created_at,
                activestatus,
                Usertype,
                EmailID,
                FirstName,
                LastName,
                CompanyName
            FROM Worktrialusers
        `;

        const result = await request.query(query);

        return res.status(200).json({
            message: 'Master user data retrieved successfully.',
            data: result.recordset
        });
    } catch (error) {
        console.error('Database error while retrieving master user data:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message || error
        });
    }
};

export default MasterManage;
