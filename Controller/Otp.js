import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'
import jwt from 'jsonwebtoken'
import { createOtp, sendOtp } from '../Services/OtpService.js'
import { createSessionToken } from '../Services/SessionService.js'
import { sendRegistrationNotifications } from '../Services/RegistrationEmailService.js'

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'
const OTP_EXPIRY_MINUTES = 10
const isValidOtp = (value) => /^\d{6}$/.test(String(value || ''))

const userResponse = (user) => ({
    id: user.id || user.UserMasterID,
    Usertype: user.Usertype,
    activestatus: String(user.activestatus),
    CompanyName: user.CompanyName,
    CompanyCode: user.CompanyCode,
    username: user.username,
    UserMasterID: user.UserMasterID,
    OrgMasterID: user.OrgMasterID,
    EmailID: user.EmailID
})

export const verifyLoginOtp = async (req, res) => {
    const { EmailID, otp } = req.body
    if (!EmailID || !isValidOtp(otp)) return res.status(400).json({ message: 'EmailID and a valid six-digit OTP are required.' })
    try {
        await poolConnect
        const request = pool.request()
        request.input('EmailID', sql.VarChar, EmailID)
        request.input('otp', sql.VarChar, otp)
        const result = await request.query(`SELECT TOP 1 * FROM Worktrialusers WHERE EmailID = @EmailID AND otp = @otp AND activestatus = 1 AND otpupdatedat >= DATEADD(MINUTE, -${OTP_EXPIRY_MINUTES}, GETDATE())`)
        if (!result.recordset.length) return res.status(401).json({ message: 'Invalid or expired OTP.' })
        const user = result.recordset[0]
        const clearRequest = pool.request()
        clearRequest.input('id', sql.Int, user.id)
        await clearRequest.query('UPDATE Worktrialusers SET otp = NULL, otpupdatedat = NULL WHERE id = @id')
        
        // Generate secure 10-minute session token with user payload
        const token = createSessionToken(user, req)
        return res.json({ message: 'Login successful', loginStatus: true, token, user: userResponse(user) })
    } catch (error) {
        console.error('Database error during login OTP verification:', error)
        return res.status(500).json({ message: 'Internal server error.' })
    }
}

export const verifyRegistrationOtp = async (req, res) => {
    const { EmailID, otp } = req.body
    if (!EmailID || !isValidOtp(otp)) return res.status(400).json({ message: 'EmailID and a valid six-digit OTP are required.' })
    try {
        await poolConnect
        const request = pool.request()
        request.input('EmailID', sql.VarChar, EmailID)
        request.input('otp', sql.VarChar, otp)
        const result = await request.query(`SELECT TOP 1 id, EmailID, FirstName, LastName, CompanyName FROM Worktrialusers WHERE EmailID = @EmailID AND otp = @otp AND activestatus = 0 AND otpupdatedat >= DATEADD(MINUTE, -${OTP_EXPIRY_MINUTES}, GETDATE())`)
        if (!result.recordset.length) return res.status(401).json({ message: 'Invalid or expired OTP.' })
        const user = result.recordset[0]
        const updateRequest = pool.request()
        updateRequest.input('id', sql.Int, user.id)
        await updateRequest.query('UPDATE Worktrialusers SET activestatus = 0, otp = NULL, otpupdatedat = NULL WHERE id = @id')

        let emailNotifications = { adminSent: false, clientSent: false }
        try {
            emailNotifications = await sendRegistrationNotifications(user)
            for (const emailError of emailNotifications.errors) {
                console.error('Registration email notification failed:', emailError)
            }
        } catch (emailError) {
            console.error('Registration email notifications could not be sent:', emailError)
        }

        return res.json({
            message: 'User registered successfully. Your account is under review.',
            registrationStatus: true,
            emailNotifications: {
                adminSent: emailNotifications.adminSent,
                clientSent: emailNotifications.clientSent
            }
        })
    } catch (error) {
        console.error('Database error during registration OTP verification:', error)
        return res.status(500).json({ message: 'Internal server error.' })
    }
}

export const requestPasswordReset = async (req, res) => {
    const { EmailID } = req.body
    if (!EmailID) return res.status(400).json({ message: 'EmailID is required.' })
    try {
        await poolConnect
        const request = pool.request()
        request.input('EmailID', sql.VarChar, EmailID)
        const result = await request.query('SELECT TOP 1 id, FirstName, LastName FROM Worktrialusers WHERE EmailID = @EmailID AND activestatus = 1')
        if (!result.recordset.length) return res.status(404).json({ message: 'No active account was found for that email.' })
        const otp = createOtp()
        const updateRequest = pool.request()
        updateRequest.input('id', sql.Int, result.recordset[0].id)
        updateRequest.input('otp', sql.VarChar, otp)
        await updateRequest.query('UPDATE Worktrialusers SET otp = @otp, otpupdatedat = GETDATE() WHERE id = @id')
        const user = result.recordset[0]
        await sendOtp(EmailID, otp, 'password reset', user.FirstName, user.LastName)
        return res.json({ message: 'A password reset OTP was sent to your email.', otpRequired: true })
    } catch (error) {
        console.error('Password reset OTP error:', error)
        return res.status(500).json({ message: 'Unable to send password reset OTP.' })
    }
}

export const resetPassword = async (req, res) => {
    const { EmailID, otp, password } = req.body
    if (!EmailID || !isValidOtp(otp) || !password) return res.status(400).json({ message: 'EmailID, OTP, and a new password are required.' })
    try {
        await poolConnect
        const request = pool.request()
        request.input('EmailID', sql.VarChar, EmailID)
        request.input('otp', sql.VarChar, otp)
        const result = await request.query(`SELECT TOP 1 id FROM Worktrialusers WHERE EmailID = @EmailID AND otp = @otp AND activestatus = 1 AND otpupdatedat >= DATEADD(MINUTE, -${OTP_EXPIRY_MINUTES}, GETDATE())`)
        if (!result.recordset.length) return res.status(401).json({ message: 'Invalid or expired OTP.' })
        const updateRequest = pool.request()
        updateRequest.input('id', sql.Int, result.recordset[0].id)
        updateRequest.input('password', sql.VarChar, password)
        await updateRequest.query('UPDATE Worktrialusers SET password = @password, otp = NULL, otpupdatedat = NULL WHERE id = @id')
        return res.json({ message: 'Password reset successfully.', resetStatus: true })
    } catch (error) {
        console.error('Password reset error:', error)
        return res.status(500).json({ message: 'Unable to reset password.' })
    }
}

export const verifyPasswordResetOtp = async (req, res) => {
    const { EmailID, otp } = req.body
    if (!EmailID || !isValidOtp(otp)) return res.status(400).json({ message: 'EmailID and a valid six-digit OTP are required.' })
    try {
        await poolConnect
        const request = pool.request()
        request.input('EmailID', sql.VarChar, EmailID)
        request.input('otp', sql.VarChar, otp)
        const result = await request.query(`SELECT TOP 1 id FROM Worktrialusers WHERE EmailID = @EmailID AND otp = @otp AND activestatus = 1 AND otpupdatedat >= DATEADD(MINUTE, -${OTP_EXPIRY_MINUTES}, GETDATE())`)
        if (!result.recordset.length) return res.status(401).json({ message: 'Invalid or expired OTP.' })
        const resetToken = jwt.sign({ purpose: 'password-reset', userId: result.recordset[0].id, EmailID }, JWT_SECRET, { expiresIn: '10m' })
        return res.json({ message: 'OTP verified. Enter your new password.', resetToken, otpVerified: true })
    } catch (error) {
        console.error('Password reset OTP verification error:', error)
        return res.status(500).json({ message: 'Unable to verify password reset OTP.' })
    }
}

export const updatePassword = async (req, res) => {
    const { EmailID, password, otp } = req.body
    if (!EmailID || !password || !otp) {
        return res.status(400).json({ message: 'EmailID, new password, and OTP are required.' })
    }
    try {
        await poolConnect
        const request = pool.request()
        request.input('EmailID', sql.VarChar, EmailID)
        request.input('otp', sql.VarChar, otp)
        request.input('password', sql.VarChar, password)
        const result = await request.query(
            `UPDATE Worktrialusers 
             SET password = @password, otp = NULL, otpupdatedat = NULL 
             WHERE EmailID = @EmailID AND otp = @otp AND activestatus = 1
               AND otpupdatedat >= DATEADD(MINUTE, -${OTP_EXPIRY_MINUTES}, GETDATE())`
        )
        if (!result.rowsAffected[0]) {
            return res.status(404).json({ message: 'Invalid OTP or account not found, or OTP has expired.' })
        }
        return res.json({ message: 'Password updated successfully.', passwordUpdated: true })
    } catch (error) {
        console.error('Password update error:', error)
        return res.status(500).json({ message: 'Unable to update password.' })
    }
}