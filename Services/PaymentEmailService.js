import nodemailer from 'nodemailer';
import { createPaymentInvoicePdf } from './PaymentInvoiceService.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[character]);

const createPaymentEmailHtml = ({ candidateName, amount, currency, orderId, paymentId, status, failureReason }) => {
    const isPaid = status === 'Paid';
    const statusColor = isPaid ? '#15803d' : '#b91c1c';
    const title = isPaid ? 'Payment successful' : 'Payment unsuccessful';
    const message = isPaid
        ? 'Your payment for the candidate verification request was received successfully. Please find your invoice attached as a PDF.'
        : 'We could not complete your payment for the candidate verification request. You can try again from the candidate verification form.';

    return `<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px">
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;color:${statusColor};font-size:24px">${title}</h1>
        <p style="font-size:15px;line-height:1.6">Hello ${escapeHtml(candidateName)},</p>
        <p style="font-size:15px;line-height:1.6">${message}</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Amount</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(currency)} ${escapeHtml(Number(amount).toFixed(2))}</td></tr>
          <tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Order ID</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(orderId)}</td></tr>
          ${paymentId ? `<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">Payment ID</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right">${escapeHtml(paymentId)}</td></tr>` : ''}
          ${!isPaid && failureReason ? `<tr><td style="padding:10px;color:#64748b">Reason</td><td style="padding:10px;text-align:right">${escapeHtml(failureReason)}</td></tr>` : ''}
        </table>
        <p style="font-size:13px;line-height:1.6;color:#64748b">This is an automatic payment status update from Worktrail. Please contact support if you need assistance.</p>
      </td></tr>
    </table>
  </body>
</html>`;
};

export const sendPaymentStatusEmail = async (transaction, status, failureReason = '') => {
    const { SMTP_SERVER, SMTP_PORT, SMTP_USER_NAME, SMTP_PASSWORD } = process.env;
    if (!SMTP_SERVER || !SMTP_USER_NAME || !SMTP_PASSWORD) {
        throw new Error('SMTP email configuration is incomplete.');
    }
    if (!transaction.Email) {
        throw new Error('No recipient email address is stored for this payment.');
    }

    const mailTransport = nodemailer.createTransport({
        host: SMTP_SERVER,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER_NAME, pass: SMTP_PASSWORD }
    });
    const isPaid = status === 'Paid';

    const mail = {
        from: `"Worktrail Payments" <${SMTP_USER_NAME}>`,
        to: transaction.Email,
        subject: isPaid ? 'Candidate verification payment successful' : 'Candidate verification payment failed',
        html: createPaymentEmailHtml({
            candidateName: transaction.CandidateName,
            amount: transaction.Amount,
            currency: transaction.Currency,
            orderId: transaction.RazorpayOrderID,
            paymentId: transaction.RazorpayPaymentID,
            status,
            failureReason
        })
    };

    if (isPaid) {
        const fileOrderId = String(transaction.RazorpayOrderID || 'payment').replace(/[^A-Za-z0-9_-]/g, '_');
        mail.attachments = [{
            filename: `Worktrail-Invoice-${fileOrderId}.pdf`,
            content: createPaymentInvoicePdf(transaction),
            contentType: 'application/pdf'
        }];
    }

    await mailTransport.sendMail(mail);
};
