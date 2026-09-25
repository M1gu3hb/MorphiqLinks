import { adminCookie, adminReady, passwordMatches } from '../_session.js';
import { json, sameOrigin } from '../_response.js';
import { redis } from '../_redis.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'Origen no permitido' });
  if (!adminReady()) return json(res, 503, { error: 'El panel aún no está configurado' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const key = 'ml:login:' + ip;
  try {
    const attempts = Number(await redis('GET', key) || 0);
    if (attempts >= 8) return json(res, 429, { error: 'Demasiados intentos. Prueba en 15 minutos.' });
    if (!passwordMatches(req.body?.password)) {
      await redis('INCR', key);
      await redis('EXPIRE', key, 900);
      return json(res, 401, { error: 'Contraseña incorrecta' });
    }
    await redis('DEL', key);
    adminCookie(res);
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error('Admin login:', e.message);
    return json(res, 503, { error: 'El panel no está disponible ahora' });
  }
}
