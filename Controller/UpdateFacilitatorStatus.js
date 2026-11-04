import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const UpdateFacilitatorStatus = async (req, res) => {
    const facilitatorId = Number(req.body?.facilitatorId);
    const activeStatus = Number(req.body?.activeStatus);

    if (!Number.isInteger(facilitatorId) || facilitatorId <= 0 || ![0, 1].includes(activeStatus)) {
        return res.status(400).json({
            error: 'A valid facilitatorId and activeStatus (0 or 1) are required.'
        });
    }

    let transaction;
    let transactionStarted = false;
    try {
        await poolConnect;
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        transactionStarted = true;

        const accountRequest = new sql.Request(transaction);
        accountRequest.input('FacilitatorId', sql.Int, facilitatorId);
        const accountResult = await accountRequest.query(`
            SELECT id, ActiveStatus
            FROM Worktrialusers
            WHERE id = @FacilitatorId AND Usertype = 'Fascilator'
        `);

        if (!accountResult.recordset.length) {
            await transaction.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Facilitator account was not found.' });
        }

        let unmappedOrganizations = [];
        if (activeStatus === 0) {
            const mappingRequest = new sql.Request(transaction);
            mappingRequest.input('FacilitatorId', sql.Int, facilitatorId);
            const mappings = await mappingRequest.query(`
                SELECT DISTINCT OrganizationName
                FROM FacilitatorOrgMap
                WHERE FacilitatorId = @FacilitatorId
            `);
            unmappedOrganizations = mappings.recordset.map((mapping) => mapping.OrganizationName);

            const deleteMappingsRequest = new sql.Request(transaction);
            deleteMappingsRequest.input('FacilitatorId', sql.Int, facilitatorId);
            await deleteMappingsRequest.query(`
                DELETE FROM FacilitatorOrgMap
                WHERE FacilitatorId = @FacilitatorId
            `);
        }

        const updateRequest = new sql.Request(transaction);
        updateRequest.input('FacilitatorId', sql.Int, facilitatorId);
        updateRequest.input('ActiveStatus', sql.Int, activeStatus);
        const updateResult = await updateRequest.query(`
            UPDATE Worktrialusers
            SET ActiveStatus = @ActiveStatus
            WHERE id = @FacilitatorId AND Usertype = 'Fascilator'
        `);

        if (updateResult.rowsAffected[0] === 0) {
            await transaction.rollback();
            transactionStarted = false;
            return res.status(404).json({ error: 'Facilitator account was not found.' });
        }

        await transaction.commit();
        transactionStarted = false;
        return res.status(200).json({
            message: activeStatus === 1
                ? 'Facilitator activated successfully.'
                : 'Facilitator deactivated and organization mappings removed successfully.',
            facilitatorId,
            activeStatus,
            unmappedOrganizations
        });
    } catch (error) {
        if (transaction && transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Failed to roll back facilitator status update:', rollbackError);
            }
        }
        console.error('Error updating facilitator status:', error);
        return res.status(500).json({ error: 'Failed to update facilitator status.' });
    }
};
