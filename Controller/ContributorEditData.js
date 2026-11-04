import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js'

export const ContributorEditData = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Get Contributor and EmployeeCode from request
    const { Contributor, EmployeeCode } = req.body;

    if (!Contributor || !EmployeeCode) {
        return res.status(400).json({
            message: 'Both Contributor and EmployeeCode must be provided in the request body.'
        });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Contributor', sql.VarChar(100), Contributor);
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode);

        // Dynamic SQL to gather all mapped fields
        const tsql = `
DECLARE @SQL NVARCHAR(MAX) = '';

SELECT @SQL = @SQL + '
SELECT
    ''' + DBFieldName + ''' AS DBFieldName,
    ''' + DisplayFieldName + ''' AS DisplayFieldName,
    CAST(WCD.' + QUOTENAME(DBFieldName) + ' AS NVARCHAR(MAX)) AS DBFieldData
FROM WorktrailcontributorData WCD
WHERE WCD.Contributor = @Contributor
  AND WCD.EmployeeCode = @EmployeeCode
UNION ALL
'
FROM WorktrailColumnsmap
WHERE Contributor = @Contributor;

-- Remove trailing UNION ALL for valid SQL
SET @SQL = LEFT(@SQL, LEN(@SQL) - 11);

EXEC sp_executesql
    @SQL,
    N'@Contributor VARCHAR(100), @EmployeeCode VARCHAR(50)',
    @Contributor = @Contributor,
    @EmployeeCode = @EmployeeCode;
        `;

        const result = await request.query(tsql);

        // result.recordsets may contain multiple recordsets, so flatten into a single array
        let records = [];
        if (Array.isArray(result.recordsets)) {
            for (const rs of result.recordsets) {
                if (Array.isArray(rs)) {
                    records.push(...rs);
                }
            }
        } else if (Array.isArray(result.recordset)) {
            records = result.recordset;
        }

        return res.status(200).json({
            message: 'Contributor edit data fetched successfully.',
            data: records
        });
    } catch (error) {
        console.error('Error fetching contributor edit data:', error);
        return res.status(500).json({
            message: 'Internal server error.',
            error: error.message || error
        });
    }
}