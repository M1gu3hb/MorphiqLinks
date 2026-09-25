import { getDays, getDay } from '../_redis.js';
import { isAdmin } from '../_session.js';
import { localDay, links, zone } from '../_config.js';
import { json } from '../_response.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  if (!isAdmin(req)) return json(res, 401, { error: 'Inicia sesión' });
  try {
    const days = await getDays();
    const rows = await Promise.all(days.map(async day => ({ day, ...await getDay(day) })));
    const today = localDay();
    return json(res, 200, {
      today, zone, labels: Object.fromEntries(Object.entries(links).map(([id, item]) => [id, item.label])),
      rows, daily: rows.find(row => row.day === today) || { day: today }
    });
  } catch (e) {
    console.error('Admin stats:', e.message);
    return json(res, 503, { error: 'No se pudo consultar el historial' });
  }
}
