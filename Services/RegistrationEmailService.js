import nodemailer from 'nodemailer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SUPPORT_EMAIL = 'worktrail.support@securitas-india.com'

const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character])

const getEmailAttachments = () => {
    const assetNames = [
        'Banner.png',
        'logo_w.png',
        'Shield-12th-Oct.png',
        'walson-h.png',
        'Pattern.png',
        'Email-icon.png',
        'Phone.png'
    ]

    return assetNames
        .map((name) => {
            const filePath = path.join(__dirname, name)
            return fs.existsSync(filePath)
                ? { filename: name, path: filePath, cid: name }
                : null
        })
        .filter(Boolean)
}

/**
 * Shared Corporate Email Shell (Header, Card Container & Walsons/Securitas Footer)
 */
const createEmailShell = ({
    title,
    badgeText,
    badgeBg = '#fef3c7',
    badgeColor = '#92400e',
    badgeBorder = '#fcd34d',
    cardBodyHtml,
    cidPrefix = 'cid:'
}) => {
    const currentYear = new Date().getFullYear()

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en" style="background-color: #f1f5f9;">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
    <!--[if gte mso 9]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->
    <!--[if mso]>
    <style type="text/css">
      table, td, div, p, a, span { font-family: 'Segoe UI', Arial, sans-serif !important; }
    </style>
    <![endif]-->
    <style type="text/css">
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
        body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        
        @media only screen and (max-width: 620px) {
            .email-container { width: 100% !important; max-width: 100% !important; }
            .mobile-padding { padding-left: 18px !important; padding-right: 18px !important; }
            .mobile-stack { display: block !important; width: 100% !important; }
            .step-cell { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
            .contact-cell { display: block !important; width: 100% !important; padding: 4px 0 !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

    <!-- Outer Canvas -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; margin: 0; padding: 24px 0;">
        <tr>
            <td align="center" style="padding: 0 12px;">
                <!--[if (gte mso 9)|(IE)]>
                <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600">
                <tr>
                <td align="center" valign="top" width="600">
                <![endif]-->

                <!-- Main Container (600px Max) -->
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #f8fafc; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">

                    <!-- Top Securitas Banner -->
                    <tr>
                        <td align="center" background="${cidPrefix}Banner.png" style="background-color: #0b1728; background-image: url('${cidPrefix}Banner.png'); background-position: top center; background-repeat: no-repeat; background-size: 100% 70%; padding: 26px 20px 0 20px;">
                            <!--[if gte mso 9]>
                            <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width: 600px;">
                                <v:fill type="frame" src="${cidPrefix}Banner.png" color="#0b1728" />
                                <v:textbox style="mso-fit-shape-to-text: true;" inset="0,0,0,0">
                            <![endif]-->
                            <div>
                                <!-- Securitas Logo -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 18px auto;">
                                    <tr>
                                        <td align="center">
                                            <img src="${cidPrefix}logo_w.png" width="125" alt="Securitas" style="display: block; width: 125px; height: auto; border: 0;" />
                                        </td>
                                    </tr>
                                </table>

                                <!-- Main Elevated White Card -->
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 14px; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
                                    
                                    <!-- Card Header Bar -->
                                    <tr>
                                        <td align="center" style="padding: 18px 24px 14px 24px; border-bottom: 1px solid #f1f5f9;" class="mobile-padding">
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                                <tr>
                                                    <td align="left" valign="middle">
                                                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 20px;">
                                                            <span style="color: #0f172a; font-weight: 800; font-size: 18px; letter-spacing: -0.3px;">Work</span><span style="color: #10b981; font-weight: 800; font-size: 18px; letter-spacing: -0.3px;">Trail</span>
                                                            <span style="color: #cbd5e1; font-size: 14px; margin: 0 6px;">|</span>
                                                            <span style="color: #64748b; font-weight: 500; font-size: 13.5px;">Client Verification</span>
                                                        </div>
                                                    </td>
                                                    <td align="right" valign="middle">
                                                        <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                                            ${badgeText}
                                                        </span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>

                                    <!-- Injected Card Body -->
                                    <tr>
                                        <td style="padding: 26px 28px 24px 28px;" class="mobile-padding">
                                            ${cardBodyHtml}
                                        </td>
                                    </tr>

                                    <!-- Support / Contact Assistance Strip -->
                                    <tr>
                                        <td align="center" style="padding: 14px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;" class="mobile-padding">
                                            <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 18px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                                Have questions about your registration? Contact our support desk at
                                                <a href="mailto:worktrail.support@securitas-india.com" style="color: #0680a6; text-decoration: underline; font-weight: 600; margin-left: 2px;">worktrail.support@securitas-india.com</a>
                                            </p>
                                        </td>
                                    </tr>

                                </table>
                                <!-- End Main White Card -->

                            </div>
                            <!--[if gte mso 9]>
                            </v:textbox>
                            </v:rect>
                            <![endif]-->
                        </td>
                    </tr>

                    <!-- Walsons Sub-branding -->
                    <tr>
                        <td align="center" style="padding: 20px 20px 8px 20px; text-align: center;">
                            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 10.5px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                WALSONS WORKTRAIL VERIFICATION NETWORK
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 10.5px; line-height: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                This is an automated notification from Worktrail Identity & Access Management.<br />
                                &copy; ${currentYear} Worktrail Technologies &bull; Powered by Walsons Group. All rights reserved.
                            </p>
                        </td>
                    </tr>

                    <!-- Walsons Logo -->
                    <tr>
                        <td align="center" style="padding: 6px 20px 12px 20px;">
                            <img src="${cidPrefix}walson-h.png" width="140" alt="Walsons Building Faith" style="display: block; width: 140px; max-width: 100%; height: auto; margin: 0 auto; border: 0;" />
                        </td>
                    </tr>

                    <!-- Wave Pattern Separator -->
                    <tr>
                        <td align="center" style="line-height: 0; font-size: 0; padding: 0;">
                            <img src="${cidPrefix}Pattern.png" width="600" alt="Pattern" style="display: block; width: 100%; max-width: 600px; max-height: 38px; object-fit: cover; border: 0;" />
                        </td>
                    </tr>

                    <!-- Dark Footer -->
                    <tr>
                        <td style="background-color: #011627; padding: 20px 24px 22px 24px; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #ef4444; font-size: 13.5px; font-weight: 800; letter-spacing: 0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                Making Workplaces Safer!
                            </p>

                            <p style="margin: 0 0 12px 0; color: #e2e8f0; font-size: 10px; font-weight: 500; line-height: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                Leadership Due Diligence <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                Vendor Due Diligence <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                Investigations <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                Audits <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                KYC Verification <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                Substance Abuse <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                Facial Match <span style="color: #ef4444; font-weight: 700; padding: 0 3px;">|</span>
                                Anniversary Checks
                            </p>

                            <!-- Contact Channels -->
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto;">
                                <tr>
                                    <td class="contact-cell" align="center" style="padding: 0 12px;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td valign="middle" style="padding-right: 6px; line-height: 0;">
                                                    <img src="${cidPrefix}Email-icon.png" width="14" height="14" alt="Email" style="display: block; border: 0;" />
                                                </td>
                                                <td valign="middle">
                                                    <a href="mailto:worktrail.support@securitas-india.com" style="color: #ffffff; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">worktrail.support@securitas-india.com</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                    <td class="contact-cell" align="center" style="padding: 0 12px;">
                                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td valign="middle" style="padding-right: 6px; line-height: 0;">
                                                    <img src="${cidPrefix}Phone.png" width="14" height="14" alt="Phone" style="display: block; border: 0;" />
                                                </td>
                                                <td valign="middle">
                                                    <a href="tel:+918527256769" style="color: #ffffff; font-size: 11px; text-decoration: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">+918527256769</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0; color: #94a3b8; font-size: 8px; line-height: 12px; font-style: italic; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin-left: auto; margin-right: auto;">
                                Disclaimer: Worktrail background screenings are conducted in strict adherence to applicable state and federal compliance standards, ensuring a thorough and legally sound verification process worldwide.
                            </p>
                        </td>
                    </tr>

                </table>
                <!-- End Main Container -->

                <!--[if (gte mso 9)|(IE)]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>`
}

/**
 * Generate Professional Client Welcome & "Under Review" Email Template
 */
const buildClientEmailHtml = ({ name, email, company, submissionDate, cidPrefix = 'cid:' }) => {
    const cardBodyHtml = `
        <!-- Headline -->
        <h2 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            Welcome to Worktrail, ${escapeHtml(name)}
        </h2>
        <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            Your registration details and email verification have been successfully recorded. Your client account has been submitted and is currently <strong style="color: #92400e;">under review</strong> by our compliance and administrative teams.
        </p>

        <!-- Status Details Box -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
            <tr>
                <td style="padding: 16px 20px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #0680a6; margin-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        Submitted Account Summary
                    </div>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; width: 38%; font-weight: 500;">Account Holder</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${escapeHtml(name)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Registered Email</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${escapeHtml(email)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Company / Entity</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${escapeHtml(company)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Submission Date</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(submissionDate)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Account Status</td>
                            <td style="padding: 6px 0;">
                                <span style="background-color: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">
                                    Pending Approval
                                </span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- 3-Step Onboarding Roadmap -->
        <div style="margin-bottom: 22px;">
            <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                What happens next?
            </p>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <!-- Step 1: Done -->
                    <td valign="top" style="padding: 10px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; width: 31%;" class="step-cell">
                        <div style="color: #15803d; font-size: 11px; font-weight: 800; margin-bottom: 2px;">Step 1 &bull; Done</div>
                        <div style="color: #166534; font-size: 12px; font-weight: 700; margin-bottom: 2px;">Email Verified</div>
                        <div style="color: #4b5563; font-size: 11px; line-height: 14px;">OTP confirmation complete.</div>
                    </td>
                    <td style="width: 3.5%; font-size: 0; line-height: 0;">&nbsp;</td>
                    <!-- Step 2: In Progress -->
                    <td valign="top" style="padding: 10px; background-color: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 8px; width: 31%;" class="step-cell">
                        <div style="color: #b45309; font-size: 11px; font-weight: 800; margin-bottom: 2px;">Step 2 &bull; Active</div>
                        <div style="color: #92400e; font-size: 12px; font-weight: 700; margin-bottom: 2px;">Account Review</div>
                        <div style="color: #4b5563; font-size: 11px; line-height: 14px;">Compliance review underway.</div>
                    </td>
                    <td style="width: 3.5%; font-size: 0; line-height: 0;">&nbsp;</td>
                    <!-- Step 3: Upcoming -->
                    <td valign="top" style="padding: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; width: 31%;" class="step-cell">
                        <div style="color: #64748b; font-size: 11px; font-weight: 800; margin-bottom: 2px;">Step 3 &bull; Next</div>
                        <div style="color: #334155; font-size: 12px; font-weight: 700; margin-bottom: 2px;">Activation Notice</div>
                        <div style="color: #4b5563; font-size: 11px; line-height: 14px;">Access granted via email.</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Security & Compliance Assurance Note -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; margin-bottom: 16px;">
            <tr>
                <td style="padding: 12px 14px;" valign="middle">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td valign="top" width="22" style="padding-right: 10px; padding-top: 1px;">
                                <img src="${cidPrefix}Shield-12th-Oct.png" width="16" height="18" alt="Shield" style="display: block; width: 16px; height: 18px; border: 0;" />
                            </td>
                            <td valign="middle" style="color: #115e59; font-size: 12px; line-height: 17px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                                <strong>Enterprise Compliance:</strong> Your organization details and verification data are stored with bank-grade encryption in accordance with strict global data privacy standards.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Sign-off -->
        <p style="margin: 0; color: #475569; font-size: 13.5px; line-height: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            Warm regards,<br />
            <strong style="color: #0f172a;">Worktrail Client Onboarding Team</strong>
        </p>
    `

    return createEmailShell({
        title: 'Your Worktrail Registration is Under Review',
        badgeText: 'Under Review',
        badgeBg: '#fef3c7',
        badgeColor: '#92400e',
        badgeBorder: '#fcd34d',
        cardBodyHtml,
        cidPrefix
    })
}

/**
 * Generate Professional Admin Alert Template for New Client Registrations
 */
const buildAdminEmailHtml = ({ name, email, company, submissionDate, cidPrefix = 'cid:' }) => {
    const cardBodyHtml = `
        <!-- Headline -->
        <h2 style="margin: 0 0 8px 0; font-size: 21px; font-weight: 800; color: #0f172a; line-height: 27px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            New Client Registration Pending Review
        </h2>
        <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 22px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            A new client user has verified their OTP and is waiting for administrator approval and account activation in the Worktrail platform.
        </p>

        <!-- Registrant Details Table -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 22px;">
            <tr>
                <td style="padding: 16px 20px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #dc2626; margin-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        Applicant Profile & Credentials
                    </div>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <tr>
                            <td style="padding: 7px 0; color: #64748b; width: 38%; font-weight: 500;">Applicant Name</td>
                            <td style="padding: 7px 0; color: #0f172a; font-weight: 700;">${escapeHtml(name)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Email Address</td>
                            <td style="padding: 7px 0; color: #0f172a; font-weight: 700;">
                                <a href="mailto:${escapeHtml(email)}" style="color: #0680a6; text-decoration: none;">${escapeHtml(email)}</a>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Company / Organization</td>
                            <td style="padding: 7px 0; color: #0f172a; font-weight: 700;">${escapeHtml(company)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Verification Time</td>
                            <td style="padding: 7px 0; color: #0f172a; font-weight: 600;">${escapeHtml(submissionDate)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Account Status</td>
                            <td style="padding: 7px 0;">
                                <span style="background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">
                                    Inactive (Review Required)
                                </span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Required Action Callout -->
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 22px;">
            <p style="margin: 0 0 4px 0; color: #991b1b; font-size: 13px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Action Required:
            </p>
            <p style="margin: 0; color: #7f1d1d; font-size: 12.5px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                Please log into the <strong>Worktrail Admin Console</strong> under <em>User Master Management</em> to inspect this client's credentials, assign their organization mappings, and activate their account.
            </p>
        </div>

        <!-- Portal Link Button -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 18px 0;">
            <tr>
                <td align="center" style="border-radius: 10px; background-color: #0f172a;">
                    <a href="https://worktrail.ai/Login" target="_blank" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;">
                        Open Worktrail Admin Portal &rarr;
                    </a>
                </td>
            </tr>
        </table>

        <!-- Footer Sign-off -->
        <p style="margin: 0; color: #64748b; font-size: 12.5px; line-height: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            Automated internal alert sent by the Worktrail Identity Engine.
        </p>
    `

    return createEmailShell({
        title: 'New Client Registration Awaiting Review',
        badgeText: 'Action Required',
        badgeBg: '#fee2e2',
        badgeColor: '#991b1b',
        badgeBorder: '#fecaca',
        cardBodyHtml,
        cidPrefix
    })
}

/**
 * Send Professional Registration Notification Emails (to Admin and Client)
 */
export const sendRegistrationNotifications = async (user) => {
    const { SMTP_SERVER, SMTP_PORT, SMTP_USER_NAME, SMTP_PASSWORD } = process.env
    if (!SMTP_SERVER || !SMTP_USER_NAME || !SMTP_PASSWORD) {
        throw new Error('SMTP email configuration is incomplete.')
    }

    const supportEmail =
        process.env.REGISTRATION_NOTIFICATION_EMAIL || 'worktrail.support@securitas-india.com'

    const mailTransport = nodemailer.createTransport({
        host: SMTP_SERVER,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER_NAME, pass: SMTP_PASSWORD }
    })

    const fullName =
        [user?.FirstName, user?.LastName].filter(Boolean).join(' ') ||
        user?.username ||
        'Valued Client'
    const company = user?.CompanyName?.trim() || 'Not provided'
    const email = user?.EmailID || ''
    const submissionDate = new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    })

    const attachments = getEmailAttachments()

    const adminMail = {
        from: `"Worktrail Registration" <${SMTP_USER_NAME}>`,
        to: supportEmail,
        subject: `New Client Registration Review: ${fullName} (${company})`,
        text: `A client registration has been verified and is awaiting account review.\n\nName: ${fullName}\nEmail: ${email}\nCompany: ${company}\nSubmission Date: ${submissionDate}\n\nPlease review and activate the account in the Worktrail Admin Console.`,
        html: buildAdminEmailHtml({
            name: fullName,
            email,
            company,
            submissionDate,
            cidPrefix: 'cid:'
        }),
        attachments
    }

    const clientMail = {
        from: `"Worktrail Support" <${SMTP_USER_NAME}>`,
        to: email,
        subject: 'Your Worktrail Registration is Under Review',
        text: `Hello ${fullName},\n\nThank you for registering with Worktrail. Your email has been verified, and your account registration has been submitted successfully.\n\nOur team is currently reviewing your account details. We will notify you by email as soon as your account is approved and activated.\n\nSummary:\n- Name: ${fullName}\n- Email: ${email}\n- Company: ${company}\n- Date: ${submissionDate}\n\nWorktrail Support Team\nworktrail.support@securitas-india.com`,
        html: buildClientEmailHtml({
            name: fullName,
            email,
            company,
            submissionDate,
            cidPrefix: 'cid:'
        }),
        attachments
    }

    const [adminResult, clientResult] = await Promise.allSettled([
        mailTransport.sendMail(adminMail),
        mailTransport.sendMail(clientMail)
    ])

    return {
        adminSent: adminResult.status === 'fulfilled',
        clientSent: clientResult.status === 'fulfilled',
        errors: [adminResult, clientResult]
            .filter((result) => result.status === 'rejected')
            .map((result) => result.reason)
    }
}

export const sendAccountStatusEmail = async (user, activeStatus) => {
    const { SMTP_SERVER, SMTP_PORT, SMTP_USER_NAME, SMTP_PASSWORD } = process.env
    if (!SMTP_SERVER || !SMTP_USER_NAME || !SMTP_PASSWORD) {
        throw new Error('SMTP email configuration is incomplete.')
    }
    if (!user?.EmailID) {
        throw new Error('Client account has no email address.')
    }

    const isActive = activeStatus === 1
    const fullName =
        [user.FirstName, user.LastName].filter(Boolean).join(' ') ||
        user.username ||
        'Valued Client'
    const company = user.CompanyName?.trim() || 'Not provided'
    const status = isActive ? 'Active' : 'Deactivated'
    const statusColor = isActive ? '#047857' : '#b91c1c'
    const statusBackground = isActive ? '#ecfdf5' : '#fef2f2'
    const statusBorder = isActive ? '#a7f3d0' : '#fecaca'
    const message = isActive
        ? 'Your Worktrail account has been activated. You can now sign in and access your account.'
        : 'Your Worktrail account has been deactivated, and access is currently unavailable. Please contact Worktrail Support if you believe this was done in error.'
    const escapedName = escapeHtml(fullName)
    const escapedCompany = escapeHtml(company)
    const cardBodyHtml = `
        <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.3">
            Your account is ${status.toLowerCase()}
        </h2>
        <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:22px">
            Hello ${escapedName}, here is an update about your Worktrail account.
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;background-color:${statusBackground};border:1px solid ${statusBorder};border-radius:12px">
            <tr><td style="padding:18px 20px">
                <div style="margin-bottom:8px;color:${statusColor};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px">Account status</div>
                <div style="color:${statusColor};font-size:18px;font-weight:800">${status}</div>
                <p style="margin:10px 0 0;color:#334155;font-size:13px;line-height:20px">${message}</p>
            </td></tr>
        </table>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
            <tr><td style="padding:16px 20px">
                <div style="margin-bottom:8px;color:#64748b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.7px">Account details</div>
                <div style="color:#334155;font-size:13px;line-height:21px"><strong>Company:</strong> ${escapedCompany}</div>
                <div style="color:#334155;font-size:13px;line-height:21px"><strong>Email:</strong> ${escapeHtml(user.EmailID)}</div>
            </td></tr>
        </table>
        <p style="margin:0;color:#475569;font-size:13px;line-height:20px">
            If you have any questions, contact Worktrail Support at
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#0680a6;font-weight:700;text-decoration:none">${SUPPORT_EMAIL}</a>.
        </p>
    `
    const html = createEmailShell({
        title: `Worktrail Account ${status}`,
        badgeText: `Account ${status}`,
        badgeBg: isActive ? '#d1fae5' : '#fee2e2',
        badgeColor: isActive ? '#065f46' : '#991b1b',
        badgeBorder: isActive ? '#6ee7b7' : '#fecaca',
        cardBodyHtml
    })
    const text = `Hello ${fullName},\n\n${message}\n\nAccount status: ${status}\nCompany: ${company}\n\nWorktrail Support\n${SUPPORT_EMAIL}`

    const mailTransport = nodemailer.createTransport({
        host: SMTP_SERVER,
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: { user: SMTP_USER_NAME, pass: SMTP_PASSWORD }
    })

    await mailTransport.sendMail({
        from: `"Worktrail Support" <${SMTP_USER_NAME}>`,
        to: user.EmailID,
        bcc: SUPPORT_EMAIL,
        subject: `Your Worktrail account is ${status.toLowerCase()}`,
        text,
        html,
        attachments: getEmailAttachments()
    })
}
