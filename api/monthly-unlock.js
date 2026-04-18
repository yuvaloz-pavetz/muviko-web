const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.BASE_URL || "https://muviko.app";
const FROM = "Muviko <hello@muviko.app>";

const MONTH_META = [
  { num: 1,  title: "The Minimum Effective Dose",  tagline: "Why 3 minutes rewires your biology" },
  { num: 2,  title: "Morning Protocol",             tagline: "The 90-second start that changes everything" },
  { num: 3,  title: "Work-Day Wins",                tagline: "From desk-bound to movement-rich" },
  { num: 4,  title: "Heart Defense",                tagline: "Rewiring your cardiovascular risk in minutes" },
  { num: 5,  title: "Cancer Defense",               tagline: "4.5 minutes. 32% lower risk. The evidence." },
  { num: 6,  title: "Strength Snacks",              tagline: "Building muscle in the gaps of your day" },
  { num: 7,  title: "Metabolic Reset",              tagline: "Movement as medicine for energy and blood sugar" },
  { num: 8,  title: "Brain Performance",            tagline: "Movement is the most powerful cognitive tool you own" },
  { num: 9,  title: "Recovery Science",             tagline: "Rest is not the opposite of training — it is training" },
  { num: 10, title: "Built to Last",                tagline: "309 days of movement — and a lifetime of it after" },
];

// Runs daily — finds subscribers who just hit a 30-day milestone and haven't
// received that month's unlock email yet, then sends it.
module.exports = async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Fetch all active subscribers
  const subsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/website_subscribers?unsubscribed_at=is.null&select=id,email,created_at,months_unlocked,unsubscribe_token`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
  );
  const subscribers = await subsRes.json();

  const now = Date.now();
  const results = [];

  for (const sub of subscribers) {
    const daysSince = (now - new Date(sub.created_at).getTime()) / 86400000;
    // Which month they should unlock next (they have month 1 from welcome email)
    const monthsUnlocked = sub.months_unlocked || [];
    // months 2–10 unlock at days 30, 60, 90 ...
    for (let m = 2; m <= 10; m++) {
      const minDays = (m - 1) * 30;
      if (daysSince >= minDays && !monthsUnlocked.includes(m)) {
        // Send unlock email for month m
        const meta = MONTH_META[m - 1];
        const sent = await sendUnlockEmail(sub, meta);
        if (sent) {
          // Record it so we don't send again
          await fetch(
            `${SUPABASE_URL}/rest/v1/website_subscribers?id=eq.${sub.id}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ months_unlocked: [...monthsUnlocked, m] }),
            }
          );
          results.push({ email: sub.email, month: m });
        }
        break; // only one unlock email per run per subscriber
      }
    }
  }

  return res.json({ ok: true, sent: results.length, details: results });
};

async function sendUnlockEmail(sub, meta) {
  const unlockUrl = `${BASE_URL}/api/unlock?month=${meta.num}&token=${sub.unsubscribe_token}`;
  const unsubUrl = `${BASE_URL}/api/unsubscribe?token=${sub.unsubscribe_token}`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: sub.email,
      subject: `Month ${meta.num} is ready — ${meta.title}`,
      html: unlockEmailHtml(meta, unlockUrl, unsubUrl),
    }),
  });

  if (!emailRes.ok) console.error(`Resend error for ${sub.email}:`, await emailRes.text());
  return emailRes.ok;
}

function unlockEmailHtml(meta, unlockUrl, unsubUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0a1a17;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}
  .wrap{max-width:560px;margin:0 auto;padding:40px 24px}
  .logo{font-size:18px;font-weight:700;color:#f0ede6;margin-bottom:40px}
  .month-badge{display:inline-block;background:rgba(29,158,117,0.15);border:1px solid rgba(61,203,165,0.3);color:#3dcba5;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:5px 14px;border-radius:100px;margin-bottom:24px}
  .title{font-size:30px;font-weight:700;color:#f0ede6;line-height:1.2;margin-bottom:12px;font-family:Georgia,serif}
  .tagline{font-size:16px;color:rgba(240,237,230,0.5);margin-bottom:28px}
  .body{font-size:16px;color:rgba(240,237,230,0.65);line-height:1.75;margin-bottom:32px}
  .unlock-btn{display:inline-block;background:#1d9e75;color:#fff;text-decoration:none;padding:15px 32px;border-radius:100px;font-size:15px;font-weight:500;margin-bottom:20px}
  .note{font-size:13px;color:rgba(240,237,230,0.3);margin-bottom:40px;line-height:1.6}
  hr{border:none;border-top:1px solid rgba(61,203,165,0.1);margin:32px 0}
  .footer{font-size:12px;color:rgba(240,237,230,0.25);line-height:1.7}
  .footer a{color:rgba(240,237,230,0.35);text-decoration:none}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">Muviko</div>

  <div class="month-badge">Month ${meta.num} of 10</div>
  <div class="title">${meta.title}</div>
  <div class="tagline">${meta.tagline}</div>

  <div class="body">
    You've been building for 30 days. Month ${meta.num} is ready when you are — no pressure, no deadline. Click below whenever it feels right. Your link will always work.
  </div>

  <a class="unlock-btn" href="${unlockUrl}">Unlock Month ${meta.num} →</a>

  <div class="note">
    This is your personal unlock link — it's yours to keep. If you're not ready yet, come back to this email whenever you are.
  </div>

  <hr>

  <div class="footer">
    You're receiving this as part of your Muviko subscription.<br>
    <a href="${unsubUrl}">Unsubscribe</a> · <a href="https://muviko.app" style="color:rgba(240,237,230,0.35)">muviko.app</a> · © 2026 Muviko
  </div>
</div>
</body>
</html>`;
}
