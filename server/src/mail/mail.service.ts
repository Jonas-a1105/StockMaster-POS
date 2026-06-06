import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port || '587', 10),
        secure: port === '465',
        auth: { user, pass },
      });
      this.logger.log(`Mail transport configured: ${user} @ ${host}:${port}`);
    } else {
      this.logger.warn('SMTP not configured. Email features disabled. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
    }
  }

  private getFrontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Cannot send verification email to ${email}: SMTP not configured`);
      return false;
    }

    const frontendUrl = this.getFrontendUrl();
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: `"StockMaster POS" <${this.config.get<string>('SMTP_USER')}>`,
        to: email,
        subject: 'Verifica tu correo electrónico - StockMaster POS',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #fbbf24;">StockMaster POS</h2>
            <p>Hola <strong>${name}</strong>,</p>
            <p>Gracias por registrarte. Para verificar tu dirección de correo electrónico, haz clic en el siguiente botón:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${verifyUrl}" 
                 style="background-color: #fbbf24; color: #000; padding: 10px 24px; 
                        border-radius: 8px; text-decoration: none; font-weight: bold;">
                Verificar Correo
              </a>
            </div>
            <p style="color: #888; font-size: 12px;">
              Si no creaste una cuenta en StockMaster POS, ignora este mensaje.
              <br>Este enlace expira en 24 horas.
            </p>
          </div>
        `,
      });
      this.logger.log(`Verification email sent to ${email}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}: ${err}`);
      return false;
    }
  }
}
