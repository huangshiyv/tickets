'use strict';
const $ = id => document.getElementById(id);
const rad = Math.PI / 180;
const state = { lat: 39.9042, lng: 116.4074 };
const params = new URLSearchParams(location.hash.slice(1));
function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s + 'T12:00:00Z')); }
const zoneOptions = [...$('zone').options].map(o => o.value);
if (zoneOptions.includes(params.get('zone'))) $('zone').value = params.get('zone');
function today() { return new Date(Date.now() + Number($('zone').value) * 3600000).toISOString().slice(0, 10); }
$('date').value = validDate(params.get('date')) ? params.get('date') : today();
if (params.has('time') && Number.isInteger(Number(params.get('time'))) && Number(params.get('time')) >= 0 && Number(params.get('time')) <= 1439) $('time').value = params.get('time');
if (params.has('lat') && params.has('lng') && Math.abs(Number(params.get('lat'))) <= 85 && Math.abs(Number(params.get('lng'))) <= 180) {
  state.lat = Number(params.get('lat')); state.lng = Number(params.get('lng'));
  $('place').textContent = '分享的观测位置';
}
const map = L.map('map', { zoomControl: false }).setView([state.lat, state.lng], 12);
L.control.zoom({ position: 'topright' }).addTo(map);
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
let tileWarning = false;
tiles.on('tileerror', () => {
  if (!tileWarning) { $('status').textContent = '地图瓦片暂不可用；坐标选择和太阳计算仍可使用。'; tileWarning = true; }
});
const layers = L.layerGroup().addTo(map);
const point = L.marker([state.lat, state.lng], { draggable: true, icon: L.divIcon({ className: 'point-pin', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
function instant(minutes = Number($('time').value)) {
  return new Date(Date.parse($('date').value + 'T00:00:00Z') + (minutes - Number($('zone').value) * 60) * 60000);
}
function clock(date, markDay = false) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '—';
  const local = new Date(date.getTime() + Number($('zone').value) * 3600000).toISOString();
  const diff = Math.round((Date.parse(local.slice(0, 10)) - Date.parse($('date').value)) / 86400000);
  return local.slice(11, 16) + (markDay && diff ? ` (${diff > 0 ? '+' : ''}${diff}日)` : '');
}
function bearing(pos) { return ((pos.azimuth / rad + 180) % 360 + 360) % 360; }
function destination(angle, distance) {
  const d = distance / 6371000, a = state.lat * rad, b = state.lng * rad, t = angle * rad;
  const lat = Math.asin(Math.sin(a) * Math.cos(d) + Math.cos(a) * Math.sin(d) * Math.cos(t));
  const lng = b + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(a), Math.cos(d) - Math.sin(a) * Math.sin(lat));
  return [lat / rad, lng / rad];
}
function solar(date) { return SunCalc.getPosition(date, state.lat, state.lng); }
function update() {
  if (!validDate($('date').value)) { $('status').textContent = '请选择有效日期。'; return; }
  const date = instant(), pos = solar(date), az = bearing(pos), alt = pos.altitude / rad;
  const times = SunCalc.getTimes(instant(720), state.lat, state.lng);
  for (const key of ['sunrise', 'sunset', 'dawn', 'dusk']) $(key).textContent = clock(times[key], true);
  $('noon').textContent = clock(times.solarNoon, true);
  const hasEvents = Number.isFinite(times.sunrise.getTime()) && Number.isFinite(times.sunset.getTime());
  if (hasEvents) {
    const mins = Math.round((times.sunset - times.sunrise) / 60000);
    $('duration').textContent = `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
    $('golden').textContent = `${clock(times.goldenHour, true)} – ${clock(times.sunset, true)}`;
  } else {
    $('duration').textContent = solar(times.solarNoon).altitude > 0 ? '极昼 · 全天日照' : '极夜 · 无日出';
    $('golden').textContent = '—';
  }
  $('clock').textContent = clock(date);
  $('azimuth').textContent = az.toFixed(1) + '°'; $('altitude').textContent = alt.toFixed(1) + '°';
  $('phase').textContent = alt < -6 ? '夜间' : alt < 0 ? '晨昏微光' : alt < 6 ? '黄金时刻' : '日间';
  const shadowAngle = (az + 180) % 360;
  $('shadow-bearing').textContent = alt > 0 ? shadowAngle.toFixed(1) + '°' : '—';
  const height = Number($('height').value);
  $('shadow-result').textContent = !$('height').checkValidity() || $('height').value === '' ? '请输入 0–10000 米的高度。' : alt > 0 ? `影长 ${(height / Math.tan(pos.altitude)).toFixed(1)} 米 · 朝向 ${shadowAngle.toFixed(1)}°` : '太阳在地平线下，无直射阳光阴影。';
  $('lat').value = state.lat.toFixed(5); $('lng').value = state.lng.toFixed(5);
  layers.clearLayers();
  const length = Math.max(100, map.getBounds().getSouthWest().distanceTo(map.getBounds().getNorthEast()) * .27);
  function ray(angle, color, dash) {
    const end = destination(angle, length);
    L.polyline([[state.lat, state.lng], end], { color, weight: 2, dashArray: dash, interactive: false }).addTo(layers);
    return end;
  }
  if (hasEvents) {
    ray(bearing(solar(times.sunrise)), '#d9a73d', '7 5');
    ray(bearing(solar(times.sunset)), '#8b70a7', '7 5');
  }
  // Directional arc at a fixed map radius, not the physical path of the Sun.
  let arc = [];
  for (let min = 0; min <= 1440; min += 10) {
    const p = solar(instant(min));
    if (p.altitude >= 0) arc.push(destination(bearing(p), length));
    else if (arc.length) { L.polyline(arc, { color: '#dcb455', weight: 2, opacity: .65, interactive: false }).addTo(layers); arc = []; }
  }
  if (arc.length) L.polyline(arc, { color: '#dcb455', weight: 2, opacity: .65, interactive: false }).addTo(layers);
  const end = ray(az, '#df7c35', alt <= 0 ? '4 7' : undefined);
  L.marker(end, { interactive: false, icon: L.divIcon({ className: 'sun-pin', html: '☀', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(layers);
  if (alt > 0) ray(shadowAngle, '#586961', '3 6');
  const hash = new URLSearchParams({ lat: state.lat.toFixed(5), lng: state.lng.toFixed(5), date: $('date').value, time: $('time').value, zone: $('zone').value });
  history.replaceState(null, '', '#' + hash);
}
function selectLocation(lat, lng, name, center = true) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) { $('status').textContent = '请输入纬度 −85～85、经度 −180～180。'; return; }
  Object.assign(state, { lat, lng }); point.setLatLng([lat, lng]);
  $('place').textContent = name || '地图上的观测点';
  $('status').textContent = '位置已更新，请确认显示时区。';
  if (center) map.panTo([lat, lng]); update();
}
map.on('click', e => selectLocation(e.latlng.lat, ((e.latlng.lng + 180) % 360 + 360) % 360 - 180, null, false));
point.on('dragend', () => { const p = point.getLatLng(); selectLocation(p.lat, ((p.lng + 180) % 360 + 360) % 360 - 180); });
map.on('zoomend', update);
for (const id of ['time', 'height']) $(id).addEventListener('input', update);
for (const id of ['date', 'zone']) $(id).addEventListener('change', update);
$('coordinates-go').onclick = () => {
  if (!$('lat').value || !$('lng').value) { $('status').textContent = '请输入经纬度。'; return; }
  selectLocation(Number($('lat').value), Number($('lng').value));
};
$('now').onclick = () => { const now = new Date(Date.now() + Number($('zone').value) * 3600000); $('date').value = now.toISOString().slice(0, 10); $('time').value = now.getUTCHours() * 60 + now.getUTCMinutes(); update(); };
$('locate').onclick = () => {
  if (!navigator.geolocation) { $('status').textContent = '浏览器不支持定位，请搜索地点或输入坐标。'; return; }
  $('status').textContent = '正在获取位置…';
  navigator.geolocation.getCurrentPosition(p => selectLocation(p.coords.latitude, p.coords.longitude, '我的位置'), () => { $('status').textContent = '无法获取位置，请允许定位或手动选择。'; }, { timeout: 15000 });
};
let searchController;
$('search-form').onsubmit = async event => {
  event.preventDefault(); const query = $('search').value.trim(); if (!query) return;
  if (searchController) searchController.abort(); searchController = new AbortController();
  const controller = searchController; const timeout = setTimeout(() => controller.abort(), 12000);
  $('results').textContent = '正在搜索…';
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': 'zh-CN' });
    const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error('Search failed');
    const places = await response.json(); if (controller !== searchController) return;
    $('results').replaceChildren();
    if (!places.length) $('results').textContent = '未找到地点，请换个关键词或输入坐标。';
    for (const place of places) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = place.display_name;
      button.onclick = () => { selectLocation(Number(place.lat), Number(place.lon), place.display_name.split(',')[0]); $('results').replaceChildren(); };
      $('results').append(button);
    }
  } catch (error) { if (controller === searchController) $('results').textContent = '搜索服务暂不可用，请点击地图或输入坐标。'; }
  finally { clearTimeout(timeout); }
};
$('share').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); $('status').textContent = '地点、日期与时间链接已复制。'; }
  catch { $('status').textContent = '请复制浏览器地址栏分享当前位置。'; }
};
update();
