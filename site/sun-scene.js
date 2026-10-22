import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

// Local coordinates: +X east, +Y up, -Z north. Azimuth is clockwise from north.
export function createSunScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.tabIndex = -1;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 350);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 22;
  controls.maxDistance = 145;
  controls.minPolarAngle = .08;
  controls.maxPolarAngle = Math.PI / 2 - .025;
  controls.target.set(0, 5, 0);
  controls.enableDamping = false;
  const ambient = new THREE.HemisphereLight(0xeaf4ff, 0x8a9572, 2.2);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight(0xfff1cc, 3);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: .1, far: 210 });
  sunlight.shadow.bias = -.0003;
  sunlight.shadow.normalBias = .02;
  scene.add(sunlight, sunlight.target);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(43, 96), new THREE.MeshStandardMaterial({ color: 0xe6ecdd, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(68, 17, 0xa4b5a5, 0xc5cfc0);
  grid.position.y = .025;
  grid.material.transparent = true;
  grid.material.opacity = .5;
  scene.add(grid);

  function line(points, color, dashed = false, opacity = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: .65, gapSize: .45, transparent: true, opacity })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const mesh = new THREE.Line(geometry, material);
    if (dashed) mesh.computeLineDistances();
    return mesh;
  }
  const ring = [];
  for (let i = 0; i <= 96; i++) { const a = i / 96 * Math.PI * 2; ring.push(new THREE.Vector3(34 * Math.sin(a), .06, 34 * Math.cos(a))); }
  scene.add(line(ring, 0x98af9a));
  for (const axis of [0, Math.PI / 2]) {
    const points = [];
    for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI; points.push(new THREE.Vector3(32 * Math.cos(a) * Math.cos(axis), 32 * Math.sin(a), 32 * Math.cos(a) * Math.sin(axis))); }
    scene.add(line(points, 0xb3c5b7, true, .5));
  }

  function label(text, color, width = 7) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '600 48px system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(width, width / 4, 1); return sprite;
  }
  for (const [name, x, z] of [['北 N', 0, -38], ['东 E', 38, 0], ['南 S', 0, 38], ['西 W', -38, 0]]) {
    const item = label(name, '#426452', 10); item.position.set(x, .5, z); scene.add(item);
  }
  const building = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 5), new THREE.MeshStandardMaterial({ color: 0xf1ede0, roughness: .85 }));
  walls.castShadow = walls.receiveShadow = true;
  building.add(walls);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.4, .3, 5.4), new THREE.MeshStandardMaterial({ color: 0x426a5e, roughness: .8 }));
  roof.castShadow = true; building.add(roof);
  // Windows give the model an obvious front and make changing illumination visible.
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x6f9a9c, roughness: .35, metalness: .15 });
  const windows = [];
  for (const x of [-1.6, 1.6]) {
    for (const z of [-2.505, 2.505]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), windowMaterial);
      window.position.set(x, 3, z); if (z < 0) window.rotation.y = Math.PI;
      building.add(window); windows.push(window);
    }
  }
  scene.add(building);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb83f }));
  scene.add(sun);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.85, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffcc64, transparent: true, opacity: .16, depthWrite: false }));
  scene.add(halo);
  let overlays = new THREE.Group(); scene.add(overlays);
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  let visible = true, lost = false, azimuth = 0, roomMode = false, roomBearing = 180;
  function draw() { if (visible && !lost) renderer.render(scene, camera); }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); draw();
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  controls.addEventListener('change', draw);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; container.dispatchEvent(new CustomEvent('scene-unavailable'));
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { lost = false; draw(); });
  function clearOverlays() {
    scene.remove(overlays);
    overlays.traverse(object => {
      object.geometry?.dispose();
      if (object.material) { object.material.map?.dispose(); object.material.dispose(); }
    });
    overlays = new THREE.Group(); scene.add(overlays);
  }
  function sunVector(az, alt, radius = 32) {
    const a = az * Math.PI / 180, h = Math.max(0, alt) * Math.PI / 180;
    return v(Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h)).multiplyScalar(radius);
  }
  function addTrack(track) {
    if (!track) return;
    function curve(points, color) {
      if (points.length < 2) return;
      const path = new THREE.CatmullRomCurve3(points.map(p => sunVector(p.azimuth, p.altitude)));
      overlays.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(24, points.length * 2), .14, 5, false), new THREE.MeshBasicMaterial({ color })));
      for (const t of [.32, .72]) overlays.add(new THREE.ArrowHelper(path.getTangent(t), path.getPoint(t), 3, color, 1.1, .6));
    }
    for (const segment of track.segments) {
      const morning = segment.filter(p => p.timestamp <= track.noon);
      const afternoon = segment.filter(p => p.timestamp > track.noon);
      if (morning.length && afternoon.length) afternoon.unshift(morning[morning.length - 1]);
      curve(morning, 0xd58913); curve(afternoon, 0x8355ba);
    }
    for (const event of [track.sunrise, track.sunset]) {
      if (!event) continue;
      const color = event.kind === 'sunrise' ? '#b57100' : '#7540b0';
      const point = sunVector(event.azimuth, 0);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 8), new THREE.MeshBasicMaterial({ color }));
      dot.position.copy(point).setY(.7); overlays.add(dot);
      const text = label(`${event.kind === 'sunrise' ? '日出' : '日落'} ${event.label}`, color, 18);
      text.position.copy(point).multiplyScalar(1.12).setY(2.7); overlays.add(text);
    }
    for (const tick of track.ticks) {
      const text = label(tick.label, '#6b654e', 8);
      text.position.copy(sunVector(tick.azimuth, tick.altitude, 35)); overlays.add(text);
    }
  }
  function addRoom(c, light) {
    if (!c || light.error) return;
    const room = new THREE.Group();
    room.rotation.y = Math.PI - c.bearing * Math.PI / 180;
    room.scale.setScalar(26 / Math.max(c.width, c.depth, c.height * 2));
    room.position.y = .12;
    overlays.add(room);
    const W = c.width, D = c.depth, H = c.height;
    function box(width, height, depth, x, y, z, options = {}) {
      if (width <= 1e-8 || height <= 1e-8 || depth <= 1e-8) return;
      const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: 0xf1e8d4, roughness: .9, ...options }));
      object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; room.add(object); return object;
    }
    box(W, .08, D, 0, -.04, 0, { color: 0xcbbd9c });
    // The roof is hidden for inspection but still blocks sunlight from above.
    box(W, .06, D, 0, H + .03, 0, { colorWrite: false, depthWrite: false });
    const cutaway = { transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide };
    box(W, H, .1, 0, H / 2, -D / 2, cutaway);
    box(.1, H, D, -W / 2, H / 2, 0, cutaway);
    box(.1, H, D, W / 2, H / 2, 0, cutaway);
    // Four solid pieces leave a real window aperture in the front wall.
    box((W - c.windowWidth) / 2, H, .1, -(W + c.windowWidth) / 4, H / 2, D / 2);
    box((W - c.windowWidth) / 2, H, .1, (W + c.windowWidth) / 4, H / 2, D / 2);
    box(c.windowWidth, c.sill, .1, 0, c.sill / 2, D / 2);
    box(c.windowWidth, H - c.sill - c.windowHeight, .1, 0, (H + c.sill + c.windowHeight) / 2, D / 2);
    const frame = { color: 0x2c7667 };
    for (const x of [-c.windowWidth / 2, c.windowWidth / 2]) box(.06, c.windowHeight, .13, x, c.sill + c.windowHeight / 2, D / 2, frame);
    for (const y of [c.sill, c.sill + c.windowHeight]) box(c.windowWidth, .06, .13, 0, y, D / 2, frame);
    const windowLabel = label(`窗外 ${c.bearing.toFixed(0)}°`, '#17654c', 4.2);
    windowLabel.position.set(0, c.sill + c.windowHeight + .45, D / 2 + .25); room.add(windowLabel);
    const direction = new THREE.ArrowHelper(v(0, 0, 1), v(0, .08, D / 2 + .3), 1.8, 0x16735c, .4, .2); room.add(direction);
    function patch(points, to3D) {
      if (points.length < 3) return;
      const vertices = [];
      for (let i = 1; i < points.length - 1; i++) for (const p of [points[0], points[i], points[i + 1]]) vertices.push(...to3D(p));
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      room.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffca55, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })));
    }
    patch(light.patches.floor, ([x, depth]) => [x, .012, D / 2 - depth]);
    patch(light.patches.back, ([x, y]) => [x, y, -D / 2 + .061]);
    patch(light.patches.side, ([depth, y]) => [light.side * (W / 2 - .061), y, D / 2 - depth]);
    if (light.lit) {
      const incoming = v(-light.sun.x, -light.sun.y, -light.sun.z);
      for (const [index, ray] of light.rays.entries()) {
        const start = new THREE.Vector3(...ray.start), end = new THREE.Vector3(...ray.end);
        const outer = start.clone().addScaledVector(incoming, -2.5);
        room.add(line([outer, start, end], index === 0 ? 0xd96812 : 0xf3bd4e, false, index === 0 ? 1 : .65));
        const length = start.distanceTo(end);
        if (length > .1) room.add(new THREE.ArrowHelper(incoming, start, length, 0xda8a12, Math.min(.3, length / 3), .12));
      }
    }
  }
  function update(az, alt, height, options = {}) {
    azimuth = az;
    roomMode = Boolean(options.roomMode);
    roomBearing = options.config?.bearing ?? 180;
    const a = az * Math.PI / 180, h = alt * Math.PI / 180;
    const direction = v(Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h));
    const unit = Math.max(1, height / 18);
    const modelHeight = height / unit;
    walls.scale.y = Math.max(.001, modelHeight); walls.position.y = modelHeight / 2;
    roof.scale.y = Math.min(1, modelHeight / .3);
    roof.position.y = modelHeight - Math.min(.3, modelHeight) / 2;
    building.visible = !roomMode && height > 0;
    building.rotation.y = Math.PI - roomBearing * Math.PI / 180;
    for (const window of windows) { window.position.y = modelHeight * .55; window.scale.y = Math.min(1, modelHeight / 4); }
    const daytime = alt > 0;
    sunlight.intensity = daytime ? 2.5 + Math.sin(h) : 0;
    sunlight.position.copy(direction).multiplyScalar(90);
    ambient.intensity = daytime ? 1.7 : .55;
    ground.material.color.set(daytime ? 0xe6ecdd : 0x778697);
    sun.visible = halo.visible = daytime;
    sun.position.copy(direction).multiplyScalar(32); halo.position.copy(sun.position);
    clearOverlays();
    addTrack(options.track);
    if (roomMode) addRoom(options.config, options.roomLight);
    if (daytime) {
      const projection = v(Math.sin(a), 0, -Math.cos(a));
      overlays.add(line([v(0, .07, 0), projection.clone().multiplyScalar(30).setY(.07)], 0xc68f36, true));
      overlays.add(line([v(0, .1, 0), direction.clone().multiplyScalar(32)], 0xe3a434, false, .75));
      const arc = [];
      for (let i = 0; i <= 40; i++) {
        const angle = h * i / 40;
        arc.push(v(12 * Math.sin(a) * Math.cos(angle), 12 * Math.sin(angle) + .12, -12 * Math.cos(a) * Math.cos(angle)));
      }
      overlays.add(line(arc, 0xdd841d));
      const angleLabel = label(`${alt.toFixed(1)}°`, '#a56915', 14);
      angleLabel.position.copy(v(Math.sin(a) * Math.cos(h / 2), Math.sin(h / 2), -Math.cos(a) * Math.cos(h / 2)).multiplyScalar(17));
      overlays.add(angleLabel);
      // Parallel incident rays terminate at the model and the surrounding ground.
      for (const target of roomMode ? [] : [v(0, modelHeight + .3, 0), v(-9, .2, 5), v(9, .2, 5)]) {
        const start = target.clone().addScaledVector(direction, 22);
        overlays.add(new THREE.ArrowHelper(direction.clone().negate(), start, 20, 0xefa938, 1.7, .7));
      }
      if (!roomMode && height > 0) {
        const shadowLength = modelHeight / Math.tan(h);
        const end = projection.clone().multiplyScalar(-Math.min(shadowLength, 41)).setY(.12);
        overlays.add(line([v(0, .12, 0), end], 0x617f72, true));
      }
    }
    container.setAttribute('aria-label', `三维日照：太阳高度 ${alt.toFixed(1)} 度，方位 ${az.toFixed(1)} 度，${daytime ? '阳光和建筑阴影' : '夜间，无直射阳光'}`);
    draw();
  }
  function setView(view) {
    controls.target.set(0, 5, 0);
    if (view === 'top') camera.position.set(0, roomMode ? 57 : 87, .1);
    else if (view === 'side') {
      const a = azimuth * Math.PI / 180;
      camera.position.set(75 * Math.cos(a), 13, 75 * Math.sin(a));
    } else if (roomMode || view === 'room') {
      const a = roomBearing * Math.PI / 180;
      // Look from the cutaway rear toward the window so the floor patch stays visible.
      camera.position.set(-32 * Math.sin(a) + 18 * Math.cos(a), 45, 32 * Math.cos(a) + 18 * Math.sin(a));
    } else camera.position.set(60, 45, 70);
    controls.update(); draw();
  }
  setView('reset'); resize();
  return {
    update,
    setView,
    setVisible(value) { visible = value; controls.enabled = value; if (value) resize(); },
    dispose() { observer.disconnect(); controls.dispose(); clearOverlays(); scene.traverse(object => { object.geometry?.dispose(); if (object.material) { object.material.map?.dispose(); object.material.dispose(); } }); renderer.dispose(); renderer.domElement.remove(); }
  };
}
