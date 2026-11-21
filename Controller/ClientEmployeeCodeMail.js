import nodemailer from 'nodemailer';
import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

const supportEmail = 'worktrail.support@securitas-india.com';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[character]);

export const ClientEmployeeCodeMail = async (req, res) => {
    const { EmployeeCode } = req.body || {};
    if (typeof EmployeeCode !== 'string' || !EmployeeCode.trim()) {
        return res.status(400).json({ message: 'EmployeeCode is required.' });
    }

    let mailTransport;
    try {
        await poolConnect;
        const request = pool.request();
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode.trim());
        const result = await request.query(`
            SELECT Clientemail, LOA, SupportingDocs
            FROM WorktrailclientData
            WHERE EmployeeCode = @EmployeeCode
        `);

        if (!result.recordset?.length) {
            return res.status(404).json({ message: 'Candidate record was not found.' });
        }
        if (result.recordset.length > 1) {
            return res.status(409).json({
                message: 'Multiple candidate records were found for this EmployeeCode. Please use a unique code.'
            });
        }

        const record = result.recordset[0];
        const recipient = String(record.Clientemail || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
            return res.status(400).json({ message: 'No valid client email address is stored for this candidate.' });
        }

        const employeeCode = EmployeeCode.trim();
        const documentsMissing = !String(record.LOA ?? '').trim() &&
            !String(record.SupportingDocs ?? '').trim();
        const { SMTP_SERVER, SMTP_PORT, SMTP_USER_NAME, SMTP_PASSWORD } = process.env;
        if (!SMTP_SERVER || !SMTP_USER_NAME || !SMTP_PASSWORD) {
            throw new Error('SMTP email configuration is incomplete.');
        }

        const port = Number(SMTP_PORT) || 587;
        mailTransport = nodemailer.createTransport({
            host: SMTP_SERVER,
            port,
            secure: port === 465,
            auth: { user: SMTP_USER_NAME, pass: SMTP_PASSWORD }
        });

        const documentNoticeText = documentsMissing
            ? `\n\nAdditionally, the LOA and supporting documents are not currently available in Worktrail. Please upload the Letter of Authorization (LOA) and supporting documents so we can continue processing your request.`
            : '';
        const documentNoticeHtml = documentsMissing
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;border-collapse:collapse;background-color:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #ea580c;border-radius:8px;">
                 <tr><td style="padding:18px 20px;color:#7c2d12;font-size:14px;line-height:1.7;">
                   <p style="margin:0 0 12px;color:#9a3412;font-size:12px;font-weight:700;letter-spacing:0.8px;">REQUEST STATUS: PENDING</p>
                   <p style="margin:0 0 10px;"><strong>Please upload the following documents:</strong></p>
                   <ul style="margin:0;padding:0 0 0 20px;">
                     <li style="padding:0 0 6px;">Letter of Authorization (LOA)</li>
                     <li>Supporting documents</li>
                   </ul>
                   <p style="margin:12px 0 0;">We can continue processing your request once the documents are uploaded.</p>
                 </td></tr>
               </table>`
            : '';

        await mailTransport.sendMail({
            from: `"Worktrail" <${SMTP_USER_NAME}>`,
            to: recipient,
            cc: supportEmail,
            subject: `Action required: confirm Employee Code ${employeeCode}`,
            text: `Dear Client,

We are reviewing your Worktrail request and need your help confirming the employee code associated with it.

Employee Code currently on the request: ${employeeCode}

Kindly reply to this email with the correct Employee Code so we can update the request and continue processing.${documentNoticeText}

If you need assistance, please contact us at ${supportEmail}.

Kind regards,
Worktrail Support Team`,
            html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Employee Code confirmation</title>
  </head>
  <body style="margin:0;padding:32px 16px;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;background-color:#102a43;border-bottom:4px solid #18a96b;">
              <p style="margin:0;color:#ffffff;font-size:21px;font-weight:700;letter-spacing:0.3px;">WORKTRAIL</p>
              <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Employee verification request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Dear Client,</p>
              <h1 style="margin:0 0 16px;color:#102a43;font-size:22px;line-height:1.35;">Please confirm the Employee Code</h1>
              <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.7;">
                We are reviewing your Worktrail request and need your help confirming the employee code associated with it.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr>
                  <td style="padding:14px 16px;color:#64748b;font-size:13px;">EMPLOYEE CODE CURRENTLY ON THE REQUEST</td>
                  <td align="right" style="padding:14px 16px;color:#102a43;font-size:15px;font-weight:700;">${escapeHtml(employeeCode)}</td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:collapse;background-color:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:8px;">
                <tr><td style="padding:18px 20px;color:#1e3a8a;font-size:14px;line-height:1.7;">
                  <strong>Action required</strong><br>
                  Kindly reply to this email with the correct Employee Code. We will update the request and continue processing it once we receive the correct code.
                </td></tr>
              </table>
              ${documentNoticeHtml}
              <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.7;">
                If you need assistance, please contact our support team at
                <a href="mailto:${supportEmail}" style="color:#087443;text-decoration:underline;">${supportEmail}</a>.
              </p>
              <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;">
                Kind regards,<br><strong>Worktrail Support Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
              This email is intended for the addressed recipient. Please contact Worktrail Support if you received it in error.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
        });

        return res.status(200).json({
            message: 'Employee Code confirmation email sent successfully.',
            recipient,
            cc: supportEmail,
            documentUploadRequested: documentsMissing
        });
    } catch (error) {
        console.error('Error sending Employee Code confirmation email:', error);
        return res.status(500).json({ message: 'Unable to send Employee Code confirmation email.' });
    } finally {
        mailTransport?.close();
    }
};
