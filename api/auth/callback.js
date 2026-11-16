// Paso 2: Google vuelve aquí con un código. Se canjea, se verifica el dominio y se abre la sesión (cookie de 8 horas).
const { OAuth2Client } = require('google-auth-library');
const { firmar, leer, cookies, base, cookieSet, dominios, googleConfigurado } = require('../_lib/sesion');

const cliente = new OAuth2Client();
const HORAS_SESION = 8;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const b = base(req);
  const borrarOauth = cookieSet('hsm_oauth', '', { maxAge: 0, seguro: b.seguro });
  const volver = motivo => { res.statusCode = 302; res.setHeader('Set-Cookie', borrarOauth); res.setHeader('Location', '/?error=' + motivo); res.end(); };

  if (!googleConfigurado()) return volver('config');
  const url = new URL(req.url, 'http://x');
  const error = url.searchParams.get('error');
  if (error) return volver(error === 'access_denied' ? 'cancelado' : 'estado');

  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const o = leer(cookies(req).hsm_oauth);
  if (!code || !state || !o || o.state !== state) return volver('estado');

  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${b.origen}/api/auth/callback`, grant_type: 'authorization_code', code_verifier: o.verifier,
      }),
    });
    const t = await r.json();
    if (!r.ok || !t.id_token) return volver('estado');

    const ticket = await cliente.verifyIdToken({ idToken: t.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    const d = dominios();
    const email = String(p.email || '').toLowerCase();
    const hd = String(p.hd || '').toLowerCase();
    // hd lo emite Google solo para cuentas de Workspace del dominio: evita cuentas personales con correo ajeno
    if (!p.email_verified || !d.includes(email.split('@')[1] || '') || !d.includes(hd)) return volver('dominio');

    const sesion = firmar({ email, nombre: p.name || '', exp: Date.now() + HORAS_SESION * 3600 * 1000 });
    res.statusCode = 302;
    res.setHeader('Set-Cookie', [cookieSet('hsm_session', sesion, { maxAge: HORAS_SESION * 3600, seguro: b.seguro }), borrarOauth]);
    res.setHeader('Location', '/');
    res.end();
  } catch (e) {
    volver('estado');
  }
};
