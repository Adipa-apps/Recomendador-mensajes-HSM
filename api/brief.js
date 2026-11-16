// Lee el archivo del brief (PDF, DOCX o TXT) y devuelve su texto. Exige la misma sesión que el resto de la API.
const { origenValido } = require('./_lib/sesion');
const { autenticar } = require('./_lib/acceso');

const MAX_BYTES = 3 * 1024 * 1024;        // 3 MB (el límite de una petición en Vercel es 4,5 MB y base64 pesa ~33% más)
const MAX_CARACTERES = 30000;             // texto que se envía al modelo
const MIN_CARACTERES = 20;                // menos que esto se considera vacío

const fallo = (res, estado, error) => res.status(estado).json({ ok: false, error });

const limpiar = t => String(t || '')
  .replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

async function leerPdf(buf) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function leerDocx(buf) {
  const mammoth = require('mammoth');
  const r = await mammoth.extractRawText({ buffer: buf });
  return r.value;
}

function leerTxt(buf) {
  if (buf.includes(0)) throw Object.assign(new Error('binario'), { codigo: 'binario' });
  const t = buf.toString('utf8');
  return t.includes('\uFFFD') ? buf.toString('latin1') : t;   // si no es UTF-8, se prueba con Windows/Latin-1
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return fallo(res, 405, 'Método no permitido.');
  if (!origenValido(req)) return fallo(res, 403, 'Origen no permitido.');
  try { autenticar(req); } catch (e) { return fallo(res, e.estado || 401, e.message); }

  const { nombre, datos } = req.body && typeof req.body === 'object' ? req.body : {};
  const archivo = String(nombre || '').slice(0, 200);
  const ext = (archivo.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();

  if (ext === 'doc') return fallo(res, 400, 'Los archivos .doc (Word antiguo) no se pueden leer. Guárdalo como .docx o PDF y súbelo de nuevo.');
  if (!['pdf', 'docx', 'txt'].includes(ext)) return fallo(res, 400, 'Formato no admitido. Sube un archivo PDF, DOCX o TXT.');
  if (typeof datos !== 'string' || !datos) return fallo(res, 400, 'El archivo está vacío.');

  const buf = Buffer.from(datos, 'base64');
  if (!buf.length) return fallo(res, 400, 'El archivo está vacío.');
  if (buf.length > MAX_BYTES) return fallo(res, 413, `El archivo pesa ${(buf.length / 1048576).toFixed(1)} MB. El máximo permitido es 3 MB.`);

  // Se comprueba el contenido real, no solo la extensión
  if (ext === 'pdf' && buf.subarray(0, 5).toString('latin1') !== '%PDF-') return fallo(res, 400, 'El archivo no es un PDF válido. Puede estar dañado o tener otra extensión.');
  if (ext === 'docx' && buf.subarray(0, 2).toString('latin1') !== 'PK') return fallo(res, 400, 'El archivo no es un DOCX válido. Puede estar dañado o tener otra extensión.');

  let texto = '';
  try {
    texto = limpiar(ext === 'pdf' ? await leerPdf(buf) : ext === 'docx' ? await leerDocx(buf) : leerTxt(buf));
  } catch (e) {
    if (e.codigo === 'binario') return fallo(res, 422, 'El archivo TXT no contiene texto legible.');
    if (/password/i.test(`${e.name} ${e.message}`)) return fallo(res, 422, 'El PDF está protegido con contraseña. Quita la protección y súbelo de nuevo.');
    return fallo(res, 422, 'No se pudo leer el archivo. Puede estar dañado; prueba guardándolo de nuevo o pega el texto del brief.');
  }

  if (texto.replace(/\s/g, '').length < MIN_CARACTERES) {
    return fallo(res, 422, ext === 'pdf'
      ? 'No se encontró texto en el PDF. Si es un documento escaneado (una imagen), no se puede leer: sube una versión con texto o pega el contenido.'
      : 'El archivo no tiene contenido suficiente para usarlo como brief.');
  }

  const truncado = texto.length > MAX_CARACTERES;
  if (truncado) texto = texto.slice(0, MAX_CARACTERES);
  res.status(200).json({ ok: true, nombre: archivo, texto, caracteres: texto.length, truncado });
};
