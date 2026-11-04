import crypto from 'crypto';
import Razorpay from 'razorpay';
import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';
import { sendPaymentStatusEmail } from '../Services/PaymentEmailService.js';

const getRequiredText = (value) => typeof value === 'string' && value.trim().length > 0;
const isValidEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const logErrorDetails = (label, error) => {
    console.error(label, {
        message: error?.message,
        code: error?.code,
        status: error?.statusCode || error?.response?.status,
        response: error?.response?.data,
        stack: error?.stack
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
        const expectedAmount = Number((masterAmount * numericCandidateCount * 1.18).toFixed(2));
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
                (CandidateName, Email, Phone, OrganizationID, Amount, Currency, RazorpayOrderID, Status)
            VALUES
                (@CandidateName, @Email, @Phone, @OrganizationID, @Amount, @Currency, @RazorpayOrderID, 'Created')
        `);

        const responsePayload = {
            key: process.env.RAZORPAY_API_KEY,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            candidateName: candidateName.trim()
        };
        console.log('[Payment/CreateOrder] Response JSON:', responsePayload);
        return res.status(201).json(responsePayload);
    } catch (error) {
        logErrorDetails('[Payment/CreateOrder] Error:', error);
        return res.status(500).json({ message: 'Unable to create payment order.' });
    }
};

export const verifyPayment = async (req, res) => {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

    console.log('[Payment/Verify] Request JSON:', {
        ...req.body,
        razorpay_signature: signature ? '[REDACTED]' : signature
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
    console.log('[Payment/Verify] Signature validation:', {
        orderId,
        paymentId,
        isValid
    });

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
                FailureReason = NULL,
                PaidAt = GETDATE(),
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.TransactionID, INSERTED.RazorpayOrderID, INSERTED.Status,
                   INSERTED.CandidateName, INSERTED.Email, INSERTED.Amount, INSERTED.Currency,
                   INSERTED.RazorpayPaymentID, DELETED.Status AS PreviousStatus
            WHERE RazorpayOrderID = @RazorpayOrderID
        `);

        if (result.recordset.length === 0) {
            const responsePayload = { message: 'Payment order was not found.' };
            console.log('[Payment/Verify] Response JSON:', responsePayload);
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
        console.log('[Payment/Verify] Payment verification completed:', {
            transactionId: publicTransaction.TransactionID,
            emailSent
        });
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
    console.log('[Payment/Transaction] Request JSON:', { orderId: req.params.orderId });
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
            console.log('[Payment/Transaction] Response JSON:', responsePayload);
            return res.status(404).json(responsePayload);
        }
        const responsePayload = { data: result.recordset[0] };
        console.log('[Payment/Transaction] Response JSON:', responsePayload);
        return res.status(200).json(responsePayload);
    } catch (error) {
        logErrorDetails('[Payment/Transaction] Error:', error);
        return res.status(500).json({ message: 'Unable to retrieve payment transaction.' });
    }
};