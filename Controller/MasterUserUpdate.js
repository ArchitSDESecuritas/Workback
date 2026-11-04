import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';
import { sendAccountStatusEmail } from '../Services/RegistrationEmailService.js';

export const MasterUserUpdate = async (req, res) => {
    const userId = Number(req.body?.id);
    const activeStatusValue = req.body?.activeStatus;
    const activeStatus = Number(activeStatusValue);

    if (
        !Number.isInteger(userId) ||
        userId <= 0 ||
        ![0, 1].includes(activeStatus) ||
        ![0, 1, '0', '1'].includes(activeStatusValue)
    ) {
        return res.status(400).json({
            message: 'A valid id and activeStatus (0 or 1) are required.'
        });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('id', sql.Int, userId);
        request.input('activeStatus', sql.Int, activeStatus);
        const result = await request.query(`
            UPDATE Worktrialusers
            SET activestatus = @activeStatus
            OUTPUT
                inserted.EmailID,
                inserted.FirstName,
                inserted.LastName,
                inserted.CompanyName,
                inserted.Usertype,
                inserted.activestatus AS activeStatus,
                deleted.activestatus AS previousActiveStatus
            WHERE id = @id
        `);

        const user = result.recordset[0];
        if (!user) {
            return res.status(404).json({ message: 'User account was not found.' });
        }

        let emailNotification = 'not_applicable';
        const statusChanged = Number(user.previousActiveStatus) !== Number(user.activeStatus);
        if (statusChanged && String(user.Usertype).trim().toLowerCase() === 'client') {
            emailNotification = 'failed';
            try {
                await sendAccountStatusEmail(user, activeStatus);
                emailNotification = 'sent';
            } catch (emailError) {
                console.error('Client account status email failed:', emailError);
            }
        }

        return res.status(200).json({
            message: `User ${activeStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
            id: userId,
            activeStatus,
            emailNotification
        });
    } catch (error) {
        console.error('Error updating master user status:', error);
        return res.status(500).json({ message: 'Failed to update user status.' });
    }
};

export default MasterUserUpdate;
