// Proxy hacia n8n: exige sesión (Google, dominio permitido; o código temporal) y oculta la URL y el token del webhook.
const { origenValido } = require('./_lib/sesion');
const { autenticar } = require('./_lib/acceso');

const ACCIONES = ['tipos', 'crear_tipo', 'crear_pais', 'crear_variable', 'generar', 'guardar'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido.' });

  if (!origenValido(req)) return res.status(403).json({ ok: false, error: 'Origen no permitido.' });
  let usuario;
  try { usuario = autenticar(req); }
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
