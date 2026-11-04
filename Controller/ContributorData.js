import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'

// POST API handler for inserting or updating contributor records in WorktrailcontributorData, 
// and logging all submissions to WorktrailcontributorDataLog
export const ContributorData = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Support either a single object or an array of objects
    let contributors = req.body;
    if (!Array.isArray(contributors)) {
        contributors = [contributors];
    }

    contributors = [...contributors].reverse();


    // Validate all contributors
    let allMissingFields = [];
    let hasValidationError = false;

    contributors.forEach((contributor, idx) => {
        const missingFields = [];
        
        // Accept EmployeeCode as string or integer, but not undefined/null/empty string.
        // Also, allow EmployeeCode of 0 but not undefined/null/empty.
        if (contributor.EmployeeCode === undefined || contributor.EmployeeCode === null || contributor.EmployeeCode === '') {
            missingFields.push('EmployeeCode');
        }

        if (missingFields.length > 0) {
            allMissingFields.push({
                index: idx,
                missingFields
            });
            hasValidationError = true;
        }
    });

    if (hasValidationError) {
        return res.status(400).json({
            message: "Some contributor entries have missing required fields.",
            missingFields: allMissingFields
        });
    }

    try {
        await poolConnect;

        const results = [];
        for (let i = 0; i < contributors.length; i++) {
            const cOriginal = contributors[i];

            // Make a shallow copy so we don't affect input, and normalize EmployeeCode
            // Always use string as DB column is VarChar(50), but be robust about input
            const c = { ...cOriginal };
            if (typeof c.EmployeeCode === 'number') {
                c.EmployeeCode = c.EmployeeCode.toString();
            } else if (typeof c.EmployeeCode === 'string') {
                c.EmployeeCode = c.EmployeeCode.trim();
            }
            if (!c.EmployeeCode || !String(c.EmployeeCode).length) {
                results.push({
                    index: i,
                    status: 'fail',
                    message: 'EmployeeCode missing or invalid after normalization.',
                    error: 'EmployeeCode must be a non-empty string or integer.'
                });
                continue;
            }

            const now = new Date();

            // For date fields, we want to preserve the incoming exact string/format.
            // Pass whatever is given straight to the query parameter, do NOT convert to Date type.
            // So, we pass them as sql.VarChar instead of sql.Date.

            const logRequest = pool.request();
            logRequest.input('FirstName', sql.VarChar(100), c.FirstName);
            logRequest.input('MiddleName', sql.VarChar(100), c.MiddleName || null);
            logRequest.input('LastName', sql.VarChar(100), c.LastName);
            logRequest.input('Email', sql.VarChar(255), c.Email || null);
            logRequest.input('MobileNo', sql.VarChar(20), c.MobileNo || null);
            logRequest.input('Department', sql.VarChar(100), c.Department);
            logRequest.input('DateOfJoining', sql.VarChar(50), c.DateOfJoining); // PASS AS-IS STRING
            logRequest.input('LastPositionHeld', sql.VarChar(150), c.LastPositionHeld);
            logRequest.input('DateOfLeaving', sql.VarChar(50), c.DateOfLeaving); // PASS AS-IS STRING
            logRequest.input('LastSalaryAnnual', sql.Decimal(18, 2), c.LastSalaryAnnual || null);
            logRequest.input('EmployeeCode', sql.VarChar(50), c.EmployeeCode);
            logRequest.input('ExitFormalities', sql.VarChar(255), c.ExitFormalities || null);
            logRequest.input('EmploymentType', sql.VarChar(50), c.EmploymentType || null);
            logRequest.input('AnyBehaviourIssue', sql.VarChar(255), c.AnyBehaviourIssue || null);
            logRequest.input('EligibilityToRehire', sql.VarChar(50), c.EligibilityToRehire || null);
            logRequest.input('Contributor', sql.VarChar(500), c.Contributor);
            logRequest.input('CreatedAt', sql.DateTime, now);
            logRequest.input('CreatedBy', sql.VarChar(100), c.CreatedBy || null);
            logRequest.input('HRComments', sql.VarChar(50), c.HRComments || null);

            const logInsertQuery = `
                INSERT INTO WorktrailcontributorDataLog (
                    FirstName, MiddleName, LastName, Email, MobileNo, Department,
                    DateOfJoining, LastPositionHeld, DateOfLeaving, LastSalaryAnnual,
                    EmployeeCode, ExitFormalities, EmploymentType, AnyBehaviourIssue, EligibilityToRehire, Contributor,
                    CreatedAt, CreatedBy, HRComments
                )
                VALUES (
                    @FirstName, @MiddleName, @LastName, @Email, @MobileNo, @Department,
                    @DateOfJoining, @LastPositionHeld, @DateOfLeaving, @LastSalaryAnnual,
                    @EmployeeCode, @ExitFormalities, @EmploymentType, @AnyBehaviourIssue, @EligibilityToRehire, @Contributor,
                    @CreatedAt, @CreatedBy, @HRComments
                )
            `;
            try {
                await logRequest.query(logInsertQuery);
            } catch (logErr) {
                if (
                    logErr.originalError &&
                    logErr.originalError.info &&
                    logErr.originalError.info.number === 2627
                ) {
                    // Optional: silently ignore
                } else {
                    console.error("Error inserting into contributor log table", logErr);
                }
            }

            // New logic:
            // 1. Check if (EmployeeCode, Contributor) exists - update if so.
            // 2. Else, check if EmployeeCode exists (should be unique) - block if so.
            // 3. Else, insert (Contributor can be duplicate).

            let existsExact = false;

            let checkExactRequest = pool.request();
            checkExactRequest.input('EmployeeCode', sql.VarChar(50), c.EmployeeCode);
            checkExactRequest.input('Contributor', sql.VarChar(500), c.Contributor);
            const checkExactQuery = `
                SELECT TOP 1 * FROM WorktrailcontributorData WHERE EmployeeCode = @EmployeeCode AND Contributor = @Contributor
            `;
            try {
                const checkExactResult = await checkExactRequest.query(checkExactQuery);
                if (checkExactResult.recordset.length > 0) {
                    existsExact = true;
                }
            } catch (err) {
                results.push({
                    index: i,
                    status: 'fail',
                    message: "Failed to check for existing contributor data (EmployeeCode AND Contributor).",
                    error: err.message || err
                });
                continue;
            }

            const mainRequest = pool.request();
            mainRequest.input('FirstName', sql.VarChar(100), c.FirstName);
            mainRequest.input('MiddleName', sql.VarChar(100), c.MiddleName || null);
            mainRequest.input('LastName', sql.VarChar(100), c.LastName);
            mainRequest.input('Email', sql.VarChar(255), c.Email || null);
            mainRequest.input('MobileNo', sql.VarChar(20), c.MobileNo || null);
            mainRequest.input('Department', sql.VarChar(100), c.Department);
            mainRequest.input('DateOfJoining', sql.VarChar(50), c.DateOfJoining); // PASS AS-IS STRING
            mainRequest.input('LastPositionHeld', sql.VarChar(150), c.LastPositionHeld);
            mainRequest.input('DateOfLeaving', sql.VarChar(50), c.DateOfLeaving); // PASS AS-IS STRING
            mainRequest.input('LastSalaryAnnual', sql.Decimal(18, 2), c.LastSalaryAnnual || null);
            mainRequest.input('EmployeeCode', sql.VarChar(50), c.EmployeeCode);
            mainRequest.input('ExitFormalities', sql.VarChar(255), c.ExitFormalities || null);
            mainRequest.input('EmploymentType', sql.VarChar(50), c.EmploymentType || null);
            mainRequest.input('AnyBehaviourIssue', sql.VarChar(255), c.AnyBehaviourIssue || null);
            mainRequest.input('EligibilityToRehire', sql.VarChar(50), c.EligibilityToRehire || null);
            mainRequest.input('Contributor', sql.VarChar(500), c.Contributor);
            mainRequest.input('HRComments', sql.VarChar(50), c.HRComments || null);

            if (existsExact) {
                // Update using both EmployeeCode and Contributor
                const updateQuery = `
                    UPDATE WorktrailcontributorData SET
                        FirstName = @FirstName,
                        MiddleName = @MiddleName,
                        LastName = @LastName,
                        Email = @Email,
                        MobileNo = @MobileNo,
                        Department = @Department,
                        DateOfJoining = @DateOfJoining,
                        LastPositionHeld = @LastPositionHeld,
                        DateOfLeaving = @DateOfLeaving,
                        LastSalaryAnnual = @LastSalaryAnnual,
                        ExitFormalities = @ExitFormalities,
                        EmploymentType = @EmploymentType,
                        AnyBehaviourIssue = @AnyBehaviourIssue,
                        EligibilityToRehire = @EligibilityToRehire,
                        HRComments = @HRComments
                    WHERE 
                        EmployeeCode = @EmployeeCode AND Contributor = @Contributor
                `;
                try {
                    await mainRequest.query(updateQuery);
                    results.push({ index: i, status: 'updated_by_employeecode_contributor' });
                } catch (error) {
                    results.push({
                        index: i,
                        status: 'fail',
                        message: 'Failed to update contributor data (by EmployeeCode AND Contributor).',
                        error: error.message || error
                    });
                }
                continue;
            }

            // 2. Check if EmployeeCode exists in other row (which would violate unique constraint)
            let checkEmployeeCodeOnlyRequest = pool.request();
            checkEmployeeCodeOnlyRequest.input('EmployeeCode', sql.VarChar(50), c.EmployeeCode);
            const checkEmpCodeOnlyQuery = `
                SELECT TOP 1 * FROM WorktrailcontributorData WHERE EmployeeCode = @EmployeeCode
            `;
            let empCodeConflict = false;
            try {
                const empCodeOnlyResult = await checkEmployeeCodeOnlyRequest.query(checkEmpCodeOnlyQuery);
                if (empCodeOnlyResult.recordset.length > 0) {
                    empCodeConflict = true;
                }
            } catch (err) {
                results.push({
                    index: i,
                    status: 'fail',
                    message: "Failed to check for existing EmployeeCode.",
                    error: err.message || err
                });
                continue;
            }

            if (empCodeConflict) {
                results.push({
                    index: i,
                    status: 'fail',
                    message: `EmployeeCode already present, try a different one.`,
                    error: `Duplicate found on EmployeeCode.`
                });
                continue;
            }

            // 3. Now safe to insert even if Contributor is duplicate!
            const insertQuery = `
                INSERT INTO WorktrailcontributorData (
                    FirstName, MiddleName, LastName, Email, MobileNo, Department,
                    DateOfJoining, LastPositionHeld, DateOfLeaving, LastSalaryAnnual,
                    EmployeeCode, ExitFormalities, EmploymentType, AnyBehaviourIssue, EligibilityToRehire, Contributor, HRComments
                )
                VALUES (
                    @FirstName, @MiddleName, @LastName, @Email, @MobileNo, @Department,
                    @DateOfJoining, @LastPositionHeld, @DateOfLeaving, @LastSalaryAnnual,
                    @EmployeeCode, @ExitFormalities, @EmploymentType, @AnyBehaviourIssue, @EligibilityToRehire, @Contributor, @HRComments
                );
            `;
            try {
                await mainRequest.query(insertQuery);
                results.push({ index: i, status: 'inserted' });
            } catch (error) {
                let errorMessage = 'Failed to insert contributor data.';
                if (
                    error.originalError &&
                    error.originalError.info &&
                    error.originalError.info.message &&
                    (
                        error.originalError.info.message.toLowerCase().includes('unique') ||
                        error.originalError.info.message.toLowerCase().includes('duplicate key')
                    )
                ) {
                    errorMessage = 'EmployeeCode already present, try a different one.';
                }
                results.push({
                    index: i,
                    status: 'fail',
                    message: errorMessage,
                    error: error.originalError?.info?.message || error.message || error
                });
            }
        }

        // Return response based on success/failure
        if (results.every(r => r.status && !r.status.startsWith('fail'))) {
            return res.status(201).json({ message: 'Contributor data successfully processed.', results });
        } else if (results.every(r => r.status && r.status.startsWith('fail'))) {
            return res.status(409).json({
                message: 'Failed to process any contributor data.',
                results
            });
        } else {
            // Partial success (some inserted/updated, some failed)
            return res.status(207).json({
                message: 'Some contributor entries were not processed.',
                results
            });
        }
    } catch (outerError) {
        console.error('Error processing contributors in bulk:', outerError);
        return res.status(500).json({
            message: 'Internal server error while processing contributor data.',
            error: outerError.message || outerError
        });
    }
}