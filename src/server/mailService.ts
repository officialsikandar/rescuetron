import nodemailer, { type Transporter } from "nodemailer";
import dns from "dns";

// Enforce global Node.js IPv4-first DNS resolution on Render / Cloud containers
try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch (e) {
  // ignore
}

// Custom IPv4-only lookup function for Nodemailer
function ipv4OnlyLookup(hostname: string, options: any, callback: Function) {
  return dns.lookup(hostname, { family: 4 }, callback as any);
}

// HTTPS Email API Dispatcher (Bypasses Render outbound SMTP TCP port blocks)
export async function sendViaHttpsApi(params: {
  toEmail: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ sent: boolean; messageId?: string; provider?: string; error?: string } | null> {
  const { toEmail, subject, htmlContent, textContent } = params;
  const cleanToEmail = (toEmail || "").trim().toLowerCase();
  let resendErrorResult: { sent: boolean; messageId?: string; provider?: string; error?: string } | null = null;

  // 1. Check Brevo / Sendinblue API Key (https://brevo.com - 300 free emails/day to ANY recipient)
  const brevoApiKey = (
    process.env.BREVO_API_KEY ||
    process.env.BREVO_KEY ||
    process.env.BREVO_APIKEY ||
    process.env.SENDINBLUE_API_KEY ||
    process.env.SENDINBLUE_KEY ||
    process.env.BREVO_TOKEN ||
    process.env.BREVO_SMTP_KEY ||
    ((process.env.SMTP_HOST || "").includes("brevo") || (process.env.SMTP_HOST || "").includes("sendinblue") ? process.env.SMTP_PASS : "") ||
    ((process.env.SMTP_PASS || "").startsWith("xsib-") || (process.env.SMTP_PASS || "").startsWith("xkeysib-") ? process.env.SMTP_PASS : "") ||
    ((process.env.SMTP_PASSWORD || "").startsWith("xsib-") || (process.env.SMTP_PASSWORD || "").startsWith("xkeysib-") ? process.env.SMTP_PASSWORD : "")
  )?.replace(/["']/g, "").trim();

  if (brevoApiKey) {
    if (brevoApiKey.startsWith("xsmtpsib-")) {
      console.warn(`⚠️ [Brevo Key Warning] You provided an SMTP Key ("${brevoApiKey.slice(0, 8)}...") instead of a v3 API Key. Brevo REST API requires an API Key starting with "xkeysib-".`);
      return {
        sent: false,
        error: `Brevo Configuration Notice: Your BREVO_API_KEY starts with "xsmtpsib-", which is an SMTP password. Brevo's HTTPS API requires a v3 API Key starting with "xkeysib-". Please go to Brevo Dashboard -> SMTP & API -> API Keys tab and generate an API key.`,
        provider: "Brevo HTTPS API",
      };
    }

    try {
      const senderEmail = (process.env.SMTP_USER || process.env.RESEND_FROM_EMAIL || "sikandaritguy@gmail.com").replace(/["'<>]|Rescuetron Emergency/gi, "").trim();
      const maskedKey = `${brevoApiKey.slice(0, 6)}...${brevoApiKey.slice(-4)}`;
      console.log(`🚀 [HTTPS Email Gateway] Dispatching via Brevo HTTPS API to "${cleanToEmail}" | Sender: "${senderEmail}" | Key: "${maskedKey}"...`);

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "accept": "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Rescuetron Emergency Network", email: senderEmail },
          to: [{ email: cleanToEmail }],
          subject,
          htmlContent,
          textContent,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.messageId || data.messageIds)) {
        const msgId = data.messageId || (data.messageIds && data.messageIds[0]) || "brevo_ok";
        console.log(`✅ [HTTPS Email Gateway SUCCESS] Delivered via Brevo HTTPS API to "${cleanToEmail}"! ID: ${msgId}`);
        return { sent: true, messageId: msgId, provider: "Brevo HTTPS API" };
      } else {
        const errorDetail = data.message || data.code || JSON.stringify(data);
        console.error(`❌ [HTTPS Email Gateway FAILURE] Brevo API Rejected Request (HTTP ${res.status}):`, {
          statusCode: res.status,
          message: errorDetail,
          rawResponse: data,
        });
        return {
          sent: false,
          error: `Brevo API Error (HTTP ${res.status}): ${errorDetail}. Note: Ensure you are using a Brevo v3 API Key (starts with xkeysib-...) from Brevo Dashboard -> SMTP & API -> API Keys tab.`,
          provider: "Brevo HTTPS API",
        };
      }
    } catch (err: any) {
      console.error(`❌ [HTTPS Email Gateway EXCEPTION] Brevo request failed:`, err.message);
    }
  } else {
    console.log(`ℹ️ [HTTPS Email Gateway] BREVO_API_KEY is not set in environment variables.`);
  }

  // 2. Check Resend API Key (https://resend.com - 3000 free emails/mo)
  const resendApiKey = (
    process.env.RESEND_API_KEY ||
    process.env.RESEND_KEY ||
    process.env.RESEND_TOKEN
  )?.replace(/["']/g, "").trim();

  if (resendApiKey) {
    const maskedKey = `${resendApiKey.slice(0, 5)}...${resendApiKey.slice(-4)}`;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Rescuetron Emergency <onboarding@resend.dev>";
    console.log(`🚀 [HTTPS Email Gateway] Initiating Resend API dispatch -> Target: "${cleanToEmail}" | From: "${fromEmail}" | Key: "${maskedKey}"`);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [cleanToEmail],
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data.id) {
        console.log(`✅ [HTTPS Email Gateway SUCCESS] Resend Email Delivered! Message ID: ${data.id}`);
        return { sent: true, messageId: data.id, provider: "Resend HTTPS API" };
      } else {
        const errorReason = data.message || data.error || JSON.stringify(data);
        const isValidationError = data.name === "validation_error" || res.status === 403;
        
        let friendlyExplanation = errorReason;
        if (isValidationError && errorReason.includes("testing emails")) {
          friendlyExplanation = `Resend Free Test Mode: You can send test emails to your registered Resend account address (e.g. sikandaritguy@gmail.com). To send emails to all external recipients, add & verify a domain at https://resend.com/domains`;
          console.warn(`⚠️ [Resend Domain Warning] ${friendlyExplanation}`);
        } else {
          console.error(`❌ [HTTPS Email Gateway FAILURE] Resend API Rejected Request (HTTP ${res.status}):`, {
            statusCode: res.status,
            errorType: data.name || "ResendError",
            message: errorReason,
            rawResponse: data,
          });
        }
        
        resendErrorResult = { sent: false, error: friendlyExplanation, provider: "Resend HTTPS API" };
      }
    } catch (err: any) {
      console.error(`❌ [HTTPS Email Gateway EXCEPTION] Resend Fetch Failed:`, {
        message: err.message,
        stack: err.stack,
      });
      return { sent: false, error: `Resend Fetch Failed: ${err.message}`, provider: "Resend HTTPS API" };
    }
  }

  // 3. Check SendGrid API Key (https://sendgrid.com)
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      console.log(`🚀 [HTTPS Email Gateway] Dispatching via SendGrid API to ${toEmail}...`);
      const senderEmail = (process.env.SMTP_USER || "sikandaritguy@gmail.com").replace(/["']/g, "").trim();
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: senderEmail, name: "Rescuetron Emergency Network" },
          subject,
          content: [
            { type: "text/plain", value: textContent },
            { type: "text/html", value: htmlContent },
          ],
        }),
      });
      if (res.ok || res.status === 202) {
        console.log(`✅ [HTTPS Email Gateway] Sent via SendGrid HTTPS API!`);
        return { sent: true, provider: "SendGrid HTTPS API" };
      }
    } catch (err: any) {
      console.error(`❌ [HTTPS Email Gateway] SendGrid request failed:`, err.message);
    }
  }

  return resendErrorResult;
}

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

export function getMailConfig(): MailConfig {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER || "sikandaritguy@gmail.com").replace(/["']/g, "").trim();
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "xktq iowj sgje umjn").replace(/["']/g, "").trim();

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    user,
    pass,
    fromName: process.env.SMTP_FROM_NAME || "Rescuetron Emergency Alert System",
  };
}

let transporter: Transporter | null = null;

export function getTransporter(): Transporter | null {
  const config = getMailConfig();

  if (!config.user || !config.pass) {
    return null;
  }

  const sanitizedPass = config.pass.replace(/\s+/g, "");

  if (config.host.includes("gmail")) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      lookup: ipv4OnlyLookup,
      family: 4,
      auth: {
        user: config.user,
        pass: sanitizedPass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    } as any);
    return transporter;
  }

  // Create transporter with sanitized app password
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    lookup: ipv4OnlyLookup,
    family: 4,
    auth: {
      user: config.user,
      pass: sanitizedPass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
    },
  } as any);

  return transporter;
}

export async function verifySmtpConnection(): Promise<{ configured: boolean; verified: boolean; message: string; user?: string }> {
  const config = getMailConfig();
  console.log(`🔍 [SMTP HealthCheck] Verifying credentials for user: "${config.user || 'NOT_SET'}", Host: "${config.host}:${config.port}"`);

  if (!config.user || !config.pass) {
    console.warn(`⚠️ [SMTP HealthCheck Failed] Missing SMTP credentials! SMTP_USER present: ${Boolean(config.user)}, SMTP_PASS present: ${Boolean(config.pass)}`);
    return {
      configured: false,
      verified: false,
      message: "SMTP is not yet configured. Please set SMTP_USER and SMTP_PASS in backend/.env or server environment variables.",
    };
  }

  try {
    const transport = getTransporter();
    if (!transport) throw new Error("Could not initialize mail transporter");
    await transport.verify();
    console.log(`✅ [SMTP HealthCheck Passed] Successfully verified Gmail SMTP connection for ${config.user}`);
    return {
      configured: true,
      verified: true,
      message: `Gmail SMTP connected successfully via ${config.user}`,
      user: config.user,
    };
  } catch (error: any) {
    console.error(`❌ [SMTP HealthCheck Failure] Connection to ${config.host}:${config.port} failed:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return {
      configured: true,
      verified: false,
      message: `Gmail SMTP connection failed: ${error.message || error}`,
      user: config.user,
    };
  }
}

/**
 * Sends a Login / Signup 6-digit OTP Email via personal Gmail SMTP
 */
export async function sendOtpEmail(toEmail: string, otpCode: string, type: "signup" | "login" | "reset" = "signup"): Promise<{ sent: boolean; message: string; error?: string }> {
  const config = getMailConfig();
  const transport = getTransporter();

  const title = type === "signup" ? "Verify Your Account (Sign Up)" : type === "login" ? "One-Time Login Code" : "Account Verification Code";
  const actionText = type === "signup" ? "completing your registration on Rescuetron Accident Detection & Emergency System" : "signing in to your Rescuetron Emergency System account";

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 28px 30px; text-align: left;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 1px; display: inline-block;">
                      ⚡ RESCUETRON
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #ffe4e6; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
                      Accident Detection & Emergency Alert Network
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 30px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 14px 0;">${title}</h1>
              
              <p style="font-size: 14px; line-height: 22px; color: #94a3b8; margin: 0 0 24px 0;">
                You are ${actionText}. Use the verification code below to authenticate.
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #1e293b; border: 2px dashed #38bdf8; border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;">
                  YOUR 6-DIGIT VERIFICATION CODE
                </div>
                <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #ffffff; font-family: 'Courier New', Courier, monospace;">
                  ${otpCode}
                </div>
                <div style="font-size: 12px; color: #f43f5e; font-weight: 600; margin-top: 8px;">
                  ⏱ Valid for 10 minutes only
                </div>
              </div>

              <!-- Security Notice -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1e293b; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
                <tr>
                  <td width="24" valign="top" style="font-size: 16px;">🔒</td>
                  <td style="font-size: 12px; line-height: 18px; color: #cbd5e1; padding-left: 8px;">
                    <strong>Security Warning:</strong> Never share this OTP code with anyone, including Rescuetron support. If you did not request this verification code, please disregard this email.
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 20px; color: #64748b; margin: 0;">
                Stay safe,<br>
                <strong style="color: #cbd5e1;">The Rescuetron Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #020617; padding: 20px 30px; border-top: 1px solid #1e293b; text-align: center;">
              <p style="font-size: 11px; color: #475569; margin: 0 0 6px 0;">
                Sent automatically by Rescuetron Emergency SMTP Gateway
              </p>
              <p style="font-size: 11px; color: #334155; margin: 0;">
                © ${new Date().getFullYear()} Rescuetron. Real-time Crash Telemetry & Life Safety System.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = `[Rescuetron] ${otpCode} is your ${title}`;
  const textContent = `Your Rescuetron verification code is: ${otpCode}. It is valid for 10 minutes. Do not share this code.`;

  // First try HTTPS Email API (Port 443 - Bypasses Render outbound SMTP TCP blocks)
  const httpsResult = await sendViaHttpsApi({
    toEmail,
    subject,
    htmlContent,
    textContent,
  });

  if (httpsResult?.sent) {
    return {
      sent: true,
      message: `Verification code successfully delivered to ${toEmail} via ${httpsResult.provider}.`,
    };
  }

  if (!transport || !config.user || !config.pass) {
    const errorDetail = httpsResult?.error ? ` | HTTPS API Error: ${httpsResult.error}` : "";
    console.warn(`⚠️ [SMTP Service] Gmail SMTP credentials missing! User present: ${Boolean(config.user)}, Pass present: ${Boolean(config.pass)}.${errorDetail}`);
    return {
      sent: false,
      message: `Email delivery failed${errorDetail}`,
      error: httpsResult?.error || "SMTP credentials missing and HTTPS API not configured",
    };
  }

  console.log(`📧 [SMTP Service] Attempting to dispatch OTP email -> Target: "${toEmail}" | Sender: "${config.fromName} <${config.user}>" | Host: "${config.host}:${config.port}"`);

  try {
    const info = await transport.sendMail({
      from: `"${config.fromName}" <${config.user}>`,
      to: toEmail,
      subject: `[Rescuetron] ${otpCode} is your ${title}`,
      text: `Your Rescuetron verification code is: ${otpCode}. It is valid for 10 minutes. Do not share this code.`,
      html: htmlContent,
    });

    console.log(`✅ [SMTP Service] Real Gmail OTP successfully delivered to "${toEmail}"! MessageId: ${info.messageId} | Response: ${info.response}`);
    return {
      sent: true,
      message: `Verification code successfully delivered to ${toEmail} via Gmail.`,
    };
  } catch (error: any) {
    console.error(`❌ [SMTP Service Failure] Failed to send OTP email to "${toEmail}":`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });
    const combinedError = httpsResult?.error ? `${httpsResult.error}` : `Gmail SMTP Error: ${error.message || error}`;
    return {
      sent: false,
      message: combinedError,
      error: error.message || String(error),
    };
  }
}

/**
 * Sends an urgent Crash Emergency Alert Email with Live GPS Tracker Link
 */
export async function sendEmergencyAlertEmail(params: {
  toEmail: string;
  contactName?: string;
  victimName: string;
  victimPhone?: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  gForce: number;
  speedKmh?: number;
  trackerUrl: string;
  bloodGroup?: string;
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  alertId?: string;
  trackingPixelUrl?: string;
}): Promise<{ sent: boolean; message: string }> {
  const config = getMailConfig();
  const transport = getTransporter();

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${params.latitude},${params.longitude}`;
  const confirmOpenUrl = params.trackingPixelUrl
    ? `${params.trackingPixelUrl.replace('/track-open/', '/confirm-open/')}?redirect=${encodeURIComponent(params.trackerUrl)}`
    : params.trackerUrl;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 CRITICAL EMERGENCY ALERT</title>
</head>
<body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  ${params.trackingPixelUrl ? `<img src="${params.trackingPixelUrl}" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0.01;border:0;outline:none;" alt="rescuetron-beacon" />` : ''}
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #020617; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #0f172a; border-radius: 16px; border: 2px solid #e11d48; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(225, 29, 72, 0.4);">
          
          <!-- Urgent Red Banner -->
          <tr>
            <td style="background-color: #e11d48; padding: 24px 30px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 1px; text-transform: uppercase;">
                🚨 CRITICAL ACCIDENT DETECTED
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #ffe4e6; margin-top: 6px; letter-spacing: 0.5px;">
                IMMEDIATE ACTION REQUIRED • EMERGENCY CONTACT DISPATCH
              </div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 15px; line-height: 22px; color: #f1f5f9; margin: 0 0 16px 0;">
                Dear <strong>${params.contactName || "Emergency Contact"}</strong>,
              </p>
              <p style="font-size: 14px; line-height: 22px; color: #cbd5e1; margin: 0 0 20px 0;">
                An impact collision or vehicle crash was detected for <strong style="color: #ffffff; font-size: 16px;">${params.victimName}</strong>. High g-force deceleration was registered by the mobile telemetry sensors.
              </p>

              <!-- Action Buttons: Confirm Received & Live GPS Tracker -->
              <div style="text-align: center; margin: 24px 0 16px 0;">
                <a href="${confirmOpenUrl}" style="display: block; background-color: #10b981; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 15px 24px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4); letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 10px;">
                  ✅ I HAVE RECEIVED THIS ALERT (CONFIRM RESPONSE)
                </a>

                <a href="${confirmOpenUrl}" style="display: block; background-color: #0284c7; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none; padding: 12px 24px; border-radius: 12px; box-shadow: 0 8px 12px -3px rgba(2, 132, 199, 0.4); letter-spacing: 0.5px;">
                  📍 OPEN LIVE GPS TRACKER & MEDICAL ID
                </a>

                <div style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
                  Clicking either button instantly confirms response and opens real-time location.
                </div>
              </div>

              <!-- Crash Telemetry Snapshot Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <tr>
                  <td colspan="2" style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; padding-bottom: 10px; border-bottom: 1px solid #334155;">
                    📊 Incident Telemetry Snapshot
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0 6px 0; font-size: 13px; color: #94a3b8;">Impact Force:</td>
                  <td style="padding: 10px 0 6px 0; font-size: 15px; font-weight: 800; color: #f43f5e; text-align: right;">${params.gForce.toFixed(2)} G</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Speed at Impact:</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 700; color: #ffffff; text-align: right;">${(params.speedKmh || 45).toFixed(1)} km/h</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Time of Incident:</td>
                  <td style="padding: 6px 0; font-size: 13px; color: #ffffff; text-align: right;">${new Date().toLocaleString()}</td>
                </tr>
              </table>

              <!-- GPS Location Card -->
              <div style="background-color: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                  📍 Crash Location
                </div>
                <div style="font-size: 14px; font-weight: 600; color: #ffffff; line-height: 20px; margin-bottom: 8px;">
                  ${params.locationAddress || `${params.latitude.toFixed(5)}° N, ${params.longitude.toFixed(5)}° E`}
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">
                  Coordinates: ${params.latitude.toFixed(6)}, ${params.longitude.toFixed(6)}
                </div>
                <a href="${googleMapsUrl}" style="display: inline-block; background-color: #334155; color: #38bdf8; font-size: 12px; font-weight: 700; text-decoration: none; padding: 8px 16px; border-radius: 6px;">
                  🗺️ Open in Google Maps
                </a>
              </div>

              <!-- Medical Profile Card -->
              <div style="background-color: #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: 700; color: #f43f5e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
                  🩺 First Responder Medical Summary
                </div>
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">Blood Group:</td>
                    <td style="font-size: 14px; font-weight: 800; color: #e11d48; text-align: right; padding: 4px 0;">${params.bloodGroup || "O+"}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">Known Allergies:</td>
                    <td style="font-size: 13px; font-weight: 600; color: #ffffff; text-align: right; padding: 4px 0;">${params.allergies || "None"}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">Medical Conditions:</td>
                    <td style="font-size: 13px; font-weight: 600; color: #ffffff; text-align: right; padding: 4px 0;">${params.medicalConditions || "None"}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 12px; color: #94a3b8; padding: 4px 0;">Current Medications:</td>
                    <td style="font-size: 13px; font-weight: 600; color: #ffffff; text-align: right; padding: 4px 0;">${params.medications || "None"}</td>
                  </tr>
                </table>
              </div>

              ${params.victimPhone ? `
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="tel:${params.victimPhone}" style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 8px;">
                  📞 Call ${params.victimName} (${params.victimPhone})
                </a>
              </div>
              ` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #020617; padding: 20px 24px; border-top: 1px solid #1e293b; text-align: center;">
              <p style="font-size: 11px; color: #64748b; margin: 0 0 4px 0;">
                Dispatched automatically by Rescuetron Emergency Response Network
              </p>
              <p style="font-size: 10px; color: #475569; margin: 0;">
                If you cannot reach the victim, please notify local emergency services (911 / 112 / 108) immediately with the GPS coordinates above.
              </p>
              ${params.trackingPixelUrl ? `
              <!-- Invisible 1x1 Email Open Tracking Pixel -->
              <img src="${params.trackingPixelUrl}" width="1" height="1" style="display:none;width:1px;height:1px;border:0;outline:none;" alt="" />
              ` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = `🚨 [EMERGENCY SOS] Crash Detected for ${params.victimName} - Live GPS Tracker`;
  const textContent = `EMERGENCY ALERT: Accident detected for ${params.victimName} at ${params.locationAddress}. Live tracker link: ${params.trackerUrl}`;

  // First try HTTPS Email API (Port 443 - Bypasses Render outbound SMTP TCP blocks)
  const httpsResult = await sendViaHttpsApi({
    toEmail: params.toEmail,
    subject,
    htmlContent,
    textContent,
  });

  if (httpsResult?.sent) {
    return {
      sent: true,
      message: `Emergency SOS email successfully delivered to ${params.toEmail} via ${httpsResult.provider}.`,
    };
  }

  if (!transport || !config.user || !config.pass) {
    const errorDetail = httpsResult?.error ? ` | HTTPS API Error: ${httpsResult.error}` : "";
    console.warn(`⚠️ [SMTP Emergency] Gmail SMTP not configured.${errorDetail}`);
    return {
      sent: false,
      message: `Emergency email delivery failed${errorDetail}`,
    };
  }

  console.log(`🚨 [SMTP Emergency SOS] Attempting to dispatch urgent alert -> Target: "${params.toEmail}" | Victim: "${params.victimName}"`);

  try {
    const info = await transport.sendMail({
      from: `"${config.fromName} (EMERGENCY)" <${config.user}>`,
      to: params.toEmail,
      subject: `🚨 [EMERGENCY SOS] Crash Detected for ${params.victimName} - Live GPS Tracker`,
      text: `EMERGENCY ALERT: Accident detected for ${params.victimName} at ${params.locationAddress}. Live tracker link: ${params.trackerUrl}`,
      html: htmlContent,
      priority: "high",
    });

    console.log(`🚨 [SMTP Service] Real Gmail Emergency SOS dispatched to ${params.toEmail}! MessageId: ${info.messageId}`);
    return {
      sent: true,
      message: `Emergency SOS email successfully delivered to ${params.toEmail} via Gmail.`,
    };
  } catch (error: any) {
    console.error(`❌ [SMTP Emergency Failure] Emergency email failure to ${params.toEmail}:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });
    return {
      sent: false,
      message: `Failed to deliver emergency email: ${error.message || error}`,
    };
  }
}
