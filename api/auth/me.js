// Dice al navegador si hay sesión abierta y de quién.
const { sesionDe } = require('../_lib/sesion');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const s = sesionDe(req);
  if (!s) return res.status(401).json({ ok: false });
  res.status(200).json({ ok: true, email: s.email, nombre: s.nombre });
};
