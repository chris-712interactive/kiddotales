type MailgunMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function buildGiftEmailHtml(params: {
  heading: string;
  intro: string;
  planLabel: string;
  durationLabel: string;
  giftCode: string;
  ctaUrl: string;
  ctaLabel: string;
  outro?: string;
}): string {
  const logoUrl = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || "https://kiddo-tales.com/logo-email.png";
  return `
    <div style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:22px 24px 10px 24px;text-align:center;background:linear-gradient(180deg,#fff7ed 0%,#ffffff 100%);">
                  <img src="${logoUrl}" alt="KiddoTales" width="160" style="display:block;margin:0 auto 8px auto;border:0;outline:none;text-decoration:none;" />
                  <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">KiddoTales</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px 0 24px;">
                  <h1 style="margin:0 0 10px 0;font-size:24px;line-height:1.25;color:#0f172a;">${params.heading}</h1>
                  <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#334155;">${params.intro}</p>
                  <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:14px 16px;margin:0 0 18px 0;">
                    <p style="margin:0 0 6px 0;font-size:14px;color:#334155;"><strong>Gift plan:</strong> ${params.planLabel}</p>
                    <p style="margin:0 0 6px 0;font-size:14px;color:#334155;"><strong>Duration:</strong> ${params.durationLabel}</p>
                    <p style="margin:0;font-size:14px;color:#334155;"><strong>Gift code:</strong> <span style="font-family:ui-monospace,Menlo,Consolas,monospace;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 8px;">${params.giftCode}</span></p>
                  </div>
                  <div style="margin:0 0 16px 0;">
                    <a href="${params.ctaUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;padding:11px 16px;font-weight:600;font-size:14px;">${params.ctaLabel}</a>
                  </div>
                  ${params.outro ? `<p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#475569;">${params.outro}</p>` : ""}
                  <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#64748b;">If you need help, just reply to this email and we&apos;ll take care of you.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">You&apos;re receiving this message because a KiddoTales gift membership was purchased. KiddoTales • Bedtime magic in minutes.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

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
  body.set("h:Reply-To", "support@712int.com");
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
  const planLabel =
    params.tier === "spark"
      ? "Spark"
      : params.tier === "magic"
        ? "Magic"
        : "Legend";

  if (params.purchaserEmail) {
    await sendMailgunEmail({
      to: params.purchaserEmail,
      subject: `Your KiddoTales gift code is ready ✨`,
      text: [
        `Amazing gift choice!`,
        ``,
        `Your KiddoTales gift membership is ready to share.`,
        ``,
        `Gift plan: ${planLabel}`,
        `Duration: ${durationLabel}`,
        `Gift code: ${params.giftCode}`,
        ``,
        `Next steps:`,
        `1) Share this gift code with your recipient`,
        `2) Ask them to sign in at KiddoTales`,
        `3) They can redeem it at: ${redeemUrl}`,
        ``,
        `Need help? Reply to this email.`,
      ].join("\n"),
      html: buildGiftEmailHtml({
        heading: "Your gift code is ready!",
        intro:
          "Thanks for gifting KiddoTales. You can share the gift code below with your recipient so they can start creating personalized bedtime stories.",
        planLabel,
        durationLabel,
        giftCode: params.giftCode,
        ctaUrl: redeemUrl,
        ctaLabel: "Open KiddoTales",
        outro:
          "Tip: keep this email handy so you can resend the code anytime.",
      }),
    });
  }

  if (params.recipientEmail) {
    await sendMailgunEmail({
      to: params.recipientEmail,
      subject: `You received a KiddoTales gift membership 🎁`,
      text: [
        `Great news - you received a KiddoTales gift membership!`,
        ``,
        `Gift plan: ${planLabel}`,
        `Duration: ${durationLabel}`,
        `Gift code: ${params.giftCode}`,
        ``,
        `How to redeem:`,
        `1) Sign in to KiddoTales`,
        `2) Go to Settings`,
        `3) Enter the gift code above`,
        ``,
        `Redeem here: ${redeemUrl}`,
        ``,
        `Enjoy creating magical personalized stories!`,
      ].join("\n"),
      html: buildGiftEmailHtml({
        heading: "You got a KiddoTales gift!",
        intro:
          "Someone gifted you a KiddoTales membership so you can create personalized bedtime stories your child will love.",
        planLabel,
        durationLabel,
        giftCode: params.giftCode,
        ctaUrl: redeemUrl,
        ctaLabel: "Redeem my gift",
        outro:
          "We can&apos;t wait to see the stories you create.",
      }),
    });
  }
}
