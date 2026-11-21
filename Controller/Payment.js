import crypto from 'crypto';
import Razorpay from 'razorpay';
import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';
import { sendPaymentStatusEmail } from '../Services/PaymentEmailService.js';
import { createPaymentInvoicePdf } from '../Services/PaymentInvoiceService.js';

const getRequiredText = (value) => typeof value === 'string' && value.trim().length > 0;
const isValidEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const safeLogValue = (value, maxLength = 500) => String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, maxLength);

const logErrorDetails = (label, error) => {
    const status = Number(error?.statusCode || error?.response?.status);
    console.error(label, {
        message: safeLogValue(error?.message),
        code: safeLogValue(error?.code, 100),
        status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined
    });
};

export const createPaymentOrder = async (req, res) => {
    // Ensure req.body is always an object before destructuring
    const {
        candidateName,
        email,
        phone,
        organizationId,
        amount,
        candidateCount
    } = typeof req.body === 'object' && req.body !== null ? req.body : {};

    const numericOrganizationId = Number(organizationId);
    const numericCandidateCount = Number(candidateCount) || 1;
    const numericAmount = Number(amount);

    if (!getRequiredText(candidateName) || !isValidEmail(email) || !Number.isInteger(numericOrganizationId) || numericOrganizationId <= 0 || !Number.isInteger(numericCandidateCount) || numericCandidateCount <= 0) {
        return res.status(400).json({ message: 'Candidate name, valid email, organization, and candidate count are required.' });
    }

    if (!process.env.RAZORPAY_API_KEY || !process.env.RAZORPAY_SECRET_KEY) {
        return res.status(500).json({ message: 'Payment gateway is not configured on the server.' });
    }

    const amountInPaise = Math.round(numericAmount * 100);
    if (amountInPaise < 100) {
        return res.status(400).json({ message: 'The minimum payment amount is INR 1.' });
    }

    try {
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_API_KEY,
            key_secret: process.env.RAZORPAY_SECRET_KEY
        });
        const razorpayOrderPayload = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `candidate_${Date.now()}`,
            notes: { candidateName: candidateName.trim() }
        };
        await poolConnect;
        const organizationRequest = pool.request();
        organizationRequest.input('OrganizationID', sql.Int, numericOrganizationId);
        const organizationResult = await organizationRequest.query(`
            SELECT TOP 1 Amount
            FROM OrganizationMaster
            WHERE OrganizationID = @OrganizationID AND IsDeleted = '0'
        `);
        if (!organizationResult.recordset.length || !Number.isFinite(Number(organizationResult.recordset[0].Amount))) {
            return res.status(400).json({ message: 'Selected organization pricing was not found.' });
        }
        const masterAmount = Number(organizationResult.recordset[0].Amount);
        const userRole = String(req.user?.Usertype || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
        const unitBaseAmount = Number(masterAmount.toFixed(2));
        const unitGstAmount = userRole === 'client'
            ? Number((unitBaseAmount * 0.18).toFixed(2))
            : 0;
        const expectedAmount = Number(((unitBaseAmount + unitGstAmount) * numericCandidateCount).toFixed(2));
        if (!Number.isFinite(numericAmount) || Math.abs(numericAmount - expectedAmount) > 0.01) {
            return res.status(400).json({ message: 'Payment amount does not match the selected organization pricing.' });
        }

        const order = await razorpay.orders.create(razorpayOrderPayload);

        const request = pool.request();
        request.input('CandidateName', sql.NVarChar(200), candidateName.trim());
        request.input('Email', sql.VarChar(255), email.trim());
        request.input('Phone', sql.VarChar(30), getRequiredText(phone) ? phone.trim() : null);
        request.input('OrganizationID', sql.Int, numericOrganizationId);
        request.input('Amount', sql.Decimal(18, 2), expectedAmount.toFixed(2));
        request.input('Currency', sql.Char(3), 'INR');
        request.input('RazorpayOrderID', sql.VarChar(80), order.id);

        await request.query(`
            INSERT INTO PaymentTransactions
                (CandidateName, Email, Phone, OrganizationID, Amount, Currency, RazorpayOrderID, Status, InvoiceStatus)
            VALUES
                (@CandidateName, @Email, @Phone, @OrganizationID, @Amount, @Currency, @RazorpayOrderID, 'Created', 'Pending')
        `);

        const responsePayload = {
            key: process.env.RAZORPAY_API_KEY,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            candidateName: candidateName.trim()
        };
        return res.status(201).json(responsePayload);
    } catch (error) {
        logErrorDetails('[Payment/CreateOrder] Error:', error);
        return res.status(500).json({ message: 'Unable to create payment order.' });
    }
};

export const verifyPayment = async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

    console.log('[Payment/Verify] Request received:', {
        hasOrderId: Boolean(orderId),
        hasPaymentId: Boolean(paymentId),
        hasSignature: Boolean(signature)
    });

    if (!orderId || !paymentId || !signature) {
        return res.status(400).json({ message: 'Payment verification details are required.' });
    }
    if (!process.env.RAZORPAY_SECRET_KEY) {
        return res.status(500).json({ message: 'Payment gateway is not configured on the server.' });
    }

    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    const receivedSignatureBuffer = Buffer.from(signature);
    const isValid = expectedSignatureBuffer.length === receivedSignatureBuffer.length &&
        crypto.timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer);
    console.log('[Payment/Verify] Signature validation completed:', { isValid });

    if (!isValid) {
        return res.status(400).json({ message: 'Payment verification failed.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('RazorpayOrderID', sql.VarChar(80), orderId);
        request.input('RazorpayPaymentID', sql.VarChar(80), paymentId);
        request.input('RazorpaySignature', sql.VarChar(255), signature);

        const result = await request.query(`
            UPDATE PaymentTransactions
            SET RazorpayPaymentID = @RazorpayPaymentID,
                RazorpaySignature = @RazorpaySignature,
                Status = 'Paid',
                InvoiceStatus = CASE WHEN InvoiceStatus = 'Downloaded' THEN 'Downloaded' ELSE 'Generated' END,
                FailureReason = NULL,
                PaidAt = GETDATE(),
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.TransactionID, INSERTED.RazorpayOrderID, INSERTED.Status,
                   INSERTED.CandidateName, INSERTED.Email, INSERTED.Amount, INSERTED.Currency,
                   INSERTED.RazorpayPaymentID, INSERTED.InvoiceStatus, INSERTED.PaidAt,
                   DELETED.Status AS PreviousStatus
            WHERE RazorpayOrderID = @RazorpayOrderID
        `);

        if (result.recordset.length === 0) {
            const responsePayload = { message: 'Payment order was not found.' };
            return res.status(404).json(responsePayload);
        }
        const transaction = result.recordset[0];
        let emailSent = false;
        if (transaction.PreviousStatus !== 'Paid') {
            try {
                await sendPaymentStatusEmail(transaction, 'Paid');
                emailSent = true;
            } catch (emailError) {
                logErrorDetails('[Payment/Verify] Confirmation email error:', emailError);
            }
        }
        const { PreviousStatus, ...publicTransaction } = transaction;
        const responsePayload = {
            message: 'Payment verified successfully.',
            transaction: publicTransaction,
            emailSent
        };
        console.log('[Payment/Verify] Payment verification completed:', { emailSent });
        return res.status(200).json(responsePayload);
    } catch (error) {
        logErrorDetails('[Payment/Verify] Error:', error);
        return res.status(500).json({ message: 'Unable to verify payment.' });
    }
};

export const reportPaymentFailure = async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId } = req.body || {};
    if (!getRequiredText(orderId) || !getRequiredText(paymentId)) {
        return res.status(400).json({ message: 'Payment order and payment IDs are required.' });
    }
    if (!process.env.RAZORPAY_API_KEY || !process.env.RAZORPAY_SECRET_KEY) {
        return res.status(500).json({ message: 'Payment gateway is not configured on the server.' });
    }

    try {
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_API_KEY,
            key_secret: process.env.RAZORPAY_SECRET_KEY
        });
        const payment = await razorpay.payments.fetch(paymentId);
        if (payment.order_id !== orderId || payment.status !== 'failed') {
            return res.status(400).json({ message: 'The payment gateway has not confirmed a failed payment for this order.' });
        }

        await poolConnect;
        const request = pool.request();
        request.input('RazorpayOrderID', sql.VarChar(80), orderId);
        request.input('RazorpayPaymentID', sql.VarChar(80), paymentId);
        request.input(
            'FailureReason',
            sql.NVarChar(500),
            (payment.error_description || payment.error_reason || 'Payment was declined.').slice(0, 500)
        );
        const result = await request.query(`
            UPDATE PaymentTransactions
            SET RazorpayPaymentID = @RazorpayPaymentID,
                Status = 'Failed',
                FailureReason = @FailureReason,
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.TransactionID, INSERTED.RazorpayOrderID, INSERTED.Status,
                   INSERTED.CandidateName, INSERTED.Email, INSERTED.Amount, INSERTED.Currency,
                   INSERTED.RazorpayPaymentID, INSERTED.FailureReason, DELETED.Status AS PreviousStatus
            WHERE RazorpayOrderID = @RazorpayOrderID AND Status <> 'Paid'
        `);

        if (result.recordset.length === 0) {
            const lookup = pool.request();
            lookup.input('RazorpayOrderID', sql.VarChar(80), orderId);
            const existing = await lookup.query(`
                SELECT TOP 1 Status FROM PaymentTransactions WHERE RazorpayOrderID = @RazorpayOrderID
            `);
            if (!existing.recordset.length) {
                return res.status(404).json({ message: 'Payment order was not found.' });
            }
            if (existing.recordset[0].Status === 'Paid') {
                return res.status(409).json({ message: 'A successful payment cannot be marked as failed.' });
            }
            return res.status(200).json({ message: 'Payment failure was already recorded.', emailSent: false });
        }

        const transaction = result.recordset[0];
        let emailSent = false;
        if (transaction.PreviousStatus !== 'Failed') {
            try {
                await sendPaymentStatusEmail(transaction, 'Failed', transaction.FailureReason);
                emailSent = true;
            } catch (emailError) {
                logErrorDetails('[Payment/Failure] Failure email error:', emailError);
            }
        }

        return res.status(200).json({
            message: 'Payment failure recorded.',
            emailSent
        });
    } catch (error) {
        logErrorDetails('[Payment/Failure] Error:', error);
        return res.status(500).json({ message: 'Unable to record the payment failure.' });
    }
};

export const getPaymentTransaction = async (req, res) => {
    try {
        await poolConnect;
        const request = pool.request();
        request.input('RazorpayOrderID', sql.VarChar(80), req.params.orderId);
        const result = await request.query(`
            SELECT TransactionID, CandidateName, Email, Phone, OrganizationID, Amount,
                   Currency, RazorpayOrderID, RazorpayPaymentID, Status, FailureReason,
                   CreatedAt, PaidAt, UpdatedAt
            FROM PaymentTransactions
            WHERE RazorpayOrderID = @RazorpayOrderID
        `);
        if (result.recordset.length === 0) {
            const responsePayload = { message: 'Payment transaction was not found.' };
            return res.status(404).json(responsePayload);
        }
        const responsePayload = { data: result.recordset[0] };
        return res.status(200).json(responsePayload);
    } catch (error) {
        logErrorDetails('[Payment/Transaction] Error:', error);
        return res.status(500).json({ message: 'Unable to retrieve payment transaction.' });
    }
};

export const getClientPaymentInvoices = async (req, res) => {
    const email = String(req.user?.EmailID || req.user?.email || '').trim();
    if (!isValidEmail(email)) {
        return res.status(401).json({ message: 'A valid client email is required.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Email', sql.VarChar(255), email);
        const result = await request.query(`
            SELECT p.TransactionID, p.CandidateName, p.Email, p.Amount, p.Currency,
                   p.RazorpayOrderID, p.RazorpayPaymentID, p.InvoiceStatus, p.PaidAt, p.CreatedAt,
                   (SELECT COUNT(*) FROM WorktrailclientData w WHERE w.OrderID = p.RazorpayOrderID) AS Quantity
            FROM PaymentTransactions p
            WHERE LOWER(LTRIM(RTRIM(p.Email))) = LOWER(@Email)
              AND p.Status = 'Paid'
              AND p.InvoiceStatus IN ('Generated', 'Downloaded')
              AND EXISTS (
                  SELECT 1
                  FROM WorktrailclientData w
                  WHERE w.OrderID = p.RazorpayOrderID
              )
            ORDER BY COALESCE(p.PaidAt, p.CreatedAt) DESC
        `);
        return res.status(200).json({ data: result.recordset });
    } catch (error) {
        logErrorDetails('[Payment/Invoices] Error:', error);
        return res.status(500).json({ message: 'Unable to retrieve payment invoices.' });
    }
};

export const downloadClientPaymentInvoice = async (req, res) => {
    const email = String(req.user?.EmailID || req.user?.email || '').trim();
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const razorpayOrderId = typeof body.razorpayOrderId === 'string' ? body.razorpayOrderId.trim() : '';
    const quantity = Number(body.quantity);

    if (!isValidEmail(email)) {
        return res.status(401).json({ message: 'A valid client email is required.' });
    }
    if (!getRequiredText(orderId) || !getRequiredText(razorpayOrderId)) {
        return res.status(400).json({ message: 'Order ID and Razorpay order ID are required.' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'A positive employee quantity is required.' });
    }

    try {
        await poolConnect;
        const lookup = pool.request();
        lookup.input('Email', sql.VarChar(255), email);
        lookup.input('OrderID', sql.VarChar(500), orderId);
        lookup.input('RazorpayOrderID', sql.VarChar(80), razorpayOrderId);
        const invoiceResult = await lookup.query(`
            SELECT TOP 1 TransactionID, CandidateName, Email, Amount, Currency,
                   RazorpayOrderID, RazorpayPaymentID, PaidAt, CreatedAt
            FROM PaymentTransactions
            WHERE LOWER(LTRIM(RTRIM(Email))) = LOWER(@Email)
              AND Status = 'Paid'
              AND InvoiceStatus = 'Generated'
              AND RazorpayOrderID = @RazorpayOrderID
              AND RazorpayOrderID = @OrderID
              AND EXISTS (
                  SELECT 1
                  FROM WorktrailclientData
                  WHERE OrderID = @OrderID
              )
        `);
        if (!invoiceResult.recordset.length) {
            return res.status(404).json({ message: 'A downloadable invoice was not found for this order.' });
        }

        const invoice = invoiceResult.recordset[0];
        const employeeRequest = pool.request();
        employeeRequest.input('OrderID', sql.VarChar(500), orderId);
        const employeeResult = await employeeRequest.query(`
            SELECT FirstName, MiddleName, LastName, EmployeeCode
            FROM WorktrailclientData
            WHERE OrderID = @OrderID
            ORDER BY Sno
        `);
        if (!employeeResult.recordset.length) {
            return res.status(404).json({ message: 'No employee records were found for this order.' });
        }
        if (employeeResult.recordset.length !== quantity) {
            return res.status(409).json({
                message: 'The employee quantity does not match the records saved for this order. Refresh the invoice list and try again.'
            });
        }
        invoice.Quantity = employeeResult.recordset.length;
        invoice.Employees = employeeResult.recordset;
        const pdf = createPaymentInvoicePdf(invoice);
        const update = pool.request();
        update.input('Email', sql.VarChar(255), email);
        update.input('OrderID', sql.VarChar(500), orderId);
        update.input('RazorpayOrderID', sql.VarChar(80), razorpayOrderId);
        const updated = await update.query(`
            UPDATE PaymentTransactions
            SET InvoiceStatus = 'Downloaded',
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.TransactionID
            WHERE LOWER(LTRIM(RTRIM(Email))) = LOWER(@Email)
              AND Status = 'Paid'
              AND InvoiceStatus = 'Generated'
              AND RazorpayOrderID = @RazorpayOrderID
              AND RazorpayOrderID = @OrderID
              AND EXISTS (
                  SELECT 1
                  FROM WorktrailclientData
                  WHERE OrderID = @OrderID
              )
        `);
        if (!updated.recordset.length) {
            return res.status(409).json({ message: 'This invoice has already been downloaded.' });
        }

        const fileOrderId = razorpayOrderId.replace(/[^A-Za-z0-9_-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Worktrail-Invoice-${fileOrderId}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(pdf);
    } catch (error) {
        logErrorDetails('[Payment/InvoiceDownload] Error:', error);
        return res.status(500).json({ message: 'Unable to download the payment invoice.' });
    }
};