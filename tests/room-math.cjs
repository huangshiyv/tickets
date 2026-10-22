const assert = require('node:assert/strict');
const { calculate, validate } = require('../site/room-math.js');
const c = { bearing: 180, width: 4, depth: 5, height: 2.8, windowWidth: 2, windowHeight: 1.4, sill: .9 };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≈ ${b}`);
const front = calculate(180, 45, c);
assert.equal(front.lit, true);
close(front.incidence, 45);
close(front.depth[0], .9); close(front.depth[1], 2.3);
assert.equal(front.patches.floor.length, 4);
assert.equal(front.patches.back.length, 0);
// Low sun enters the same window but reaches the back wall before the floor.
const low = calculate(180, 5, c);
assert.equal(low.lit, true); assert.equal(low.depth, null); assert.ok(low.patches.back.length >= 3);
for (const ray of low.rays) close(ray.end[2], -2.5);
// Side sun must stop at the side wall and never extend beyond the room.
const side = calculate(240, 20, c);
assert.ok(side.patches.side.length >= 3);
for (const ray of side.rays) {
  assert.ok(ray.end[0] >= -2 - 1e-8 && ray.end[0] <= 2 + 1e-8);
  assert.ok(ray.end[1] >= -1e-8 && ray.end[1] <= 2.8 + 1e-8);
  assert.ok(ray.end[2] >= -2.5 - 1e-8 && ray.end[2] <= 2.5 + 1e-8);
}
assert.equal(calculate(0, 45, c).lit, false);
assert.equal(calculate(90, 30, c).lit, false);
assert.equal(calculate(180, 0, c).lit, false);
assert.equal(calculate(180, -10, c).reason, 'night');
// Rotating both sun and house by 90° preserves the light footprint.
const east = calculate(90, 45, { ...c, bearing: 90 });
assert.deepEqual(east.patches, front.patches);
assert.match(validate({ ...c, windowWidth: 5 }), /窗户宽度/);
assert.match(validate({ ...c, sill: 2 }), /窗台高度/);
assert.match(validate({ ...c, height: NaN }), /有效/);
// Sweep oblique rays: every illuminated point stays inside its receiving face.
for (let az = 0; az < 360; az += 15) for (const alt of [.1, 5, 25, 60, 89.9]) {
  const result = calculate(az, alt, c);
  for (const [x, depth] of result.patches.floor) {
    assert.ok(x >= -2 - 1e-7 && x <= 2 + 1e-7);
    assert.ok(depth >= -1e-7 && depth <= 5 + 1e-7);
  }
}
console.log('Room geometry: front/back/side/night, floor and wall clipping, rotation and invalid dimensions passed');
