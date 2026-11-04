import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

/**
 * Compare contributor and client data for a given contributor and employee code.
 * Expects { contributor, employeeCode } in POST body.
 */
export const ReviewClientData = async (req, res) => {
    // Accept only POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { contributor, employeeCode, orderId } = req.body;
    if (orderId) {
        try {
            await poolConnect;
            const request = pool.request();
            request.input('OrderID', sql.VarChar(500), orderId);
            const result = await request.query(`
                SELECT Sno, FirstName, MiddleName, LastName, Email, MobileNo,
                       Department, DateOfJoining, LastPositionHeld, DateOfLeaving,
                       LastSalaryAnnual, EmployeeCode, Contributor, OrderID,
                       Clientemail, LOA, SupportingDocs, Status, CreatedAt
                FROM WorktrailclientData
                WHERE OrderID = @OrderID
                ORDER BY Sno
            `);
            return res.status(200).json({ data: result.recordset || [] });
        } catch (error) {
            console.error('Error reviewing client order:', error);
            return res.status(500).json({ message: 'Unable to retrieve candidate data.' });
        }
    }
    if (!contributor || !employeeCode) {
        return res.status(400).json({
            message: 'contributor and employeeCode are required in body',
        });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Contributor', sql.NVarChar(100), contributor);
        request.input('EmployeeCode', sql.NVarChar(100), employeeCode);

        // Fix: Do not DECLARE the same parameter variables within query batch!
        // Instead, use only parameterized variables within sp_executesql context.

        const reviewSql = `
           DECLARE @Columns TABLE
(
    ColumnName SYSNAME,
    ColumnOrder INT
);

-- Get only mapped columns for contributor
INSERT INTO @Columns
(
    ColumnName,
    ColumnOrder
)
SELECT
    c.name,
    c.column_id
FROM sys.columns c
INNER JOIN WorktrailColumnsMap m
    ON m.DBFieldName = c.name
WHERE c.object_id = OBJECT_ID('WorktrailcontributorData')
  AND m.Contributor = @Contributor
  AND c.name NOT IN
  (
      'Contributor',
      'EmployeeCode'
  );

DECLARE @Values NVARCHAR(MAX);
DECLARE @SQL NVARCHAR(MAX);

SELECT
    @Values =
        STRING_AGG
        (
            CAST
            (
                '(' +
                '''' + REPLACE(ColumnName, '''', '''''') + ''',' +
                'CONVERT(NVARCHAR(MAX),w.' + QUOTENAME(ColumnName) + '),' +
                '''' + REPLACE(ColumnName, '''', '''''') + ''',' +
                'CONVERT(NVARCHAR(MAX),wc.' + QUOTENAME(ColumnName) + ')' +
                ')'
                AS NVARCHAR(MAX)
            ),
            ','
        )
        WITHIN GROUP (ORDER BY ColumnOrder)
FROM @Columns;

SET @SQL = N'

SELECT
    v.ContributorColumn,
    v.ContributorData,
    v.ClientColumn,
    v.ClientData

FROM WorktrailcontributorData w

FULL OUTER JOIN Worktrailclientdata wc
    ON wc.Contributor = w.Contributor
   AND wc.EmployeeCode = w.EmployeeCode

CROSS APPLY
(
    VALUES

    (
        ''EmployeeCode'',
        CONVERT(NVARCHAR(MAX),w.EmployeeCode),
        ''EmployeeCode'',
        CONVERT(NVARCHAR(MAX),wc.EmployeeCode)
    )'

    + CASE
        WHEN ISNULL(@Values,'''') <> ''''
        THEN ',' + @Values
        ELSE ''''
      END +

N'

) v
(
    ContributorColumn,
    ContributorData,
    ClientColumn,
    ClientData
)

WHERE
(
    (
        w.Contributor = @Contributor
        AND w.EmployeeCode = @EmployeeCode
    )
    OR
    (
        wc.Contributor = @Contributor
        AND wc.EmployeeCode = @EmployeeCode
    )
)

AND
(
    NULLIF(LTRIM(RTRIM(v.ContributorData)),'''') IS NOT NULL
    OR
    NULLIF(LTRIM(RTRIM(v.ClientData)),'''') IS NOT NULL
)

ORDER BY
    CASE
        WHEN v.ContributorColumn = ''EmployeeCode'' THEN 0
        ELSE 1
    END,
    v.ContributorColumn;
';

EXEC sp_executesql
    @SQL,
    N'@Contributor NVARCHAR(100),
      @EmployeeCode NVARCHAR(100)',
    @Contributor = @Contributor,
    @EmployeeCode = @EmployeeCode;

        `;

        const result = await request.query(reviewSql);

        return res.status(200).json({
            data: result.recordset || [],
        });
    } catch (error) {
        console.error('Error in ReviewClientData:', error);
        return res.status(500).json({
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};