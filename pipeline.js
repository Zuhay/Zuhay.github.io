/* Deployment pipeline: 3D scene (Three.js r128, loaded before this file) */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl') || c.getContext('experimental-webgl'))) return; } catch (e) { return; }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLOR = {
    navy: 0x12233f, navyDeep: 0x0c1830, white: 0xe8eef5, steel: 0x8a9bb4,
    amber: 0xffb000, red: 0xff5a4e, block: 0x1d3560
  };
  const STAGES = [
    { name: 'Commit', tools: 'Git, GitHub' },
    { name: 'Build', tools: 'Jenkins, GitHub Actions' },
    { name: 'Provision', tools: 'Terraform, Ansible' },
    { name: 'Deploy', tools: 'Harness, Kubernetes' },
    { name: 'Observe', tools: 'Splunk, Grafana' }
  ];
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const clamp01 = t => Math.max(0, Math.min(1, t));
  function whenVisible(el, start, stop) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(el);
  }
  function initPipeline() {
    const stageEl = document.getElementById('pipelineStage');
    const canvas = document.getElementById('pipelineCanvas');
    const labelsEl = document.getElementById('pipelineLabels');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: reduceMotion });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLOR.navyDeep, 18, 42);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xbfd2ff, COLOR.navyDeep, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(-6, 12, 8);
    scene.add(key);

    const floor = new THREE.GridHelper(60, 40, 0x2a4370, 0x1a2c4d);
    floor.position.y = -0.001;
    scene.add(floor);

    // Stages
    const SPACING = 3.4, W = 2.2, H = 0.55, D = 2.2;
    const xs = STAGES.map((_, i) => (i - (STAGES.length - 1) / 2) * SPACING);
    const blockGeo = new THREE.BoxGeometry(W, H, D);
    blockGeo.translate(0, H / 2, 0);
    const edgeGeo = new THREE.EdgesGeometry(blockGeo);
    const lampGeo = new THREE.BoxGeometry(W * 0.8, 0.05, 0.16);

    const stages = STAGES.map((s, i) => {
      const mat = new THREE.MeshStandardMaterial({ color: COLOR.block, roughness: 0.6, metalness: 0.2, emissive: COLOR.amber, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(blockGeo, mat);
      mesh.position.x = xs[i];
      const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: COLOR.steel, transparent: true, opacity: 0.55 }));
      mesh.add(edges);
      const lampMat = new THREE.MeshBasicMaterial({ color: COLOR.steel });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(0, H + 0.03, D / 2 - 0.25);
      mesh.add(lamp);
      scene.add(mesh);

      const label = document.createElement('div');
      label.className = 'plabel';
      label.innerHTML = `<b>${s.name}</b><span>${s.tools}</span>`;
      labelsEl.appendChild(label);
      return { mesh, mat, lampMat, edges, label, heat: 0, anchor: new THREE.Vector3(xs[i], 0, D / 2 + 0.6) };
    });

    // Track between stages
    const trackLen = xs[xs.length - 1] - xs[0];
    const track = new THREE.Mesh(
      new THREE.BoxGeometry(trackLen, 0.06, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x2a4370, roughness: 0.8 })
    );
    track.position.set(0, H + 0.03, 0);
    scene.add(track);

    // Packets (changes moving through the pipeline)
    const PACKET_Y = H + 0.22;
    const packetGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const packets = [];
    const pool = [];
    function makePacket(fail) {
      const m = pool.pop() || new THREE.Mesh(packetGeo,
        new THREE.MeshStandardMaterial({ color: COLOR.white, emissive: COLOR.white, emissiveIntensity: 0.35, roughness: 0.4 }));
      m.material.color.setHex(COLOR.white);
      m.material.emissive.setHex(COLOR.white);
      m.scale.setScalar(1);
      m.visible = true;
      scene.add(m);
      return { m, x: xs[0] - 1.2, state: 'forward', fail, t: 0, life: 0 };
    }
    let spawned = 0;

    const SPEED = 2.4; // units per second
    function updatePacket(p, dt) {
      p.life += dt;
      if (p.state === 'forward') {
        p.x += SPEED * dt;
        p.m.position.set(p.x, PACKET_Y, 0);
        p.m.rotation.y += dt * 1.5;
        if (p.fail && p.x >= xs[4]) { // fails monitoring at Observe
          p.state = 'rollback'; p.t = 0; p.from = p.x;
          p.m.material.color.setHex(COLOR.red);
          p.m.material.emissive.setHex(COLOR.red);
        }
        if (p.x > xs[4] + 1.6) p.state = 'done';
      } else if (p.state === 'rollback') {
        // arc back to Build over the pipeline
        p.t += dt / 1.8;
        const k = easeOut(clamp01(p.t));
        p.x = p.from + (xs[1] - p.from) * k;
        p.m.position.set(p.x, PACKET_Y + Math.sin(Math.PI * clamp01(p.t)) * 1.8, -Math.sin(Math.PI * clamp01(p.t)) * 0.8);
        if (p.t >= 1) {
          p.state = 'forward'; p.fail = false;
          p.m.material.color.setHex(COLOR.white);
          p.m.material.emissive.setHex(COLOR.white);
        }
      } else if (p.state === 'done') {
        p.x += SPEED * dt;
        p.m.position.x = p.x;
        const s = p.m.scale.x - dt * 2;
        p.m.scale.setScalar(Math.max(s, 0.001));
        if (s <= 0) { p.state = 'dead'; p.m.visible = false; scene.remove(p.m); pool.push(p.m); }
      }
    }

    // Layout
    let dist = 18, narrowView = false;
    function resize() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // fit all stages horizontally
      const halfWidth = trackLen / 2 + W;
      const hfov = 2 * Math.atan(Math.tan((camera.fov * Math.PI / 180) / 2) * camera.aspect);
      narrowView = camera.aspect < 1.9;
      dist = Math.max(9, (halfWidth / Math.tan(hfov / 2)) * (narrowView ? 1.02 : 1.0));
      camera.updateProjectionMatrix();
      if (!running) renderOnce();
    }

    const pointer = { x: 0, cur: 0 };
    window.addEventListener('pointermove', e => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; }, { passive: true });

    function placeCamera() {
      pointer.cur += (pointer.x - pointer.cur) * 0.05;
      // Narrow screens look straight on so the five labels don't crowd together
      const yaw = (narrowView ? -0.06 : -0.32) + pointer.cur * 0.12;
      const lift = narrowView ? 0.7 : 0.55;
      camera.position.set(Math.sin(yaw) * dist, dist * lift, Math.cos(yaw) * dist);
      camera.lookAt(0, narrowView ? 0.6 : 0.9, 0);
    }

    const v = new THREE.Vector3();
    function placeLabels() {
      const w = stageEl.clientWidth, h = stageEl.clientHeight;
      const narrow = w < 560;
      stages.forEach(s => {
        v.copy(s.anchor).project(camera);
        const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
        s.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0)`;
        s.label.querySelector('span').style.display = narrow ? 'none' : '';
        s.label.classList.toggle('is-on', s.heat > 0.4);
      });
    }

    // Power-up sequence: stages rise one by one, then packets start
    let startTime = null, running = false, raf = null, last = 0, nextSpawn = 0, lastElapsed = 0;
    const RISE = 0.5, STAGGER = 0.18;

    function applyRise(elapsed) {
      stages.forEach((s, i) => {
        const k = reduceMotion ? 1 : easeOut(clamp01((elapsed - i * STAGGER) / RISE));
        s.mesh.scale.y = Math.max(k, 0.001);
        s.mesh.visible = k > 0.002;
        s.label.style.opacity = k;
      });
      const tk = reduceMotion ? 1 : easeOut(clamp01((elapsed - 0.2) / 1.0));
      track.scale.x = Math.max(tk, 0.001);
    }

    function heatStages(dt) {
      stages.forEach((s, i) => {
        let near = 0;
        packets.forEach(p => {
          if (p.state !== 'forward') return;
          const d = Math.abs(p.m.position.x - xs[i]);
          if (d < 0.9) near = Math.max(near, 1 - d / 0.9);
        });
        s.heat += (near - s.heat) * Math.min(1, dt * 8);
        s.mat.emissiveIntensity = s.heat * 0.35;
        s.lampMat.color.setHex(s.heat > 0.3 ? COLOR.amber : COLOR.steel);
      });
      // Observe flashes red while a change is rolling back
      const rolling = packets.some(p => p.state === 'rollback' && p.t < 0.35);
      if (rolling) { stages[4].lampMat.color.setHex(COLOR.red); stages[4].mat.emissive.setHex(COLOR.red); stages[4].mat.emissiveIntensity = 0.3; }
      else stages[4].mat.emissive.setHex(COLOR.amber);
    }

    function frame(now) {
      raf = null;
      if (startTime === null) { startTime = now; last = now; }
      const elapsed = (now - startTime) / 1000;
      lastElapsed = elapsed;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      applyRise(elapsed);
      const live = elapsed > STAGES.length * STAGGER + RISE;
      if (live) {
        nextSpawn -= dt;
        if (nextSpawn <= 0) {
          spawned++;
          packets.push(makePacket(spawned % 5 === 3));
          nextSpawn = 1.35;
        }
      }
      packets.forEach(p => updatePacket(p, dt));
      for (let i = packets.length - 1; i >= 0; i--) if (packets[i].state === 'dead') packets.splice(i, 1);
      heatStages(dt);

      placeCamera();
      renderer.render(scene, camera);
      placeLabels();
      if (running) raf = requestAnimationFrame(frame);
    }

    function renderOnce() {
      applyRise(reduceMotion ? 99 : lastElapsed);
      placeCamera();
      renderer.render(scene, camera);
      placeLabels();
    }

    window.addEventListener('resize', resize);
    resize();

    if (reduceMotion) {
      // Static scene: a few changes in flight, one rolling back
      [xs[0] + 0.6, xs[2], xs[3] + 0.8].forEach(x => {
        const p = makePacket(false); p.m.position.set(x, PACKET_Y, 0); packets.push(p);
      });
      const r = makePacket(false);
      r.m.material.color.setHex(COLOR.red); r.m.material.emissive.setHex(COLOR.red);
      r.m.position.set((xs[1] + xs[4]) / 2, PACKET_Y + 1.6, -0.8);
      stages.forEach((s, i) => { s.heat = i === 2 ? 1 : 0; s.mat.emissiveIntensity = s.heat * 0.35; s.lampMat.color.setHex(s.heat ? COLOR.amber : COLOR.steel); });
      renderOnce();
      return;
    }

    // Power up when the section scrolls into view; pause while off screen
    whenVisible(stageEl,
      () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      () => { running = false; if (raf) cancelAnimationFrame(raf); raf = null; });
  }

  if (document.getElementById('pipelineStage')) initPipeline();
})();