import { Resend } from 'resend';

// Lazy-initialize Resend client to avoid build-time errors
let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Default from address
export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'noreply@talentflow.com';
