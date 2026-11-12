(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasThree = typeof window.THREE !== 'undefined';

  /* =========================================================
     Experience data (single source of truth for the 3D viz)
     ========================================================= */
  const ROLES = [
    {
      id: 'fcg', title: 'Software Engineer', co: 'First Central Group',
      months: 4, color: '#7c3aed',
      tools: ['Java', 'OOP', 'REST APIs', 'Git', 'SQL', 'Agile']
    },
    {
      id: 'fdm', title: 'Cloud / Site Reliability Engineer', co: 'FDM Group',
      months: 18, color: '#0284c7',
      tools: ['AWS', 'Azure', 'Linux', 'Java', 'Jenkins', 'Git', 'GitHub', 'Python', 'Bash', 'Docker',
              'Kubernetes', 'Splunk', 'CloudWatch', 'Grafana', 'PostgreSQL', 'MySQL', 'Terraform', 'Ansible']
    },
    {
      id: 'occ', title: 'DevOps / Platform Engineer', co: 'Options Clearing Corporation',
      months: 25, color: '#059669',
      tools: ['Java', 'Linux', 'Python', 'Bash', 'Git', 'Jenkins', 'GitHub Actions', 'Harness', 'Terraform',
              'Ansible', 'Docker', 'Kubernetes', 'Rancher', 'Splunk', 'CloudWatch', 'Grafana',
              'LogicMonitor', 'Copilot']
    }
  ];

  /* ---------- Small helpers ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();

  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Active nav link
  const navLinks = [...document.querySelectorAll('.nav__links a')];
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });

  // Reveal on scroll
  const rev = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rev.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => rev.observe(el));

  // Count-up stats
  const counter = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.count;
      counter.unobserve(el);
      if (reduceMotion) { el.textContent = target; return; }
      const t0 = performance.now(), dur = 1400;
      const step = now => {
        const p = Math.min((now - t0) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(el => counter.observe(el));

  // 3D tilt cards
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.tilt').forEach(card => {
      const max = card.classList.contains('job') ? 3 : 8;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
        card.style.setProperty('--mx', (x * 100) + '%');
        card.style.setProperty('--my', (y * 100) + '%');
      });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  // Copy email
  const copyBtn = document.getElementById('copyEmail');
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copyBtn.dataset.email); copyBtn.textContent = 'Copied ✓'; }
    catch (e) { copyBtn.textContent = 'Select & copy'; }
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1800);
  });

  // Run a render loop only while the element is on screen
  function whenVisible(el, start, stop) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0 }).observe(el);
  }

  /* =========================================================
     HERO — 3D "cluster" scene
     ========================================================= */
  function initHero() {
    const canvas = document.getElementById('heroCanvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: reduceMotion });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xffffff, 0.04);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    const world = new THREE.Group();
    scene.add(world);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const l1 = new THREE.PointLight(0x10b981, 1.6, 30); l1.position.set(5, 4, 6); scene.add(l1);
    const l2 = new THREE.PointLight(0x38bdf8, 1.4, 30); l2.position.set(-6, -3, 4); scene.add(l2);
    const l3 = new THREE.PointLight(0xa78bfa, 1.2, 30); l3.position.set(0, -5, -4); scene.add(l3);

    // Core: faceted solid + wireframe shell
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshStandardMaterial({ color: 0xe8edf3, metalness: 0.25, roughness: 0.35, flatShading: true })
    );
    world.add(core);
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.05, 1)),
      new THREE.LineBasicMaterial({ color: 0x059669, transparent: true, opacity: 0.6 })
    );
    world.add(shell);

    // Orbit rings
    const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.012, 8, 160), ringMat(0x0284c7, 0.55));
    ring1.rotation.x = Math.PI / 2.4;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.01, 8, 160), ringMat(0x7c3aed, 0.45));
    ring2.rotation.set(Math.PI / 3, Math.PI / 5, 0);
    world.add(ring1, ring2);

    // Node cluster (pods) + connections
    const nodeCount = 64, radius = 3.3, nodes = [];
    const nodeGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const palette = [0x059669, 0x0284c7, 0x7c3aed];
    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / nodeCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = radius + (Math.random() - 0.5) * 0.9;
      const v = new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
      const m = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: palette[i % 3] }));
      m.position.copy(v);
      world.add(m);
      nodes.push(v);
    }
    const linePos = [];
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++)
        if (nodes[i].distanceTo(nodes[j]) < 1.55) linePos.push(...nodes[i].toArray(), ...nodes[j].toArray());
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    world.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.28 })));

    // Packets travelling along random edges
    const packets = [];
    const edgeCount = linePos.length / 6;
    const pGeo = new THREE.SphereGeometry(0.045, 8, 8);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0x0f172a }));
      world.add(m);
      packets.push({ m, e: Math.floor(Math.random() * edgeCount), t: Math.random(), s: 0.004 + Math.random() * 0.01 });
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3();

    // Star field
    const starCount = 1400, sp = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 60;
      sp[i * 3 + 1] = (Math.random() - 0.5) * 40;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x94a3b8, size: 0.045, transparent: true, opacity: 0.6 }));
    scene.add(stars);

    // Layout: push the cluster to the right on wide screens
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const wide = w > 900;
      world.position.set(wide ? 4.9 : 0, wide ? 0 : 1.2, 0);
      world.scale.setScalar(wide ? 0.9 : 0.8);
      camera.position.z = wide ? 11 : 13;
    }
    resize();
    window.addEventListener('resize', resize);

    const mouse = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    window.addEventListener('pointermove', e => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    let raf = null;
    const clock = new THREE.Clock();
    function frame() {
      const t = clock.getElapsedTime();
      cur.x += (mouse.x - cur.x) * 0.04;
      cur.y += (mouse.y - cur.y) * 0.04;
      world.rotation.y = t * 0.12 + cur.x * 0.5;
      world.rotation.x = Math.sin(t * 0.2) * 0.15 + cur.y * 0.3;
      core.rotation.y = -t * 0.3;
      core.rotation.z = t * 0.15;
      shell.rotation.x = t * 0.08;
      ring1.rotation.z = t * 0.25;
      ring2.rotation.z = -t * 0.18;
      stars.rotation.y = t * 0.01;

      packets.forEach(p => {
        p.t += p.s;
        if (p.t >= 1) { p.t = 0; p.e = Math.floor(Math.random() * edgeCount); }
        const o = p.e * 6;
        a.set(linePos[o], linePos[o + 1], linePos[o + 2]);
        b.set(linePos[o + 3], linePos[o + 4], linePos[o + 5]);
        p.m.position.lerpVectors(a, b, p.t);
      });

      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }
    whenVisible(canvas,
      () => { if (!raf) { clock.start(); frame(); } },
      () => { cancelAnimationFrame(raf); raf = null; });
  }

  /* =========================================================
     DATA — 3D bar chart of roles
     ========================================================= */
  function initChart() {
    const stage = document.getElementById('chartStage');
    const canvas = document.getElementById('chartCanvas');
    const labelsEl = document.getElementById('chartLabels');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: reduceMotion });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(6, 10, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x4cc9ff, 0.5); rim.position.set(-8, 4, -6); scene.add(rim);

    const pivot = new THREE.Group();
    scene.add(pivot);

    // Floor grid
    const grid = new THREE.GridHelper(20, 20, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0;
    pivot.add(grid);

    // Bars: placed side-by-side along X (chronological), length = months, height = tools
    const MONTH = 0.22, TOOL = 0.26, DEPTH = 1.5, GAP = 0.7;
    const total = ROLES.reduce((s, r) => s + r.months * MONTH, 0) + GAP * (ROLES.length - 1);
    let x = -total / 2;
    const bars = [];
    ROLES.forEach((r, i) => {
      const w = r.months * MONTH, h = r.tools.length * TOOL;
      const color = new THREE.Color(r.color);
      const geo = new THREE.BoxGeometry(w, h, DEPTH);
      geo.translate(0, h / 2, 0); // grow from floor
      const mat = new THREE.MeshStandardMaterial({
        color, metalness: 0.35, roughness: 0.35, transparent: true, opacity: 0.85,
        emissive: color, emissiveIntensity: 0.12
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x + w / 2, 0, 0);
      mesh.scale.y = 0.001;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.25 }));
      mesh.add(edges);
      pivot.add(mesh);

      // Floor glow under bar
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 0.6, DEPTH + 0.6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x + w / 2, 0.01, 0);
      pivot.add(glow);

      const label = document.createElement('div');
      label.className = 'viz__label';
      label.style.color = r.color;
      label.innerHTML = `<b style="color:var(--text)">${r.co}</b>${r.months} mo · ${r.tools.length} tools`;
      labelsEl.appendChild(label);

      bars.push({ role: r, mesh, mat, h, label, top: new THREE.Vector3() });
      x += w + GAP;
    });

    // Side panel + legend
    const legend = document.getElementById('chartLegend');
    const panel = document.getElementById('chartPanel');
    const $ = id => document.getElementById(id);
    let active = bars.length - 1;
    function select(i) {
      active = i;
      const r = bars[i].role;
      panel.style.setProperty('--c', r.color);
      $('vpTitle').textContent = r.title;
      $('vpCo').textContent = r.co;
      $('vpMonths').textContent = r.months;
      $('vpTools').textContent = r.tools.length;
      $('vpTags').innerHTML = r.tools.map(t => `<li>${t}</li>`).join('');
      bars.forEach((b, j) => {
        b.mat.emissiveIntensity = j === i ? 0.45 : 0.08;
        b.mat.opacity = j === i ? 0.95 : 0.55;
        b.label.classList.toggle('is-active', j === i);
      });
      [...legend.children].forEach((btn, j) => btn.classList.toggle('is-active', j === i));
      requestRender();
    }
    bars.forEach((b, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `<i style="background:${b.role.color}"></i>${b.role.co}`;
      btn.addEventListener('mouseenter', () => select(i));
      btn.addEventListener('focus', () => select(i));
      btn.addEventListener('click', () => select(i));
      legend.appendChild(btn);
    });

    // Interaction: drag to rotate, hover to select
    let yaw = -0.55, pitch = 0.42, targetYaw = yaw, targetPitch = pitch, dragging = false, lastX = 0, lastY = 0, idle = 0;
    stage.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointerup', () => { dragging = false; });
    stage.addEventListener('pointercancel', () => { dragging = false; });

    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    stage.addEventListener('pointermove', e => {
      if (dragging) {
        targetYaw -= (e.clientX - lastX) * 0.008;
        targetPitch = Math.max(0.1, Math.min(1.1, targetPitch + (e.clientY - lastY) * 0.005));
        lastX = e.clientX; lastY = e.clientY; idle = 0;
        requestRender();
        return;
      }
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(bars.map(b => b.mesh), false)[0];
      if (hit) { const i = bars.findIndex(b => b.mesh === hit.object); if (i !== active) select(i); }
    });

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      requestRender();
    }
    window.addEventListener('resize', resize);

    // Grow-in animation
    let growStart = null;
    const dist = 17;
    let raf = null, running = false;
    function frame(now) {
      raf = null;
      if (growStart === null) growStart = now;
      const g = reduceMotion ? 1 : Math.min((now - growStart) / 1400, 1);
      let growing = false;
      bars.forEach((b, i) => {
        const p = Math.max(0, Math.min(1, g * 1.6 - i * 0.25));
        const e = 1 - Math.pow(1 - p, 3);
        b.mesh.scale.y = Math.max(e, 0.001);
        if (p < 1) growing = true;
      });

      idle++;
      if (!dragging && idle > 180 && !reduceMotion) targetYaw += 0.0015;
      yaw += (targetYaw - yaw) * 0.08;
      pitch += (targetPitch - pitch) * 0.08;
      const aspectBoost = camera.aspect < 1 ? 1.45 : 1;
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist * aspectBoost,
        Math.sin(pitch) * dist * aspectBoost,
        Math.cos(yaw) * Math.cos(pitch) * dist * aspectBoost
      );
      camera.lookAt(0, 2, 0);

      renderer.render(scene, camera);

      // Project labels
      const w = stage.clientWidth, h = stage.clientHeight;
      bars.forEach(b => {
        b.top.set(b.mesh.position.x, b.h * b.mesh.scale.y + 0.35, 0).project(camera);
        b.label.style.left = ((b.top.x + 1) / 2 * w) + 'px';
        b.label.style.top = ((1 - b.top.y) / 2 * h) + 'px';
        b.label.style.opacity = b.mesh.scale.y > 0.2 ? 1 : 0;
      });

      const settling = Math.abs(targetYaw - yaw) > 0.0005 || Math.abs(targetPitch - pitch) > 0.0005;
      if (running && (!reduceMotion || growing || settling || dragging)) raf = requestAnimationFrame(frame);
    }
    function requestRender() { if (!raf) raf = requestAnimationFrame(frame); }

    resize();
    select(active);
    whenVisible(stage,
      () => { running = true; requestRender(); },
      () => { running = false; cancelAnimationFrame(raf); raf = null; });
  }

  /* =========================================================
     USAGE — tools grouped by category, one dot per company
     ========================================================= */
  function initMatrix() {
    const el = document.getElementById('matrix');
    const legend = document.getElementById('usageLegend');
    const GROUPS = [
      { name: 'CI/CD & source control', tools: ['Git', 'GitHub', 'GitHub Actions', 'Jenkins', 'Harness'] },
      { name: 'Containers & infrastructure', tools: ['Docker', 'Kubernetes', 'Rancher', 'Terraform', 'Ansible', 'Linux'] },
      { name: 'Observability', tools: ['Splunk', 'CloudWatch', 'Grafana', 'LogicMonitor'] },
      { name: 'Cloud', tools: ['AWS', 'Azure'] },
      { name: 'Languages & tooling', tools: ['Java', 'Python', 'Bash', 'SQL', 'Copilot'] },
      { name: 'Data & APIs', tools: ['PostgreSQL', 'MySQL', 'REST APIs'] }
    ];
    const cos = [...ROLES].reverse(); // most recent first
    const short = co => co.replace('Options Clearing Corporation', 'OCC').replace('First Central Group', 'First Central');

    legend.innerHTML = cos.map(r =>
      `<button type="button" data-co="${r.id}" style="--c:${r.color}"><i></i>${short(r.co)}</button>`).join('');

    el.innerHTML = GROUPS.map(g => `
      <div class="usage__group">
        <h4>${g.name}</h4>
        <ul>${g.tools.map(t => {
          const used = cos.filter(r => r.tools.includes(t));
          const label = `${t}: used at ${used.map(r => short(r.co)).join(', ')}`;
          return `<li aria-label="${label}"><span class="usage__tool">${t}</span><span class="usage__dots" aria-hidden="true">${
            cos.map(r => `<i class="${r.tools.includes(t) ? 'on' : ''}" data-co="${r.id}" style="--c:${r.color}" title="${t} ${r.tools.includes(t) ? 'used' : 'not used'} at ${short(r.co)}"></i>`).join('')
          }</span></li>`;
        }).join('')}</ul>
      </div>`).join('');

    // Hover or focus a company in the legend to highlight only its dots
    legend.querySelectorAll('button').forEach(btn => {
      const on = () => { el.dataset.focus = btn.dataset.co; legend.dataset.focus = btn.dataset.co; };
      const off = () => { delete el.dataset.focus; delete legend.dataset.focus; };
      btn.addEventListener('mouseenter', on); btn.addEventListener('focus', on);
      btn.addEventListener('mouseleave', off); btn.addEventListener('blur', off);
    });
  }

  /* =========================================================
     SKILLS — rotating 3D tag sphere
     ========================================================= */
  function initSphere() {
    const el = document.getElementById('sphere');
    const words = ['Kubernetes', 'Terraform', 'Docker', 'Jenkins', 'GitHub Actions', 'Harness', 'Ansible', 'AWS', 'Azure',
      'Splunk', 'Grafana', 'CloudWatch', 'LogicMonitor', 'Rancher', 'Linux', 'Python', 'Bash', 'Java', 'C#', 'C++',
      'JavaScript', 'SQL', 'PostgreSQL', 'MySQL', 'REST APIs', 'Microservices', 'Angular', 'TensorFlow', 'CI/CD',
      'Git', 'RCA', 'Agile', 'Copilot', 'HTML5', 'CSS3', 'SRE'];
    const hot = new Set(['Kubernetes', 'Terraform', 'Jenkins', 'AWS', 'Splunk', 'Python', 'Java', 'Docker', 'CI/CD']);
    const pts = words.map((w, i) => {
      const s = document.createElement('span');
      s.textContent = w;
      if (hot.has(w)) s.classList.add('hot');
      el.appendChild(s);
      const phi = Math.acos(1 - 2 * (i + 0.5) / words.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return { s, x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi) };
    });

    let vx = 0.003, vy = 0.004, dragging = false, lx = 0, ly = 0, raf = null;
    el.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => (dragging = false));
    el.addEventListener('pointercancel', () => (dragging = false));
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      vy = (e.clientX - lx) * 0.0025; vx = -(e.clientY - ly) * 0.0025;
      lx = e.clientX; ly = e.clientY;
    });

    function frame() {
      const R = el.clientWidth * 0.4;
      const cx = Math.cos(vx), sx = Math.sin(vx), cy = Math.cos(vy), sy = Math.sin(vy);
      pts.forEach(p => {
        // rotate around X then Y
        let y = p.y * cx - p.z * sx, z = p.y * sx + p.z * cx;
        let x = p.x * cy + z * sy; z = -p.x * sy + z * cy;
        p.x = x; p.y = y; p.z = z;
        const scale = (z + 2) / 3;
        p.s.style.transform = `translate(-50%,-50%) translate3d(${(x * R).toFixed(1)}px,${(y * R).toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
        p.s.style.opacity = (0.25 + (z + 1) * 0.375).toFixed(3);
        p.s.style.zIndex = Math.round((z + 1) * 50);
      });
      if (!dragging) { vx += (0.002 - vx) * 0.02; vy += (0.004 - vy) * 0.02; }
      raf = reduceMotion ? null : requestAnimationFrame(frame);
    }
    whenVisible(el, () => { if (!raf) frame(); }, () => { cancelAnimationFrame(raf); raf = null; });
  }

  /* ---------- Boot ---------- */
  initMatrix();
  initSphere();
  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
    catch (e) { return false; }
  }
  if (hasThree && webglOK()) {
    initHero();
    initChart();
  } else {
    document.getElementById('chartStage').innerHTML =
      '<p class="mono" style="padding:24px;color:var(--muted)">3D view needs WebGL. The breakdown is in the Experience section above.</p>';
  }
})();
