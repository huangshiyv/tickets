'use strict';
const $ = id => document.getElementById(id);
const rad = Math.PI / 180;
const state = { lat: 39.9042, lng: 116.4074 };
const params = new URLSearchParams(location.hash.slice(1));
let viewMode = params.get('view') === '3d' ? '3d' : 'map';
let sunScene, sceneLoading;
let roomMode = params.get('model') === 'room';
let pickingBearing = false;
const roomFields = { bearing: 'house-bearing', width: 'room-width', depth: 'room-depth', height: 'room-height', windowWidth: 'window-width', windowHeight: 'window-height', sill: 'window-sill' };
for (const [key, id] of Object.entries(roomFields)) {
  if (params.has(key) && params.get(key).trim() !== '' && Number.isFinite(Number(params.get(key)))) $(id).value = params.get(key);
}
function roomConfig() {
  return Object.fromEntries(Object.entries(roomFields).map(([key, id]) => [key, $(id).value === '' ? NaN : Number($(id).value)]));
}
function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s + 'T12:00:00Z')); }
const openedAt = new Date();
const browserOffset = -openedAt.getTimezoneOffset() / 60;
const sharedOffset = Number(params.get('zone'));
const hasSharedOffset = params.has('zone') && params.get('zone').trim() !== '' && Number.isFinite(sharedOffset) && sharedOffset >= -12 && sharedOffset <= 14 && Number.isInteger(sharedOffset * 60);
const initialOffset = hasSharedOffset ? sharedOffset : browserOffset;
// Include offsets missing from the short preset list, such as UTC+05:45.
if (![...$('zone').options].some(option => Number(option.value) === initialOffset)) {
  const minutes = Math.round(Math.abs(initialOffset) * 60);
  const label = `UTC ${initialOffset < 0 ? '−' : '+'}${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  $('zone').add(new Option(label, String(initialOffset)));
}
$('zone').value = String(initialOffset);
function today() { return new Date(Date.now() + Number($('zone').value) * 3600000).toISOString().slice(0, 10); }
$('date').value = validDate(params.get('date')) ? params.get('date') : today();
const initialLocalTime = new Date(openedAt.getTime() + initialOffset * 3600000);
$('time').value = initialLocalTime.getUTCHours() * 60 + initialLocalTime.getUTCMinutes();
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
function solar(date) { return SunCalc.getPosition(date, state.lat, state.lng); }
function buildTrack(times) {
  const make = date => { const p = solar(date); return { timestamp: date.getTime(), azimuth: bearing(p), altitude: p.altitude / rad, label: clock(date) }; };
  const hasEvents = Number.isFinite(times.sunrise.getTime()) && Number.isFinite(times.sunset.getTime());
  const result = { segments: [], ticks: [], noon: times.solarNoon.getTime(), sunrise: null, sunset: null };
  if (hasEvents) {
    result.sunrise = { ...make(times.sunrise), kind: 'sunrise' };
    result.sunset = { ...make(times.sunset), kind: 'sunset' };
    const points = [result.sunrise];
    for (let t = times.sunrise.getTime() + 600000; t < times.sunset.getTime(); t += 600000) points.push(make(new Date(t)));
    points.push(result.sunset); result.segments.push(points);
    const offset = Number($('zone').value) * 3600000;
    const firstTick = Math.ceil((times.sunrise.getTime() + offset) / 10800000) * 10800000 - offset;
    for (let t = firstTick; t < times.sunset.getTime() - 3600000; t += 10800000) {
      if (t > times.sunrise.getTime() + 3600000) result.ticks.push(make(new Date(t)));
    }
  } else {
    let points = [];
    for (let minute = 0; minute <= 1440; minute += 10) {
      const p = make(instant(minute));
      if (p.altitude > 0) points.push(p);
      else if (points.length) { result.segments.push(points); points = []; }
    }
    if (points.length) result.segments.push(points);
  }
  return result;
}
function focusMap() {
  map.invalidateSize();
  map.setView([state.lat, state.lng], map.getZoom(), { animate: false });
  map.panBy([0, map.getSize().y / 2 - SolarMap.frame(map).centreY], { animate: false });
  update();
}
function jumpTo(timestamp) {
  const date = new Date(timestamp + Number($('zone').value) * 3600000);
  $('date').value = date.toISOString().slice(0, 10);
  $('time').value = date.getUTCHours() * 60 + date.getUTCMinutes();
  update();
}
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
  const config = roomConfig();
  const roomLight = RoomLight.calculate(az, alt, config);
  const track = buildTrack(times);
  $('room-result').textContent = roomLight.error || (roomLight.lit
    ? `阳光可直射入窗 · 入窗角 ${roomLight.incidence.toFixed(1)}° · ${roomLight.relative < 0 ? '偏左' : '偏右'} ${Math.abs(roomLight.relative).toFixed(1)}°`
    : roomLight.reason === 'night' ? '太阳在地平线下，当前无直射光入窗。' : '太阳在窗户背面或侧面，当前无直射光入窗。');
  $('room-depth-result').textContent = roomLight.depth
    ? `地板光斑深入 ${roomLight.depth[0].toFixed(2)}–${roomLight.depth[1].toFixed(2)} 米（从窗墙起）`
    : roomLight.lit ? '光线落在后墙或侧墙，当前没有地板光斑。' : '';
  $('room-result').classList.toggle('invalid', Boolean(roomLight.error));
  for (const button of document.querySelectorAll('[data-bearing]')) button.setAttribute('aria-pressed', String(Number(button.dataset.bearing) === config.bearing));
  document.querySelector('.canvas').classList.toggle('is-night', alt <= 0);
  $('scene-state').textContent = roomMode ? $('room-result').textContent : alt <= 0
    ? '太阳已在地平线下 · 当前没有直射阳光'
    : `太阳高度 ${alt.toFixed(1)}° · 箭头从日出沿轨迹指向日落`;
  if (viewMode === '3d' && sunScene) sunScene.update(az, alt, $('height').checkValidity() && $('height').value !== '' ? height : 0, { roomMode, config, roomLight, track });
  $('lat').value = state.lat.toFixed(5); $('lng').value = state.lng.toFixed(5);
  SolarMap.render(map, layers, { lat: state.lat, lng: state.lng, azimuth: az, altitude: alt, track, facing: Number.isFinite(config.bearing) ? config.bearing : 180 }, jumpTo);
  const hash = new URLSearchParams({ lat: state.lat.toFixed(5), lng: state.lng.toFixed(5), date: $('date').value, time: $('time').value, zone: $('zone').value });
  if (viewMode === '3d') hash.set('view', '3d');
  if (roomMode) hash.set('model', 'room');
  for (const [key, value] of Object.entries(config)) if (Number.isFinite(value)) hash.set(key, String(value));
  history.replaceState(null, '', '#' + hash);
}
function sceneUnavailable() {
  $('scene-loading').hidden = false;
  $('scene-loading').textContent = '当前浏览器无法显示 3D。请开启硬件加速或换一个浏览器，也可以切回二维地图查看太阳方向。';
  $('sun-scene').dataset.state = 'unavailable';
  for (const id of ['scene-reset', 'scene-side', 'scene-top']) $(id).disabled = true;
}
async function setViewMode(mode) {
  viewMode = mode;
  const is3D = mode === '3d';
  document.querySelector('.canvas').classList.toggle('sun-mode', is3D);
  $('sun-panel').hidden = !is3D;
  $('map').setAttribute('aria-hidden', String(is3D));
  $('map').inert = is3D;
  $('view-map').setAttribute('aria-pressed', String(!is3D));
  $('view-3d').setAttribute('aria-pressed', String(is3D));
  sunScene?.setVisible(is3D);
  update();
  if (!is3D) { requestAnimationFrame(focusMap); return; }
  if (!sunScene && !sceneLoading) {
    $('view-3d').setAttribute('aria-busy', 'true');
    for (const id of ['scene-reset', 'scene-side', 'scene-top']) $(id).disabled = true;
    sceneLoading = import('./sun-scene.js').then(({ createSunScene }) => {
      sunScene = createSunScene($('sun-scene'));
      $('scene-loading').hidden = true;
      $('sun-scene').dataset.state = 'ready';
      for (const id of ['scene-reset', 'scene-side', 'scene-top']) $(id).disabled = false;
      sunScene.setVisible(viewMode === '3d');
      update();
      if (roomMode) sunScene.setView('room');
    }).catch(() => {
      sunScene?.dispose(); sunScene = undefined;
      $('sun-scene').querySelector('canvas')?.remove();
      sceneUnavailable();
    }).finally(() => {
      $('view-3d').removeAttribute('aria-busy');
      sceneLoading = undefined;
    });
  }
}
$('view-map').onclick = () => setViewMode('map');
$('view-3d').onclick = () => setViewMode('3d');
$('sun-scene').addEventListener('scene-unavailable', sceneUnavailable);
for (const view of ['reset', 'side', 'top']) $(`scene-${view}`).onclick = () => sunScene?.setView(view);
function selectLocation(lat, lng, name, center = true) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) { $('status').textContent = '请输入纬度 −85～85、经度 −180～180。'; return; }
  Object.assign(state, { lat, lng }); point.setLatLng([lat, lng]);
  $('place').textContent = name || '地图上的观测点';
  $('status').textContent = '位置已更新，请确认显示时区。';
  if (center) focusMap(); else update();
}
map.on('click', e => {
  if (pickingBearing) {
    const lat1 = state.lat * rad, lat2 = e.latlng.lat * rad, delta = (e.latlng.lng - state.lng) * rad;
    if (map.distance([state.lat, state.lng], e.latlng) < 1) { $('status').textContent = '请点击离观测点稍远的位置以指定朝向。'; return; }
    const angle = Math.atan2(Math.sin(delta) * Math.cos(lat2), Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(delta)) / rad;
    $('house-bearing').value = Math.round((angle + 360) % 360);
    pickingBearing = false; $('pick-bearing').setAttribute('aria-pressed', 'false');
    $('status').textContent = `窗户朝向已设置为 ${$('house-bearing').value}°。`;
    update();
  } else selectLocation(e.latlng.lat, ((e.latlng.lng + 180) % 360 + 360) % 360 - 180, null, true);
});
point.on('dragend', () => { const p = point.getLatLng(); selectLocation(p.lat, ((p.lng + 180) % 360 + 360) % 360 - 180); });
map.on('zoomend', update);
$('map-fit').onclick = focusMap;
map.on('resize', () => { if (viewMode === 'map') requestAnimationFrame(focusMap); });
for (const id of Object.values(roomFields)) $(id).addEventListener('input', update);
for (const button of document.querySelectorAll('[data-bearing]')) button.onclick = () => { $('house-bearing').value = button.dataset.bearing; update(); };
$('pick-bearing').onclick = () => {
  pickingBearing = !pickingBearing;
  $('pick-bearing').setAttribute('aria-pressed', String(pickingBearing));
  setViewMode('map');
  $('status').textContent = pickingBearing ? '请在地图上点击窗户朝外正对的方向。观测点位置不变。' : '已取消朝向选择。';
  $('map').scrollIntoView({ block: 'center' });
};
function setRoomMode(value) {
  roomMode = value;
  $('model-building').setAttribute('aria-pressed', String(!value));
  $('model-room').setAttribute('aria-pressed', String(value));
  $('scene-title').textContent = value ? '阳光如何走进房间' : '感受阳光的角度';
  $('scene-description').textContent = value ? '屋顶剖开查看 · 金色光斑为窗户直射光' : '日出 → 白天轨迹 → 日落 · 示意建筑';
  update(); sunScene?.setView(value ? 'room' : 'reset');
}
$('model-building').onclick = () => setRoomMode(false);
$('model-room').onclick = () => setRoomMode(true);
$('open-room').onclick = () => { setRoomMode(true); setViewMode('3d'); document.querySelector('.canvas').scrollIntoView({ block: 'start' }); };

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
setRoomMode(roomMode);
if (viewMode === '3d') setViewMode('3d');
else requestAnimationFrame(focusMap);
