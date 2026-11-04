import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

/**
 * @route POST /contributor-service-request
 * @desc Gets dynamic mapped data for a given Contributor with filters.
 *       Only Contributor is required; all other params are optional.
 *
 * @body {
 *   Contributor: string,
 *   Status?: string,
 *   Downloadstatus?: string|number,
 *   ClientEmail?: string,
 *   CreatedAt?: string,
 *   EmployeeCode?: string
 * }
 */
export const ContributorServiceRequest = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({
            message: 'Method Not Allowed'
        });
    }

    const {
        Contributor,
        Status = '',
        Downloadstatus = '',
        ClientEmail = null,
        CreatedAt = null,
        EmployeeCode = null
    } = req.body || {};

    if (!Contributor) {
        return res.status(400).json({
            message: "'Contributor' is required in the request body"
        });
    }

    try {
        await poolConnect;

        // Get dynamic field list for this contributor
        const mapResult = await pool.request()
            .input('Contributor', sql.NVarChar(100), Contributor)
            .query(`
                SELECT Id, DBFieldName, DisplayFieldName
                FROM WorktrailColumnsmap
                WHERE Contributor = @Contributor
            `);

        const dbFieldNames = mapResult.recordset.map(row => row.DBFieldName);

        if (dbFieldNames.length === 0) {
            return res.status(404).json({
                message: `No mapped columns found for Contributor '${Contributor}'.`
            });
        }

        // Build CASE WHEN dynamically
        const caseWhen = dbFieldNames.map(name => {
            // Escape single quotes in column name
            const safeName = name.replace(/'/g, "''");

            return `WHEN '${safeName}' THEN CAST(CD.[${name}] AS NVARCHAR(MAX))`;
        }).join('\n');

        // Main dynamic SQL
        const dynamicSql = `
SELECT
    CM.Id,
    CM.DBFieldName,
    CM.DisplayFieldName,
    V.DBFieldData
FROM WorktrailColumnsmap CM
CROSS APPLY
(
    SELECT
        CASE CM.DBFieldName
${caseWhen}
        END AS DBFieldData
    FROM WorktrailclientData CD
    WHERE CD.Contributor = @pContributor
      AND (NULLIF(@pStatus, '') IS NULL OR CD.Status = @pStatus)
      AND (NULLIF(@pDownloadstatus, '') IS NULL OR CD.DownloadStatus = @pDownloadstatus)
      AND (NULLIF(@pClientEmail, '') IS NULL OR CD.Clientemail = @pClientEmail)
      AND (
            @pCreatedAt IS NULL
            OR CONVERT(DATE, CD.CreatedAt) = CONVERT(DATE, @pCreatedAt)
          )
      AND (
            NULLIF(@pEmployeeCode, '') IS NULL
            OR CD.EmployeeCode = @pEmployeeCode
          )
) V
WHERE CM.Contributor = @pContributor
        `.trim();

        const execParams = {
            pContributor: {
                type: sql.NVarChar(100),
                value: Contributor
            },
            pStatus: {
                type: sql.NVarChar(100),
                value: Status
            },
            pDownloadstatus: {
                type: sql.NVarChar(100),
                value: Downloadstatus === undefined
                    ? ''
                    : String(Downloadstatus)
            },
            pClientEmail: {
                type: sql.NVarChar(200),
                value: ClientEmail
            },
            pCreatedAt: {
                type: sql.DateTime,
                value: CreatedAt ? new Date(CreatedAt) : null
            },
            pEmployeeCode: {
                type: sql.NVarChar(100),
                value: EmployeeCode
            }
        };

        const paramDef = `
@pContributor NVARCHAR(100),
@pStatus NVARCHAR(100),
@pDownloadstatus NVARCHAR(100),
@pClientEmail NVARCHAR(200),
@pCreatedAt DATETIME,
@pEmployeeCode NVARCHAR(100)
        `.trim();

        const request = pool.request();

        request.input(
            'pContributor',
            execParams.pContributor.type,
            execParams.pContributor.value
        );

        request.input(
            'pStatus',
            execParams.pStatus.type,
            execParams.pStatus.value
        );

        request.input(
            'pDownloadstatus',
            execParams.pDownloadstatus.type,
            execParams.pDownloadstatus.value
        );

        request.input(
            'pClientEmail',
            execParams.pClientEmail.type,
            execParams.pClientEmail.value
        );

        request.input(
            'pCreatedAt',
            execParams.pCreatedAt.type,
            execParams.pCreatedAt.value
        );

        request.input(
            'pEmployeeCode',
            execParams.pEmployeeCode.type,
            execParams.pEmployeeCode.value
        );

        const execSql = `
            DECLARE @SQL NVARCHAR(MAX) = N'${dynamicSql.replace(/'/g, "''")}';

            EXEC sp_executesql
                @SQL,
                N'${paramDef}',
                @pContributor = @pContributor,
                @pStatus = @pStatus,
                @pDownloadstatus = @pDownloadstatus,
                @pClientEmail = @pClientEmail,
                @pCreatedAt = @pCreatedAt,
                @pEmployeeCode = @pEmployeeCode;
        `;

        const result = await request.query(execSql);

        const records = result.recordset || [];

        /*
         * Group records by EmployeeCode.
         *
         * Every employee starts when DBFieldName === 'EmployeeCode'.
         */
        const groupedData = [];

        records.forEach((item) => {
            if (item.DBFieldName === 'EmployeeCode') {
                groupedData.push([item]);
            } else if (groupedData.length > 0) {
                groupedData[groupedData.length - 1].push(item);
            }
        });

        return res.status(200).json({
            data: groupedData,
            message: "Data fetched successfully"
        });

    } catch (error) {
        console.error(
            'Error in ContributorServiceRequest:',
            error
        );

        return res.status(500).json({
            message: 'Internal Server Error',
            error: error.message || error
        });
    }
};
