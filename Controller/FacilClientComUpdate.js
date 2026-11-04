import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

// FacilitatorCommentsUpdate now accepts a value for FacilitatorComments to update, not just clear.
export const FacilitatorCommentsUpdate = async (req, res) => {
    const { employeeCode, facilitatorComments } = req.body;

    if (!employeeCode) {
        return res.status(400).json({
            error: "employeeCode is required in body as { employeeCode: string, facilitatorComments?: string }"
        });
    }

    // Allow facilitatorComments to be empty string (to clear) or any value, but must be present in the body
    if (typeof facilitatorComments === "undefined") {
        return res.status(400).json({
            error: "facilitatorComments is required in body as { facilitatorComments: string (can be empty) }"
        });
    }

    try {
        await poolConnect;

        const result = await pool.request()
            .input('EmployeeCode', sql.VarChar(100), employeeCode)
            .input('FacilitatorComments', sql.NVarChar(sql.MAX), facilitatorComments)
            .query(`
                UPDATE WorktrailclientData 
                SET FacilitatorComments = @FacilitatorComments
                WHERE EmployeeCode = @EmployeeCode
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                message: "No record found for the given employeeCode"
            });
        }

        return res.status(200).json({
            message: `FacilitatorComments updated for EmployeeCode=${employeeCode}`,
            facilitatorComments: facilitatorComments
        });

    } catch (error) {
        console.error('Error updating FacilitatorComments:', error);
        return res.status(500).json({
            error: 'Failed to update FacilitatorComments',
            details: error.message
        });
    }
};