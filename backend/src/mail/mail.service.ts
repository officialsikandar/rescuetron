import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
    const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!user || !pass) {
      this.logger.warn('⚠️ Gmail SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS in .env');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    this.logger.log(`📧 Gmail SMTP Transporter initialized for ${user}`);
  }

  async sendOtpEmail(toEmail: string, otpCode: string, type: 'signup' | 'login' = 'signup') {
    if (!this.transporter) {
      this.initTransporter();
    }

    const title = type === 'signup' ? 'Verify Your Account' : 'Login One-Time Password';
    const user = process.env.SMTP_USER || 'alerts@rescuetron.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Rescuetron Emergency System';

    if (!this.transporter) {
      this.logger.warn(`Simulated OTP for ${toEmail}: ${otpCode}`);
      return { sent: false, message: `Simulated OTP ${otpCode} for ${toEmail}` };
    }

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${user}>`,
        to: toEmail,
        subject: `[Rescuetron] ${otpCode} is your ${title}`,
        html: `
          <div style="background-color: #020617; padding: 30px; font-family: sans-serif; color: #ffffff;">
            <div style="max-width: 500px; margin: auto; background-color: #0f172a; border-radius: 12px; padding: 24px; border: 1px solid #1e293b;">
              <h2 style="color: #e11d48; margin-top: 0;">⚡ RESCUETRON</h2>
              <p style="color: #cbd5e1;">Your 6-digit verification code is:</p>
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; padding: 16px; background: #1e293b; text-align: center; border-radius: 8px;">
                ${otpCode}
              </div>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">This code expires in 10 minutes. Do not share it with anyone.</p>
            </div>
          </div>
        `,
      });
      this.logger.log(`✅ OTP email delivered to ${toEmail} via Gmail`);
      return { sent: true, message: `OTP sent to ${toEmail}` };
    } catch (e: any) {
      this.logger.error(`❌ Failed to send OTP to ${toEmail}: ${e.message}`);
      return { sent: false, message: e.message };
    }
  }

  async sendEmergencyAlertEmail(params: {
    toEmail: string;
    victimName: string;
    locationAddress: string;
    latitude: number;
    longitude: number;
    gForce: number;
    trackerUrl: string;
    bloodGroup?: string;
  }) {
    if (!this.transporter) {
      this.initTransporter();
    }

    const user = process.env.SMTP_USER || 'alerts@rescuetron.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Rescuetron Emergency System';

    if (!this.transporter) {
      this.logger.warn(`Simulated Emergency SOS to ${params.toEmail}`);
      return { sent: false, message: 'Simulated dispatch' };
    }

    try {
      await this.transporter.sendMail({
        from: `"${fromName} (EMERGENCY)" <${user}>`,
        to: params.toEmail,
        subject: `🚨 [EMERGENCY SOS] Crash Detected for ${params.victimName}`,
        html: `
          <div style="background-color: #020617; padding: 30px; font-family: sans-serif; color: #ffffff;">
            <div style="max-width: 550px; margin: auto; background-color: #0f172a; border-radius: 12px; padding: 24px; border: 2px solid #e11d48;">
              <h2 style="color: #e11d48; margin-top: 0;">🚨 CRITICAL ACCIDENT DETECTED</h2>
              <p style="color: #f1f5f9;">Accident detected for <strong>${params.victimName}</strong>.</p>
              <p style="color: #94a3b8;">Impact Force: <strong style="color: #f43f5e;">${params.gForce} G</strong></p>
              <p style="color: #94a3b8;">Location: <strong>${params.locationAddress}</strong></p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${params.trackerUrl}" style="background-color: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                  📍 OPEN LIVE GPS TRACKER
                </a>
              </div>
            </div>
          </div>
        `,
        priority: 'high',
      });
      this.logger.log(`🚨 Emergency email delivered to ${params.toEmail}`);
      return { sent: true };
    } catch (e: any) {
      this.logger.error(`❌ Failed to send Emergency alert: ${e.message}`);
      return { sent: false, message: e.message };
    }
  }
}
