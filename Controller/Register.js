import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'
import { createOtp, sendOtp } from '../Services/OtpService.js'

export const Register = async (req, res) => {
    const {
        username,
        password,
        UserType,
        EmailID,
        FirstName,
        LastName,
        CompanyName,
        CompanyCode,
        GSTNumber,
        Address,
        City,
        State,
        Country,
        ZIPcode,
        OrgMasterID,
        UserMasterID
    } = req.body;

    const normalizedEmail = typeof EmailID === 'string' ? EmailID.trim() : '';

    // Basic validation
    if (!username || !password || !UserType || !normalizedEmail) {
        return res.status(400).json({ message: 'Username, password, UserType, and EmailID are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    let transaction;
    let transactionCommitted = false;
    try {
        await poolConnect;
        transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request = new sql.Request(transaction);
        request.input('username', sql.VarChar, username);
        request.input('password', sql.VarChar, password);
        request.input('Usertype', sql.VarChar, UserType);
        request.input('EmailID', sql.VarChar, normalizedEmail);
        request.input('FirstName', sql.VarChar, FirstName || null);
        request.input('LastName', sql.VarChar, LastName || null);
        request.input('CompanyName', sql.VarChar, CompanyName || null);
        request.input('CompanyCode', sql.VarChar, CompanyCode || null);
        request.input('GSTNumber', sql.VarChar, GSTNumber || null);
        request.input('Address', sql.VarChar, Address || null);
        request.input('City', sql.VarChar, City || null);
        request.input('State', sql.VarChar, State || null);
        request.input('Country', sql.VarChar, Country || null);
        request.input('ZIPcode', sql.VarChar, ZIPcode || null);
        request.input('OrgMasterID', sql.Int, typeof OrgMasterID !== 'undefined' ? OrgMasterID : null);
        request.input('UserMasterID', sql.Int, typeof UserMasterID !== 'undefined' ? UserMasterID : null);

        const existingUser = await request.query(`
            SELECT TOP 1 id
            FROM Worktrialusers WITH (UPDLOCK, HOLDLOCK)
            WHERE LOWER(LTRIM(RTRIM(EmailID))) = LOWER(@EmailID)
        `);
        if (existingUser.recordset.length) {
            await transaction.rollback();
            return res.status(409).json({ message: 'This email is already used. Enter a different email.' });
        }

        const otp = createOtp();
        request.input('otp', sql.VarChar, otp);

        // Insert query (assumes the primary key [id] is auto-increment)
        // Added new fields OrgMasterID and UserMasterID to the insert list
        const insertQuery = `
            INSERT INTO Worktrialusers 
            (username, password, Usertype, EmailID, FirstName, LastName, CompanyName, CompanyCode, GSTNumber, Address, City, State, Country, ZIPcode, OrgMasterID, UserMasterID, created_at, activestatus, otp, otpupdatedat)
            VALUES (
                @username, @password, @Usertype, @EmailID, @FirstName, @LastName, @CompanyName, @CompanyCode, @GSTNumber, @Address, @City, @State, @Country, @ZIPcode, 
                @OrgMasterID, @UserMasterID, GETDATE(), 0, @otp, GETDATE()
            )
        `;

        await request.query(insertQuery);
        await transaction.commit();
        transactionCommitted = true;

        await sendOtp(normalizedEmail, otp, 'registration', FirstName, LastName);
        return res.status(201).json({ message: 'A registration OTP was sent to your email.', otpRequired: true });
    } catch (error) {
        if (transaction && !transactionCommitted) {
            try { await transaction.rollback(); } catch (rollbackError) {
                console.error('Registration rollback failed:', rollbackError);
            }
        }
        console.error('Database error during registration:', error);
        // Respond with the actual error message for transparency
        return res.status(500).json({ 
            message: 'Error during registration',
            error: error.message || error 
        });
    }
}