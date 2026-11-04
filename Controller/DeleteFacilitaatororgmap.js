import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const DeleteFacilitatorOrgMap = async (req, res) => {
    // us ethis
    const { id } = req.body;
    if (typeof id === "undefined" || id === null) {
        return res.status(400).json({ error: "ID is required in body as { id: number }" });
    }

    try {
        await poolConnect; // ensures that the pool connection is established
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query("DELETE FROM FacilitatorOrgMap WHERE id = @id");

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "FacilitatorOrgMap record not found for the given ID" });
        }
        return res.status(200).json({ message: `FacilitatorOrgMap entry with id=${id} deleted successfully` });
    } catch (error) {
        return res.status(500).json({ error: "Failed to delete FacilitatorOrgMap entry", details: error.message });
    }
};