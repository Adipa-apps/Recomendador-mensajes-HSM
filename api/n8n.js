// Proxy hacia n8n: exige sesión (Google, dominio permitido; o código temporal) y oculta la URL y el token del webhook.
const { sesionDe, dominios, googleConfigurado, origenValido } = require('./_lib/sesion');

const crypto = require('crypto');
const ACCIONES = ['tipos', 'crear_tipo', 'crear_pais', 'crear_variable', 'generar', 'guardar'];

class ErrorAcceso extends Error {
  constructor(estado, mensaje) { super(mensaje); this.estado = estado; }
}

const iguales = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Acceso temporal por código: solo existe mientras no haya GOOGLE_CLIENT_ID. En cuanto se configura Google, se ignora.
function usuarioPorCodigo(req) {
  if (!iguales(req.headers['x-codigo'], process.env.ACCESS_CODE)) throw new ErrorAcceso(401, 'Código incorrecto.');
  let nombre = '';
  try { nombre = decodeURIComponent(String(req.headers['x-nombre'] || '')); } catch (_) {}
  nombre = nombre.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
  return { email: `${nombre || 'sin nombre'} (acceso por código)`, nombre };
}

function usuarioDeSesion(req) {
  if (!googleConfigurado()) throw new ErrorAcceso(500, 'Falta configurar el inicio de sesión en el servidor.');
  const s = sesionDe(req);
  if (!s) throw new ErrorAcceso(401, 'Falta iniciar sesión o la sesión expiró.');
  const d = dominios();
  if (!d.includes(String(s.email || '').split('@')[1] || '')) throw new ErrorAcceso(403, 'Tu cuenta no tiene acceso.');
  return { email: s.email, nombre: s.nombre || '' };
}

function usuarioVerificado(req) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    if (process.env.ACCESS_CODE) return usuarioPorCodigo(req);
    throw new ErrorAcceso(500, 'Falta configurar el acceso en el servidor.');
  }
  return usuarioDeSesion(req);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });

  if (!origenValido(req)) return res.status(403).json({ ok: false, error: 'Origen no permitido.' });
  let usuario;
  try { usuario = usuarioVerificado(req); }
  catch (e) { return res.status(e.estado || 401).json({ ok: false, error: e.message }); }

  const { N8N_WEBHOOK_URL, N8N_TOKEN } = process.env;
  if (!N8N_WEBHOOK_URL) return res.status(500).json({ ok: false, error: 'Falta configurar el servicio de generación.' });

  const entrada = req.body && typeof req.body === 'object' ? req.body : {};
  if (!ACCIONES.includes(entrada.accion)) return res.status(400).json({ ok: false, error: 'Acción no válida.' });
  // Quién genera lo define el servidor con el correo verificado; el navegador no puede falsearlo
  const body = { ...entrada, quien: usuario.email };

  try {
    const r = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(N8N_TOKEN ? { 'X-HSM-Token': N8N_TOKEN } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
    const texto = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json; charset=utf-8').send(texto);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'No se pudo contactar el servicio de generación.' });
  }
};
