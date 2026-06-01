/* ================================================
   Cosmic Merge 🌌 - Game Engine
   Physics-based planet merging puzzle game
   ================================================ */
(() => {
  'use strict';

  // ---- Body Type Definitions ----
  const TYPES = [
    { name:'Stardust',  r:14, c1:'#FFFDE7',c2:'#FFD54F',glow:'rgba(255,213,79,.4)',  pts:2,  emoji:'✨' },
    { name:'Comet',     r:19, c1:'#E1F5FE',c2:'#4FC3F7',glow:'rgba(79,195,247,.4)',  pts:5,  emoji:'☄️' },
    { name:'Asteroid',  r:25, c1:'#ECEFF1',c2:'#78909C',glow:'rgba(120,144,156,.3)', pts:10, emoji:'🪨' },
    { name:'Moon',      r:31, c1:'#F5F5F5',c2:'#BDBDBD',glow:'rgba(200,200,200,.3)', pts:20, emoji:'🌙' },
    { name:'Mars',      r:37, c1:'#FFCDD2',c2:'#E53935',glow:'rgba(229,57,53,.35)',   pts:35, emoji:'🔴' },
    { name:'Earth',     r:43, c1:'#B2DFDB',c2:'#1565C0',glow:'rgba(21,101,192,.35)', pts:55, emoji:'🌍' },
    { name:'Saturn',    r:50, c1:'#FFF9C4',c2:'#F9A825',glow:'rgba(249,168,37,.35)', pts:80, emoji:'🪐' },
    { name:'Jupiter',   r:57, c1:'#FFE0B2',c2:'#E65100',glow:'rgba(230,81,0,.35)',   pts:110,emoji:'🟠' },
    { name:'Sun',       r:64, c1:'#FFF8E1',c2:'#FF8F00',glow:'rgba(255,143,0,.45)',  pts:150,emoji:'☀️' },
    { name:'Supernova', r:72, c1:'#EDE7F6',c2:'#7C4DFF',glow:'rgba(124,77,255,.45)', pts:200,emoji:'💫' },
    { name:'BlackHole', r:80, c1:'#37474F',c2:'#1A1A2E',glow:'rgba(124,77,255,.55)', pts:300,emoji:'🕳️' },
  ];
  const DROP_TYPES = 5; // only first N types can be dropped
  const GRAVITY = 0.35;
  const DAMPING = 0.997;
  const RESTITUTION = 0.35;
  const FLOOR_FRICTION = 0.06;
  const PHYS_ITERS = 4;
  const DROP_COOLDOWN = 500; // ms
  const DANGER_GRACE = 2500; // ms above line before game over

  // ---- Sound Manager ----
  class Sound {
    constructor() { this.ctx = null; this.on = true; }
    init() {
      if (this.ctx) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { this.on = false; }
    }
    resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }
    play(type, p = {}) {
      if (!this.on || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;
      if (type === 'drop') this._tone(t, 220, .08, .08, 'sine');
      else if (type === 'merge') {
        const lvl = p.level || 0;
        this._tone(t, 350 + lvl * 60, .12, .15, 'triangle');
        this._tone(t + .06, 500 + lvl * 60, .1, .12, 'sine');
      }
      else if (type === 'gameover') {
        [400,350,300,250].forEach((f,i) => this._tone(t+i*.18, f, .1, .3, 'sine'));
      }
      else if (type === 'best') {
        [523,659,784,1047].forEach((f,i) => this._tone(t+i*.1, f, .1, .35, 'triangle'));
      }
    }
    _tone(t, freq, vol, dur, type) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur + .01);
    }
  }

  // ---- Particle ----
  class Particles {
    constructor() { this.list = []; }
    emit(x, y, color, count = 12) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 4;
        this.list.push({
          x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1.5,
          r: 2 + Math.random() * 4, color, alpha: 1,
          decay: .018 + Math.random() * .02, gravity: .06 + Math.random() * .04
        });
      }
    }
    emitRing(x, y, color, radius) {
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI * 2 / 24) * i;
        this.list.push({
          x: x + Math.cos(a) * radius * .5, y: y + Math.sin(a) * radius * .5,
          vx: Math.cos(a) * 3, vy: Math.sin(a) * 3,
          r: 3, color, alpha: 1, decay: .025, gravity: 0
        });
      }
    }
    update() {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
        p.alpha -= p.decay; p.r *= .98;
        if (p.alpha <= 0) this.list.splice(i, 1);
      }
    }
    draw(ctx) {
      for (const p of this.list) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ---- Main Game ----
  class CosmicMerge {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = 0; this.H = 0;
      this.bodies = [];
      this.score = 0;
      this.bestScore = parseInt(localStorage.getItem('cm_best') || '0');
      this.state = 'menu';
      this.currentType = 0;
      this.nextType = 0;
      this.dropX = 0;
      this.canDrop = true;
      this.lastDropTime = 0;
      this.dangerTimers = new Map();
      this.totalDrops = 0;
      this.totalMerges = 0;
      this.biggestType = 0;
      this.shakeAmount = 0;
      this.stars = [];
      this.container = { x:0, y:0, w:0, h:0, dangerY:0 };

      this.sound = new Sound();
      this.particles = new Particles();

      this._resize();
      this._genStars();
      this._bindEvents();
      this._updateMenuBest();
      this._randomizeNext();
      this._loop();
    }

    // ---- Sizing ----
    _resize() {
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.canvas.width = this.W * this.dpr;
      this.canvas.height = this.H * this.dpr;
      this.canvas.style.width = this.W + 'px';
      this.canvas.style.height = this.H + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // Container
      const cw = Math.min(this.W * 0.88, 380);
      const ch = Math.min(this.H * 0.68, 560);
      this.container = {
        x: (this.W - cw) / 2,
        y: this.H - ch - Math.max(20, this.H * 0.04),
        w: cw, h: ch,
        dangerY: 0
      };
      this.container.dangerY = this.container.y + ch * 0.12;
      this.dropX = this.W / 2;
    }

    _genStars() {
      this.stars = [];
      for (let i = 0; i < 80; i++) {
        this.stars.push({
          x: Math.random() * this.W, y: Math.random() * this.H,
          r: .5 + Math.random() * 1.5, alpha: .2 + Math.random() * .6,
          speed: .3 + Math.random() * .5, phase: Math.random() * Math.PI * 2
        });
      }
    }

    // ---- Events ----
    _bindEvents() {
      window.addEventListener('resize', () => { this._resize(); this._genStars(); });

      const getX = (e) => {
        if (e.touches) return e.touches[0].clientX;
        return e.clientX;
      };

      // Pointer move: update aim position
      const onMove = (e) => {
        if (this.state !== 'playing') return;
        const cx = getX(e);
        const c = this.container;
        const r = TYPES[this.currentType].r;
        this.dropX = Math.max(c.x + r + 2, Math.min(cx, c.x + c.w - r - 2));
      };

      // Pointer up: drop body
      const onDrop = (e) => {
        if (this.state !== 'playing' || !this.canDrop) return;
        e.preventDefault();
        this.sound.init();
        if (e.touches) {
          const cx = e.changedTouches[0].clientX;
          const c = this.container;
          const r = TYPES[this.currentType].r;
          this.dropX = Math.max(c.x + r + 2, Math.min(cx, c.x + c.w - r - 2));
        }
        this._dropBody();
      };

      this.canvas.addEventListener('mousemove', onMove);
      this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
      this.canvas.addEventListener('click', onDrop);
      this.canvas.addEventListener('touchend', onDrop);
      this.canvas.addEventListener('contextmenu', e => e.preventDefault());

      // UI Buttons
      document.getElementById('btnStart').addEventListener('click', () => { this.sound.init(); this._startGame(); });
      document.getElementById('btnHowTo').addEventListener('click', () => this._showOverlay('howToScreen'));
      document.getElementById('btnCloseHow').addEventListener('click', () => this._hideOverlay('howToScreen'));
      document.getElementById('btnRestart').addEventListener('click', () => { this._hideOverlay('gameOverScreen'); this._startGame(); });
      document.getElementById('btnGoMenu').addEventListener('click', () => { this._hideOverlay('gameOverScreen'); this._showOverlay('menuScreen'); });
      document.getElementById('btnShareScore').addEventListener('click', () => this._share());
    }

    _showOverlay(id) { document.getElementById(id)?.classList.add('active'); }
    _hideOverlay(id) { document.getElementById(id)?.classList.remove('active'); }

    // ---- Game Start ----
    _startGame() {
      this._hideOverlay('menuScreen');
      this.bodies = [];
      this.score = 0;
      this.totalDrops = 0;
      this.totalMerges = 0;
      this.biggestType = 0;
      this.canDrop = true;
      this.dangerTimers.clear();
      this.shakeAmount = 0;
      this.particles.list = [];
      this._randomizeNext();
      this.currentType = this.nextType;
      this._randomizeNext();
      this.state = 'playing';
    }

    _randomizeNext() {
      // Weighted random: favor smaller types
      const weights = [35, 28, 20, 12, 5];
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      for (let i = 0; i < DROP_TYPES; i++) {
        r -= weights[i];
        if (r <= 0) { this.nextType = i; return; }
      }
      this.nextType = 0;
    }

    // ---- Drop Body ----
    _dropBody() {
      const now = Date.now();
      if (now - this.lastDropTime < DROP_COOLDOWN) return;

      const type = this.currentType;
      const t = TYPES[type];
      this.bodies.push({
        x: this.dropX, y: this.container.y + t.r + 4,
        vx: 0, vy: 0,
        type: type,
        mass: t.r * t.r,
        alive: true,
        justDropped: true,
        dropFrame: 0
      });

      this.sound.play('drop');
      if (navigator.vibrate) navigator.vibrate(15);

      this.totalDrops++;
      this.lastDropTime = now;
      this.canDrop = false;
      this.currentType = this.nextType;
      this._randomizeNext();

      setTimeout(() => { this.canDrop = true; }, DROP_COOLDOWN);
    }

    // ---- Physics ----
    _physics() {
      if (this.state !== 'playing') return;
      const c = this.container;
      const bodies = this.bodies.filter(b => b.alive);

      // Gravity + damping + move
      for (const b of bodies) {
        b.vy += GRAVITY;
        b.vx *= DAMPING;
        b.vy *= DAMPING;
        b.x += b.vx;
        b.y += b.vy;
        if (b.justDropped) { b.dropFrame++; if (b.dropFrame > 5) b.justDropped = false; }
      }

      // Collision resolution (multiple iterations)
      for (let iter = 0; iter < PHYS_ITERS; iter++) {
        // Wall collisions
        for (const b of bodies) {
          const r = TYPES[b.type].r;
          // Left
          if (b.x - r < c.x) { b.x = c.x + r; b.vx = Math.abs(b.vx) * RESTITUTION; }
          // Right
          if (b.x + r > c.x + c.w) { b.x = c.x + c.w - r; b.vx = -Math.abs(b.vx) * RESTITUTION; }
          // Bottom
          if (b.y + r > c.y + c.h) {
            b.y = c.y + c.h - r;
            b.vy = -Math.abs(b.vy) * RESTITUTION;
            b.vx *= (1 - FLOOR_FRICTION);
          }
          // Top (soft - don't bounce, just clamp)
          if (b.y - r < c.y) { b.y = c.y + r; if (b.vy < 0) b.vy = 0; }
        }

        // Body-body collisions
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i], b = bodies[j];
            if (!a.alive || !b.alive) continue;

            const ra = TYPES[a.type].r, rb = TYPES[b.type].r;
            const dx = b.x - a.x, dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = ra + rb;

            if (distSq < minDist * minDist && distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              const nx = dx / dist, ny = dy / dist;
              const overlap = minDist - dist;

              // Position correction
              const totalMass = a.mass + b.mass;
              const aShare = b.mass / totalMass;
              const bShare = a.mass / totalMass;
              a.x -= overlap * aShare * nx;
              a.y -= overlap * aShare * ny;
              b.x += overlap * bShare * nx;
              b.y += overlap * bShare * ny;

              // Velocity impulse
              const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
              const dvn = dvx * nx + dvy * ny;
              if (dvn > 0) continue;

              const imp = -(1 + RESTITUTION) * dvn / (1/a.mass + 1/b.mass);
              a.vx += imp * nx / a.mass;
              a.vy += imp * ny / a.mass;
              b.vx -= imp * nx / b.mass;
              b.vy -= imp * ny / b.mass;
            }
          }
        }
      }

      // Velocity sleep threshold
      for (const b of bodies) {
        if (Math.abs(b.vx) < .05) b.vx = 0;
        if (Math.abs(b.vy) < .05 && b.y + TYPES[b.type].r >= c.y + c.h - 1) b.vy = 0;
      }

      // Merge check
      this._checkMerges(bodies);

      // Game over check
      this._checkDanger(bodies);

      // Cleanup
      this.bodies = this.bodies.filter(b => b.alive);
    }

    // ---- Merge ----
    _checkMerges(bodies) {
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j];
          if (!a.alive || !b.alive) continue;
          if (a.type !== b.type) continue;
          if (a.justDropped || b.justDropped) continue;
          if (a.type >= TYPES.length - 1) continue; // can't merge black holes

          const ra = TYPES[a.type].r, rb = TYPES[b.type].r;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx*dx + dy*dy);

          if (dist < ra + rb + 2) {
            // Merge!
            const newType = a.type + 1;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const nt = TYPES[newType];

            a.alive = false;
            b.alive = false;

            this.bodies.push({
              x: mx, y: my,
              vx: (a.vx + b.vx) * .3,
              vy: (a.vy + b.vy) * .3 - 1,
              type: newType,
              mass: nt.r * nt.r,
              alive: true,
              justDropped: false,
              dropFrame: 99
            });

            // Effects
            this.score += nt.pts;
            this.totalMerges++;
            if (newType > this.biggestType) this.biggestType = newType;

            this.particles.emit(mx, my, nt.c2, 14 + newType * 2);
            this.particles.emitRing(mx, my, nt.glow, nt.r);

            this.sound.play('merge', { level: newType });

            if (navigator.vibrate) navigator.vibrate(20 + newType * 8);

            if (newType >= 6) {
              this.shakeAmount = Math.min(newType * 1.5, 10);
            }

            return; // process one merge per frame
          }
        }
      }
    }

    // ---- Danger / Game Over ----
    _checkDanger(bodies) {
      const dangerY = this.container.dangerY;
      const now = Date.now();
      const alive = new Set();

      for (const b of bodies) {
        if (!b.alive || b.justDropped) continue;
        const top = b.y - TYPES[b.type].r;
        if (top < dangerY) {
          alive.add(b);
          if (!this.dangerTimers.has(b)) {
            this.dangerTimers.set(b, now);
          } else if (now - this.dangerTimers.get(b) > DANGER_GRACE) {
            this._gameOver();
            return;
          }
        }
      }

      // Clean up timers for bodies no longer in danger
      for (const [b] of this.dangerTimers) {
        if (!alive.has(b)) this.dangerTimers.delete(b);
      }
    }

    _gameOver() {
      this.state = 'gameover';
      this.sound.play('gameover');

      const isNew = this.score > this.bestScore;
      if (isNew && this.score > 0) {
        this.bestScore = this.score;
        localStorage.setItem('cm_best', this.bestScore.toString());
        setTimeout(() => this.sound.play('best'), 600);
      }

      // Update UI
      document.getElementById('goScore').textContent = this.score.toLocaleString();
      document.getElementById('goBest').textContent = this.bestScore.toLocaleString();
      document.getElementById('goDrops').textContent = this.totalDrops;
      document.getElementById('goMerges').textContent = this.totalMerges;
      document.getElementById('goBiggest').textContent = this.biggestType < TYPES.length ? TYPES[this.biggestType].emoji : '?';

      const nb = document.getElementById('goNewBest');
      nb.classList.toggle('show', isNew && this.score > 0);

      if (this.score >= 500) {
        document.getElementById('goEmoji').textContent = '🤩';
        document.getElementById('goTitle').textContent = 'Legendary!';
      } else if (this.score >= 200) {
        document.getElementById('goEmoji').textContent = '🎉';
        document.getElementById('goTitle').textContent = 'Amazing!';
      } else if (this.score >= 100) {
        document.getElementById('goEmoji').textContent = '😎';
        document.getElementById('goTitle').textContent = 'Great Job!';
      } else {
        document.getElementById('goEmoji').textContent = '💥';
        document.getElementById('goTitle').textContent = 'Game Over';
      }

      setTimeout(() => this._showOverlay('gameOverScreen'), 600);
    }

    // ---- Rendering ----
    _render() {
      const ctx = this.ctx;
      const W = this.W, H = this.H;

      // Shake
      ctx.save();
      if (this.shakeAmount > 0) {
        const sx = (Math.random() - .5) * this.shakeAmount * 2;
        const sy = (Math.random() - .5) * this.shakeAmount * 2;
        ctx.translate(sx, sy);
        this.shakeAmount *= .88;
        if (this.shakeAmount < .2) this.shakeAmount = 0;
      }

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#070b1a');
      bg.addColorStop(.5, '#0d1232');
      bg.addColorStop(1, '#0a0e24');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Nebula
      this._drawNebula(ctx, W * .25, H * .3, 200, 'rgba(124,77,255,.04)');
      this._drawNebula(ctx, W * .75, H * .6, 250, 'rgba(79,195,247,.03)');
      this._drawNebula(ctx, W * .5, H * .15, 180, 'rgba(255,92,141,.025)');

      // Stars
      const time = Date.now() * .001;
      for (const s of this.stars) {
        ctx.globalAlpha = s.alpha * (.6 + .4 * Math.sin(time * s.speed + s.phase));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (this.state === 'playing' || this.state === 'gameover') {
        this._drawContainer(ctx);
        this._drawBodies(ctx);
        this._drawHUD(ctx);
        if (this.state === 'playing') this._drawAim(ctx);
      }

      // Particles
      this.particles.draw(ctx);

      ctx.restore();
    }

    _drawNebula(ctx, x, y, r, color) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    _drawContainer(ctx) {
      const c = this.container;
      const r = 16; // corner radius

      // Container fill (subtle)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x, c.y + c.h - r);
      ctx.quadraticCurveTo(c.x, c.y + c.h, c.x + r, c.y + c.h);
      ctx.lineTo(c.x + c.w - r, c.y + c.h);
      ctx.quadraticCurveTo(c.x + c.w, c.y + c.h, c.x + c.w, c.y + c.h - r);
      ctx.lineTo(c.x + c.w, c.y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.02)';
      ctx.fill();

      // Container border
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Left wall
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x, c.y + c.h - r);
      ctx.quadraticCurveTo(c.x, c.y + c.h, c.x + r, c.y + c.h);
      // Bottom
      ctx.lineTo(c.x + c.w - r, c.y + c.h);
      ctx.quadraticCurveTo(c.x + c.w, c.y + c.h, c.x + c.w, c.y + c.h - r);
      // Right wall
      ctx.lineTo(c.x + c.w, c.y);
      ctx.stroke();

      // Danger line
      const dy = c.dangerY;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,80,80,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x + 4, dy);
      ctx.lineTo(c.x + c.w - 4, dy);
      ctx.stroke();
      ctx.setLineDash([]);

      // "DANGER" text
      ctx.font = '600 9px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,80,80,.3)';
      ctx.textAlign = 'left';
      ctx.fillText('DANGER', c.x + 8, dy - 4);

      ctx.restore();
    }

    _drawBodies(ctx) {
      for (const b of this.bodies) {
        if (!b.alive) continue;
        const t = TYPES[b.type];

        // Outer glow
        ctx.save();
        ctx.globalAlpha = .35;
        const glowG = ctx.createRadialGradient(b.x, b.y, t.r * .7, b.x, b.y, t.r + 8);
        glowG.addColorStop(0, t.glow);
        glowG.addColorStop(1, 'transparent');
        ctx.fillStyle = glowG;
        ctx.beginPath();
        ctx.arc(b.x, b.y, t.r + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Body circle gradient
        const bodyG = ctx.createRadialGradient(
          b.x - t.r * .3, b.y - t.r * .3, t.r * .1,
          b.x, b.y, t.r
        );
        bodyG.addColorStop(0, t.c1);
        bodyG.addColorStop(1, t.c2);
        ctx.fillStyle = bodyG;
        ctx.beginPath();
        ctx.arc(b.x, b.y, t.r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle border
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = .8;
        ctx.stroke();

        // Highlight reflection
        ctx.save();
        ctx.globalAlpha = .35;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(b.x - t.r * .25, b.y - t.r * .28, t.r * .35, t.r * .22, -.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Saturn ring (special)
        if (t.name === 'Saturn') {
          ctx.save();
          ctx.strokeStyle = 'rgba(249,168,37,.5)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, t.r * 1.45, t.r * .35, -.15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Sun corona (special)
        if (t.name === 'Sun') {
          ctx.save();
          ctx.globalAlpha = .12 + Math.sin(Date.now() * .005) * .06;
          const corona = ctx.createRadialGradient(b.x, b.y, t.r, b.x, b.y, t.r * 1.6);
          corona.addColorStop(0, 'rgba(255,143,0,.4)');
          corona.addColorStop(1, 'transparent');
          ctx.fillStyle = corona;
          ctx.beginPath();
          ctx.arc(b.x, b.y, t.r * 1.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Black hole swirl (special)
        if (t.name === 'BlackHole') {
          ctx.save();
          const swt = Date.now() * .002;
          ctx.globalAlpha = .2;
          ctx.strokeStyle = '#7C4DFF';
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, t.r * (.5 + i * .2), swt + i * 2, swt + i * 2 + Math.PI * 1.2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Emoji on body
        const emojiSize = Math.max(t.r * .7, 12);
        ctx.font = `${emojiSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, b.x, b.y + 1);
      }
    }

    _drawHUD(ctx) {
      const c = this.container;

      // Score (top center)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '700 11px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillText('SCORE', this.W / 2, 24);
      ctx.font = '900 28px Outfit, sans-serif';
      ctx.fillStyle = '#FFD54F';
      ctx.fillText(this.score.toLocaleString(), this.W / 2, 52);

      // Best score
      ctx.font = '600 10px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillText(`Best: ${this.bestScore.toLocaleString()}`, this.W / 2, 68);
      ctx.restore();

      // Next body preview (top right area)
      const nt = TYPES[this.nextType];
      const px = c.x + c.w - 30;
      const py = c.y - 30;

      ctx.save();
      ctx.font = '600 9px Outfit, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.textAlign = 'center';
      ctx.fillText('NEXT', px, py - 16);

      // Preview body
      ctx.globalAlpha = .7;
      const pg = ctx.createRadialGradient(px - nt.r * .15, py - nt.r * .15, 1, px, py, nt.r * .55);
      pg.addColorStop(0, nt.c1);
      pg.addColorStop(1, nt.c2);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, nt.r * .55, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = `${Math.max(nt.r * .4, 10)}px sans-serif`;
      ctx.fillText(nt.emoji, px, py + 1);
      ctx.restore();
    }

    _drawAim(ctx) {
      if (!this.canDrop) return;
      const t = TYPES[this.currentType];
      const c = this.container;
      const x = this.dropX;
      const y = c.y + t.r + 4;

      // Aim line
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + t.r);
      ctx.lineTo(x, c.y + c.h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Preview body at drop position
      ctx.globalAlpha = .6;
      const bg = ctx.createRadialGradient(x - t.r * .3, y - t.r * .3, 1, x, y, t.r);
      bg.addColorStop(0, t.c1);
      bg.addColorStop(1, t.c2);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, t.r, 0, Math.PI * 2);
      ctx.fill();

      // Emoji
      ctx.globalAlpha = .5;
      const es = Math.max(t.r * .7, 12);
      ctx.font = `${es}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.emoji, x, y + 1);

      ctx.restore();
    }

    // ---- Share ----
    async _share() {
      const big = this.biggestType < TYPES.length ? TYPES[this.biggestType].name : '???';
      const text = `🌌 Cosmic Merge\n🏆 Score: ${this.score.toLocaleString()}\n💫 Biggest: ${big} ${TYPES[this.biggestType]?.emoji || ''}\n💥 Merges: ${this.totalMerges}\n\nCan you beat me? 🚀`;
      if (navigator.share) {
        try { await navigator.share({ title: 'Cosmic Merge Score', text }); } catch(e) { this._copy(text); }
      } else { this._copy(text); }
    }
    _copy(text) {
      navigator.clipboard?.writeText(text).then(() => {
        const btn = document.getElementById('btnShareScore');
        btn.textContent = 'Copied! 📋';
        setTimeout(() => { btn.textContent = 'Share Score 📤'; }, 2000);
      }).catch(() => {});
    }

    _updateMenuBest() {
      document.getElementById('menuBestVal').textContent = this.bestScore.toLocaleString();
    }

    // ---- Game Loop ----
    _loop() {
      this._physics();
      this.particles.update();
      this._render();
      requestAnimationFrame(() => this._loop());
    }
  }

  // ---- Init ----
  window.addEventListener('DOMContentLoaded', () => new CosmicMerge());
})();
