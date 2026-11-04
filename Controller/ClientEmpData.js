import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

const requiredFields = ['EmployeeCode'];

const valueOrNull = (value) => value === undefined || value === '' ? null : value;

const databaseDate = (value) => value && !Number.isNaN(Date.parse(value)) ? value : new Date();

export const ClientEmpData = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { orderId, Clientemail, Contributor, candidates } = body;
    const rows = Array.isArray(candidates) ? candidates : [body.candidate || body];

    if (!orderId || !Clientemail || !Contributor || rows.length === 0) {
        return res.status(400).json({
            message: 'orderId, Clientemail, Contributor, and candidate data are required.'
        });
    }

    const invalidRows = rows.map((candidate, index) => {
        const missingFields = requiredFields.filter((field) => !candidate?.[field]);
        return missingFields.length ? { index, missingFields: [...new Set(missingFields)] } : null;
    }).filter(Boolean);

    if (invalidRows.length) {
        return res.status(400).json({ message: 'Required candidate fields are missing or invalid.', invalidRows });
    }

    let transaction;
    try {
        await poolConnect;

        const paymentRequest = pool.request();
        paymentRequest.input('OrderID', sql.VarChar(500), orderId);
        const paymentResult = await paymentRequest.query(`
            SELECT TOP 1 Status
            FROM PaymentTransactions
            WHERE RazorpayOrderID = @OrderID
        `);

        if (!paymentResult.recordset.length || paymentResult.recordset[0].Status !== 'Paid') {
            return res.status(402).json({ message: 'Candidate data can only be saved after successful payment.' });
        }

        const duplicateRequest = pool.request();
        duplicateRequest.input('OrderID', sql.VarChar(500), orderId);
        const duplicateResult = await duplicateRequest.query(`
            SELECT TOP 1 Sno FROM WorktrailclientData WHERE OrderID = @OrderID
        `);
        if (duplicateResult.recordset.length) {
            return res.status(409).json({ message: 'Candidate data has already been saved for this payment order.' });
        }

        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const results = [];
        for (let index = 0; index < rows.length; index += 1) {
            const candidate = rows[index];
            const request = new sql.Request(transaction);
            request.input('FirstName', sql.VarChar(100), valueOrNull(candidate.FirstName) || '');
            request.input('MiddleName', sql.VarChar(100), valueOrNull(candidate.MiddleName));
            request.input('LastName', sql.VarChar(100), valueOrNull(candidate.LastName) || '');
            request.input('Email', sql.VarChar(255), valueOrNull(candidate.Email));
            request.input('MobileNo', sql.VarChar(20), valueOrNull(candidate.MobileNo));
            request.input('Department', sql.VarChar(100), valueOrNull(candidate.Department) || '');
            request.input('DateOfJoining', sql.Date, databaseDate(candidate.DateOfJoining));
            request.input('LastPositionHeld', sql.VarChar(150), valueOrNull(candidate.LastPositionHeld) || '');
            request.input('DateOfLeaving', sql.Date, databaseDate(candidate.DateOfLeaving));
            request.input('LastSalaryAnnual', sql.Decimal(18, 2), valueOrNull(candidate.LastSalaryAnnual));
            request.input('EmployeeCode', sql.VarChar(50), candidate.EmployeeCode);
            request.input('ExitFormalities', sql.VarChar(255), valueOrNull(candidate.ExitFormalities));
            request.input('EmploymentType', sql.VarChar(50), valueOrNull(candidate.EmploymentType));
            request.input('AnyBehaviourIssue', sql.VarChar(255), valueOrNull(candidate.AnyBehaviourIssue));
            request.input('EligibilityToRehire', sql.VarChar(50), valueOrNull(candidate.EligibilityToRehire));
            request.input('Contributor', sql.VarChar(500), Contributor);
            request.input('OrderID', sql.VarChar(500), orderId);
            request.input('Clientemail', sql.VarChar(500), Clientemail);
            request.input('LOA', sql.VarChar(sql.MAX), null);
            request.input('SupportingDocs', sql.VarChar(sql.MAX), null);
            request.input('Status', sql.VarChar(30), 'Pending');
            request.input('CreatedAt', sql.DateTime, new Date());

            // Set HRComments to the literal string "dfjjkfnwkf"
            request.input('HRComments', sql.VarChar(sql.MAX), (candidate.HRComments));

            // Add the new column with some value; for demo, let's call it 'NewColumnName'
            // and set its value as null for now (you should update to your proper value)
           

            await request.query(`
                INSERT INTO WorktrailclientData (
                    FirstName, MiddleName, LastName, Email, MobileNo, Department,
                    DateOfJoining, LastPositionHeld, DateOfLeaving, LastSalaryAnnual,
                    EmployeeCode, ExitFormalities, EmploymentType, AnyBehaviourIssue,
                    EligibilityToRehire, Contributor, OrderID, Clientemail, LOA, SupportingDocs, Status, CreatedAt, HRComments
                ) VALUES (
                    @FirstName, @MiddleName, @LastName, @Email, @MobileNo, @Department,
                    @DateOfJoining, @LastPositionHeld, @DateOfLeaving, @LastSalaryAnnual,
                    @EmployeeCode, @ExitFormalities, @EmploymentType, @AnyBehaviourIssue,
                    @EligibilityToRehire, @Contributor, @OrderID, @Clientemail, @LOA, @SupportingDocs, @Status, @CreatedAt, @HRComments
                )
            `);
            results.push({ index, status: 'inserted' });
        }

        await transaction.commit();
        return res.status(201).json({ message: 'Candidate data saved successfully.', results });
    } catch (error) {
        if (transaction) {
            try { await transaction.rollback(); } catch (rollbackError) { console.error('Client data rollback failed:', rollbackError); }
        }
        console.error('Error inserting client candidate data:', error);
        return res.status(500).json({ message: 'Unable to save candidate data.', error: error.message || error });
    }
};