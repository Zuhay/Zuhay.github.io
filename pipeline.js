/* Delivery loop: 3D scene (Three.js r128, loaded before this file)
   Seven stations on a ring. Changes travel Commit → Observe, then feedback
   closes the loop back to Commit. Every fifth change fails Testing and goes
   back to Build. */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl') || c.getContext('experimental-webgl'))) return; } catch (e) { return; }

  const stageEl = document.getElementById('pipelineStage');
  if (!stageEl) return;
  const canvas = document.getElementById('pipelineCanvas');
  const labelsEl = document.getElementById('pipelineLabels');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLOR = {
    block: 0xf8fafc, edge: 0x94a3b8, lampOff: 0xcbd5e1, amber: 0xf59e0b,
    packet: 0x0f172a, red: 0xef4444, track: 0xcbd5e1, hub: 0xffffff, accent: 0x059669
  };
  const STATIONS = [
    { name: 'Commit', tools: 'Git, GitHub' },
    { name: 'Build', tools: 'Jenkins, GitHub Actions' },
    { name: 'Provision', tools: 'Terraform, Ansible' },
    { name: 'Development', tools: 'Harness, Kubernetes', env: 0x0284c7 },
    { name: 'Testing', tools: 'Harness, Kubernetes', env: 0x7c3aed },
    { name: 'Production', tools: 'Harness, Kubernetes, Rancher', env: 0x059669 },
    { name: 'Observe', tools: 'Splunk, Grafana, CloudWatch' }
  ];
  const BUILD = 1, TESTING = 4;

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const clamp01 = t => Math.max(0, Math.min(1, t));

  /* ---------- Renderer, scene, lights ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: reduceMotion });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe3ec, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(-5, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.radius = 4;
  scene.add(sun);

  const grid = new THREE.GridHelper(40, 40, 0xdbe3ec, 0xe9eef3);
  scene.add(grid);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.12 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.001;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  /* ---------- Ring geometry ---------- */
  const R = 5.2;
  const STEP = (Math.PI * 2) / STATIONS.length;
  const START = Math.PI * 0.85;                   // Commit sits front-left
  const angleOf = i => START + i * STEP;          // unwrapped, increasing
  const onRing = (a, r = R, y = 0) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

  const H = 0.5, W = 1.9, D = 1.4;
  const TRACK_Y = H + 0.04, PACKET_Y = H + 0.26;

  // Main track: Commit → Observe
  const trackMat = new THREE.MeshStandardMaterial({ color: COLOR.track, roughness: 0.7, transparent: true, opacity: 0 });
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(R, 0.07, 10, 200, STEP * (STATIONS.length - 1)),
    trackMat
  );
  track.rotation.x = Math.PI / 2;           // lie flat; torus arc starts at +x and sweeps toward +z… in local space
  track.rotation.z = START;                 // align arc start with Commit
  track.position.y = TRACK_Y;
  track.receiveShadow = true;
  scene.add(track);

  // Feedback segment: Observe → Commit (dashed amber)
  const fbPts = [];
  for (let k = 0; k <= 40; k++) fbPts.push(onRing(angleOf(STATIONS.length - 1) + STEP * (k / 40), R, TRACK_Y + 0.02));
  const feedback = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(fbPts),
    new THREE.LineDashedMaterial({ color: COLOR.amber, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0 })
  );
  feedback.computeLineDistances();
  scene.add(feedback);

  // Hub in the middle
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.4, 0.16, 72),
    new THREE.MeshStandardMaterial({ color: COLOR.hub, roughness: 0.5 })
  );
  hub.position.y = 0.08;
  hub.castShadow = true; hub.receiveShadow = true;
  scene.add(hub);
  const hubRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.32, 0.035, 8, 140),
    new THREE.MeshBasicMaterial({ color: COLOR.accent })
  );
  hubRing.rotation.x = Math.PI / 2;
  hubRing.position.y = 0.17;
  scene.add(hubRing);

  /* ---------- Stations ---------- */
  const blockGeo = new THREE.BoxGeometry(W, H, D);
  blockGeo.translate(0, H / 2, 0);
  const edgeGeo = new THREE.EdgesGeometry(blockGeo);
  const lampGeo = new THREE.BoxGeometry(W * 0.75, 0.05, 0.14);
  const capGeo = new THREE.BoxGeometry(W, 0.08, D);

  const stations = STATIONS.map((s, i) => {
    const a = angleOf(i);
    const g = new THREE.Group();
    g.position.copy(onRing(a));
    g.rotation.y = -a + Math.PI / 2;        // long side follows the ring

    const mat = new THREE.MeshStandardMaterial({ color: COLOR.block, roughness: 0.55, emissive: COLOR.amber, emissiveIntensity: 0 });
    const block = new THREE.Mesh(blockGeo, mat);
    block.castShadow = true; block.receiveShadow = true;
    g.add(block);
    g.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: COLOR.edge, transparent: true, opacity: 0.7 })));

    if (s.env) { // environment stations get a coloured cap
      const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: s.env, roughness: 0.45 }));
      cap.position.y = H + 0.04;
      cap.castShadow = true;
      g.add(cap);
    }
    const lampMat = new THREE.MeshBasicMaterial({ color: COLOR.lampOff });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, H + (s.env ? 0.11 : 0.03), D / 2 - 0.22);
    g.add(lamp);
    scene.add(g);

    const label = document.createElement('div');
    label.className = 'plabel' + (s.env ? ' plabel--env' : '');
    if (s.env) label.style.setProperty('--env', '#' + s.env.toString(16).padStart(6, '0'));
    label.innerHTML = `<b>${s.name}</b><span>${s.tools}</span>`;
    labelsEl.appendChild(label);
    return { g, mat, lampMat, label, a, heat: 0, anchor: onRing(a, R + 1.55, 0) };
  });

  // Centre and feedback labels
  const hubLabel = document.createElement('div');
  hubLabel.className = 'plabel plabel--hub';
  hubLabel.innerHTML = '<b>Agile loop</b><span>Feedback shapes<br>the next commit</span>';
  labelsEl.appendChild(hubLabel);
  const fbLabel = document.createElement('div');
  fbLabel.className = 'plabel plabel--feedback';
  fbLabel.innerHTML = '<span>feedback</span>';
  labelsEl.appendChild(fbLabel);
  const hubAnchor = new THREE.Vector3(0, 0.2, 0);
  const fbAnchor = onRing(angleOf(STATIONS.length - 1) + STEP / 2, R + 0.9, 0);

  /* ---------- Changes (packets) ---------- */
  const packetGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
  const packets = [], pool = [];
  const LAP = 10;                                  // seconds per loop
  const OMEGA = (Math.PI * 2) / LAP;

  function makePacket(fail) {
    const m = pool.pop() || new THREE.Mesh(packetGeo, new THREE.MeshStandardMaterial({ roughness: 0.4 }));
    m.material.color.setHex(COLOR.packet);
    m.castShadow = true;
    m.scale.setScalar(1);
    m.visible = true;
    scene.add(m);
    return { m, a: angleOf(0), state: 'loop', fail, t: 0 };
  }
  function setPacketColor(p, hex) { p.m.material.color.setHex(hex); }

  const bezier = (p0, p1, p2, t) => p0.clone().multiplyScalar((1 - t) * (1 - t))
    .add(p1.clone().multiplyScalar(2 * (1 - t) * t)).add(p2.clone().multiplyScalar(t * t));

  function updatePacket(p, dt) {
    if (p.state === 'loop') {
      p.a += OMEGA * dt;
      p.m.position.copy(onRing(p.a, R, PACKET_Y));
      p.m.rotation.y -= dt * 1.4;
      if (p.fail && p.a >= angleOf(TESTING)) {      // fails testing → back to build
        p.state = 'rollback'; p.t = 0;
        p.from = p.m.position.clone();
        p.to = onRing(angleOf(BUILD), R, PACKET_Y);
        p.ctrl = new THREE.Vector3(0, 3.4, 0);
        setPacketColor(p, COLOR.red);
      }
      if (p.a >= angleOf(0) + Math.PI * 2) { p.state = 'done'; }
    } else if (p.state === 'rollback') {
      p.t += dt / 2.0;
      const k = easeOut(clamp01(p.t));
      p.m.position.copy(bezier(p.from, p.ctrl, p.to, k));
      p.m.rotation.x += dt * 3;
      if (p.t >= 1) { p.state = 'loop'; p.fail = false; p.a = angleOf(BUILD); setPacketColor(p, COLOR.packet); }
    } else if (p.state === 'done') {                // absorbed into the next commit
      const s = p.m.scale.x - dt * 2.5;
      p.m.scale.setScalar(Math.max(s, 0.001));
      if (s <= 0) { p.state = 'dead'; p.m.visible = false; scene.remove(p.m); pool.push(p.m); }
    }
  }

  function heatStations(dt) {
    stations.forEach((s, i) => {
      let near = 0;
      packets.forEach(p => {
        if (p.state !== 'loop') return;
        // angular distance on the unwrapped loop
        let d = Math.abs(((p.a - s.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (d < 0.28) near = Math.max(near, 1 - d / 0.28);
      });
      s.heat += (near - s.heat) * Math.min(1, dt * 8);
      s.mat.emissiveIntensity = s.heat * 0.28;
      s.lampMat.color.setHex(s.heat > 0.3 ? COLOR.amber : COLOR.lampOff);
      s.label.classList.toggle('is-on', s.heat > 0.4);
    });
    const failing = packets.some(p => p.state === 'rollback' && p.t < 0.35);
    const test = stations[TESTING];
    if (failing) { test.lampMat.color.setHex(COLOR.red); test.label.classList.add('is-fail'); }
    else test.label.classList.remove('is-fail');
  }

  /* ---------- Camera and layout ---------- */
  let dist = 18, narrow = false;
  const PITCH = 0.72;
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    narrow = w < 560;
    const vHalf = Math.tan((camera.fov * Math.PI / 180) / 2);
    const hHalf = vHalf * camera.aspect;
    const halfW = R + (narrow ? 1.5 : 2.4);
    const halfH = (R + 2.2) * Math.sin(PITCH) + 1.9;
    dist = Math.max(halfW / hHalf, halfH / vHalf) * 1.04;
    if (!running) renderOnce();
  }

  const pointer = { x: 0, cur: 0 };
  window.addEventListener('pointermove', e => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; }, { passive: true });
  function placeCamera() {
    pointer.cur += (pointer.x - pointer.cur) * 0.05;
    const yaw = pointer.cur * 0.14;
    camera.position.set(Math.sin(yaw) * Math.cos(PITCH) * dist, Math.sin(PITCH) * dist, Math.cos(yaw) * Math.cos(PITCH) * dist);
    camera.lookAt(0, 0, 0.9);
  }

  const v = new THREE.Vector3();
  function toScreen(p) {
    v.copy(p).project(camera);
    return { x: (v.x + 1) / 2 * stageEl.clientWidth, y: (1 - v.y) / 2 * stageEl.clientHeight };
  }
  const put = (el, x, y) => { el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`; };
  const stationTop = new THREE.Vector3();
  function placeLabels() {
    const c = toScreen(hubAnchor);
    const ox = narrow ? 52 : 118, oy = narrow ? 30 : 58;   // labels are wider than tall
    stations.forEach(s => {
      stationTop.set(s.g.position.x, H, s.g.position.z);
      const p = toScreen(stationTop);
      const dx = p.x - c.x, dy = p.y - c.y, len = Math.hypot(dx, dy) || 1;
      put(s.label, p.x + dx / len * ox, p.y + dy / len * oy);
      s.label.classList.toggle('is-compact', narrow);
    });
    put(hubLabel, c.x, c.y);
    const f = toScreen(fbAnchor); put(fbLabel, f.x, f.y);
    hubLabel.classList.toggle('is-compact', narrow);
  }

  /* ---------- Power-up, loop ---------- */
  let running = false, raf = null, startTime = null, last = 0, elapsedNow = 0, nextSpawn = 0, spawned = 0;
  const RISE = 0.45, STAGGER = 0.14;

  function applyRise(elapsed) {
    stations.forEach((s, i) => {
      const k = reduceMotion ? 1 : easeOut(clamp01((elapsed - i * STAGGER) / RISE));
      s.g.scale.y = Math.max(k, 0.001);
      s.g.visible = k > 0.002;
      s.label.style.opacity = k;
    });
    const t = reduceMotion ? 1 : clamp01((elapsed - 0.3) / 0.9);
    trackMat.opacity = t;
    feedback.material.opacity = t * 0.95;
    hubLabel.style.opacity = t; fbLabel.style.opacity = t;
    const hk = reduceMotion ? 1 : easeOut(clamp01(elapsed / 0.8));
    hub.scale.set(hk || 0.001, 1, hk || 0.001);
    hubRing.scale.set(hk || 0.001, hk || 0.001, 1);
  }

  function frame(now) {
    raf = null;
    if (startTime === null) { startTime = now; last = now; }
    elapsedNow = (now - startTime) / 1000;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    applyRise(elapsedNow);
    if (elapsedNow > STATIONS.length * STAGGER + RISE) {
      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        spawned++;
        packets.push(makePacket(spawned % 5 === 2));
        nextSpawn = 1.25;
      }
    }
    packets.forEach(p => updatePacket(p, dt));
    for (let i = packets.length - 1; i >= 0; i--) if (packets[i].state === 'dead') packets.splice(i, 1);
    heatStations(dt);

    placeCamera();
    renderer.render(scene, camera);
    placeLabels();
    if (running) raf = requestAnimationFrame(frame);
  }

  function renderOnce() {
    applyRise(reduceMotion ? 99 : elapsedNow);
    placeCamera();
    renderer.render(scene, camera);
    placeLabels();
  }

  window.addEventListener('resize', resize);
  resize();

  if (reduceMotion) {
    // Still scene: changes spread around the loop, one rolling back from Testing
    [0.4, 1.6, 2.6, 3.6, 5.2].forEach(off => {
      const p = makePacket(false); p.a = angleOf(0) + off; p.m.position.copy(onRing(p.a, R, PACKET_Y)); packets.push(p);
    });
    const r = makePacket(false);
    setPacketColor(r, COLOR.red);
    r.m.position.copy(bezier(onRing(angleOf(TESTING), R, PACKET_Y), new THREE.Vector3(0, 3.4, 0), onRing(angleOf(BUILD), R, PACKET_Y), 0.45));
    stations[3].heat = 1; stations[3].lampMat.color.setHex(COLOR.amber); stations[3].mat.emissiveIntensity = 0.28;
    stations[3].label.classList.add('is-on');
    renderOnce();
    return;
  }

  // Power up when the section scrolls into view; pause while off screen
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (running) return;
      running = true; last = performance.now();
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }
  }).observe(stageEl);
})();
