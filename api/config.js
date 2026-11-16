// Dice al navegador cómo autenticarse: Google (cuando existe GOOGLE_CLIENT_ID) o, de forma temporal, código de acceso.
const { googleConfigurado } = require('./_lib/sesion');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { GOOGLE_CLIENT_ID, ACCESS_CODE } = process.env;
  const modo = GOOGLE_CLIENT_ID ? 'google' : (ACCESS_CODE ? 'codigo' : '');
  res.status(200).json({ modo, configurado: modo === 'google' ? googleConfigurado() : !!modo });
};
