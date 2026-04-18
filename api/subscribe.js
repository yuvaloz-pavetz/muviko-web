const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const PDF_URL = "https://muviko-web.vercel.app/assets/309-guide.pdf";
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

  // 1. Save to Supabase
  try {
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/website_subscribers`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify({ email: cleanEmail, source: "website" }),
    });
    if (!dbRes.ok && dbRes.status !== 409) {
      const err = await dbRes.text();
      console.error("Supabase error:", dbRes.status, err);
    }
  } catch (err) {
    console.error("Supabase fetch error:", err);
  }

  // 2. Send welcome email via Resend
  let emailSent = false;
  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: cleanEmail,
        subject: "Your free 309-day guide is here",
        html: emailHtml(),
      }),
    });
    emailSent = emailRes.ok;
    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error("Resend error:", emailRes.status, err);
    }
  } catch (err) {
    console.error("Resend fetch error:", err);
  }

  return res.status(200).json({ ok: true, emailSent });
};

function emailHtml() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0a1a17;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:560px;margin:0 auto;padding:48px 24px}
  .logo{font-size:22px;font-weight:700;color:#f0ede6;margin-bottom:40px}
  .num{font-size:80px;font-weight:900;color:#3dcba5;line-height:1;margin-bottom:4px;font-family:Georgia,serif}
  .title{font-size:28px;font-weight:700;color:#f0ede6;margin-bottom:24px;font-family:Georgia,serif}
  .body{font-size:16px;color:rgba(240,237,230,0.7);line-height:1.7;margin-bottom:32px}
  .btn{display:inline-block;background:#1d9e75;color:#fff;text-decoration:none;padding:16px 32px;border-radius:100px;font-size:16px;font-weight:500;margin-bottom:40px}
  .note{font-size:13px;color:rgba(240,237,230,0.35);line-height:1.6}
  hr{border:none;border-top:1px solid rgba(61,203,165,0.1);margin:32px 0}
  .footer{font-size:12px;color:rgba(240,237,230,0.25)}
  a.footer-link{color:rgba(240,237,230,0.3)}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Muviko</div>
  <div class="num">309</div>
  <div class="title">Days of Micro Training Science — yours, free.</div>
  <div class="body">
    You just made a great decision. Your complete 309-day micro training guide is ready to download — 10 months of research-backed weekly themes, daily actions, and the habit tracker that makes it stick.<br><br>
    No gym required. No hour-long workouts. Just the minimum effective dose of science-backed movement, every single day.
  </div>
  <a class="btn" href="${PDF_URL}">Download your free guide →</a>
  <div class="note">
    You'll also receive a daily research insight from Muviko — one peer-reviewed micro training finding per morning, translated into plain English. Unsubscribe any time, no questions asked.
  </div>
  <hr>
  <div class="footer">
    © 2026 Muviko · <a href="https://muviko.app" class="footer-link">muviko.app</a><br>
    You're receiving this because you subscribed at muviko.app
  </div>
</div>
</body>
</html>`;
}
