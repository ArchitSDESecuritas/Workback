import { sql, poolConnect } from "../DatabaseConfig/DB.js";

export const MapFacilitatorToOrg = async (req, res) => {
    await poolConnect; // ensures the pool has been created
    try {
        // Expecting body: { "orgFacilitator": 3, "orgId": 11, "organizationName": "DemoCompany" }
        const { orgId, orgFacilitator, organizationName } = req.body;
        const facilitatorId = orgFacilitator; // facilitator ID comes directly as a value

        // Insert mapping - LockedStatus is always 1
        const request = (await import("../DatabaseConfig/DB.js")).pool.request();
        request.input('FacilitatorId', sql.Int, facilitatorId);
        request.input('OrgMasterId', sql.Int, orgId);
        request.input('OrganizationName', sql.NVarChar, organizationName);
        request.input('LockedStatus', sql.Int, 1);

        const insertQuery = `
            INSERT INTO FacilitatorOrgMap (FacilitatorId, OrgMasterId, OrganizationName, LockedStatus)
            VALUES (@FacilitatorId, @OrgMasterId, @OrganizationName, @LockedStatus)
        `;

        await request.query(insertQuery);

        // Return all mappings
        const result = await request.query(`SELECT * FROM FacilitatorOrgMap`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Database operation failed", details: err });
    }
};