import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supportEmail = 'worktrail.support@securitas-india.com';
const documentFolders = {
    LOA: path.join(backendRoot, 'LOA'),
    SupportingDocs: path.join(backendRoot, 'SupportingDocs')
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
})[character]);

const getAttachment = async (storedPath, folderName) => {
    if (!storedPath) return null;

    const normalizedPath = String(storedPath).replace(/\\/g, '/');
    const expectedPrefix = `${folderName}/`;
    const fileName = normalizedPath.startsWith(expectedPrefix)
        ? normalizedPath.slice(expectedPrefix.length)
        : '';
    if (!fileName || fileName === '.' || fileName === '..' || fileName.includes('/')) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const folderPath = documentFolders[folderName];
    const resolvedFilePath = path.resolve(folderPath, fileName);
    const relativePath = path.relative(folderPath, resolvedFilePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const actualFolderPath = await fs.realpath(folderPath);
    const actualFilePath = await fs.realpath(resolvedFilePath);
    const actualRelativePath = path.relative(actualFolderPath, actualFilePath);
    if (!actualRelativePath || actualRelativePath.startsWith('..') || path.isAbsolute(actualRelativePath)) {
        throw new Error(`Invalid ${folderName} document path.`);
    }

    const extension = path.extname(fileName).toLowerCase();
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(extension)) {
        throw new Error(`Unsupported ${folderName} document type.`);
    }

    return {
        filename: fileName,
        path: actualFilePath
    };
};

export const ClientDocumentsMail = async (req, res) => {
    const { EmployeeCode, OrderID } = req.body || {};
    if (typeof EmployeeCode !== 'string' || !EmployeeCode.trim()) {
        return res.status(400).json({ message: 'EmployeeCode is required.' });
    }
    if (typeof OrderID !== 'string' || !OrderID.trim()) {
        return res.status(400).json({ message: 'OrderID is required.' });
    }

    let mailTransport;
    try {
        await poolConnect;
        const request = pool.request();
        request.input('EmployeeCode', sql.VarChar(50), EmployeeCode.trim());
        request.input('OrderID', sql.VarChar(500), OrderID.trim());
        const result = await request.query(`
            SELECT Clientemail, LOA, SupportingDocs
            FROM WorktrailclientData
            WHERE EmployeeCode = @EmployeeCode
            AND OrderID = @OrderID
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

        const attachments = (await Promise.all([
            getAttachment(record.LOA, 'LOA'),
            getAttachment(record.SupportingDocs, 'SupportingDocs')
        ])).filter(Boolean);

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

        const employeeCode = EmployeeCode.trim();
        const hasAttachments = attachments.length > 0;
        const attachmentList = attachments
            .map(({ filename }) => `<li style="padding:0 0 8px;color:#334155;">${escapeHtml(filename)}</li>`)
            .join('');
        const subject = hasAttachments
            ? `Worktrail documents for Employee Code ${employeeCode}`
            : `Action required: documents needed for Employee Code ${employeeCode}`;
        const text = hasAttachments
            ? `Dear Client,

Please find the available documents for Employee Code ${employeeCode} attached to this email.

Attachments:
${attachments.map(({ filename }) => `- ${filename}`).join('\n')}

If you have any questions or need further assistance, please contact us at ${supportEmail}.

Kind regards,
Worktrail Support Team`
            : `Dear Client,

The request for Employee Code ${employeeCode} is currently pending because the required documents are not available in Worktrail.

To help us process your request, please upload the Letter of Authorization (LOA) and the supporting documents to Worktrail at your earliest convenience. Processing can continue once the required documents have been received.

If you need assistance with the upload, please contact us at ${supportEmail}.

Kind regards,
Worktrail Support Team`;
        const emailHeading = hasAttachments
            ? 'Your requested documents are attached'
            : 'Action required to process your request';
        const emailMessage = hasAttachments
            ? 'Please find the available documents for the employee listed below attached to this email.'
            : 'Your request is currently pending because the required documents have not yet been uploaded. Please upload the documents listed below so we can continue processing your request.';
        const attachmentSection = hasAttachments
            ? `<p style="margin:0 0 10px;color:#334155;font-size:14px;font-weight:700;">Included with this email</p>
                <ul style="margin:0 0 24px;padding:0 0 0 20px;font-size:14px;line-height:1.6;">${attachmentList}</ul>`
            : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:collapse;background-color:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #ea580c;border-radius:8px;">
                  <tr><td style="padding:18px 20px;color:#7c2d12;font-size:14px;line-height:1.7;">
                    <p style="margin:0 0 12px;color:#9a3412;font-size:12px;font-weight:700;letter-spacing:0.8px;">REQUEST STATUS: PENDING</p>
                    <p style="margin:0 0 10px;"><strong>Please upload the following documents:</strong></p>
                    <ul style="margin:0;padding:0 0 0 20px;">
                      <li style="padding:0 0 6px;">Letter of Authorization (LOA)</li>
                      <li>Supporting documents</li>
                    </ul>
                    <p style="margin:12px 0 0;">We can continue processing your request once these documents have been uploaded.</p>
                  </td></tr>
                </table>`;

        await mailTransport.sendMail({
            from: `"Worktrail" <${SMTP_USER_NAME}>`,
            to: recipient,
            cc: supportEmail,
            subject,
            text,
            html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Worktrail documents</title>
  </head>
  <body style="margin:0;padding:32px 16px;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;background-color:#102a43;border-bottom:4px solid #18a96b;">
                <p style="margin:0;color:#ffffff;font-size:21px;font-weight:700;letter-spacing:0.3px;">WORKTRAIL</p>
                <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Candidate document delivery</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Dear Client,</p>
                <h1 style="margin:0 0 16px;color:#102a43;font-size:22px;line-height:1.35;">${emailHeading}</h1>
                <p style="margin:0 0 22px;color:#475569;font-size:15px;line-height:1.7;">
                  ${emailMessage}
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:collapse;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                  <tr>
                    <td style="padding:14px 16px;color:#64748b;font-size:13px;">EMPLOYEE CODE</td>
                    <td align="right" style="padding:14px 16px;color:#102a43;font-size:15px;font-weight:700;">${escapeHtml(employeeCode)}</td>
                  </tr>
                </table>
                ${attachmentSection}
                <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.7;">
                  If you have any questions or require further assistance, please contact our support team at
                  <a href="mailto:${supportEmail}" style="color:#087443;text-decoration:underline;">${supportEmail}</a>.
                </p>
                <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;">
                  Kind regards,<br>
                  <strong>Worktrail Support Team</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
                This email and its attachments are intended for the addressed recipient. Please contact Worktrail Support if you received it in error.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
            attachments
        });

        return res.status(200).json({
            message: hasAttachments
                ? 'Candidate documents emailed successfully.'
                : 'Document availability notification emailed successfully.',
            recipient,
            cc: supportEmail,
            attachmentCount: attachments.length
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'A requested candidate document file was not found.' });
        }
        console.error('Error emailing candidate documents:', error);
        return res.status(500).json({ message: 'Unable to email candidate documents.' });
    } finally {
        mailTransport?.close();
    }
};
