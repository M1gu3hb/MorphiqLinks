const $ = id => document.getElementById(id);
const ids = ['whatsapp', 'llamada', 'correo', 'sitio'];
const integer = new Intl.NumberFormat('es-MX');
const percent = (n, total) => total ? Math.round(n / total * 100) + '%' : '0%';
const sum = (rows, field) => rows.reduce((acc, row) => acc + (row[field] || 0), 0);
const clicks = row => ids.reduce((acc, id) => acc + (row[id] || 0), 0);
function showLogin(message = '') { $('login-screen').hidden = false; $('dashboard').hidden = true; $('logout').hidden = true; $('login-error').textContent = message; }
function showDashboard() { $('login-screen').hidden = true; $('dashboard').hidden = false; $('logout').hidden = false; }
function addText(parent, tag, value, className) {
  const child = document.createElement(tag);
  child.textContent = value;
  if (className) child.className = className;
  parent.append(child);
  return child;
}
function bar(parent, width, depth = false) {
  const track = addText(parent, 'span', '', depth ? 'depth-track' : 'rank-track');
  const fill = addText(track, 'b', '');
  fill.style.width = Math.max(0, Math.min(100, width)) + '%';
}
function renderChart(rows) {
  const el = $('chart'); el.replaceChildren();
  const recent = rows.slice(-30);
  if (!recent.length) { addText(el, 'p', 'Aún no hay actividad registrada.', 'empty-state'); return; }
  const end = new Date(recent[recent.length - 1].day + 'T12:00:00Z');
  const byDate = new Map(recent.map(row => [row.day, row]));
  const days = Array.from({length:30}, (_, index) => {
    const d = new Date(end); d.setUTCDate(d.getUTCDate() - (29 - index));
    const date = d.toISOString().slice(0, 10);
    return byDate.get(date) || {day:date};
  });
  const max = Math.max(1, ...days.flatMap(row => [row.visits || 0, clicks(row)]));
  const width = 620, height = 180, left = 34, right = 12, top = 10, bottom = 28;
  const x = i => left + i * (width - left - right) / 29;
  const y = v => top + (max - v) * (height - top - bottom) / max;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 620 180'); svg.setAttribute('preserveAspectRatio', 'none');
  function node(tag, attrs) { const n = document.createElementNS(svg.namespaceURI, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); svg.append(n); return n; }
  for (let i = 0; i < 3; i++) {
    const value = Math.round(max * (2 - i) / 2);
    const gy = y(value);
    node('line', {x1:left,y1:gy,x2:width-right,y2:gy,stroke:'#314155','stroke-dasharray':'3 5'});
    const t = node('text', {x:1,y:gy+4,fill:'#93a5bc','font-size':11}); t.textContent = value;
  }
  function line(values, color) {
    node('polyline', {points:values.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:color,'stroke-width':2.7,'stroke-linecap':'round','stroke-linejoin':'round'});
  }
  line(days.map(row => row.visits || 0), '#4c9df4');
  line(days.map(clicks), '#78ddbd');
  for (const i of [0,14,29]) {
    const t = node('text', {x:x(i),y:height-3,fill:'#93a5bc','font-size':11,'text-anchor':i===0?'start':i===29?'end':'middle'});
    t.textContent = days[i].day.slice(5);
  }
  el.append(svg);
}
function render(data) {
  const rows = data.rows || [], today = data.daily || {};
  const totalVisits = sum(rows, 'visits'), todayVisits = today.visits || 0;
  const todayClicks = clicks(today);
  $('visits-today').textContent = integer.format(todayVisits);
  $('clicks-today').textContent = integer.format(todayClicks);
  $('visits-all').textContent = integer.format(totalVisits);
  $('engagement-today').textContent = percent(todayVisits - (today.depth0 || 0), todayVisits);
  renderChart(rows);
  $('links-today').replaceChildren();
  for (const id of ids) {
    const item = addText($('links-today'),'div','','destination');
    addText(item,'span',data.labels[id]); addText(item,'strong',integer.format(today[id] || 0));
  }
  const totals = ids.map(id => ({id,total:sum(rows,id)})).sort((a,b)=>b.total-a.total);
  const top = Math.max(1,totals[0]?.total || 0);
  $('ranking').replaceChildren();
  for(const entry of totals) {
    const row = addText($('ranking'),'div','','rank-row');
    addText(row,'span',data.labels[entry.id]); bar(row,entry.total/top*100); addText(row,'strong',integer.format(entry.total));
  }
  $('depth').replaceChildren();
  for (let i=0;i<=4;i++) {
    const amount=sum(rows,'depth'+i), row=addText($('depth'),'div','','depth-row');
    addText(row,'span',i===0?'Ninguno':i+' '+(i===1?'enlace':'enlaces'));
    bar(row,percent(amount,totalVisits).replace('%',''),true);
    addText(row,'strong',percent(amount,totalVisits));
  }
  $('history-count').textContent = integer.format(rows.length)+' días';
  $('history-body').replaceChildren();
  for (const day of [...rows].reverse()) {
    const tr=document.createElement('tr');
    for (const value of [day.day,day.visits || 0,...ids.map(id=>day[id]||0),clicks(day)]) addText(tr,'td',typeof value==='number'?integer.format(value):value);
    $('history-body').append(tr);
  }
  if (!rows.length) { const tr=document.createElement('tr');const td=addText(tr,'td','Todavía no hay registros.');td.colSpan=7;$('history-body').append(tr); }
}
async function load() {
  const response=await fetch('/api/admin/stats',{cache:'no-store'});
  if (response.status===401) return showLogin();
  const data=await response.json();
  if (!response.ok) return showLogin(data.error || 'No se pudieron cargar las estadísticas.');
  showDashboard(); render(data);
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('login-error').textContent='';
  const button=event.target.querySelector('button');button.disabled=true;
  try {
    const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('password').value})});
    const data=await response.json();
    if(!response.ok) throw Error(data.error || 'No se pudo entrar.');
    $('password').value='';await load();
  } catch (e) { $('login-error').textContent=e.message; } finally { button.disabled=false; }
});
$('logout').addEventListener('click',async()=>{await fetch('/api/admin/logout',{method:'POST'});showLogin();});
$('refresh').addEventListener('click',load);
load().catch(()=>showLogin('No se pudo conectar con el servidor.'));
