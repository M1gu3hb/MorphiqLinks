const SCRIPT = `
local day = ARGV[1]
local sid = ARGV[2]
local action = ARGV[3]
local daykey = 'ml:day:' .. day
local session = 'ml:session:' .. day .. ':' .. sid
local isnew = redis.call('SETNX', session .. ':seen', '1')
if isnew == 1 then
  redis.call('EXPIRE', session .. ':seen', 172800)
  redis.call('HINCRBY', daykey, 'visits', 1)
  redis.call('HINCRBY', daykey, 'depth0', 1)
end
redis.call('ZADD', 'ml:days', 0, day)
if action ~= 'view' then
  redis.call('HINCRBY', daykey, action, 1)
  local before = redis.call('SCARD', session .. ':links')
  local added = redis.call('SADD', session .. ':links', action)
  redis.call('EXPIRE', session .. ':links', 172800)
  if added == 1 then
    redis.call('HINCRBY', daykey, 'depth' .. before, -1)
    redis.call('HINCRBY', daykey, 'depth' .. (before + 1), 1)
  end
end
return 1
`;
export class ConfigurationError extends Error {}
export async function redis(...command) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) throw new ConfigurationError('Redis no está configurado');
  const r = await fetch(base.replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000)
  });
  if (!r.ok) throw new Error('Redis HTTP ' + r.status);
  const data = await r.json();
  if (data.error) throw new Error('Redis command failed');
  return data.result;
}
export async function record(day, sid, action) { await redis('EVAL', SCRIPT, 0, day, sid, action); }
export async function getDays() { return await redis('ZRANGE', 'ml:days', 0, -1) || []; }
export async function getDay(day) {
  const pairs = await redis('HGETALL', 'ml:day:' + day);
  const out = {};
  for (let i = 0; i < (pairs?.length || 0); i += 2) out[pairs[i]] = Number(pairs[i + 1]);
  return out;
}
