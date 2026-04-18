const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  const { token } = req.query;

  if (!token) return res.status(400).send(page("Invalid link", "This unsubscribe link is invalid or has expired."));

  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/website_subscribers?unsubscribe_token=eq.${encodeURIComponent(token)}&unsubscribed_at=is.null`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
    }
  );

  if (!dbRes.ok) {
    return res.status(500).send(page("Something went wrong", "Please try again or email us at hello@muviko.app."));
  }

  res.setHeader("Content-Type", "text/html");
  res.status(200).send(page(
    "You're unsubscribed.",
    "You won't receive any more emails from Muviko. We're sorry to see you go — if you ever want to come back, the door's open at muviko.app."
  ));
};

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Muviko</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#0a1a17;color:#f0ede6;font-family:'DM Sans',sans-serif;font-weight:300;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{max-width:480px;text-align:center}
  .logo{font-family:'Playfair Display',serif;font-size:20px;color:#f0ede6;margin-bottom:48px}
  h1{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;margin-bottom:16px}
  p{font-size:16px;color:rgba(240,237,230,0.65);line-height:1.7;margin-bottom:32px}
  a{color:#3dcba5;text-decoration:none}
  a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Muviko</div>
  <h1>${title}</h1>
  <p>${body}</p>
  <a href="https://muviko.app">← Back to muviko.app</a>
</div>
</body>
</html>`;
}
