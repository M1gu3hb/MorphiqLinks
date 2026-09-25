import { json, sameOrigin } from '../_response.js';
export default function handler(req, res) {
  if (req.method !== 'POST' || !sameOrigin(req)) return json(res, 405, { error: 'Método no permitido' });
  res.setHeader('Set-Cookie', 'ml_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' + (process.env.VERCEL_ENV ? '; Secure' : ''));
  return json(res, 200, { ok: true });
}
