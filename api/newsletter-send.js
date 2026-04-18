const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.BASE_URL || "https://muviko.app";
const FROM = "Muviko <hello@muviko.app>";

// Runs daily via cron — self-filters to Mon/Wed/Fri
module.exports = async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Only send on Mon (1), Wed (3), Fri (5)
  const day = new Date().getDay();
  if (![1, 3, 5].includes(day)) {
    return res.json({ skipped: true, reason: "not a newsletter day" });
  }

  // Read latest article
  let articles;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "articles.json"), "utf8");
    articles = JSON.parse(raw);
  } catch {
    return res.status(500).json({ error: "Could not read articles.json" });
  }

  if (!articles.length) return res.json({ skipped: true, reason: "no articles yet" });

  const article = articles[0];

  // Check if already sent
  const sentCheck = await fetch(
    `${SUPABASE_URL}/rest/v1/newsletter_sends?article_slug=eq.${encodeURIComponent(article.slug)}&select=id`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const sentRows = await sentCheck.json();
  if (sentRows.length) return res.json({ skipped: true, reason: "already sent", slug: article.slug });

  // Fetch active subscribers
  const subsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/website_subscribers?unsubscribed_at=is.null&select=email,unsubscribe_token`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const subscribers = await subsRes.json();
  if (!subscribers.length) return res.json({ skipped: true, reason: "no subscribers" });

  // Batch-send via Resend (max 100 per call)
  const articleUrl = `${BASE_URL}/articles/${article.slug}.html`;
  const batches = chunk(subscribers, 100);
  let sent = 0;

  for (const batch of batches) {
    const emails = batch.map(sub => ({
      from: FROM,
      to: sub.email,
      subject: article.title,
      html: newsletterHtml(article, articleUrl, sub.unsubscribe_token),
    }));

    const batchRes = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(emails),
    });

    if (batchRes.ok) sent += batch.length;
    else console.error("Resend batch error:", await batchRes.text());
  }

  // Record the send
  await fetch(`${SUPABASE_URL}/rest/v1/newsletter_sends`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ article_slug: article.slug, recipient_count: sent }),
  });

  return res.json({ ok: true, sent, article: article.slug });
};

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function newsletterHtml(article, articleUrl, token) {
  const unsubUrl = `${BASE_URL}/api/unsubscribe?token=${token}`;
  const date = new Date(article.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0a1a17;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:560px;margin:0 auto;padding:40px 24px}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px;padding-bottom:20px;border-bottom:1px solid rgba(61,203,165,0.1)}
  .logo{font-size:18px;font-weight:700;color:#f0ede6}
  .date{font-size:12px;color:rgba(240,237,230,0.3);letter-spacing:0.06em}
  .tag{font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#3dcba5;margin-bottom:16px}
  .title{font-size:26px;font-weight:700;color:#f0ede6;line-height:1.3;margin-bottom:20px;font-family:Georgia,serif}
  .excerpt{font-size:16px;color:rgba(240,237,230,0.65);line-height:1.75;margin-bottom:28px}
  .read-btn{display:inline-block;background:#1d9e75;color:#fff;text-decoration:none;padding:13px 28px;border-radius:100px;font-size:14px;font-weight:500;margin-bottom:40px}
  hr{border:none;border-top:1px solid rgba(61,203,165,0.1);margin:32px 0}
  .footer{font-size:12px;color:rgba(240,237,230,0.25);line-height:1.7}
  .footer a{color:rgba(240,237,230,0.35);text-decoration:none}
  .footer a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <span class="logo">Muviko</span>
    <span class="date">${date}</span>
  </div>

  <div class="tag">Micro Training Research</div>
  <div class="title">${article.title}</div>
  <div class="excerpt">${article.excerpt}</div>
  <a class="read-btn" href="${articleUrl}">Read the full breakdown →</a>

  <hr>

  <div class="footer">
    You're receiving this because you subscribed at muviko.app.<br>
    <a href="${unsubUrl}">Unsubscribe</a> · <a href="https://muviko.app">muviko.app</a> · © 2026 Muviko
  </div>
</div>
</body>
</html>`;
}
