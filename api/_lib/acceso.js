// Autenticación compartida: sesión de Google (producción) o código temporal (mientras no exista GOOGLE_CLIENT_ID).
const crypto = require('crypto');
const { sesionDe, dominios, googleConfigurado } = require('./sesion');

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
  if (!dominios().includes(String(s.email || '').split('@')[1] || '')) throw new ErrorAcceso(403, 'Tu cuenta no tiene acceso.');
  return { email: s.email, nombre: s.nombre || '' };
}

function autenticar(req) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    if (process.env.ACCESS_CODE) return usuarioPorCodigo(req);
    throw new ErrorAcceso(500, 'Falta configurar el acceso en el servidor.');
  }
  return usuarioDeSesion(req);
}

module.exports = { ErrorAcceso, autenticar };
