import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';
import nodemailer from 'nodemailer';

export const ClientDownloadMail = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const {
        CompanyName,
        CandidateName,
        EmployeeCode,
        RequestID
    } = req.body || {};
    if (
        typeof CompanyName !== 'string' || !CompanyName.trim() ||
        typeof CandidateName !== 'string' || !CandidateName.trim() ||
        typeof EmployeeCode !== 'string' || !EmployeeCode.trim() ||
        (RequestID != null && typeof RequestID !== 'string' && typeof RequestID !== 'number')
    ) {
        return res.status(400).json({
            message: 'CompanyName, CandidateName, and EmployeeCode are required.'
        });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('CompanyName', sql.VarChar(255), CompanyName.trim());
        const recipientsResult = await request.query(
            "SELECT EmailID FROM Worktrialusers WHERE CompanyName = @CompanyName AND Usertype = 'ContributorAdmin'"
        );

        const recipients = [...new Set(
            recipientsResult.recordset
                .map(({ EmailID }) => String(EmailID || '').trim())
                .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        )];
        if (recipients.length === 0) {
            return res.status(404).json({
                message: `No valid ContributorAdmin email addresses were found for ${CompanyName.trim()}.`
            });
        }

        const { SMTP_SERVER, SMTP_PORT, SMTP_USER_NAME, SMTP_PASSWORD } = process.env;
        if (!SMTP_SERVER || !SMTP_USER_NAME || !SMTP_PASSWORD) {
            throw new Error('SMTP email configuration is incomplete.');
        }

        const mailTransport = nodemailer.createTransport({
            host: SMTP_SERVER,
            port: Number(SMTP_PORT) || 587,
            secure: Number(SMTP_PORT) === 465,
            auth: { user: SMTP_USER_NAME, pass: SMTP_PASSWORD }
        });

        const candidateName = CandidateName.trim();
        const employeeCode = EmployeeCode.trim();
        const requestId = RequestID == null ? 'Not provided' : String(RequestID);
        const reviewerName = req.user?.username || req.user?.EmailID || 'Worktrail Reviewer';
        const reviewerEmail = req.user?.EmailID || 'Not provided';
        const date = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        await mailTransport.sendMail({
            from: `"Worktrail Appeals" <${SMTP_USER_NAME}>`,
            to: recipients,
            subject: `[Urgent Appeal] Missing Employment Data Request - Candidate: ${candidateName} (${employeeCode})`,
            text: `Dear ${CompanyName.trim()} HR / Verification Department,

Re: Official Employment Verification Records Request
Candidate Name: ${candidateName}
Employee Code / ID: ${employeeCode}
Reference Request ID: ${requestId}

During our background verification review on Worktrail, official contributor records were not found for this candidate ("Data Not Found").

As the registered Contributor / Employer, we kindly request that you provide the official employment records, tenure confirmation, and clearance details for this candidate so the verification can proceed.

Please reply directly to this email with the verified details or update the candidate record via the Worktrail Contributor portal.

Requested by: ${reviewerName} (${reviewerEmail})
Date: ${date}
Platform: Worktrail Background Verification System`
        });

        return res.status(200).json({
            message: 'Appeal email sent successfully.',
            recipientCount: recipients.length
        });
    } catch (error) {
        console.error('Error sending contributor appeal email:', error);
        return res.status(500).json({ message: 'Unable to send appeal email.' });
    }
};
