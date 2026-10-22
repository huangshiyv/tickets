/* Map overlays represent compass directions, not geographic sunrise locations. */
(function (root) {
  const compass = angle => ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(angle / 45) % 8];
  function frame(map) {
    const top = 90;
    const bottom = document.querySelector('.timeline').getBoundingClientRect().top - map.getContainer().getBoundingClientRect().top - 45;
    return { centreY: (top + bottom) / 2, radius: Math.max(40, Math.min(map.getSize().x / 2 - 76, (bottom - top) / 2 - 56)) };
  }
  function render(map, layers, data, jumpTo) {
    layers.clearLayers();
    const { lat, lng, azimuth, altitude, track, facing } = data;
    const centre = [lat, lng];
    const pixels = frame(map).radius;
    const centrePoint = map.latLngToContainerPoint(centre);
    const distance = map.distance(centre, map.containerPointToLatLng(centrePoint.add([pixels, 0])));
    function destination(angle, radius = distance) {
      const rad = Math.PI / 180, d = radius / 6371000, a = lat * rad, b = lng * rad, t = angle * rad;
      const phi = Math.asin(Math.sin(a) * Math.cos(d) + Math.cos(a) * Math.sin(d) * Math.cos(t));
      return [phi / rad, (b + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(a), Math.cos(d) - Math.sin(a) * Math.sin(phi))) / rad];
    }
    function line(points, color, weight = 3, dashed) {
      L.polyline(points, { color: '#fff', weight: weight + 3, opacity: .8, interactive: false }).addTo(layers);
      return L.polyline(points, { color, weight, opacity: 1, dashArray: dashed, interactive: false }).addTo(layers);
    }
    function marker(position, html, className, size, anchor, click) {
      const item = L.marker(position, { interactive: Boolean(click), keyboard: Boolean(click), icon: L.divIcon({ className, html, iconSize: size, iconAnchor: anchor }) }).addTo(layers);
      if (click) item.on('click', event => { L.DomEvent.stopPropagation(event); click(); });
      return item;
    }
    function path(points, color) {
      if (points.length < 2) return;
      const projected = points.map(p => destination(p.azimuth));
      line(projected, color, 4);
      for (const fraction of [.3, .7]) {
        const i = Math.max(1, Math.floor((points.length - 1) * fraction));
        const a = map.latLngToLayerPoint(projected[i - 1]), b = map.latLngToLayerPoint(projected[i]);
        const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        marker(projected[i], `<span style="color:${color};transform:rotate(${angle}deg)">➤</span>`, 'track-arrow', [20, 20], [10, 10]);
      }
    }
    for (const segment of track.segments) {
      const before = segment.filter(p => p.timestamp <= track.noon);
      const after = segment.filter(p => p.timestamp > track.noon);
      if (before.length && after.length) after.unshift(before[before.length - 1]);
      path(before, '#d58913'); path(after, '#8355ba');
    }
    for (const event of [track.sunrise, track.sunset]) {
      if (!event) continue;
      const color = event.kind === 'sunrise' ? '#bd7100' : '#7540b0';
      const position = destination(event.azimuth);
      line([centre, position], color, 2, '7 6');
      L.circleMarker(position, { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, interactive: false }).addTo(layers);
      const above = map.latLngToContainerPoint(position).y <= centrePoint.y;
      marker(position, `<b>${event.kind === 'sunrise' ? '↗ 日出' : '↘ 日落'} ${event.label}</b><small>${compass(event.azimuth)} ${event.azimuth.toFixed(0)}°</small>`, `event-pin ${event.kind}`, [122, 44], [61, above ? 56 : -10], () => jumpTo(event.timestamp));
    }
    for (const tick of track.ticks) {
      const position = destination(tick.azimuth, distance * .83);
      if ([track.sunrise, track.sunset].filter(Boolean).some(event => map.latLngToContainerPoint(position).distanceTo(map.latLngToContainerPoint(destination(event.azimuth))) < 65)) continue;
      marker(position, `<span>${tick.label}</span>`, 'track-time', [42, 22], [21, 11], () => jumpTo(tick.timestamp));
    }
    const current = destination(azimuth);
    line([centre, current], '#ec6d24', 3, altitude <= 0 ? '4 7' : undefined);
    marker(current, '<span>☀</span>', 'sun-pin', [34, 34], [17, 17]);
    if (altitude > 0) line([centre, destination((azimuth + 180) % 360, distance * .5)], '#61786b', 2, '3 6');
    const faceEnd = destination(facing, distance * .48);
    line([centre, faceEnd], '#16735c', 4);
    marker(faceEnd, `<span style="transform:rotate(${facing}deg)">↑</span><small>窗朝${compass(facing)}</small>`, 'house-direction', [64, 52], [32, 18]);
  }
  root.SolarMap = { render, compass, frame };
})(globalThis);
