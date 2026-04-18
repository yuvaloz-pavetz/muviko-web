const { randomBytes } = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_URL = process.env.BASE_URL || "https://muviko.app";

const PDF_URL = `${BASE_URL}/assets/month-01.pdf`;
const FROM = "Muviko <hello@muviko.app>";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const token = randomBytes(32).toString("hex");

  // 1. Save to Supabase with unsubscribe token
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/website_subscribers`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify({ email: cleanEmail, source: "website", unsubscribe_token: token }),
  });

  // If duplicate, fetch their existing token instead
  let unsubToken = token;
  if (dbRes.status === 409 || !dbRes.ok) {
    const existing = await fetch(
      `${SUPABASE_URL}/rest/v1/website_subscribers?email=eq.${encodeURIComponent(cleanEmail)}&select=unsubscribe_token`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const rows = await existing.json();
    if (rows.length) unsubToken = rows[0].unsubscribe_token;
  }

  // 2. Send welcome email via Resend
  const unsubUrl = `${BASE_URL}/api/unsubscribe?token=${unsubToken}`;
  let emailSent = false;
  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: cleanEmail,
        subject: "Your free Month 1 guide is here",
        html: welcomeHtml(unsubUrl),
      }),
    });
    emailSent = emailRes.ok;
    if (!emailRes.ok) console.error("Resend error:", await emailRes.text());
  } catch (err) {
    console.error("Resend fetch error:", err);
  }

  return res.status(200).json({ ok: true, emailSent });
};

function welcomeHtml(unsubUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0a1a17;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:560px;margin:0 auto;padding:48px 24px}
  .logo{font-size:22px;font-weight:700;color:#f0ede6;margin-bottom:40px}
  .month-badge{display:inline-block;background:rgba(29,158,117,0.15);border:1px solid rgba(61,203,165,0.3);color:#3dcba5;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:5px 14px;border-radius:100px;margin-bottom:24px}
  .title{font-size:30px;font-weight:700;color:#f0ede6;line-height:1.25;margin-bottom:20px;font-family:Georgia,serif}
  .body{font-size:16px;color:rgba(240,237,230,0.65);line-height:1.75;margin-bottom:32px}
  .btn{display:inline-block;background:#1d9e75;color:#fff;text-decoration:none;padding:16px 32px;border-radius:100px;font-size:15px;font-weight:500;margin-bottom:16px}
  .next-up{background:rgba(13,36,32,0.8);border:1px solid rgba(61,203,165,0.12);border-radius:12px;padding:20px 24px;margin:32px 0;font-size:14px;color:rgba(240,237,230,0.55);line-height:1.6}
  .next-up strong{color:#f0ede6;display:block;margin-bottom:4px}
  .note{font-size:13px;color:rgba(240,237,230,0.3);line-height:1.6;margin-bottom:40px}
  hr{border:none;border-top:1px solid rgba(61,203,165,0.1);margin:32px 0}
  .footer{font-size:12px;color:rgba(240,237,230,0.25);line-height:1.7}
  .footer a{color:rgba(240,237,230,0.35);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Muviko</div>

  <div class="month-badge">Month 1 of 10</div>
  <div class="title">The Minimum Effective Dose — your free guide is here.</div>
  <div class="body">
    Welcome. Your 30-day Month 1 guide covers the science that started everything — why 3.4 minutes of vigorous movement cuts heart attack risk by 51%, what "vigorous" actually means, and how to build your baseline in the next 30 days.
  </div>

  <a class="btn" href="${PDF_URL}">Download Month 1 →</a>

  <div class="next-up">
    <strong>What happens next</strong>
    Three times a week (Mon, Wed, Fri) you'll receive one research insight in your inbox — a single peer-reviewed finding, translated into plain language, with a link to the full breakdown on our blog. In 30 days, Month 2 will be ready to unlock.
  </div>

  <div class="note">
    No spam. Ever. You're in control — unsubscribe any time with one click below.
  </div>

  <hr>

  <div class="footer">
    © 2026 Muviko · <a href="https://muviko.app">muviko.app</a><br>
    You subscribed at muviko.app · <a href="${unsubUrl}">Unsubscribe</a>
  </div>
</div>
</body>
</html>`;
}
