import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.ts';

export interface ContactNotificationData {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at?: string | Date;
}

export interface IEmailTransporter {
  sendMail(mailOptions: any): Promise<any>;
}

/**
 * Service for sending email notifications on new contact submissions.
 * Handles missing configuration gracefully without failing public contact submissions.
 */
export class EmailService {
  private static customTransporter: IEmailTransporter | null = null;

  /**
   * Allows injecting a custom transporter for testing or alternative delivery providers.
   */
  public static setTransporter(transporter: IEmailTransporter | null): void {
    EmailService.customTransporter = transporter;
  }

  /**
   * Checks if SMTP configuration is present in environment variables.
   */
  public static isConfigured(): boolean {
    if (EmailService.customTransporter) {
      return true;
    }
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    return Boolean(host && user && pass);
  }

  /**
   * Sends an email notification to the site administrator when a new message is received.
   */
  public static async sendContactNotification(data: ContactNotificationData): Promise<boolean> {
    try {
      if (EmailService.customTransporter) {
        const toEmail = process.env.CONTACT_EMAIL_TO || process.env.SMTP_USER || 'admin@portfolio.local';
        const fromEmail = process.env.CONTACT_EMAIL_FROM || process.env.SMTP_USER || 'no-reply@portfolio.local';

        await EmailService.customTransporter.sendMail({
          from: `"Portfolio Contact Form" <${fromEmail}>`,
          to: toEmail,
          replyTo: data.email,
          subject: `[Portfolio Contact] ${data.subject} - from ${data.name}`,
          text: `You have received a new contact inquiry through your portfolio website.\n\nFrom: ${data.name} (${data.email})\nSubject: ${data.subject}\nDate: ${new Date().toISOString()}\n\nMessage:\n${data.message}\n\n---\nView and manage this inquiry in your Portfolio Admin Portal.`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
              <h2 style="color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-top: 0;">New Portfolio Contact Message</h2>
              <p><strong>Sender:</strong> ${data.name} (&lt;<a href="mailto:${data.email}">${data.email}</a>&gt;)</p>
              <p><strong>Subject:</strong> ${data.subject}</p>
              <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #0284c7;">
                <p style="white-space: pre-wrap; margin: 0;">${data.message}</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This message was submitted via your Portfolio CMS website contact form.</p>
            </div>
          `,
        });
        logger.info(`Contact notification email dispatched for message ID: ${data.id}`);
        return true;
      }

      if (!EmailService.isConfigured()) {
        logger.info(
          `SMTP is not configured in environment variables. Message ID: ${data.id} from "${data.email}" saved to database successfully.`
        );
        return false;
      }

      const host = process.env.SMTP_HOST!;
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      const user = process.env.SMTP_USER!;
      const pass = process.env.SMTP_PASS!;
      const toEmail = process.env.CONTACT_EMAIL_TO || user;
      const fromEmail = process.env.CONTACT_EMAIL_FROM || user;

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from: `"Portfolio Contact Form" <${fromEmail}>`,
        to: toEmail,
        replyTo: data.email,
        subject: `[Portfolio Contact] ${data.subject} - from ${data.name}`,
        text: `You have received a new contact inquiry through your portfolio website.\n\nFrom: ${data.name} (${data.email})\nSubject: ${data.subject}\nDate: ${new Date().toISOString()}\n\nMessage:\n${data.message}\n\n---\nView and manage this inquiry in your Portfolio Admin Portal.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
            <h2 style="color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-top: 0;">New Portfolio Contact Message</h2>
            <p><strong>Sender:</strong> ${data.name} (&lt;<a href="mailto:${data.email}">${data.email}</a>&gt;)</p>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Received:</strong> ${new Date().toLocaleString()}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #0284c7;">
              <p style="white-space: pre-wrap; margin: 0;">${data.message}</p>
            </div>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">This message was submitted via your Portfolio CMS website contact form.</p>
          </div>
        `,
      });

      logger.info(`Contact notification email dispatched for message ID: ${data.id}`);
      return true;
    } catch (err: any) {
      logger.error('Failed to send contact notification email:', {
        messageId: data.id,
        error: err?.message || err,
      });
      // Do not rethrow: email delivery failure should not break contact message persistence
      return false;
    }
  }
}
