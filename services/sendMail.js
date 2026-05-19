const nodemailer = require("nodemailer");

// Portal URLs per recipient type
const PORTAL_URLS = {
  admin:    "https://admin.digitalmitro.info/",
  client:   "https://client.digitalmitro.info/",
  employee: "https://digitalmitro.info/",
  user:     "https://digitalmitro.info/",
  default:  "https://digitalmitro.info/",
};

const getPortalUrl = (recipientType) =>
  PORTAL_URLS[(recipientType || "").toLowerCase()] || PORTAL_URLS.default;

/**
 * Builds a professional HTML email.
 * @param {string} subject
 * @param {string} body
 * @param {"otp"|"notification"|"plain"} type
 * @param {"admin"|"client"|"employee"|"user"} recipientType
 */
const buildHtml = (subject, body, type = "notification", recipientType = "employee") => {
  const year = new Date().getFullYear();
  const portalUrl = getPortalUrl(recipientType);
  const portalLabel = portalUrl.replace(/https?:\/\//, "").replace(/\/$/, "");

  const loginButton = `
    <div style="text-align:center;margin:28px 0;">
      <a href="${portalUrl}"
         style="display:inline-block;background:#4A154B;color:#ffffff;
                font-family:Lato,'Helvetica Neue',Arial,sans-serif;
                font-size:15px;font-weight:700;letter-spacing:0.5px;
                text-decoration:none;padding:13px 36px;border-radius:8px;">
        Open Digital Mitro CRM
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#6B7280;text-align:center;">
      You can also visit
      <a href="${portalUrl}" style="color:#4A154B;">${portalLabel}</a>
      directly.
    </p>`;

  const contentBlock = type === "otp"
    ? `
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        You requested to log in to <strong>Digital Mitro CRM</strong>. Use the
        one-time password below. It is valid for <strong>5 minutes</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <div style="display:inline-block;background:#F3F4F6;border:2px dashed #9CA3AF;
                    border-radius:10px;padding:18px 48px;">
          <span style="font-size:36px;font-weight:900;letter-spacing:10px;
                       color:#4A154B;font-family:monospace;">${body}</span>
        </div>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#6B7280;text-align:center;">
        Do not share this code with anyone.
      </p>
      <p style="margin:0;font-size:13px;color:#6B7280;text-align:center;">
        If you did not request this, you can safely ignore this email.
      </p>`
    : `
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">${body}</p>
      ${loginButton}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Lato,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#F9FAFB;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;margin:0 auto;">
        <tr>
          <td style="background:#4A154B;border-radius:10px 10px 0 0;padding:24px 32px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:1px;">
              Digital Mitro CRM
            </h1>
            <p style="margin:4px 0 0;font-size:12px;color:#C4A8C6;letter-spacing:0.5px;text-transform:uppercase;">
              Workspace Platform
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#FFFFFF;padding:36px 32px;">
            <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1D1C1D;">
              ${subject}
            </h2>
            ${contentBlock}
          </td>
        </tr>
        <tr>
          <td style="background:#F3F4F6;border-radius:0 0 10px 10px;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#9CA3AF;">
              Digital Mitro CRM &bull; Automated email — do not reply
            </p>
            <p style="margin:0;font-size:11px;color:#D1D5DB;">
              &copy; ${year} Digital Mitro. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {"otp"|"notification"|"plain"} [type="notification"]
 * @param {"admin"|"client"|"employee"|"user"} [recipientType="employee"]
 */
async function sendMail(to, subject, text, type = "notification", recipientType = "employee") {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    const bodyText = typeof text === "string" ? text : String(text);
    await transporter.sendMail({
      from: `Digital Mitro CRM <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: bodyText,
      html: buildHtml(subject, bodyText, type, recipientType),
    });
    return { success: true };
  } catch (error) {
    console.error("sendMail error:", error?.message);
    return { success: false, error };
  }
}

module.exports = sendMail;
