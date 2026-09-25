import { localDay } from './_config.js';
import { record, ConfigurationError } from './_redis.js';
import { visitor } from './_session.js';
import { json, sameOrigin } from './_response.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' });
  const sid = visitor(req, res);
  try {
    await record(localDay(), sid, 'view');
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('Visit tracking:', e.message);
    return json(res, e instanceof ConfigurationError ? 503 : 500, { error: 'Estadísticas no disponibles' });
  }
}
