/* Geometric direct sunlight through one rectangular window. Units are metres. */
(function (root) {
  'use strict';
  const rad = Math.PI / 180;
  function validate(c) {
    for (const [key, min, max] of [['bearing', 0, 360], ['width', 1, 20], ['depth', 1, 20], ['height', 2, 6], ['windowWidth', .2, 20], ['windowHeight', .2, 6], ['sill', 0, 5]]) {
      if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) return '请填写有效的朝向与房间尺寸。';
    }
    if (c.windowWidth > c.width) return '窗户宽度不能大于房间宽度。';
    if (c.sill + c.windowHeight > c.height + 1e-9) return '窗台高度加窗户高度不能超过房间层高。';
    return '';
  }
  // Sutherland–Hodgman clipping of a convex projected aperture to a surface.
  function clip(polygon, bounds) {
    let points = polygon;
    for (const [axis, edge, sign] of [[0, bounds[0], 1], [0, bounds[1], -1], [1, bounds[2], 1], [1, bounds[3], -1]]) {
      const output = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const insideA = sign * (a[axis] - edge) >= -1e-9, insideB = sign * (b[axis] - edge) >= -1e-9;
        if (insideA) output.push(a);
        if (insideA !== insideB) {
          const t = (edge - a[axis]) / (b[axis] - a[axis]);
          output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
      }
      points = output;
    }
    const area = Math.abs(points.reduce((sum, p, i) => { const next = points[(i + 1) % points.length]; return sum + p[0] * next[1] - next[0] * p[1]; }, 0)) / 2;
    return area > 1e-8 ? points : [];
  }
  function calculate(azimuth, altitude, c) {
    const error = validate(c);
    const relative = ((azimuth - c.bearing + 540) % 360) - 180;
    const cosAlt = Math.cos(altitude * rad);
    // Room +Z points out of the window; +X is horizontal along its wall.
    const sun = { x: -Math.sin(relative * rad) * cosAlt, y: Math.sin(altitude * rad), z: Math.cos(relative * rad) * cosAlt };
    const result = { error, lit: false, relative, incidence: Math.acos(Math.max(-1, Math.min(1, sun.z))) / rad, sun, patches: { floor: [], back: [], side: [] }, rays: [], depth: null, side: 0 };
    if (error) return result;
    if (altitude <= 0) return { ...result, reason: 'night' };
    if (sun.z <= 1e-6) return { ...result, reason: 'behind' };
    result.lit = true;
    const corners = [[-c.windowWidth / 2, c.sill], [c.windowWidth / 2, c.sill], [c.windowWidth / 2, c.sill + c.windowHeight], [-c.windowWidth / 2, c.sill + c.windowHeight]];
    result.patches.floor = clip(corners.map(([x, y]) => [x - sun.x * y / sun.y, sun.z * y / sun.y]), [-c.width / 2, c.width / 2, 0, c.depth]);
    result.patches.back = clip(corners.map(([x, y]) => [x - sun.x * c.depth / sun.z, y - sun.y * c.depth / sun.z]), [-c.width / 2, c.width / 2, 0, c.height]);
    if (Math.abs(sun.x) > 1e-8) {
      result.side = sun.x > 0 ? -1 : 1;
      const sideX = result.side * c.width / 2;
      result.patches.side = clip(corners.map(([x, y]) => {
        const t = (x - sideX) / sun.x;
        return [sun.z * t, y - sun.y * t];
      }), [0, c.depth, 0, c.height]);
    }
    if (result.patches.floor.length) {
      const depths = result.patches.floor.map(p => p[1]); result.depth = [Math.min(...depths), Math.max(...depths)];
    }
    // Representative rays stop at the first room surface, never pass through walls.
    for (const [x, y] of [[0, c.sill + c.windowHeight / 2], ...corners]) {
      const distances = [y / sun.y, c.depth / sun.z];
      if (Math.abs(sun.x) > 1e-8) distances.push((x - result.side * c.width / 2) / sun.x);
      const t = Math.max(0, Math.min(...distances));
      result.rays.push({ start: [x, y, c.depth / 2], end: [x - sun.x * t, y - sun.y * t, c.depth / 2 - sun.z * t] });
    }
    return result;
  }
  const api = { validate, calculate };
  root.RoomLight = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
