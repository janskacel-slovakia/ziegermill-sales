import nodemailer from 'nodemailer';

// Outgoing email for /admin (password reset, registration notice; later the offers to clients).
// Configured by environment variables, the first that is set wins:
//   SMTP_HOST, SMTP_PORT (465 = TLS), SMTP_USER, SMTP_PASS   e.g. a ziegermill.sk mailbox at exohosting
//   RESEND_API_KEY                                          a Resend account with the sender's domain verified
// MAIL_FROM is the sender, e.g. "Ziegermill <predaj@ziegermill.sk>". With neither set, nothing is sent: in development
// the message is printed to the server log, in production sendMail reports 'off'.
export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string; from?: string };

export function mailConfigured() {
  return !!(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
}

export async function sendMail(m: Mail): Promise<'sent' | 'logged' | 'off'> {
  const from = m.from || process.env.MAIL_FROM || 'Ziegermill <noreply@ziegermill.sk>';
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 465);
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await t.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: m.replyTo });
    return 'sent';
  }
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, text: m.text, html: m.html, reply_to: m.replyTo }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    return 'sent';
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n[mail – not configured, printed instead]\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
    return 'logged';
  }
  return 'off';
}

// Base address for links in emails: SITE_URL if set, else the address the request came to.
export function siteUrl(reqOrigin: string) {
  return (process.env.SITE_URL || reqOrigin).replace(/\/$/, '');
}
