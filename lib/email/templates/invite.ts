interface InviteEmailProps {
  inviteeName: string;
  inviterName: string;
  inviteUrl: string;
  expiresIn: string;
}

export function getInviteEmailSubject(): string {
  return "You've been invited to Talent Flow";
}

export function getInviteEmailHtml({
  inviteeName,
  inviterName,
  inviteUrl,
  expiresIn,
}: InviteEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to Talent Flow</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Talent Flow</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Recruiting CRM</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="margin-top: 0; color: #1f2937;">You're Invited!</h2>

    <p>Hi${inviteeName ? ` ${inviteeName}` : ''},</p>

    <p><strong>${inviterName}</strong> has invited you to join Talent Flow, our recruiting CRM platform.</p>

    <p>Click the button below to set up your account:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="background: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
        Accept Invitation
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      This invitation link will expire in <strong>${expiresIn}</strong>.
    </p>

    <p style="color: #6b7280; font-size: 14px;">
      If you didn't expect this invitation, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteUrl}" style="color: #4f46e5; word-break: break-all;">${inviteUrl}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>RTT Commerce BV - Talent Flow</p>
  </div>
</body>
</html>
`;
}

export function getInviteEmailText({
  inviteeName,
  inviterName,
  inviteUrl,
  expiresIn,
}: InviteEmailProps): string {
  return `
You're Invited to Talent Flow!

Hi${inviteeName ? ` ${inviteeName}` : ''},

${inviterName} has invited you to join Talent Flow, our recruiting CRM platform.

Click the link below to set up your account:
${inviteUrl}

This invitation link will expire in ${expiresIn}.

If you didn't expect this invitation, you can safely ignore this email.

---
RTT Commerce BV - Talent Flow
`;
}
