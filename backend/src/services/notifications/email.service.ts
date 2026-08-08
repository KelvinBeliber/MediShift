import nodemailer, { Transporter } from 'nodemailer';
import { env } from '@config/env';
import { logger } from '@utils/logger';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter | undefined {
  if (!env.smtp.host || !env.smtp.user) {
    return undefined;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const mailer = getTransporter();

  if (!mailer) {
    logger.warn(`SMTP not configured — email not sent. Would have sent to ${options.to}: "${options.subject}"`);
    logger.debug(options.html);
    return;
  }

  await mailer.sendMail({
    from: env.smtp.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export function buildVerificationEmail(rawToken: string): { subject: string; html: string } {
  const verifyUrl = `${env.clientUrl}/verify-email?token=${rawToken}`;
  return {
    subject: 'Verify your MediShift account',
    html: `<p>Welcome to MediShift. Please verify your email by visiting the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
  };
}

export function buildPasswordResetEmail(rawToken: string): { subject: string; html: string } {
  const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;
  return {
    subject: 'Reset your MediShift password',
    html: `<p>We received a request to reset your password. Visit the link below to choose a new one:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can safely ignore this email. This link expires in 1 hour.</p>`,
  };
}
