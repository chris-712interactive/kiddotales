type MailgunMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function getMailgunConfig(): {
  apiKey: string;
  domain: string;
  baseUrl: string;
  fromEmail: string;
} | null {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const baseUrl = process.env.MAILGUN_BASE_URL;
  if (!apiKey || !domain || !baseUrl) return null;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `KiddoTales <postmaster@${domain}>`;
  return { apiKey, domain, baseUrl: baseUrl.replace(/\/+$/, ""), fromEmail };
}

export async function sendMailgunEmail(message: MailgunMessage): Promise<boolean> {
  const cfg = getMailgunConfig();
  if (!cfg) return false;

  const body = new URLSearchParams();
  body.set("from", cfg.fromEmail);
  body.set("to", message.to);
  body.set("subject", message.subject);
  body.set("text", message.text);
  if (message.html) body.set("html", message.html);

  try {
    const res = await fetch(`${cfg.baseUrl}/v3/${cfg.domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${cfg.apiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const msg = await res.text();
      console.warn("[Mailgun] send failed:", res.status, msg);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[Mailgun] send error:", err);
    return false;
  }
}

export async function sendGiftMembershipEmails(params: {
  purchaserEmail?: string | null;
  recipientEmail?: string | null;
  giftCode: string;
  tier: "spark" | "magic" | "legend";
  durationMonths: number;
}): Promise<void> {
  const durationLabel = params.durationMonths === 12 ? "1 year" : `${params.durationMonths} month`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kiddo-tales.com";
  const redeemUrl = `${appUrl}/settings`;

  if (params.purchaserEmail) {
    await sendMailgunEmail({
      to: params.purchaserEmail,
      subject: `Your KiddoTales gift code is ready`,
      text: [
        `Thanks for gifting KiddoTales!`,
        ``,
        `Gift plan: ${params.tier}`,
        `Duration: ${durationLabel}`,
        `Gift code: ${params.giftCode}`,
        ``,
        `Share this code with the recipient. They can redeem it at: ${redeemUrl}`,
      ].join("\n"),
      html: `
        <p>Thanks for gifting <strong>KiddoTales</strong>!</p>
        <p><strong>Gift plan:</strong> ${params.tier}<br/>
        <strong>Duration:</strong> ${durationLabel}<br/>
        <strong>Gift code:</strong> <code>${params.giftCode}</code></p>
        <p>Share this code with the recipient. They can redeem it at <a href="${redeemUrl}">${redeemUrl}</a>.</p>
      `,
    });
  }

  if (params.recipientEmail) {
    await sendMailgunEmail({
      to: params.recipientEmail,
      subject: `You received a KiddoTales gift membership`,
      text: [
        `You received a KiddoTales gift membership!`,
        ``,
        `Gift plan: ${params.tier}`,
        `Duration: ${durationLabel}`,
        `Gift code: ${params.giftCode}`,
        ``,
        `Redeem your gift by signing in and entering this code at: ${redeemUrl}`,
      ].join("\n"),
      html: `
        <p>You received a <strong>KiddoTales</strong> gift membership!</p>
        <p><strong>Gift plan:</strong> ${params.tier}<br/>
        <strong>Duration:</strong> ${durationLabel}<br/>
        <strong>Gift code:</strong> <code>${params.giftCode}</code></p>
        <p>Redeem your gift by signing in and entering this code at <a href="${redeemUrl}">${redeemUrl}</a>.</p>
      `,
    });
  }
}
