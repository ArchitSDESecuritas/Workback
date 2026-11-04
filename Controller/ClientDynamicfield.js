import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const ClientDynamicfield = async (req, res) => {
    // Accept only POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { contributor } = req.body;

    if (!contributor || typeof contributor !== 'string') {
        return res.status(400).json({
            message: 'Contributor is required in body'
        });
    }

    try {
        await poolConnect;

        const request = pool.request();

        request.input(
            'Contributor',
            sql.VarChar(100),
            contributor
        );

        const dynamicColumnSQL = `
            DECLARE @Columns TABLE (
                ColumnName SYSNAME,
                ColumnOrder INT
            );

            INSERT INTO @Columns (ColumnName, ColumnOrder)
            SELECT
                c.name,
                c.column_id
            FROM sys.columns c
            WHERE c.object_id = OBJECT_ID('WorktrailcontributorData')
  AND c.name NOT IN ('Sno', 'CreatedAt')
              AND EXISTS (
                    SELECT 1
                    FROM WorktrailcontributorData w
                    WHERE w.Contributor = @Contributor
                      AND NULLIF(
                            LTRIM(
                                RTRIM(
                                    CONVERT(NVARCHAR(MAX), 
                                        CASE c.name
                                            WHEN 'FirstName' THEN w.FirstName
                                            WHEN 'MiddleName' THEN w.MiddleName
                                            WHEN 'LastName' THEN w.LastName
                                            WHEN 'Email' THEN w.Email
                                            WHEN 'MobileNo' THEN CONVERT(NVARCHAR(MAX), w.MobileNo)
                                            WHEN 'Department' THEN w.Department
                                            WHEN 'DateOfJoining' THEN CONVERT(NVARCHAR(MAX), w.DateOfJoining)
                                            WHEN 'LastPositionHeld' THEN w.LastPositionHeld
                                            WHEN 'DateOfLeaving' THEN CONVERT(NVARCHAR(MAX), w.DateOfLeaving)
                                            WHEN 'LastSalaryAnnual' THEN CONVERT(NVARCHAR(MAX), w.LastSalaryAnnual)
                                            WHEN 'EmployeeCode' THEN w.EmployeeCode
                                            WHEN 'ExitFormalities' THEN w.ExitFormalities
                                            WHEN 'EmploymentType' THEN w.EmploymentType
                                            WHEN 'AnyBehaviourIssue' THEN w.AnyBehaviourIssue
                                            WHEN 'EligibilityToRehire' THEN w.EligibilityToRehire
                                            WHEN 'Contributor' THEN w.Contributor
                                            WHEN 'CreatedAt' THEN CONVERT(NVARCHAR(MAX), w.CreatedAt)
                                            WHEN 'CreatedBy' THEN w.CreatedBy
                                            WHEN 'UpdatedDate' THEN CONVERT(NVARCHAR(MAX), w.UpdatedDate)
                                            WHEN 'UpdatedBy' THEN w.UpdatedBy
                                        END
                                    )
                                )
                            ),
                            ''
                        ) IS NOT NULL
                );

            SELECT ColumnName
            FROM @Columns
            ORDER BY ColumnOrder;
        `;

        const result = await request.query(dynamicColumnSQL);

        const columns = result.recordset.map(row => row.ColumnName);

        return res.status(200).json({
            columns
        });

    } catch (error) {
        console.error('Error in ClientDynamicfield:', error);

        return res.status(500).json({
            message: 'Internal Server Error',
            error: error.message
        });
    }
};
