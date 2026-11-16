// Cierra la sesión borrando la cookie.
const { base, cookieSet, origenValido } = require('../_lib/sesion');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' || !origenValido(req)) return res.status(405).json({ ok: false });
  res.setHeader('Set-Cookie', cookieSet('hsm_session', '', { maxAge: 0, seguro: base(req).seguro }));
  res.status(200).json({ ok: true });
};
