import { links, localDay } from './_config.js';
import { record } from './_redis.js';
import { visitor } from './_session.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const id = String(req.query.id || '');
  if (!Object.hasOwn(links, id)) return res.status(404).end('Enlace no encontrado');
  const sid = visitor(req, res);
  try { await record(localDay(), sid, id); }
  catch (e) { console.error('Click tracking:', e.message); }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  return res.redirect(302, links[id].url);
}
