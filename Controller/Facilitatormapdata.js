import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const FacilitatorsMapData = async (req, res) => {
    await poolConnect; // ensures the pool has been created
    try {
        const request = pool.request(); // use imported pool instead of dynamic import
        const result = await request.query(
            "SELECT * FROM FacilitatorOrgMap"
        );
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Database query failed", details: err });
    }
};