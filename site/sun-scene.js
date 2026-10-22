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
  let visible = true, lost = false, azimuth = 0;
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
  function update(az, alt, height) {
    azimuth = az;
    const a = az * Math.PI / 180, h = alt * Math.PI / 180;
    const direction = v(Math.sin(a) * Math.cos(h), Math.sin(h), -Math.cos(a) * Math.cos(h));
    const unit = Math.max(1, height / 18);
    const modelHeight = height / unit;
    walls.scale.y = Math.max(.001, modelHeight); walls.position.y = modelHeight / 2;
    roof.scale.y = Math.min(1, modelHeight / .3);
    roof.position.y = modelHeight - Math.min(.3, modelHeight) / 2;
    building.visible = height > 0;
    for (const window of windows) { window.position.y = modelHeight * .55; window.scale.y = Math.min(1, modelHeight / 4); }
    const daytime = alt > 0;
    sunlight.intensity = daytime ? 2.5 + Math.sin(h) : 0;
    sunlight.position.copy(direction).multiplyScalar(90);
    ambient.intensity = daytime ? 1.7 : .55;
    ground.material.color.set(daytime ? 0xe6ecdd : 0x778697);
    sun.visible = halo.visible = daytime;
    sun.position.copy(direction).multiplyScalar(32); halo.position.copy(sun.position);
    clearOverlays();
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
      for (const target of [v(0, modelHeight + .3, 0), v(-9, .2, 5), v(9, .2, 5)]) {
        const start = target.clone().addScaledVector(direction, 22);
        overlays.add(new THREE.ArrowHelper(direction.clone().negate(), start, 20, 0xefa938, 1.7, .7));
      }
      if (height > 0) {
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
    if (view === 'top') camera.position.set(0, 87, .1);
    else if (view === 'side') {
      const a = azimuth * Math.PI / 180;
      camera.position.set(75 * Math.cos(a), 13, 75 * Math.sin(a));
    } else camera.position.set(48, 36, 54);
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
