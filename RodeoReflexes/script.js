(() => {
  'use strict';

  // ---------- Stage scaling ----------
  const STAGE_W = 2160, STAGE_H = 3840;
  function fitStage() {
    const stage = document.getElementById('stage');
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    const offsetX = (window.innerWidth - STAGE_W * scale) / 2;
    const offsetY = (window.innerHeight - STAGE_H * scale) / 2;
    stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  // ---------- Setup ----------
  const canvas = document.getElementById('arenaCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, PIVOT_Y = H / 2 + 220;

  const rideTimeEl = document.getElementById('rideTime');
  const bestTimeEl = document.getElementById('bestTime');
  const rideCountEl = document.getElementById('rideCount');
  const rideBtn = document.getElementById('rideBtn');
  const helpBtn = document.getElementById('helpBtn');
  const closeModal = document.getElementById('closeModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const qualifiedBanner = document.getElementById('qualifiedBanner');
  const buckoffBanner = document.getElementById('buckoffBanner');
  const buckoffTimeEl = document.getElementById('buckoffTime');
  const startBanner = document.getElementById('startBanner');
  const dangerBanner = document.getElementById('dangerBanner');
  const arenaFrame = document.getElementById('arenaFrame');
  const leanLeftBtn = document.getElementById('leanLeftBtn');
  const leanRightBtn = document.getElementById('leanRightBtn');

  // ---------- Persistent stats ----------
  let bestTimeMs = Number(localStorage.getItem('rodeo_best_time_ms') || 0);
  let rideCount = Number(localStorage.getItem('rodeo_ride_count') || 0);
  bestTimeEl.textContent = (bestTimeMs / 1000).toFixed(1) + 's';
  let translations = {};
  rideCountEl.textContent = rideCount;

  // ---------- Game state ----------
  let riding = false;
  let thrown = false;         // true during the "flying off the bull" animation
  let leanPos = 0;             // -100 (full left) .. 100 (full right)
  let leanVel = 0;
  let elapsedMs = 0;
  let nextBuckAt = 0;
  let qualifiedShown = false;
  let leftHeld = false, rightHeld = false;
  let shakeMag = 0;
  let particles = [];
  let lastFrameTime = null;
  let wasInDanger = false;

  // thrown-rider animation state
  let riderThrow = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, rotVel: 0 };
  let bullSettleAngle = 0;    // bull keeps a residual wobble briefly after the rider separates
  let throwAnimMs = 0;
  let bannerShownForThisBuck = false;
  let pendingBuckStats = null; // { finalMs } computed at the instant of separation

  const FALL_THRESHOLD = 100;   // leanPos magnitude at which the rider fully separates
  const SLIDE_START = 55;       // leanPos magnitude where the "losing grip" slide begins
  const MAX_ANGLE = 0.56;       // radians (~32 degrees), bull tilt at full lean
  const ACCEL = 230;
  const QUALIFY_MS = 8000;
  const THROW_BANNER_DELAY_MS = 850; // let the throw animation read before showing the result

  startBanner.classList.add('show');

  // ---------- Audio (simple synth, no files needed) ----------
  let audioCtx = null;
  function ac() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function playHorn() {
    try {
      const c = ac();
      [0, 0.001].forEach((delay, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.value = i === 0 ? 220 : 330;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(c.destination);
        const now = c.currentTime + delay;
        g.gain.exponentialRampToValueAtTime(0.13, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        o.start(now);
        o.stop(now + 0.6);
      });
    } catch (e) { /* ignore */ }
  }
  function playThud() {
    try {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = 140;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(c.destination);
      const now = c.currentTime;
      g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
      o.frequency.exponentialRampToValueAtTime(60, now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      o.start(now);
      o.stop(now + 0.38);
    } catch (e) { /* ignore */ }
  }
  function playWarning() {
    try {
      const c = ac();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = 340;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(c.destination);
      const now = c.currentTime;
      g.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      o.frequency.exponentialRampToValueAtTime(260, now + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      o.start(now);
      o.stop(now + 0.18);
    } catch (e) { /* ignore */ }
  }
  function vibrate(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  // ---------- Helpers ----------
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function scheduleNextBuck(elapsedSec) {
    const interval = Math.max(0.5, 1.5 - elapsedSec * 0.025);
    return elapsedMs + rand(interval * 0.7, interval * 1.3) * 1000;
  }

  // ---------- Physics update (while attached to the bull) ----------
  function updatePhysics(dt) {
    const elapsedSec = elapsedMs / 1000;

    let force = 0;
    if (leftHeld && !rightHeld) force -= ACCEL;
    if (rightHeld && !leftHeld) force += ACCEL;
    leanVel += force * dt;

    leanVel += rand(-14, 14) * dt;

    if (elapsedMs >= nextBuckAt) {
      const magnitude = rand(55, 95) + Math.min(elapsedSec * 3.2, 70);
      const dir = Math.random() < 0.5 ? -1 : 1;
      leanVel += dir * magnitude;
      shakeMag = 18;
      nextBuckAt = scheduleNextBuck(elapsedSec);
    }

    const dampingPerSecond = 0.06;
    leanVel *= Math.pow(dampingPerSecond, dt);
    leanPos += leanVel * dt;
    shakeMag *= Math.pow(0.02, dt);

    if (Math.abs(leanVel) > 40 && Math.random() < 0.6) spawnDust(1);

    // ---- danger / slipping-grip zone ----
    const slideAmount = smoothstep(SLIDE_START, FALL_THRESHOLD, Math.abs(leanPos));
    const inDanger = slideAmount > 0.02;
    if (inDanger && !wasInDanger) {
      playWarning();
      vibrate(40);
    }
    if (inDanger) {
      dangerBanner.classList.add('show');
      arenaFrame.classList.add('danger');
    } else {
      dangerBanner.classList.remove('show');
      arenaFrame.classList.remove('danger');
    }
    wasInDanger = inDanger;

    if (Math.abs(leanPos) >= FALL_THRESHOLD) {
      launchThrow();
      return;
    }

    if (!qualifiedShown && elapsedMs >= QUALIFY_MS) {
      qualifiedShown = true;
      showQualifiedBanner();
      playHorn();
    }
  }

  function showQualifiedBanner() {
    qualifiedBanner.classList.add('show');
    setTimeout(() => qualifiedBanner.classList.remove('show'), 2200);
  }

  // ---------- Separation: the rider actually leaves the bull ----------
  function launchThrow() {
    riding = false;
    thrown = true;
    leftHeld = false; rightHeld = false;
    dangerBanner.classList.remove('show');
    arenaFrame.classList.remove('danger');

    const dir = leanPos >= 0 ? 1 : -1;
    riderThrow.x = 0;
    riderThrow.y = 0;
    riderThrow.vx = dir * (220 + Math.abs(leanVel) * 0.7);
    riderThrow.vy = -(260 + rand(0, 90));
    riderThrow.rot = (leanPos / 100) * MAX_ANGLE * 1.3;
    riderThrow.rotVel = dir * rand(4.5, 6.5);

    bullSettleAngle = (leanPos / 100) * MAX_ANGLE;

    playThud();
    vibrate([30, 40, 60]);
    spawnDust(45, true);

    pendingBuckStats = { finalMs: elapsedMs };
    throwAnimMs = 0;
    bannerShownForThisBuck = false;

    // lock in the stats immediately even though the banner appears after the animation
    if (pendingBuckStats.finalMs > bestTimeMs) {
      bestTimeMs = pendingBuckStats.finalMs;
      bestTimeEl.textContent = (bestTimeMs / 1000).toFixed(1) + 's';
      localStorage.setItem('rodeo_best_time_ms', String(bestTimeMs));
    }
    rideCount++;
    rideCountEl.textContent = rideCount;
    localStorage.setItem('rodeo_ride_count', String(rideCount));
  }

  function updateThrowAnimation(dt) {
    const GRAVITY = 900;
    riderThrow.vy += GRAVITY * dt;
    riderThrow.vx *= Math.pow(0.85, dt);
    riderThrow.x += riderThrow.vx * dt;
    riderThrow.y += riderThrow.vy * dt;
    riderThrow.rot += riderThrow.rotVel * dt;
    riderThrow.rotVel *= Math.pow(0.6, dt);

    bullSettleAngle *= Math.pow(0.08, dt);

    throwAnimMs += dt * 1000;
    if (!bannerShownForThisBuck && throwAnimMs >= THROW_BANNER_DELAY_MS) {
      bannerShownForThisBuck = true;
      const finalMs = pendingBuckStats.finalMs;
      const suffix = finalMs >= QUALIFY_MS ? (translations.gamesMenu?.rodeoReflexesQualifiedRideSuffix || ' — Qualified Ride!') : '';
      buckoffTimeEl.textContent = (finalMs / 1000).toFixed(1) + 's' + suffix;
      buckoffBanner.classList.add('show');
    }
  }

  // ---------- Dust particles ----------
  function spawnDust(count, burst) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: CX + rand(-70, 70),
        y: PIVOT_Y + rand(-20, 20),
        vx: rand(-1, 1) * (burst ? rand(80, 260) : rand(20, 90)),
        vy: rand(-1, -0.2) * (burst ? rand(80, 220) : rand(20, 70)),
        life: 1,
        decay: rand(0.6, 1.3),
        size: rand(6, 16) * (burst ? rand(1, 1.8) : 1),
      });
    }
    if (particles.length > 300) particles.splice(0, particles.length - 300);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 140 * dt;
      p.life -= p.decay * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  // ---------- Drawing ----------
  function drawScene() {
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    const groundGrad = ctx.createLinearGradient(0, 0, 0, H);
    groundGrad.addColorStop(0, '#c9975f');
    groundGrad.addColorStop(1, '#8a5f38');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 6;
    for (let y = 120; y < H; y += 220) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    const shakeX = shakeMag > 0.1 ? rand(-shakeMag, shakeMag) : 0;
    const shakeY = shakeMag > 0.1 ? rand(-shakeMag, shakeMag) : 0;

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x + shakeX, p.y + shakeY, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196,160,110,${Math.max(0, p.life * 0.6)})`;
      ctx.fill();
    }

    if (thrown) {
      drawBull(shakeX, shakeY, bullSettleAngle, true);
      drawRider(CX + shakeX + riderThrow.x, PIVOT_Y + shakeY - 300 + riderThrow.y, riderThrow.rot, 0);
    } else {
      const angle = (leanPos / 100) * MAX_ANGLE;
      const slideAmount = smoothstep(SLIDE_START, FALL_THRESHOLD, Math.abs(leanPos));
      const dir = leanPos >= 0 ? 1 : -1;
      drawBull(shakeX, shakeY, angle, false);
      // rider slides outward and rotates further than the bull as grip is lost
      const riderX = CX + shakeX + dir * slideAmount * 95;
      const riderY = PIVOT_Y + shakeY - 300 - slideAmount * 15;
      const riderRot = angle - dir * slideAmount * 0.9;
      drawRider(riderX, riderY, riderRot, slideAmount);
    }

    for (const p of particles) {
      if (p.y < PIVOT_Y - 40) continue;
      ctx.beginPath();
      ctx.arc(p.x + shakeX, p.y + shakeY, p.size * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150,110,70,${Math.max(0, p.life * 0.5)})`;
      ctx.fill();
    }

    // reddish vignette while the grip is slipping
    if (!thrown) {
      const slideAmount = smoothstep(SLIDE_START, FALL_THRESHOLD, Math.abs(leanPos));
      if (slideAmount > 0.01) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90);
        const grad = ctx.createRadialGradient(CX, H / 2, H * 0.25, CX, H / 2, H * 0.72);
        grad.addColorStop(0, 'rgba(193,68,14,0)');
        grad.addColorStop(1, `rgba(193,68,14,${slideAmount * 0.5 * pulse})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  function drawBull(shakeX, shakeY, angle, riderless) {
    ctx.save();
    ctx.translate(CX + shakeX, PIVOT_Y + shakeY);
    ctx.rotate(angle);

    ctx.fillStyle = '#2b211a';
    ctx.fillRect(-150, -30, 34, 130);
    ctx.fillRect(-70, -20, 34, 140);
    ctx.fillRect(50, -20, 34, 140);
    ctx.fillRect(120, -30, 34, 130);

    ctx.beginPath();
    ctx.ellipse(0, -170, 260, 165, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5b3d2b';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(60, -130, 190, 110, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(240, -160);
    ctx.quadraticCurveTo(320, -100, 300, -20);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#3a2a1e';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-250, -230, 95, 78, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#4a3122';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-320, -205, 42, 30, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#7a5a42';
    ctx.fill();

    ctx.strokeStyle = '#e8ddc8';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-270, -280);
    ctx.quadraticCurveTo(-340, -330, -390, -300);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-230, -290);
    ctx.quadraticCurveTo(-260, -350, -230, -385);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-270, -235, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1310';
    ctx.fill();

    // empty saddle strap detail once the rider is off, so the bull doesn't look bare
    if (riderless) {
      ctx.strokeStyle = 'rgba(40,25,15,0.5)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-60, -260);
      ctx.lineTo(40, -240);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draws the rider at an absolute canvas position (already includes any
  // world-space shake). `dangerAmount` (0..1) morphs the pose from a
  // confident "style-points" arm-up ride into a flailing, off-balance grab
  // as the grip is lost. Rotation is passed in radians.
  function drawRider(x, y, rotation, dangerAmount) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    // legs gripping bull (fade out slightly as they lose contact)
    ctx.globalAlpha = 1 - dangerAmount * 0.15;
    ctx.fillStyle = '#2f3e52';
    ctx.beginPath();
    ctx.ellipse(-40, 60, 26, 55, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // torso
    ctx.fillStyle = '#8a2e2e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 70, 0, 0, Math.PI * 2);
    ctx.fill();

    // roped arm — stretches and thins as the grip slips
    const gripStretch = dangerAmount * 26;
    ctx.strokeStyle = '#8a2e2e';
    ctx.lineWidth = 20 - dangerAmount * 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-30, -20);
    ctx.quadraticCurveTo(-90 - gripStretch, -50 - gripStretch * 0.4, -110 - gripStretch, -10);
    ctx.stroke();

    // free arm: raised in triumph normally, thrown out flailing once in danger
    ctx.lineWidth = 20;
    ctx.beginPath();
    if (dangerAmount < 0.05) {
      ctx.moveTo(30, -30);
      ctx.quadraticCurveTo(70, -90, 60, -140);
    } else {
      const flail = Math.sin(performance.now() / 60) * 20 * dangerAmount;
      ctx.moveTo(30, -30);
      ctx.quadraticCurveTo(90, -20 + flail, 110, 20 + flail);
    }
    ctx.stroke();

    // head
    ctx.beginPath();
    ctx.arc(0, -95, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#d9a373';
    ctx.fill();

    // hat — tips back and starts to fly off as danger increases
    ctx.save();
    ctx.translate(0, -122);
    ctx.rotate(dangerAmount * -0.6);
    ctx.fillStyle = '#3a2c20';
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-22, -6);
    ctx.quadraticCurveTo(0, -46, 22, -6);
    ctx.quadraticCurveTo(0, -18, -22, -6);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ---------- Main loop ----------
  function loop(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    let dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;
    dt = Math.min(dt, 0.05);

    if (riding) {
      elapsedMs += dt * 1000;
      updatePhysics(dt);
      rideTimeEl.textContent = (elapsedMs / 1000).toFixed(1) + 's';
    } else if (thrown) {
      updateThrowAnimation(dt);
    }
    updateParticles(dt);
    drawScene();

    requestAnimationFrame(loop);
  }

  // ---------- Controls ----------
  function bindHold(btn, setter) {
    const start = (e) => { e.preventDefault(); setter(true); btn.classList.add('pressed'); };
    const end = () => { setter(false); btn.classList.remove('pressed'); };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchcancel', end);
  }
  bindHold(leanLeftBtn, (v) => { leftHeld = v; });
  bindHold(leanRightBtn, (v) => { rightHeld = v; });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') leftHeld = true;
    if (e.key === 'ArrowRight') rightHeld = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') leftHeld = false;
    if (e.key === 'ArrowRight') rightHeld = false;
  });

  // ---------- New Ride ----------
  function newRide() {
    riding = true;
    thrown = false;
    leanPos = 0;
    leanVel = 0;
    elapsedMs = 0;
    qualifiedShown = false;
    shakeMag = 0;
    particles = [];
    leftHeld = false; rightHeld = false;
    wasInDanger = false;
    riderThrow = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, rotVel: 0 };
    bullSettleAngle = 0;
    throwAnimMs = 0;
    bannerShownForThisBuck = false;
    pendingBuckStats = null;
    nextBuckAt = scheduleNextBuck(0);

    rideTimeEl.textContent = '0.0s';
    startBanner.classList.remove('show');
    qualifiedBanner.classList.remove('show');
    buckoffBanner.classList.remove('show');
    dangerBanner.classList.remove('show');
    arenaFrame.classList.remove('danger');
  }

  rideBtn.addEventListener('click', newRide);
  helpBtn.addEventListener('click', () => modalOverlay.classList.add('show'));
  closeModal.addEventListener('click', () => modalOverlay.classList.remove('show'));
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('show');
  });

  // --- Translation Loader ---
  async function applyPageTranslations() {
    const savedLanguage = localStorage.getItem("language") || "en";
    try {
        const response = await fetch(`../../${savedLanguage}.json`);
        translations = await (response.ok ? response.json() : (await fetch('../../en.json')).json());
    } catch (error) {
        console.error("Failed to load language file, falling back to English.", error);
        translations = await (await fetch('../../en.json')).json();
    }
    document.querySelectorAll('[data-lang-key]').forEach(el => {
        const key = el.getAttribute('data-lang-key');
        const text = key.split('.').reduce((o, i) => o ? o[i] : undefined, translations);
        if (text) {
            const childSpan = el.querySelector('span');
            if (childSpan) {
                childSpan.textContent = text;
            } else {
                el.textContent = text;
            }
        }
    });
  }

  // ---------- Init ----------
  async function initializeGame() {
    await applyPageTranslations();
    requestAnimationFrame(loop);

    if (!localStorage.getItem('rodeo_seen_help')) {
      modalOverlay.classList.add('show');
      localStorage.setItem('rodeo_seen_help', '1');
    }
  }

  initializeGame();

})();
