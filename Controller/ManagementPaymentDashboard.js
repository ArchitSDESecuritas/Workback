import { pool, sql, poolConnect } from '../DatabaseConfig/DB.js';

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
};

const allowedStatuses = new Map([
    ['all', 'All'],
    ['paid', 'Paid'],
    ['created', 'Created'],
    ['failed', 'Failed']
]);

export const ManagementPaymentDashboard = async (req, res) => {
    const {
        fromDate = null,
        toDate = null,
        status = 'All',
        invoiceStatus = 'All',
        search = '',
        organizationId = null,
        minAmount = null,
        maxAmount = null,
        page = 1,
        pageSize = 25
    } = req.body && typeof req.body === 'object' ? req.body : {};

    if ((fromDate !== null && !isValidDate(fromDate)) || (toDate !== null && !isValidDate(toDate))) {
        return res.status(400).json({ message: 'Dates must use the YYYY-MM-DD format.' });
    }
    if (fromDate && toDate && fromDate > toDate) {
        return res.status(400).json({ message: 'fromDate must be on or before toDate.' });
    }

    const normalizedInvoiceStatus = String(invoiceStatus).trim().toLowerCase();
    const invoiceStatuses = new Map([
        ['all', 'All'],
        ['pending', 'Pending'],
        ['generated', 'Generated'],
        ['downloaded', 'Downloaded']
    ]);
    if (!invoiceStatuses.has(normalizedInvoiceStatus)) {
        return res.status(400).json({ message: 'Invoice status must be All, Pending, Generated, or Downloaded.' });
    }

    const normalizedSearch = typeof search === 'string' ? search.trim() : '';
    if (normalizedSearch.length > 100) {
        return res.status(400).json({ message: 'Search text must be 100 characters or fewer.' });
    }

    const parsedOrganizationId = organizationId === null || organizationId === '' ? null : Number(organizationId);
    if (parsedOrganizationId !== null && (!Number.isInteger(parsedOrganizationId) || parsedOrganizationId <= 0)) {
        return res.status(400).json({ message: 'Organization ID must be a positive whole number.' });
    }

    const parseAmount = (value) => {
        if (value === null || value === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
    };
    const parsedMinAmount = parseAmount(minAmount);
    const parsedMaxAmount = parseAmount(maxAmount);
    if (Number.isNaN(parsedMinAmount) || Number.isNaN(parsedMaxAmount)) {
        return res.status(400).json({ message: 'Amount filters must be valid non-negative numbers.' });
    }
    if (parsedMinAmount !== null && parsedMaxAmount !== null && parsedMinAmount > parsedMaxAmount) {
        return res.status(400).json({ message: 'Minimum amount must not exceed maximum amount.' });
    }

    const normalizedStatus = allowedStatuses.get(String(status).trim().toLowerCase());
    if (!normalizedStatus) {
        return res.status(400).json({ message: 'Status must be All, Paid, Created, or Failed.' });
    }

    const numericPage = Number(page);
    const numericPageSize = Number(pageSize);
    if (!Number.isInteger(numericPage) || numericPage < 1 ||
        !Number.isInteger(numericPageSize) || numericPageSize < 1 || numericPageSize > 100 ||
        (numericPage - 1) * numericPageSize > 2147483647) {
        return res.status(400).json({ message: 'Page must be positive and pageSize must be between 1 and 100.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('fromDate', sql.Date, fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null);
        request.input('toDate', sql.Date, toDate ? new Date(`${toDate}T00:00:00.000Z`) : null);
        request.input('status', sql.VarChar(30), normalizedStatus);
        request.input('invoiceStatus', sql.VarChar(30), invoiceStatuses.get(normalizedInvoiceStatus));
        request.input('search', sql.NVarChar(102), normalizedSearch ? `%${normalizedSearch}%` : null);
        request.input('organizationId', sql.Int, parsedOrganizationId);
        request.input('minAmount', sql.Decimal(18, 2), parsedMinAmount);
        request.input('maxAmount', sql.Decimal(18, 2), parsedMaxAmount);
        request.input('offset', sql.Int, (numericPage - 1) * numericPageSize);
        request.input('pageSize', sql.Int, numericPageSize);

        const result = await request.query(`
            SELECT
                COUNT(*) AS TotalTransactions,
                SUM(CASE WHEN Status = 'Paid' THEN 1 ELSE 0 END) AS PaidTransactions,
                SUM(CASE WHEN Status = 'Created' THEN 1 ELSE 0 END) AS PendingTransactions,
                SUM(CASE WHEN Status = 'Failed' THEN 1 ELSE 0 END) AS FailedTransactions,
                COALESCE(SUM(CASE WHEN p.Status = 'Paid' THEN p.Amount ELSE 0 END), 0) AS PaidAmount,
                COALESCE(SUM(CASE WHEN p.Status = 'Paid' AND om.GSTPercent > 0
                    THEN ROUND(p.Amount * om.GSTPercent / (100.0 + om.GSTPercent), 2) ELSE 0 END), 0) AS GstAmount,
                COALESCE(SUM(CASE WHEN p.Status = 'Paid'
                    THEN p.Amount - CASE WHEN om.GSTPercent > 0
                        THEN ROUND(p.Amount * om.GSTPercent / (100.0 + om.GSTPercent), 2) ELSE 0 END
                    ELSE 0 END), 0) AS ActualAmount
            FROM PaymentTransactions p
            LEFT JOIN OrganizationMaster om ON om.OrganizationID = p.OrganizationID
            WHERE (@fromDate IS NULL OR p.CreatedAt >= @fromDate)
              AND (@toDate IS NULL OR p.CreatedAt < DATEADD(day, 1, @toDate))
              AND (@status = 'All' OR p.Status = @status)
              AND (@invoiceStatus = 'All' OR p.InvoiceStatus = @invoiceStatus)
              AND (@organizationId IS NULL OR p.OrganizationID = @organizationId)
              AND (@minAmount IS NULL OR p.Amount >= @minAmount)
              AND (@maxAmount IS NULL OR p.Amount <= @maxAmount)
              AND (@search IS NULL OR p.CandidateName LIKE @search OR p.Email LIKE @search
                   OR p.RazorpayOrderID LIKE @search OR p.RazorpayPaymentID LIKE @search);

            SELECT
                CAST(p.CreatedAt AS DATE) AS TransactionDate,
                COUNT(*) AS TransactionCount,
                SUM(CASE WHEN p.Status = 'Paid' THEN 1 ELSE 0 END) AS PaidCount,
                SUM(CASE WHEN p.Status <> 'Paid' THEN 1 ELSE 0 END) AS OtherCount,
                COALESCE(SUM(CASE WHEN p.Status = 'Paid' THEN p.Amount ELSE 0 END), 0) AS PaidAmount
            FROM PaymentTransactions p
            LEFT JOIN OrganizationMaster om ON om.OrganizationID = p.OrganizationID
            WHERE (@fromDate IS NULL OR p.CreatedAt >= @fromDate)
              AND (@toDate IS NULL OR p.CreatedAt < DATEADD(day, 1, @toDate))
              AND (@status = 'All' OR p.Status = @status)
              AND (@invoiceStatus = 'All' OR p.InvoiceStatus = @invoiceStatus)
              AND (@organizationId IS NULL OR p.OrganizationID = @organizationId)
              AND (@minAmount IS NULL OR p.Amount >= @minAmount)
              AND (@maxAmount IS NULL OR p.Amount <= @maxAmount)
              AND (@search IS NULL OR p.CandidateName LIKE @search OR p.Email LIKE @search
                   OR p.RazorpayOrderID LIKE @search OR p.RazorpayPaymentID LIKE @search)
            GROUP BY CAST(p.CreatedAt AS DATE)
            ORDER BY TransactionDate;

            SELECT
                p.Status,
                COUNT(*) AS TransactionCount,
                COALESCE(SUM(p.Amount), 0) AS TransactionAmount
            FROM PaymentTransactions p
            LEFT JOIN OrganizationMaster om ON om.OrganizationID = p.OrganizationID
            WHERE (@fromDate IS NULL OR p.CreatedAt >= @fromDate)
              AND (@toDate IS NULL OR p.CreatedAt < DATEADD(day, 1, @toDate))
              AND (@status = 'All' OR p.Status = @status)
              AND (@invoiceStatus = 'All' OR p.InvoiceStatus = @invoiceStatus)
              AND (@organizationId IS NULL OR p.OrganizationID = @organizationId)
              AND (@minAmount IS NULL OR p.Amount >= @minAmount)
              AND (@maxAmount IS NULL OR p.Amount <= @maxAmount)
              AND (@search IS NULL OR p.CandidateName LIKE @search OR p.Email LIKE @search
                   OR p.RazorpayOrderID LIKE @search OR p.RazorpayPaymentID LIKE @search)
            GROUP BY p.Status
            ORDER BY TransactionCount DESC;

            SELECT TOP 8
                COALESCE(om.OrganizationName, 'Unassigned') AS Organization,
                COUNT(*) AS TransactionCount,
                SUM(CASE WHEN p.Status = 'Paid' THEN 1 ELSE 0 END) AS PaidCount,
                COALESCE(SUM(CASE WHEN p.Status = 'Paid' THEN p.Amount ELSE 0 END), 0) AS PaidAmount
            FROM PaymentTransactions p
            LEFT JOIN OrganizationMaster om ON om.OrganizationID = p.OrganizationID
            WHERE (@fromDate IS NULL OR p.CreatedAt >= @fromDate)
              AND (@toDate IS NULL OR p.CreatedAt < DATEADD(day, 1, @toDate))
              AND (@status = 'All' OR p.Status = @status)
              AND (@invoiceStatus = 'All' OR p.InvoiceStatus = @invoiceStatus)
              AND (@organizationId IS NULL OR p.OrganizationID = @organizationId)
              AND (@minAmount IS NULL OR p.Amount >= @minAmount)
              AND (@maxAmount IS NULL OR p.Amount <= @maxAmount)
              AND (@search IS NULL OR p.CandidateName LIKE @search OR p.Email LIKE @search
                   OR p.RazorpayOrderID LIKE @search OR p.RazorpayPaymentID LIKE @search)
            GROUP BY om.OrganizationID, om.OrganizationName
            ORDER BY PaidAmount DESC, TransactionCount DESC;

            SELECT
                p.TransactionID, p.CandidateName, p.Email, p.Phone,
                COALESCE(om.OrganizationName, 'Unassigned') AS OrganizationName,
                p.Amount, p.Currency,
                COALESCE(om.GSTPercent, 0) AS GSTPercent,
                CASE WHEN om.GSTPercent > 0
                    THEN ROUND(p.Amount * om.GSTPercent / (100.0 + om.GSTPercent), 2)
                    ELSE 0 END AS GstAmount,
                p.Amount - CASE WHEN om.GSTPercent > 0
                    THEN ROUND(p.Amount * om.GSTPercent / (100.0 + om.GSTPercent), 2)
                    ELSE 0 END AS ActualAmount,
                p.RazorpayOrderID, p.RazorpayPaymentID, p.Status,
                p.InvoiceStatus, p.FailureReason, p.CreatedAt, p.PaidAt, p.UpdatedAt
            FROM PaymentTransactions p
            LEFT JOIN OrganizationMaster om ON om.OrganizationID = p.OrganizationID
            WHERE (@fromDate IS NULL OR p.CreatedAt >= @fromDate)
              AND (@toDate IS NULL OR p.CreatedAt < DATEADD(day, 1, @toDate))
              AND (@status = 'All' OR p.Status = @status)
              AND (@invoiceStatus = 'All' OR p.InvoiceStatus = @invoiceStatus)
              AND (@organizationId IS NULL OR p.OrganizationID = @organizationId)
              AND (@minAmount IS NULL OR p.Amount >= @minAmount)
              AND (@maxAmount IS NULL OR p.Amount <= @maxAmount)
              AND (@search IS NULL OR p.CandidateName LIKE @search OR p.Email LIKE @search
                   OR p.RazorpayOrderID LIKE @search OR p.RazorpayPaymentID LIKE @search)
            ORDER BY p.CreatedAt DESC, p.TransactionID DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
        `);

        const summary = result.recordsets[0][0];
        const totalRecords = Number(summary?.TotalTransactions || 0);

        return res.status(200).json({
            summary: {
                totalTransactions: totalRecords,
                paidTransactions: Number(summary?.PaidTransactions || 0),
                pendingTransactions: Number(summary?.PendingTransactions || 0),
                failedTransactions: Number(summary?.FailedTransactions || 0),
                paidAmount: Number(summary?.PaidAmount || 0),
                gstAmount: Number(summary?.GstAmount || 0),
                actualAmount: Number(summary?.ActualAmount || 0)
            },
            daily: result.recordsets[1],
            statusBreakdown: result.recordsets[2],
            organizations: result.recordsets[3],
            data: result.recordsets[4],
            pagination: {
                page: numericPage,
                pageSize: numericPageSize,
                totalRecords,
                totalPages: Math.ceil(totalRecords / numericPageSize)
            }
        });
    } catch (error) {
        console.error('Management payment dashboard query failed:', error);
        return res.status(500).json({ message: 'Unable to load payment dashboard data.' });
    }
};
