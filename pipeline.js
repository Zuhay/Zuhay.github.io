/* Software delivery loop: 3D scene (Three.js r128, loaded before this file)
   Outer loop: eight stations, Plan → Observe, with feedback back to Plan.
   Inner rings: Development, Testing and Production environments, going outward.
   At Deploy a change hops onto the Development ring and spirals outward through
   Testing and Production to Observe. Every fifth change fails Testing and goes
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
    { name: 'Plan', tools: 'Agile / Scrum' },
    { name: 'Commit', tools: 'Git, GitHub' },
    { name: 'Build', tools: 'Jenkins, GitHub Actions' },
    { name: 'Security', tools: 'Certificate validation' },
    { name: 'APIs', tools: 'REST APIs, integrations' },
    { name: 'Provision', tools: 'Terraform, Ansible' },
    { name: 'Deploy', tools: 'Harness, Kubernetes' },
    { name: 'Observe', tools: 'Splunk, Grafana, CloudWatch' }
  ];
  const BUILD = 2, DEPLOY = 6, OBSERVE = 7;
  const ENVS = [
    { name: 'Development', r: 2.15, color: 0x0284c7, la: Math.PI * 0.80 },
    { name: 'Testing', r: 2.95, color: 0x7c3aed, la: Math.PI * 0.75 },
    { name: 'Production', r: 3.75, color: 0x059669, la: Math.PI * 0.70 }
  ];
  const TESTING = 1;

  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const lerp = (a, b, t) => a + (b - a) * t;

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
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  scene.add(sun);

  scene.add(new THREE.GridHelper(44, 44, 0xdbe3ec, 0xe9eef3));
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.ShadowMaterial({ opacity: 0.12 }));
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = 0.001;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  /* ---------- Geometry helpers ---------- */
  const R = 5.6;                                   // outer loop radius
  const STEP = (Math.PI * 2) / STATIONS.length;
  const START = Math.PI * 0.875;                   // puts Deploy and Observe at the front
  const angleOf = i => START + i * STEP;           // unwrapped, increasing
  const onRing = (a, r = R, y = 0) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);

  const H = 0.45, W = 1.5, D = 1.05;
  const TRACK_Y = H + 0.04, PACKET_Y = H + 0.24, ENV_Y = 0.24;

  /* ---------- Outer loop track + feedback ---------- */
  const trackMat = new THREE.MeshStandardMaterial({ color: COLOR.track, roughness: 0.7, transparent: true, opacity: 0 });
  const track = new THREE.Mesh(new THREE.TorusGeometry(R, 0.07, 10, 220, STEP * (STATIONS.length - 1)), trackMat);
  track.rotation.x = Math.PI / 2;
  track.rotation.z = START;
  track.position.y = TRACK_Y;
  scene.add(track);

  const fbPts = [];
  for (let k = 0; k <= 40; k++) fbPts.push(onRing(angleOf(OBSERVE) + STEP * (k / 40), R, TRACK_Y + 0.02));
  const feedback = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(fbPts),
    new THREE.LineDashedMaterial({ color: COLOR.amber, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0 })
  );
  feedback.computeLineDistances();
  scene.add(feedback);

  /* ---------- Hub ---------- */
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.72, 0.18, 72),
    new THREE.MeshStandardMaterial({ color: COLOR.hub, roughness: 0.5 }));
  hub.position.y = 0.09;
  hub.castShadow = true; hub.receiveShadow = true;
  scene.add(hub);
  const hubRim = new THREE.Mesh(new THREE.TorusGeometry(1.64, 0.035, 8, 140), new THREE.MeshBasicMaterial({ color: COLOR.accent }));
  hubRim.rotation.x = Math.PI / 2;
  hubRim.position.y = 0.19;
  scene.add(hubRim);

  /* ---------- Environment rings (going outward) ---------- */
  const envs = ENVS.map(e => {
    const mat = new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.5, emissive: e.color, emissiveIntensity: 0, transparent: true, opacity: 0 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(e.r - 0.13, e.r + 0.13, 160), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.receiveShadow = true;
    scene.add(ring);
    const label = document.createElement('div');
    label.className = 'plabel plabel--ring';
    label.style.setProperty('--env', '#' + e.color.toString(16).padStart(6, '0'));
    label.innerHTML = `<b>${e.name}</b>`;
    labelsEl.appendChild(label);
    return { ...e, ring, mat, label, heat: 0 };
  });

  /* ---------- Stations ---------- */
  const blockGeo = new THREE.BoxGeometry(W, H, D);
  blockGeo.translate(0, H / 2, 0);
  const edgeGeo = new THREE.EdgesGeometry(blockGeo);
  const lampGeo = new THREE.BoxGeometry(W * 0.72, 0.05, 0.13);

  const stations = STATIONS.map((s, i) => {
    const a = angleOf(i);
    const g = new THREE.Group();
    g.position.copy(onRing(a));
    g.rotation.y = -a + Math.PI / 2;
    const mat = new THREE.MeshStandardMaterial({ color: COLOR.block, roughness: 0.55, emissive: COLOR.amber, emissiveIntensity: 0 });
    const block = new THREE.Mesh(blockGeo, mat);
    block.castShadow = true; block.receiveShadow = true;
    g.add(block);
    g.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: COLOR.edge, transparent: true, opacity: 0.7 })));
    const lampMat = new THREE.MeshBasicMaterial({ color: COLOR.lampOff });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(0, H + 0.03, D / 2 - 0.2);
    g.add(lamp);
    scene.add(g);

    const label = document.createElement('div');
    label.className = 'plabel';
    label.innerHTML = `<b>${s.name}</b><span>${s.tools}</span>`;
    labelsEl.appendChild(label);
    return { g, mat, lampMat, label, a, heat: 0 };
  });

  const hubLabel = document.createElement('div');
  hubLabel.className = 'plabel plabel--hub';
  hubLabel.innerHTML = '<b>Software delivery</b>';
  labelsEl.appendChild(hubLabel);
  const fbLabel = document.createElement('div');
  fbLabel.className = 'plabel plabel--feedback';
  fbLabel.innerHTML = '<span>feedback</span>';
  labelsEl.appendChild(fbLabel);
  const hubAnchor = new THREE.Vector3(0, 0.2, 0);
  const fbAnchor = onRing(angleOf(OBSERVE) + STEP / 2, R + 0.85, 0);

  /* ---------- Changes (packets) ---------- */
  const packetGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const packets = [], pool = [];
  const OMEGA = STEP / 0.95;                        // ~0.95 s between stations
  const HOP = 0.7, SEG = 0.95;                      // hop onto Development; each ring-to-ring leg

  function makePacket(fail) {
    const m = pool.pop() || new THREE.Mesh(packetGeo, new THREE.MeshStandardMaterial({ roughness: 0.4 }));
    m.material.color.setHex(COLOR.packet);
    m.castShadow = true; m.scale.setScalar(1); m.visible = true;
    scene.add(m);
    return { m, a: angleOf(0), state: 'loop', fail, t: 0 };
  }
  const bezier = (p0, p1, p2, t) => p0.clone().multiplyScalar((1 - t) * (1 - t))
    .add(p1.clone().multiplyScalar(2 * (1 - t) * t)).add(p2.clone().multiplyScalar(t * t));

  // Promotion path: Development → Testing → Production → Observe, spiralling outward
  const aD = angleOf(DEPLOY), aO = angleOf(OBSERVE);
  const legRadii = [ENVS[0].r, ENVS[1].r, ENVS[2].r, R];
  function promotePos(u) {                         // u in [0, 3]
    const leg = Math.min(2, Math.floor(u)), k = easeInOut(clamp01(u - leg));
    const r = lerp(legRadii[leg], legRadii[leg + 1], k);
    const a = lerp(aD, aO, (leg + k) / 3);
    const y = leg === 2 ? lerp(ENV_Y, PACKET_Y, k) : ENV_Y;
    return onRing(a, r, y);
  }

  function updatePacket(p, dt) {
    if (p.state === 'loop') {
      p.a += OMEGA * dt;
      p.m.position.copy(onRing(p.a, R, PACKET_Y));
      p.m.rotation.y -= dt * 1.4;
      if (p.a >= aD && p.a < aO) {                  // reached Deploy: hop onto Development
        p.state = 'hop'; p.t = 0;
        p.from = p.m.position.clone();
        p.to = onRing(aD, ENVS[0].r, ENV_Y);
        p.ctrl = p.from.clone().lerp(p.to, 0.5).setY(2.2);
      }
      if (p.a >= angleOf(0) + Math.PI * 2) p.state = 'done';
    } else if (p.state === 'hop') {
      p.t += dt / HOP;
      p.m.position.copy(bezier(p.from, p.ctrl, p.to, easeInOut(clamp01(p.t))));
      if (p.t >= 1) { p.state = 'promote'; p.u = 0; }
    } else if (p.state === 'promote') {
      p.u += dt / SEG;
      if (p.fail && p.u >= TESTING) {               // fails in Testing → back to Build
        p.state = 'rollback'; p.t = 0;
        p.from = promotePos(TESTING);
        p.to = onRing(angleOf(BUILD), R, PACKET_Y);
        p.ctrl = new THREE.Vector3(0, 3.6, 0);
        p.m.material.color.setHex(COLOR.red);
        return;
      }
      p.m.position.copy(promotePos(Math.min(p.u, 3)));
      if (p.u >= 3) { p.state = 'loop'; p.a = aO + 0.0001; }
    } else if (p.state === 'rollback') {
      p.t += dt / 2.0;
      p.m.position.copy(bezier(p.from, p.ctrl, p.to, easeOut(clamp01(p.t))));
      p.m.rotation.x += dt * 3;
      if (p.t >= 1) { p.state = 'loop'; p.fail = false; p.a = angleOf(BUILD); p.m.material.color.setHex(COLOR.packet); }
    } else if (p.state === 'done') {                // absorbed into the next plan
      const s = p.m.scale.x - dt * 2.5;
      p.m.scale.setScalar(Math.max(s, 0.001));
      if (s <= 0) { p.state = 'dead'; p.m.visible = false; scene.remove(p.m); pool.push(p.m); }
    }
  }

  function heat(dt) {
    stations.forEach(s => {
      let near = 0;
      packets.forEach(p => {
        if (p.state !== 'loop' && !(p.state === 'hop' && p.t < 0.3)) return;
        const d = Math.abs(((p.a - s.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (d < 0.24) near = Math.max(near, 1 - d / 0.24);
      });
      s.heat += (near - s.heat) * Math.min(1, dt * 8);
      s.mat.emissiveIntensity = s.heat * 0.28;
      s.lampMat.color.setHex(s.heat > 0.3 ? COLOR.amber : COLOR.lampOff);
      s.label.classList.toggle('is-on', s.heat > 0.4);
    });
    envs.forEach((e, i) => {
      let near = 0;
      packets.forEach(p => {
        if (p.state !== 'promote') return;
        const d = Math.abs(p.u - i);
        if (d < 0.35) near = Math.max(near, 1 - d / 0.35);
      });
      e.heat += (near - e.heat) * Math.min(1, dt * 8);
      e.mat.emissiveIntensity = 0.1 + e.heat * 0.45;
      e.label.classList.toggle('is-on', e.heat > 0.4);
    });
    const failing = packets.some(p => p.state === 'rollback' && p.t < 0.35);
    envs[TESTING].label.classList.toggle('is-fail', failing);
  }

  /* ---------- Camera and labels ---------- */
  let dist = 20, narrow = false;
  const PITCH = 0.74;
  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    narrow = w < 560;
    const vHalf = Math.tan((camera.fov * Math.PI / 180) / 2), hHalf = vHalf * camera.aspect;
    const halfW = R + (narrow ? 1.4 : 2.5);
    const halfH = (R + 2.1) * Math.sin(PITCH) + 1.8;
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

  const v = new THREE.Vector3(), tmp = new THREE.Vector3();
  function toScreen(p) {
    v.copy(p).project(camera);
    return { x: (v.x + 1) / 2 * stageEl.clientWidth, y: (1 - v.y) / 2 * stageEl.clientHeight };
  }
  const put = (el, x, y) => { el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`; };
  function placeLabels() {
    const c = toScreen(hubAnchor);
    const ox = narrow ? 50 : 124, oy = narrow ? 28 : 54;
    stations.forEach(s => {
      tmp.set(s.g.position.x, H, s.g.position.z);
      const p = toScreen(tmp);
      const dx = p.x - c.x, dy = p.y - c.y, len = Math.hypot(dx, dy) || 1;
      put(s.label, p.x + dx / len * ox, p.y + dy / len * oy);
      s.label.classList.toggle('is-compact', narrow);
    });
    envs.forEach(e => { const p = toScreen(onRing(e.la, e.r, 0.05)); put(e.label, p.x, p.y); }); // front-left, clear of the promotion path
    put(hubLabel, c.x, c.y);
    const f = toScreen(fbAnchor); put(fbLabel, f.x, f.y);
  }

  /* ---------- Power-up and loop ---------- */
  let running = false, raf = null, startTime = null, last = 0, elapsedNow = 0, nextSpawn = 0, spawned = 0;
  const RISE = 0.45, STAGGER = 0.12;

  function applyRise(elapsed) {
    const hk = reduceMotion ? 1 : easeOut(clamp01(elapsed / 0.7));
    hub.scale.set(Math.max(hk, 0.001), 1, Math.max(hk, 0.001));
    hubRim.scale.set(Math.max(hk, 0.001), Math.max(hk, 0.001), 1);
    hubLabel.style.opacity = hk;
    envs.forEach((e, i) => {                        // rings ripple outward from the hub
      const k = reduceMotion ? 1 : easeOut(clamp01((elapsed - 0.25 - i * 0.18) / 0.5));
      e.mat.opacity = 0.9 * k;
      e.ring.scale.setScalar(Math.max(0.6 + 0.4 * k, 0.001));
      e.label.style.opacity = k;
    });
    stations.forEach((s, i) => {
      const k = reduceMotion ? 1 : easeOut(clamp01((elapsed - 0.8 - i * STAGGER) / RISE));
      s.g.scale.y = Math.max(k, 0.001);
      s.g.visible = k > 0.002;
      s.label.style.opacity = k;
    });
    const t = reduceMotion ? 1 : clamp01((elapsed - 1.0) / 0.9);
    trackMat.opacity = t;
    feedback.material.opacity = t * 0.95;
    fbLabel.style.opacity = t;
  }

  function frame(now) {
    raf = null;
    if (startTime === null) { startTime = now; last = now; }
    elapsedNow = (now - startTime) / 1000;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    applyRise(elapsedNow);
    if (elapsedNow > 0.8 + STATIONS.length * STAGGER + RISE) {
      nextSpawn -= dt;
      if (nextSpawn <= 0) { spawned++; packets.push(makePacket(spawned % 5 === 2)); nextSpawn = 1.3; }
    }
    packets.forEach(p => updatePacket(p, dt));
    for (let i = packets.length - 1; i >= 0; i--) if (packets[i].state === 'dead') packets.splice(i, 1);
    heat(dt);

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
    // Still scene: changes on the loop, one being promoted, one rolling back
    [0.5, 2.0, 4.0].forEach(i => {
      const p = makePacket(false); p.a = angleOf(i); p.m.position.copy(onRing(p.a, R, PACKET_Y)); packets.push(p);
    });
    const pr = makePacket(false); pr.m.position.copy(promotePos(1.5)); packets.push(pr);
    const rb = makePacket(false); rb.m.material.color.setHex(COLOR.red);
    rb.m.position.copy(bezier(promotePos(TESTING), new THREE.Vector3(0, 3.6, 0), onRing(angleOf(BUILD), R, PACKET_Y), 0.5));
    envs.forEach(e => { e.mat.emissiveIntensity = 0.1; });
    stations[4].lampMat.color.setHex(COLOR.amber); stations[4].mat.emissiveIntensity = 0.28; stations[4].label.classList.add('is-on');
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
