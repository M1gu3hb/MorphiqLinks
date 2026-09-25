import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookie } from './_response.js';
const SESSION = 'ml_sid';
const ADMIN = 'ml_admin';
const secure = process.env.VERCEL_ENV ? '; Secure' : '';
export function visitor(req, res) {
  const current = cookie(req, SESSION);
  if (current && /^[a-f0-9]{32}$/.test(current)) return current;
  const sid = randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `${SESSION}=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${secure}`);
  return sid;
}
function sign(value) { return createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('hex'); }
export function adminReady() { return Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN); }
export function adminCookie(res) {
  const expire = Math.floor(Date.now() / 1000) + 8 * 3600;
  const payload = String(expire);
  res.setHeader('Set-Cookie', `${ADMIN}=${payload}.${sign(payload)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`);
}
export function isAdmin(req) {
  if (!adminReady()) return false;
  const match = /^(\d+)\.([a-f0-9]{64})$/.exec(cookie(req, ADMIN) || '');
  if (!match || Number(match[1]) < Date.now() / 1000) return false;
  return timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(sign(match[1]), 'hex'));
}
export function passwordMatches(value) {
  const a = Buffer.from(String(value || ''));
  const b = Buffer.from(process.env.ADMIN_PASSWORD || '');
  return a.length === b.length && timingSafeEqual(a, b);
}
