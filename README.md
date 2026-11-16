# Generador de mensajes HSM (Adipa)

- `index.html`: formulario.
- `api/n8n.js`: exige sesión y reenvía a n8n (oculta la URL y el token del webhook).
- `api/auth/login.js`, `callback.js`, `me.js`, `logout.js`: inicio de sesión con Google (flujo con redirección, PKCE y cookie de sesión de 8 horas).
- `api/config.js`: indica al navegador qué modo de acceso está activo.
- `api/_lib/sesion.js`: cookies firmadas y utilidades.

## Variables de entorno (Vercel > Settings > Environment Variables)
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (Sensitive): del cliente OAuth de Google.
- `SESSION_SECRET` (Sensitive): cadena larga y aleatoria para firmar la sesión.
- `ALLOWED_DOMAINS`: dominios de correo permitidos, separados por coma (por ejemplo `adipa.cl`).
- `N8N_WEBHOOK_URL`: URL de producción del webhook de n8n.
- `N8N_TOKEN` (Sensitive): igual al credential Header Auth del webhook (cabecera `X-HSM-Token`).
- `ACCESS_CODE`: acceso temporal por código. Solo funciona mientras NO exista `GOOGLE_CLIENT_ID`. Borrarlo al activar Google.

## URI de redirección autorizadas en Google (exactas, sin barra final)
- `https://generador-de-mensajes-hsm.vercel.app/api/auth/callback`
- `https://generador-de-mensajes-hsm.adipa.ai/api/auth/callback`

Después de cambiar variables hay que volver a desplegar (`vercel --prod`).
Para probar en local: `vercel dev` con las variables en `.env.local` (no se sube).
