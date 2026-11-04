import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const CreateFacilitator = async (req, res) => {
    // Expects body: { UserName, Password, EmailID, FirstName, LastName }
    const { 
        UserName, 
        Password, 
        EmailID, 
        FirstName, 
        LastName 
    } = req.body;

    // Check required fields (ActiveStatus and UserType are now hardcoded)
    if (
        !UserName ||
        !Password ||
        !EmailID ||
        !FirstName ||
        !LastName
    ) {
        return res.status(400).json({ error: "All fields are required: UserName, Password, EmailID, FirstName, LastName" });
    }

    // Hardcoded values
    const ActiveStatus = 1;
    const UserType = 'Fascilator';

    try {
        await poolConnect;
        const result = await pool.request()
            .input('UserName', sql.NVarChar, UserName)
            .input('Password', sql.NVarChar, Password)
            .input('ActiveStatus', sql.Int, ActiveStatus)
            .input('UserType', sql.NVarChar, UserType)
            .input('EmailID', sql.NVarChar, EmailID)
            .input('FirstName', sql.NVarChar, FirstName)
            .input('LastName', sql.NVarChar, LastName)
            .query(`
                INSERT INTO Worktrialusers (
                    UserName,
                    Password,
                    ActiveStatus,
                    UserType,
                    EmailID,
                    FirstName,
                    LastName
                )
                VALUES (
                    @UserName,
                    @Password,
                    @ActiveStatus,
                    @UserType,
                    @EmailID,
                    @FirstName,
                    @LastName
                )
            `);

        res.status(201).json({ message: "Facilitator created successfully." });
    } catch (error) {
        res.status(500).json({ error: "Failed to create facilitator", details: error.message });
    }
};