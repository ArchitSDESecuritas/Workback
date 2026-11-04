import { pool, poolConnect } from "../DatabaseConfig/DB.js";

export const FacilitatorsData = async (req, res) => {
    try {
        await poolConnect;
        const request = pool.request();
        const result = await request.query(
            `SELECT id, username, EmailID, FirstName, LastName, ActiveStatus
             FROM Worktrialusers
             WHERE Usertype = 'Fascilator'
             ORDER BY ActiveStatus DESC, username`
        );
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching facilitator accounts:', err);
        res.status(500).json({ error: "Database query failed" });
    }
};