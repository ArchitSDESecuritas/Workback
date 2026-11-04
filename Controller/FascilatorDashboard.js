import { sql, pool, poolConnect } from "../DatabaseConfig/DB.js";

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');

export async function FascilatorDashboard(req, res) {
    const facilitatorId = Number(req.user?.id || req.user?.userId || req.user?.UserMasterID);

    if (!Number.isInteger(facilitatorId) || facilitatorId <= 0) {
        return res.status(400).json({
            error: "The authenticated facilitator ID is missing or invalid."
        });
    }

    try {
        await poolConnect;

        const result = await pool.request()
            .input('FacilitatorId', sql.Int, facilitatorId)
            .query(`
                SELECT DISTINCT candidate.Sno, candidate.Status, candidate.Downloadstatus, candidate.CreatedAt
                FROM WorktrailclientData AS candidate
                WHERE EXISTS (
                    SELECT 1
                    FROM FacilitatorOrgMap AS mapping
                    WHERE mapping.FacilitatorId = @FacilitatorId
                      AND mapping.LockedStatus = 1
                      AND LTRIM(RTRIM(mapping.OrganizationName)) =
                          LTRIM(RTRIM(candidate.Contributor))
                )
            `);

        const counts = result.recordset.reduce((summary, record) => {
            const status = normalizeStatus(record.Status);
            summary.total += 1;
            if (status === 'pending') summary.pending += 1;
            if (status === 'inprogress') summary.inProgress += 1;
            if (status === 'approved') summary.approved += 1;
            if (status === 'downloaded') summary.downloaded += 1;
            if (status === 'appeal') summary.appeal += 1;
            if (status === 'rejected') summary.rejected += 1;
            if (String(record.Downloadstatus ?? '').trim() === '1') summary.downloadStatusComplete += 1;
            return summary;
        }, {
            total: 0,
            pending: 0,
            inProgress: 0,
            approved: 0,
            downloaded: 0,
            appeal: 0,
            rejected: 0,
            downloadStatusComplete: 0
        });

        return res.status(200).json({
            data: result.recordset,
            counts
        });

    } catch (error) {
        console.error('Error fetching FascilatorDashboard data:', error);
        return res.status(500).json({
            error: 'Failed to fetch FascilatorDashboard data',
            details: error.message
        });
    }
}