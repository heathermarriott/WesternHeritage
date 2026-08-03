(() => {
  'use strict';

  // ---------- Stage scaling ----------
  // The whole game is designed at a fixed 2160x3840 (9x16) resolution to match
  // the Proto Luma's portrait touch display, then scaled with a CSS transform
  // to fit whatever viewport/window it actually renders in.
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
  const canvas = document.getElementById('panCanvas');
  const ctx = canvas.getContext('2d');
  const panRim = document.getElementById('panRim');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;
  const PAN_RADIUS = W / 2 - 14;

  // Original artwork constants below were tuned for a 440px canvas.
  // SCALE lets every pixel constant (brush size, texture, item size) grow
  // proportionally now that the canvas is much bigger (1400px).
  const BASELINE = 440;
  const SCALE = W / BASELINE;

  const sessionScoreEl = document.getElementById('sessionScore');
  const bestScoreEl = document.getElementById('bestScore');
  const scoopCountEl = document.getElementById('scoopCount');
  const scoopBtn = document.getElementById('scoopBtn');
  const helpBtn = document.getElementById('helpBtn');
  const closeModal = document.getElementById('closeModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const emptyBanner = document.getElementById('emptyBanner');

  // Offscreen layers
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = W; baseCanvas.height = H;
  const baseCtx = baseCanvas.getContext('2d');

  const dirtCanvas = document.createElement('canvas');
  dirtCanvas.width = W; dirtCanvas.height = H;
  const dirtCtx = dirtCanvas.getContext('2d');

  const rippleCanvas = document.createElement('canvas');
  rippleCanvas.width = W; rippleCanvas.height = H;
  const rippleCtx = rippleCanvas.getContext('2d');

  // ---------- State ----------
  let items = [];
  let sessionScore = 0;
  let bestScore = Number(localStorage.getItem('panning_best_score') || 0);
  let gamesPlayed = Number(localStorage.getItem('panning_games_played') || 0);
  let isDragging = false;
  let lastPos = null;
  let dirtRemainingCache = 1;
  let roundOver = false;

  bestScoreEl.textContent = bestScore;
  scoopCountEl.textContent = gamesPlayed;

  // ---------- Audio (simple synth beep, no files needed) ----------
  let audioCtx = null;
  function playChime(pitch = 1) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 520 * pitch;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      o.frequency.exponentialRampToValueAtTime(520 * pitch * 1.8, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      o.start(now);
      o.stop(now + 0.28);
    } catch (e) { /* audio not available, ignore */ }
  }
  function playThud() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = 160;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      o.frequency.exponentialRampToValueAtTime(90, now + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      o.start(now);
      o.stop(now + 0.22);
    } catch (e) { /* ignore */ }
  }

  // ---------- Helpers ----------
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomPointInPan(marginFromEdge = 16) {
    const angle = rand(0, Math.PI * 2);
    const radius = Math.sqrt(Math.random()) * (PAN_RADIUS - marginFromEdge);
    return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
  }

  // ---------- Item generation ----------
  const GEM_COLORS = [
    { fill: '#e0455f', hi: '#ff9aad', name: 'Ruby' },
    { fill: '#3a7bd5', hi: '#9fd1ff', name: 'Sapphire' },
    { fill: '#2fae66', hi: '#8ff2bb', name: 'Emerald' },
  ];

  // Fewer, bigger items than the original design (2x radius, ~fewer count)
  function generateItems(count = 18) {
    const arr = [];
    const placed = [];

    function tryPlace(r) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const p = randomPointInPan(r + 8);
        let ok = true;
        for (const other of placed) {
          const dx = p.x - other.x, dy = p.y - other.y;
          const minDist = r + other.r + 6;
          if (dx * dx + dy * dy < minDist * minDist) { ok = false; break; }
        }
        if (ok) return p;
      }
      return randomPointInPan(r + 8);
    }

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type, r, value, color, hi, label;

      if (roll < 0.42) {
        type = 'rock';
        r = rand(8, 16) * SCALE;
        value = 0;
        color = pick(['#8a8a86', '#75736c', '#9c968a']);
        hi = '#c9c5bb';
        label = 'Rock';
      } else if (roll < 0.78) {
        type = 'flake';
        r = rand(6, 11) * SCALE;
        value = Math.round(rand(1, 3));
        color = '#e6b422';
        hi = '#ffe694';
        label = 'Gold Flake';
      } else if (roll < 0.94) {
        type = 'nugget';
        r = rand(13, 22) * SCALE;
        value = Math.round(rand(5, 15));
        color = '#d4960f';
        hi = '#ffdb6e';
        label = 'Gold Nugget';
      } else {
        type = 'gem';
        r = rand(10, 16) * SCALE;
        const g = pick(GEM_COLORS);
        value = Math.round(rand(20, 50));
        color = g.fill;
        hi = g.hi;
        label = g.name;
      }

      const p = tryPlace(r);
      arr.push({
        x: p.x, y: p.y, r, type, value, color, hi, label,
        revealed: false, collected: false,
        wobble: Math.random() * Math.PI * 2,
      });
      placed.push(arr[arr.length - 1]);
    }
    return arr;
  }

  // ---------- Drawing: base layer (pan interior + items) ----------
  function drawBase() {
    baseCtx.clearRect(0, 0, W, H);
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.arc(CX, CY, PAN_RADIUS, 0, Math.PI * 2);
    baseCtx.clip();

    const bg = baseCtx.createRadialGradient(CX - 40 * SCALE, CY - 50 * SCALE, 20 * SCALE, CX, CY, PAN_RADIUS);
    bg.addColorStop(0, '#5c554c');
    bg.addColorStop(0.55, '#413b33');
    bg.addColorStop(1, '#22201b');
    baseCtx.fillStyle = bg;
    baseCtx.fillRect(0, 0, W, H);

    baseCtx.strokeStyle = 'rgba(0,0,0,0.15)';
    baseCtx.lineWidth = 1 * SCALE;
    for (let r = 30 * SCALE; r < PAN_RADIUS; r += 26 * SCALE) {
      baseCtx.beginPath();
      baseCtx.arc(CX, CY, r, 0, Math.PI * 2);
      baseCtx.stroke();
    }

    for (const item of items) {
      drawItemShape(baseCtx, item);
    }

    baseCtx.restore();
  }

  function drawItemShape(c, item) {
    c.save();
    c.translate(item.x, item.y);
    if (item.type === 'gem') {
      c.beginPath();
      c.moveTo(0, -item.r);
      c.lineTo(item.r * 0.8, 0);
      c.lineTo(0, item.r);
      c.lineTo(-item.r * 0.8, 0);
      c.closePath();
      c.fillStyle = item.color;
      c.fill();
      c.beginPath();
      c.moveTo(0, -item.r);
      c.lineTo(item.r * 0.3, -item.r * 0.2);
      c.lineTo(-item.r * 0.3, -item.r * 0.2);
      c.closePath();
      c.fillStyle = item.hi;
      c.globalAlpha = 0.8;
      c.fill();
      c.globalAlpha = 1;
    } else {
      c.beginPath();
      const bumps = item.type === 'nugget' ? 6 : 0;
      if (bumps) {
        for (let i = 0; i <= bumps; i++) {
          const a = (i / bumps) * Math.PI * 2;
          const rr = item.r * (0.85 + 0.15 * Math.sin(a * 3 + item.wobble));
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
      } else {
        c.arc(0, 0, item.r, 0, Math.PI * 2);
      }
      c.closePath();
      c.fillStyle = item.color;
      c.fill();
      c.beginPath();
      c.arc(-item.r * 0.3, -item.r * 0.3, item.r * 0.35, 0, Math.PI * 2);
      c.fillStyle = item.hi;
      c.globalAlpha = 0.7;
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
  }

  // ---------- Drawing: dirt layer ----------
  function drawDirt() {
    dirtCtx.clearRect(0, 0, W, H);
    dirtCtx.save();
    dirtCtx.beginPath();
    dirtCtx.arc(CX, CY, PAN_RADIUS, 0, Math.PI * 2);
    dirtCtx.clip();

    const bg = dirtCtx.createRadialGradient(CX, CY, 10 * SCALE, CX, CY, PAN_RADIUS);
    bg.addColorStop(0, '#7a5230');
    bg.addColorStop(1, '#5a3a1e');
    dirtCtx.fillStyle = bg;
    dirtCtx.fillRect(0, 0, W, H);

    const speckleCount = Math.round(900 * SCALE * SCALE);
    for (let i = 0; i < speckleCount; i++) {
      const p = randomPointInPan(4 * SCALE);
      const r = rand(1, 3.2) * SCALE;
      dirtCtx.beginPath();
      dirtCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
      dirtCtx.fillStyle = pick(['#6b4423', '#8a5f38', '#4d3319', '#95724a']);
      dirtCtx.globalAlpha = rand(0.4, 0.9);
      dirtCtx.fill();
    }
    dirtCtx.globalAlpha = 1;
    dirtCtx.restore();
  }

  // ---------- Brush (washing away dirt) ----------
  function washAt(x, y) {
    const brushRadius = 26 * SCALE;
    const grad = dirtCtx.createRadialGradient(x, y, 0, x, y, brushRadius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    dirtCtx.save();
    dirtCtx.globalCompositeOperation = 'destination-out';
    dirtCtx.beginPath();
    dirtCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
    dirtCtx.fillStyle = grad;
    dirtCtx.fill();
    dirtCtx.restore();

    rippleCtx.beginPath();
    rippleCtx.arc(x, y, brushRadius * 0.8, 0, Math.PI * 2);
    rippleCtx.strokeStyle = 'rgba(180,225,240,0.5)';
    rippleCtx.lineWidth = 2 * SCALE;
    rippleCtx.stroke();

    checkRevealsNear(x, y, brushRadius);
  }

  function checkRevealsNear(x, y, radius) {
    for (const item of items) {
      if (item.collected || item.revealed) continue;
      const dx = item.x - x, dy = item.y - y;
      if (dx * dx + dy * dy > (radius + item.r) * (radius + item.r)) continue;
      const px = Math.max(0, Math.min(W - 1, Math.round(item.x)));
      const py = Math.max(0, Math.min(H - 1, Math.round(item.y)));
      const data = dirtCtx.getImageData(px, py, 1, 1).data;
      if (data[3] < 60) {
        item.revealed = true;
      }
    }
  }

  function refreshDirtRemaining() {
    const data = dirtCtx.getImageData(0, 0, W, H).data;
    let opaque = 0, total = 0;
    for (let i = 3; i < data.length; i += 4 * 23) {
      total++;
      if (data[i] > 40) opaque++;
    }
    dirtRemainingCache = total ? opaque / total : 0;
  }

  // ---------- Render loop ----------
  let animT = 0;
  function render() {
    animT += 0.05;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(baseCanvas, 0, 0);
    ctx.drawImage(dirtCanvas, 0, 0);
    ctx.drawImage(rippleCanvas, 0, 0);

    rippleCtx.save();
    rippleCtx.globalCompositeOperation = 'destination-out';
    rippleCtx.fillStyle = 'rgba(0,0,0,0.06)';
    rippleCtx.fillRect(0, 0, W, H);
    rippleCtx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, PAN_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    for (const item of items) {
      if (item.revealed && !item.collected) {
        const pulse = 1 + 0.25 * Math.sin(animT * 3 + item.wobble);
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.beginPath();
        ctx.arc(0, 0, item.r * 1.9 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = item.type === 'gem' ? 'rgba(255,255,255,0.25)' : 'rgba(255,225,110,0.28)';
        ctx.fill();
        ctx.restore();
        drawItemShape(ctx, item);
      }
    }
    ctx.restore();

    updateEmptyBanner();
    requestAnimationFrame(render);
  }

  function updateEmptyBanner() {
    const nothingLeftToWash = dirtRemainingCache < 0.04;
    if (nothingLeftToWash && !roundOver) {
      roundOver = true;
    }
    if (roundOver) {
      emptyBanner.classList.add('show');
    } else {
      emptyBanner.classList.remove('show');
    }
  }

  // ---------- Interaction ----------
  function getPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function inPan(p) {
    const dx = p.x - CX, dy = p.y - CY;
    return dx * dx + dy * dy <= PAN_RADIUS * PAN_RADIUS;
  }

  function handleDown(evt) {
    evt.preventDefault();
    if (roundOver) return; // one scoop per play — no more washing once the round ends
    const p = getPos(evt);
    if (!inPan(p)) return;

    for (const item of items) {
      if (item.collected || !item.revealed) continue;
      const dx = item.x - p.x, dy = item.y - p.y;
      if (dx * dx + dy * dy <= (item.r + 10 * SCALE) * (item.r + 10 * SCALE)) {
        collectItem(item, evt);
        return;
      }
    }

    isDragging = true;
    lastPos = p;
    panRim.classList.add('swirling');
    washAt(p.x, p.y);
    refreshDirtRemaining();
  }

  function handleMove(evt) {
    if (!isDragging || roundOver) return;
    evt.preventDefault();
    const p = getPos(evt);
    if (!inPan(p)) return;
    if (lastPos) {
      const dist = Math.hypot(p.x - lastPos.x, p.y - lastPos.y);
      const steps = Math.max(1, Math.floor(dist / 8));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        washAt(lastPos.x + (p.x - lastPos.x) * t, lastPos.y + (p.y - lastPos.y) * t);
      }
    } else {
      washAt(p.x, p.y);
    }
    lastPos = p;
    refreshDirtRemaining();
  }

  function handleUp() {
    isDragging = false;
    lastPos = null;
    panRim.classList.remove('swirling');
    refreshDirtRemaining();
  }

  function collectItem(item, evt) {
    item.collected = true;
    sessionScore += item.value;
    sessionScoreEl.textContent = sessionScore;
    if (sessionScore > bestScore) {
      bestScore = sessionScore;
      bestScoreEl.textContent = bestScore;
      localStorage.setItem('panning_best_score', String(bestScore));
    }
    if (item.value > 0) {
      playChime(item.type === 'gem' ? 1.6 : item.type === 'nugget' ? 1.3 : 1.0);
    } else {
      playThud();
    }
    const clientX = evt.touches ? (evt.changedTouches[0] || evt.touches[0]).clientX : evt.clientX;
    const clientY = evt.touches ? (evt.changedTouches[0] || evt.touches[0]).clientY : evt.clientY;
    spawnFloater(clientX, clientY, `+${item.value} ${item.label}`, item);
  }

  function spawnFloater(clientX, clientY, text, item) {
    const div = document.createElement('div');
    div.className = 'floater';
    div.textContent = text;
    div.style.left = clientX + 'px';
    div.style.top = clientY + 'px';
    div.style.color = item.value > 0 ? (item.hi || '#ffd869') : '#cfcac0';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1150);
  }

  // ---------- Scoop / New Game ----------
  // Only one scoop per play: hitting "New Scoop" always starts a brand new
  // game session (score resets to 0), rather than adding another scoop to
  // the current session's total.
  function newGame() {
    sessionScore = 0;
    sessionScoreEl.textContent = sessionScore;
    roundOver = false;
    isDragging = false;
    lastPos = null;

    items = generateItems(18);
    drawBase();
    drawDirt();
    rippleCtx.clearRect(0, 0, W, H);
    refreshDirtRemaining();

    gamesPlayed++;
    scoopCountEl.textContent = gamesPlayed;
    localStorage.setItem('panning_games_played', String(gamesPlayed));

    emptyBanner.classList.remove('show');
  }

  // ---------- Events ----------
  canvas.addEventListener('mousedown', handleDown);
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
  canvas.addEventListener('touchstart', handleDown, { passive: false });
  canvas.addEventListener('touchmove', handleMove, { passive: false });
  window.addEventListener('touchend', handleUp);

  scoopBtn.addEventListener('click', newGame);
  helpBtn.addEventListener('click', () => modalOverlay.classList.add('show'));
  closeModal.addEventListener('click', () => modalOverlay.classList.remove('show'));
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('show');
  });

  // ---------- Init ----------
  newGame();
  render();

  if (!localStorage.getItem('panning_seen_help')) {
    modalOverlay.classList.add('show');
    localStorage.setItem('panning_seen_help', '1');
  }
})();