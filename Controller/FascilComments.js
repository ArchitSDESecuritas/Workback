import { sql, pool, poolConnect } from "../DatabaseConfig/DB.js";

// POST API to get FacilitatorComments by EmployeeCode
export async function FascilatorComments(req, res) {
    const { employeeCode } = req.body;

    if (!employeeCode) {
        return res.status(400).json({
            error: "employeeCode is required in body as { employeeCode: string }"
        });
    }

    try {
        await poolConnect;

        const result = await pool.request()
            .input('EmployeeCode', sql.VarChar(100), employeeCode)
            .query(`
                SELECT FacilitatorComments 
                FROM WorktrailclientData 
                WHERE EmployeeCode = @EmployeeCode
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                message: "No record found for the given employeeCode"
            });
        }

        return res.status(200).json({
            employeeCode: employeeCode,
            facilitatorComments: result.recordset[0].FacilitatorComments
        });

    } catch (error) {
        console.error('Error fetching FacilitatorComments:', error);
        return res.status(500).json({
            error: 'Failed to fetch FacilitatorComments',
            details: error.message
        });
    }
}