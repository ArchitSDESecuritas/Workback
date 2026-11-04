import { sql, pool, poolConnect } from "../DatabaseConfig/DB.js";

// Post API to get orgs by FacilitatorId provided in req.body
export async function OrgsByFacilitator(req, res) {
    const { facilitatorId } = req.body;

    if (!facilitatorId) {
        return res.status(400).json({ error: "facilitatorId is required in body" });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('FacilitatorId', sql.Int, facilitatorId);
        const result = await request.query(
            `SELECT OrgMasterId, OrganizationName 
             FROM FacilitatorOrgMap 
             WHERE FacilitatorId = @FacilitatorId`
        );
        res.status(200).json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}