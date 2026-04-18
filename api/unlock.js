const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL || "https://muviko.app";

module.exports = async function handler(req, res) {
  const { month, token } = req.query;
  const monthNum = parseInt(month, 10);

  if (!token || isNaN(monthNum) || monthNum < 2 || monthNum > 10) {
    return res.status(400).send(errorPage("Invalid unlock link."));
  }

  // Fetch subscriber by token
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/website_subscribers?unsubscribe_token=eq.${encodeURIComponent(token)}&select=id,created_at,unsubscribed_at,months_unlocked`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  const rows = await lookupRes.json();
  if (!rows.length) return res.status(404).send(errorPage("Subscriber not found."));

  const sub = rows[0];
  if (sub.unsubscribed_at) return res.status(403).send(errorPage("This account has been unsubscribed."));

  // Check they've been subscribed long enough (30 days per month beyond month 1)
  const daysSince = (Date.now() - new Date(sub.created_at).getTime()) / 86400000;
  const minDays = (monthNum - 1) * 30;
  if (daysSince < minDays) {
    return res.status(403).send(errorPage(`Month ${monthNum} unlocks after ${minDays} days. You're almost there!`));
  }

  // Record unlock (add month to array if not already there)
  const already = (sub.months_unlocked || []).includes(monthNum);
  if (!already) {
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
        body: JSON.stringify({ months_unlocked: [...(sub.months_unlocked || []), monthNum] }),
      }
    );
  }

  const monthStr = String(monthNum).padStart(2, "0");
  res.redirect(302, `${BASE_URL}/assets/month-${monthStr}.pdf`);
};

function errorPage(msg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Muviko</title>
<style>
  body{margin:0;background:#0a1a17;color:#f0ede6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}
  p{color:rgba(240,237,230,0.6);font-size:16px;margin-bottom:24px}
  a{color:#3dcba5}
</style>
</head>
<body>
<div>
  <p>${msg}</p>
  <a href="https://muviko.app">← Back to muviko.app</a>
</div>
</body>
</html>`;
}
