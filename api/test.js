module.exports = async function handler(req, res) {
  try {
    const { randomBytes } = require("crypto");
    const token = randomBytes(32).toString("hex");
    const body = req.body || {};
    res.json({ ok: true, token, body, env: !!process.env.SUPABASE_URL });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
