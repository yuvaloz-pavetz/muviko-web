export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const PDF_URL = "https://muviko.app/assets/309-guide.pdf";
const FROM = "Muviko <hello@muviko.app>";

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let email;
  try {
    const body = await req.json();
    email = (body.email || "").trim().toLowerCase();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Invalid email" }, 400);
  }

  // 1. Save to Supabase
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/website_subscribers`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify({ email, source: "website" }),
  });

  if (!dbRes.ok && dbRes.status !== 409) {
    const err = await dbRes.text();
    console.error("Supabase error:", err);
    return json({ error: "Database error" }, 500);
  }

  // 2. Send welcome email via Resend
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: email,
      subject: "Your free 309-day guide is here",
      html: emailHtml(email),
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.text();
    console.error("Resend error:", err);
    // Still return success — email is saved, user should retry email separately
    return json({ ok: true, emailSent: false });
  }

  return json({ ok: true, emailSent: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function emailHtml(email) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #0a1a17; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 48px 24px; }
  .logo { font-size: 22px; font-weight: 700; color: #f0ede6; margin-bottom: 40px; }
  .num { font-size: 80px; font-weight: 900; color: #3dcba5; line-height: 1; margin-bottom: 4px; }
  .title { font-size: 28px; font-weight: 700; color: #f0ede6; margin-bottom: 24px; }
  .body { font-size: 16px; color: rgba(240,237,230,0.7); line-height: 1.7; margin-bottom: 32px; }
  .btn { display: inline-block; background: #1d9e75; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 100px; font-size: 16px; font-weight: 500; margin-bottom: 40px; }
  .note { font-size: 13px; color: rgba(240,237,230,0.35); line-height: 1.6; }
  .divider { border: none; border-top: 1px solid rgba(61,203,165,0.1); margin: 32px 0; }
  .footer { font-size: 12px; color: rgba(240,237,230,0.25); }
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Muviko</div>

  <div class="num">309</div>
  <div class="title">Days of Micro Training Science — yours, free.</div>

  <div class="body">
    You just made a great decision. Your complete 309-day micro training guide is ready to download — 10 months of research-backed weekly themes, daily actions, and the habit tracker that makes it stick.
    <br><br>
    No gym required. No hour-long workouts. Just the minimum effective dose of science-backed movement, every single day.
  </div>

  <a class="btn" href="${PDF_URL}">Download your free guide →</a>

  <div class="note">
    You'll also receive a daily research insight from Muviko — one peer-reviewed micro training finding per morning, translated into plain English. Unsubscribe any time, no questions asked.
  </div>

  <hr class="divider">

  <div class="footer">
    © 2026 Muviko · <a href="https://muviko.app" style="color:rgba(240,237,230,0.3)">muviko.app</a><br>
    You're receiving this because you subscribed at muviko.app
  </div>
</div>
</body>
</html>`;
}
