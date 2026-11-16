// Utilidades de sesión: cookies firmadas (HMAC) sin dependencias externas.
const crypto = require('crypto');

const firmaDe = cuerpo => crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(cuerpo).digest('base64url');

function firmar(obj) {
  const cuerpo = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return cuerpo + '.' + firmaDe(cuerpo);
}

function leer(valor) {
  if (!valor || !process.env.SESSION_SECRET) return null;
  const [cuerpo, firma] = String(valor).split('.');
  if (!cuerpo || !firma) return null;
  const a = Buffer.from(firma), b = Buffer.from(firmaDe(cuerpo));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    return o && o.exp && o.exp > Date.now() ? o : null;
  } catch (_) { return null; }
}

function cookies(req) {
  const salida = {};
  String(req.headers.cookie || '').split(';').forEach(c => {
    const i = c.indexOf('='); if (i < 1) return;
    try { salida[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); } catch (_) {}
  });
  return salida;
}

function base(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const seguro = !/^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  return { host, seguro, origen: `${seguro ? 'https' : 'http'}://${host}` };
}

const cookieSet = (nombre, valor, { maxAge, seguro }) =>
  `${nombre}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${seguro ? '; Secure' : ''}`;

const dominios = () => String(process.env.ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const sesionDe = req => leer(cookies(req).hsm_session);
const googleConfigurado = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET && dominios().length);

// Defensa extra contra peticiones de otros sitios: si el navegador manda Origin, debe ser este mismo sitio
function origenValido(req) {
  const o = req.headers.origin; if (!o) return true;
  try { return new URL(o).host === base(req).host; } catch (_) { return false; }
}

module.exports = { firmar, leer, cookies, base, cookieSet, dominios, sesionDe, googleConfigurado, origenValido };
