// Paso 1: redirige a Google con state y PKCE.
const crypto = require('crypto');
const { firmar, base, cookieSet, dominios, googleConfigurado } = require('../_lib/sesion');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ir = url => { res.statusCode = 302; res.setHeader('Location', url); res.end(); };
  if (!googleConfigurado()) return ir('/?error=config');

  const b = base(req);
  const state = crypto.randomBytes(24).toString('base64url');
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const d = dominios();

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${b.origen}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    hd: d.length === 1 ? d[0] : '*',
  });
  res.setHeader('Set-Cookie', cookieSet('hsm_oauth', firmar({ state, verifier, exp: Date.now() + 10 * 60 * 1000 }), { maxAge: 600, seguro: b.seguro }));
  ir('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
};
