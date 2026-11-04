import { pool, sql, poolConnect } from '../DatabaseConfig/DB.js'
import nodemailer from 'nodemailer'

// Email transporter
const mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER_NAME,
        pass: process.env.SMTP_PASSWORD
    }
})

// Generate a professional HTML template for contact submissions
function contactUsHtmlTemplate(data) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>New Contact Us Submission</title>
      <style>
        body { background: #f6f8fa; font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0;}
        .container { background: #fff; max-width: 600px; margin: 20px auto; border-radius: 10px; box-shadow: 0 6px 24px rgba(30,41,59,0.10); padding: 32px; border: 1px solid #e2e8f0; }
        .header { font-size: 22px; font-weight: bold; color: #114488; margin-bottom: 16px;}
        .item { margin-bottom: 8px; }
        .label { color: #64748b; font-weight: 600; width: 30%; display: inline-block;}
        .value { color: #111827; }
        .message { background: #f1f5f9; padding: 12px 18px; border-radius: 8px; color: #334155; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">📬 New Contact Us Submission</div>
        <div class="item"><span class="label">Company Name:</span> <span class="value">${data.CompanyName || '-'}</span></div>
        <div class="item"><span class="label">Your Name:</span> <span class="value">${data.YourName || '-'}</span></div>
        <div class="item"><span class="label">Work Email:</span> <span class="value">${data.WorkEmail || '-'}</span></div>
        <div class="item"><span class="label">Job Title:</span> <span class="value">${data.JobTitle || '-'}</span></div>
        <div class="item"><span class="label">Business Type:</span> <span class="value">${data.BusinessType || '-'}</span></div>
        <div class="item"><span class="label">Phone Number:</span> <span class="value">${data.PhoneNumber || '-'}</span></div>
        <div class="item"><span class="label">Employee Count:</span> <span class="value">${data.EmployeeCount || '-'}</span></div>
        <div style="margin-top:18px; margin-bottom: 6px;" class="label">Message:</div>
        <div class="message">${data.Message || '-'}</div>
        <div style="margin-top:32px; font-size: 12px; color: #94a3b8;">This email was generated automatically by the Contact Us form.</div>
      </div>
    </body>
    </html>
    `;
}

// The 'Contact Us' API endpoint
export const ContactUS = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const {
        CompanyName,
        YourName,
        WorkEmail,
        JobTitle,
        BusinessType,
        PhoneNumber,
        EmployeeCount,
        Message
    } = req.body || {};

    try {
        await poolConnect;
        const request = pool.request();
        request.input('CompanyName', sql.NVarChar(200), CompanyName || null);
        request.input('YourName', sql.NVarChar(200), YourName || null);
        request.input('WorkEmail', sql.NVarChar(255), WorkEmail || null);
        request.input('JobTitle', sql.NVarChar(200), JobTitle || null);
        request.input('BusinessType', sql.NVarChar(200), BusinessType || null);
        request.input('PhoneNumber', sql.NVarChar(50), PhoneNumber || null);
        request.input('EmployeeCount', sql.NVarChar(50), EmployeeCount || null);
        request.input('Message', sql.NVarChar(sql.MAX), Message || null);
        // Insert contact info into DB
        await request.query(`
          INSERT INTO WorktrailContactUS
            (CompanyName, YourName, WorkEmail, JobTitle, BusinessType, PhoneNumber, EmployeeCount, Message)
          VALUES
            (@CompanyName, @YourName, @WorkEmail, @JobTitle, @BusinessType, @PhoneNumber, @EmployeeCount, @Message)
        `);

        // Send professional-styled email ALWAYS to worktrail.support@securitas-india.com
        await mailTransport.sendMail({
            from: `"Worktrail Contact" <${process.env.SMTP_USER_NAME}>`,
            to: "worktrail.support@securitas-india.com",
            subject: 'New Contact Us Submission',
            html: contactUsHtmlTemplate({
                CompanyName, YourName, WorkEmail, JobTitle, BusinessType, PhoneNumber, EmployeeCount, Message
            })
        });

        return res.status(200).json({ message: "Your information has been submitted. We'll reach out to you soon." });
    } catch (err) {
        console.error('Contact US error:', err);
        return res.status(500).json({ message: 'Unable to submit contact request. Please try again later.' });
    }
};