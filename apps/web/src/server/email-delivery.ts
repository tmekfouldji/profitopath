import 'server-only';

import nodemailer from 'nodemailer';

import { parseRuntimeEnv } from '@profitopath/shared';

import { emailVerificationUrl } from './email-verification';
import { passwordResetUrl } from './password-reset';

export class EmailDeliveryConfigurationError extends Error {
  constructor() {
    super('Production SMTP delivery is not configured');
    this.name = 'EmailDeliveryConfigurationError';
  }
}

export function isSmtpEmailDeliveryConfigured(): boolean {
  return parseRuntimeEnv().EMAIL_PROVIDER === 'smtp';
}

export async function sendEmailVerification(input: {
  recipient: string;
  token: string;
}): Promise<void> {
  const env = parseRuntimeEnv();
  if (env.EMAIL_PROVIDER !== 'smtp') {
    throw new EmailDeliveryConfigurationError();
  }

  const verificationUrl = emailVerificationUrl(input.token);
  const transporter = nodemailer.createTransport({
    auth: {
      pass: env.SMTP_PASSWORD,
      user: env.SMTP_USER,
    },
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    requireTLS: env.SMTP_PORT === 587,
    secure: env.SMTP_PORT === 465,
  });
  await transporter.sendMail({
    from: `Profitopath <${env.EMAIL_FROM}>`,
    html: `<p>Confirm your Profitopath email address to activate sign-in.</p><p><a href="${verificationUrl}">Confirm email address</a></p><p>This link expires in ${env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES} minutes.</p>`,
    subject: 'Confirm your Profitopath email',
    text: [
      'Confirm your Profitopath email address to activate sign-in.',
      '',
      verificationUrl,
      '',
      `This link expires in ${env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES} minutes.`,
    ].join('\n'),
    to: input.recipient,
  });
}

export async function sendPasswordReset(input: {
  recipient: string;
  token: string;
}): Promise<void> {
  const env = parseRuntimeEnv();
  if (env.EMAIL_PROVIDER !== 'smtp') {
    throw new EmailDeliveryConfigurationError();
  }

  const resetUrl = passwordResetUrl(input.token);
  const transporter = nodemailer.createTransport({
    auth: {
      pass: env.SMTP_PASSWORD,
      user: env.SMTP_USER,
    },
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    requireTLS: env.SMTP_PORT === 587,
    secure: env.SMTP_PORT === 465,
  });
  await transporter.sendMail({
    from: `Profitopath <${env.EMAIL_FROM}>`,
    html: `<p>Reset your Profitopath password.</p><p><a href="${resetUrl}">Choose a new password</a></p><p>This link expires in ${env.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.</p>`,
    subject: 'Reset your Profitopath password',
    text: [
      'Reset your Profitopath password.',
      '',
      resetUrl,
      '',
      `This link expires in ${env.PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
    ].join('\n'),
    to: input.recipient,
  });
}
