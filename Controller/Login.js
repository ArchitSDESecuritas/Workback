import express from 'express'
import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'
import { createOtp, sendOtp } from '../Services/OtpService.js'

export const Login = async (req, res) => {
    const { EmailID, password } = req.body;
    if (!EmailID || !password) {
        return res.status(400).json({ 
            message: 'EmailID and password are required.', 
            loginStatus: false 
        });
    }
    try {
        await poolConnect;
        const request = pool.request();
        request.input('EmailID', sql.VarChar, EmailID);
        request.input('password', sql.VarChar, password);
        // Assuming Worktrialusers table with columns: EmailID and password
        const result = await request.query(
            'SELECT * FROM Worktrialusers WHERE EmailID = @EmailID AND password = @password'
        );
        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            if (String(user.activestatus ?? '1') !== '1') {
                return res.status(403).json({
                    message: 'Your account is currently inactive. Please wait 24 hours if you have any query please connect Worktrail.',
                    loginStatus: false
                });
            }
            const otp = createOtp();
            const otpRequest = pool.request();
            otpRequest.input('id', sql.Int, user.id);
            otpRequest.input('otp', sql.VarChar, otp);
            await otpRequest.query('UPDATE Worktrialusers SET otp = @otp, otpupdatedat = GETDATE() WHERE id = @id');
            await sendOtp(EmailID, otp, 'login', user.FirstName, user.LastName);
            return res.status(200).json({ 
                message: 'A login OTP was sent to your email.',
                EmailID,
                otpRequired: true,
                user: {
                    id: user.id,
                    EmailID: user.EmailID,
                    Usertype: user.Usertype,
                    activestatus: user.activestatus,
                    CompanyName: user.CompanyName,
                    CompanyCode: user.CompanyCode,
                    username: user.username,
                    UserMasterID: user.UserMasterID,
                    OrgMasterID: user.OrgMasterID
                }
            });
       
        } else {
            return res.status(401).json({ 
                message: 'Invalid EmailID or password',
                loginStatus: false
            });
        }
    } catch (error) {
        console.error('Database error during login:', error);
        return res.status(500).json({ 
            message: 'Internal server error',
            loginStatus: false
        });
    }
}