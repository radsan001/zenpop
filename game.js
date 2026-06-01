/* ================================================
   ZenPop ✨ - Game Engine
   Premium Mind Relaxing Bubble Game
   ================================================ */

(() => {
  'use strict';

  // ---- Constants ----
  const COLS = 8;
  const ROWS = 10;
  const COLORS = ['rose', 'cyan', 'gold', 'violet', 'emerald'];
  const COLOR_HEX = {
    rose: '#FF6B6B',
    cyan: '#4ECDC4',
    gold: '#FFE66D',
    violet: '#A78BFA',
    emerald: '#6BCB77',
    ocean: '#63B3ED'
  };
  const MIN_GROUP = 2;
  const COMBO_TIMEOUT = 2000;
  const BLITZ_TIME = 90;
  const PUZZLE_MOVES = 30;

  // ---- Sound Manager ----
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.musicEnabled = false;
      this.musicOsc = null;
      this.musicGain = null;
    }

    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.enabled = false;
      }
    }

    play(type, params = {}) {
      if (!this.enabled || !this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      switch (type) {
        case 'pop': this._playPop(params.pitch || 1, params.count || 1); break;
        case 'combo': this._playCombo(params.level || 1); break;
        case 'click': this._playClick(); break;
        case 'gameover': this._playGameOver(); break;
        case 'newbest': this._playNewBest(); break;
      }
    }

    _playPop(pitch, count) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 * pitch + Math.min(count * 30, 300), now);
      osc.frequency.exponentialRampToValueAtTime(800 * pitch, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    }

    _playCombo(level) {
      const now = this.ctx.currentTime;
      const baseFreq = 523;

      for (let i = 0; i < Math.min(level, 5); i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq * Math.pow(1.25, i), now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.35);
      }
    }

    _playClick() {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    }

    _playGameOver() {
      const now = this.ctx.currentTime;
      const notes = [523, 466, 415, 349];

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.2);

        gain.gain.setValueAtTime(0.1, now + i * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.2);
        osc.stop(now + i * 0.2 + 0.45);
      });
    }

    _playNewBest() {
      const now = this.ctx.currentTime;
      const notes = [523, 659, 784, 1047];

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.12, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.45);
      });
    }

    startMusic() {
      if (!this.musicEnabled || !this.ctx || this.musicOsc) return;
      // Ambient drone
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 2);

      const notes = [65.41, 82.41, 98.00]; // C2, E2, G2
      this.musicOsc = notes.map(freq => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.connect(this.musicGain);
        osc.start();
        return osc;
      });
      this.musicGain.connect(this.ctx.destination);
    }

    stopMusic() {
      if (this.musicOsc) {
        this.musicOsc.forEach(osc => { try { osc.stop(); } catch(e){} });
        this.musicOsc = null;
      }
      if (this.musicGain) {
        this.musicGain.disconnect();
        this.musicGain = null;
      }
    }
  }

  // ---- Particle System ----
  class ParticleSystem {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.loop();
    }

    resize() {
      this.canvas.width = window.innerWidth * devicePixelRatio;
      this.canvas.height = window.innerHeight * devicePixelRatio;
      this.canvas.style.width = window.innerWidth + 'px';
      this.canvas.style.height = window.innerHeight + 'px';
      this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    emit(x, y, color, count = 12) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
        const speed = 2 + Math.random() * 4;
        const size = 3 + Math.random() * 5;

        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          size,
          color,
          alpha: 1,
          decay: 0.015 + Math.random() * 0.02,
          gravity: 0.08 + Math.random() * 0.05,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.2,
          shape: Math.random() > 0.5 ? 'circle' : 'star'
        });
      }
    }

    emitConfetti(x, y, count = 30) {
      const confettiColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#6BCB77', '#FF9A9E'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;

        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          size: 4 + Math.random() * 4,
          color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
          alpha: 1,
          decay: 0.008 + Math.random() * 0.01,
          gravity: 0.12,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
          shape: 'rect'
        });
      }
    }

    update() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.98;
        p.alpha -= p.decay;
        p.rotation += p.rotSpeed;
        p.size *= 0.99;

        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    render() {
      this.ctx.clearRect(0, 0, this.canvas.width / devicePixelRatio, this.canvas.height / devicePixelRatio);

      for (const p of this.particles) {
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          this.ctx.beginPath();
          this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.shape === 'star') {
          this._drawStar(0, 0, p.size);
        } else {
          this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }

        this.ctx.restore();
      }
    }

    _drawStar(x, y, r) {
      const points = 4;
      this.ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const angle = (i * Math.PI) / points - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.4;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }

    loop() {
      this.update();
      this.render();
      requestAnimationFrame(() => this.loop());
    }
  }

  // ---- Main Game ----
  class ZenPopGame {
    constructor() {
      this.grid = [];
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.bubblesPopped = 0;
      this.biggestPop = 0;
      this.mode = 'zen';
      this.state = 'splash';
      this.timeLeft = BLITZ_TIME;
      this.movesLeft = PUZZLE_MOVES;
      this.comboTimer = null;
      this.gameTimer = null;
      this.highlightedCells = [];
      this.isAnimating = false;
      this.settings = this._loadSettings();

      // DOM refs
      this.els = {
        splashScreen: document.getElementById('splashScreen'),
        menuScreen: document.getElementById('menuScreen'),
        gameScreen: document.getElementById('gameScreen'),
        pauseOverlay: document.getElementById('pauseOverlay'),
        gameOverOverlay: document.getElementById('gameOverOverlay'),
        settingsOverlay: document.getElementById('settingsOverlay'),
        highScoresOverlay: document.getElementById('highScoresOverlay'),
        howToPlayOverlay: document.getElementById('howToPlayOverlay'),
        gameGrid: document.getElementById('gameGrid'),
        scoreValue: document.getElementById('scoreValue'),
        modeIndicator: document.getElementById('modeIndicator'),
        timerBar: document.getElementById('timerBar'),
        timerFill: document.getElementById('timerFill'),
        timerText: document.getElementById('timerText'),
        movesDisplay: document.getElementById('movesDisplay'),
        movesValue: document.getElementById('movesValue'),
        comboIndicator: document.getElementById('comboIndicator'),
        comboValue: document.getElementById('comboValue'),
        scorePopups: document.getElementById('scorePopups'),
        menuBestValue: document.getElementById('menuBestValue'),
        pauseScore: document.getElementById('pauseScore'),
        finalScore: document.getElementById('finalScore'),
        finalBest: document.getElementById('finalBest'),
        newBestBadge: document.getElementById('newBestBadge'),
        gameOverEmoji: document.getElementById('gameOverEmoji'),
        gameOverTitle: document.getElementById('gameOverTitle'),
        statBubbles: document.getElementById('statBubbles'),
        statMaxCombo: document.getElementById('statMaxCombo'),
        statBiggest: document.getElementById('statBiggest'),
        scoresList: document.getElementById('scoresList'),
        particleCanvas: document.getElementById('particleCanvas'),
        bgStars: document.getElementById('bgStars')
      };

      // Systems
      this.sound = new SoundManager();
      this.particles = new ParticleSystem(this.els.particleCanvas);

      this._createBgStars();
      this._bindEvents();
      this._applySavedSettings();
      this._startSplash();
    }

    // ---- Background Stars ----
    _createBgStars() {
      const count = 60;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        const star = document.createElement('div');
        star.className = 'bg-star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.setProperty('--duration', (2 + Math.random() * 4) + 's');
        star.style.setProperty('--max-opacity', (0.2 + Math.random() * 0.5).toString());
        star.style.animationDelay = (Math.random() * 4) + 's';
        star.style.width = (1 + Math.random() * 2) + 'px';
        star.style.height = star.style.width;
        frag.appendChild(star);
      }
      this.els.bgStars.appendChild(frag);
    }

    // ---- Splash ----
    _startSplash() {
      setTimeout(() => {
        this._showScreen('menuScreen');
      }, 2500);
    }

    // ---- Screen Management ----
    _showScreen(screenId) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const screen = document.getElementById(screenId);
      if (screen) screen.classList.add('active');

      if (screenId === 'menuScreen') {
        this.state = 'menu';
        this._updateMenuBestScore();
      }
    }

    _showOverlay(overlayId) {
      document.getElementById(overlayId)?.classList.add('active');
    }

    _hideOverlay(overlayId) {
      document.getElementById(overlayId)?.classList.remove('active');
    }

    // ---- Event Binding ----
    _bindEvents() {
      // Mode selection
      document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => {
          this.sound.init();
          this.sound.play('click');
          this.mode = card.dataset.mode;
          this._startGame();
        });
      });

      // Pause
      document.getElementById('btnPause').addEventListener('click', () => {
        this.sound.play('click');
        this._pauseGame();
      });

      document.getElementById('btnResume').addEventListener('click', () => {
        this.sound.play('click');
        this._resumeGame();
      });

      document.getElementById('btnQuitToMenu').addEventListener('click', () => {
        this.sound.play('click');
        this._quitToMenu();
      });

      // Game Over
      document.getElementById('btnPlayAgain').addEventListener('click', () => {
        this.sound.play('click');
        this._hideOverlay('gameOverOverlay');
        this._startGame();
      });

      document.getElementById('btnShare').addEventListener('click', () => {
        this._shareScore();
      });

      document.getElementById('btnBackToMenu').addEventListener('click', () => {
        this.sound.play('click');
        this._hideOverlay('gameOverOverlay');
        this._showScreen('menuScreen');
      });

      // Settings
      document.getElementById('btnSettings').addEventListener('click', () => {
        this.sound.play('click');
        this._showOverlay('settingsOverlay');
      });

      document.getElementById('btnCloseSettings').addEventListener('click', () => {
        this.sound.play('click');
        this._hideOverlay('settingsOverlay');
        this._saveSettings();
      });

      document.getElementById('toggleSound').addEventListener('change', (e) => {
        this.sound.enabled = e.target.checked;
        this.settings.sound = e.target.checked;
      });

      document.getElementById('toggleVibration').addEventListener('change', (e) => {
        this.settings.vibration = e.target.checked;
      });

      document.getElementById('toggleMusic').addEventListener('change', (e) => {
        this.sound.musicEnabled = e.target.checked;
        this.settings.music = e.target.checked;
        if (e.target.checked && this.state === 'playing') {
          this.sound.init();
          this.sound.startMusic();
        } else {
          this.sound.stopMusic();
        }
      });

      // High Scores
      document.getElementById('btnHighScores').addEventListener('click', () => {
        this.sound.play('click');
        this._showHighScores();
      });

      document.getElementById('btnCloseScores').addEventListener('click', () => {
        this.sound.play('click');
        this._hideOverlay('highScoresOverlay');
      });

      document.querySelectorAll('.score-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.score-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this._renderScores(tab.dataset.tab);
        });
      });

      // How to Play
      document.getElementById('btnHowToPlay').addEventListener('click', () => {
        this.sound.play('click');
        this._showOverlay('howToPlayOverlay');
      });

      document.getElementById('btnCloseTutorial').addEventListener('click', () => {
        this.sound.play('click');
        this._hideOverlay('howToPlayOverlay');
      });

      // Keyboard
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (this.state === 'playing') this._pauseGame();
          else if (this.state === 'paused') this._resumeGame();
        }
      });

      // Prevent context menu on long press
      this.els.gameGrid.addEventListener('contextmenu', e => e.preventDefault());
    }

    // ---- Game Start ----
    _startGame() {
      this.grid = [];
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.bubblesPopped = 0;
      this.biggestPop = 0;
      this.timeLeft = BLITZ_TIME;
      this.movesLeft = PUZZLE_MOVES;
      this.isAnimating = false;
      this.highlightedCells = [];

      if (this.comboTimer) clearTimeout(this.comboTimer);
      if (this.gameTimer) clearInterval(this.gameTimer);

      // Initialize grid
      for (let r = 0; r < ROWS; r++) {
        this.grid[r] = [];
        for (let c = 0; c < COLS; c++) {
          this.grid[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
        }
      }

      // Update UI
      this.els.scoreValue.textContent = '0';
      this.els.modeIndicator.textContent = this.mode.toUpperCase();

      // Mode-specific setup
      this.els.timerBar.classList.remove('active');
      this.els.movesDisplay.classList.remove('active');
      this.els.comboIndicator.classList.remove('active');

      if (this.mode === 'blitz') {
        this.els.timerBar.classList.add('active');
        this.els.timerFill.style.width = '100%';
        this.els.timerFill.className = 'timer-fill';
        this.els.timerText.textContent = BLITZ_TIME;
        this._startTimer();
      } else if (this.mode === 'puzzle') {
        this.els.movesDisplay.classList.add('active');
        this.els.movesValue.textContent = PUZZLE_MOVES;
      }

      this._renderGrid();
      this._showScreen('gameScreen');
      this.state = 'playing';

      if (this.sound.musicEnabled) {
        this.sound.init();
        this.sound.startMusic();
      }
    }

    // ---- Grid Rendering ----
    _renderGrid() {
      this.els.gameGrid.innerHTML = '';
      const frag = document.createDocumentFragment();

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const bubble = document.createElement('div');
          bubble.className = `bubble ${this.grid[r][c] || 'empty'}`;
          bubble.dataset.row = r;
          bubble.dataset.col = c;
          bubble.style.setProperty('--delay', (r * 30 + c * 20) + 'ms');
          bubble.style.setProperty('--breathe-delay', (Math.random() * 3) + 's');

          if (this.grid[r][c]) {
            bubble.classList.add('idle');
            bubble.addEventListener('pointerenter', () => this._onBubbleHover(r, c));
            bubble.addEventListener('pointerleave', () => this._clearHighlight());
            bubble.addEventListener('click', () => this._onBubbleClick(r, c));
          }

          frag.appendChild(bubble);
        }
      }

      this.els.gameGrid.appendChild(frag);
    }

    _getBubbleEl(row, col) {
      return this.els.gameGrid.children[row * COLS + col];
    }

    // ---- Bubble Interaction ----
    _onBubbleHover(row, col) {
      if (this.isAnimating || this.state !== 'playing') return;
      const group = this._findGroup(row, col);
      if (group.length >= MIN_GROUP) {
        this._clearHighlight();
        this.highlightedCells = group;
        group.forEach(([r, c]) => {
          const el = this._getBubbleEl(r, c);
          if (el) {
            el.classList.remove('idle');
            el.classList.add('highlighted');
          }
        });
      }
    }

    _clearHighlight() {
      this.highlightedCells.forEach(([r, c]) => {
        const el = this._getBubbleEl(r, c);
        if (el) {
          el.classList.remove('highlighted');
          el.classList.add('idle');
        }
      });
      this.highlightedCells = [];
    }

    _onBubbleClick(row, col) {
      if (this.isAnimating || this.state !== 'playing') return;
      if (!this.grid[row][col]) return;

      const group = this._findGroup(row, col);
      if (group.length < MIN_GROUP) {
        // Shake feedback for invalid tap
        const el = this._getBubbleEl(row, col);
        if (el) {
          el.style.animation = 'none';
          el.offsetHeight; // reflow
          el.style.animation = '';
          el.classList.add('highlighted');
          setTimeout(() => el.classList.remove('highlighted'), 200);
        }
        return;
      }

      this.isAnimating = true;
      this._clearHighlight();

      const color = this.grid[row][col];
      const colorHex = COLOR_HEX[color] || '#fff';
      const groupSize = group.length;

      // Update stats
      this.bubblesPopped += groupSize;
      if (groupSize > this.biggestPop) this.biggestPop = groupSize;

      // Combo system
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;

      if (this.comboTimer) clearTimeout(this.comboTimer);
      this.comboTimer = setTimeout(() => {
        this.combo = 0;
        this.els.comboIndicator.classList.remove('active');
      }, COMBO_TIMEOUT);

      if (this.combo >= 2) {
        this.els.comboIndicator.classList.add('active');
        this.els.comboValue.textContent = `x${this.combo}`;
      }

      // Calculate score
      const baseScore = groupSize * (groupSize - 1) * 5;
      const comboMultiplier = Math.max(1, this.combo);
      const points = baseScore * comboMultiplier;
      this.score += points;

      // Sound
      this.sound.play('pop', { pitch: 0.8 + groupSize * 0.1, count: groupSize });
      if (this.combo >= 2) {
        this.sound.play('combo', { level: this.combo });
      }

      // Vibration
      if (this.settings.vibration && navigator.vibrate) {
        navigator.vibrate(Math.min(groupSize * 10, 100));
      }

      // Pop animation
      const gridRect = this.els.gameGrid.getBoundingClientRect();
      const bubbleSize = gridRect.width / COLS;
      let centerX = 0, centerY = 0;

      group.forEach(([r, c]) => {
        const el = this._getBubbleEl(r, c);
        if (el) {
          el.classList.remove('idle', 'highlighted');
          el.classList.add('popping');

          // Particle emission
          const bubbleRect = el.getBoundingClientRect();
          const bx = bubbleRect.left + bubbleRect.width / 2;
          const by = bubbleRect.top + bubbleRect.height / 2;
          centerX += bx;
          centerY += by;
          this.particles.emit(bx, by, colorHex, Math.min(6 + groupSize, 15));
        }
        this.grid[r][c] = null;
      });

      centerX /= group.length;
      centerY /= group.length;

      // Score popup
      this._showScorePopup(centerX, centerY, points, this.combo);

      // Screen shake for big groups
      if (groupSize >= 8) {
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 400);
        this.particles.emitConfetti(centerX, centerY, groupSize * 3);
      }

      // Update score display
      this._updateScoreDisplay();

      // Puzzle mode: decrement moves
      if (this.mode === 'puzzle') {
        this.movesLeft--;
        this.els.movesValue.textContent = this.movesLeft;
      }

      // After pop animation, apply gravity
      setTimeout(() => {
        this._applyGravity();
        this._renderGridSmooth();

        setTimeout(() => {
          if (this.mode === 'zen') {
            this._fillEmpty();
            this._renderGridSmooth();
          }

          setTimeout(() => {
            this.isAnimating = false;

            // Check game over conditions
            if (this._checkGameOver()) {
              this._endGame();
            }
          }, 300);
        }, 250);
      }, 350);
    }

    // ---- BFS Flood Fill ----
    _findGroup(row, col) {
      const color = this.grid[row]?.[col];
      if (!color) return [];

      const visited = new Set();
      const queue = [[row, col]];
      const group = [];

      while (queue.length > 0) {
        const [r, c] = queue.shift();
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        if (this.grid[r][c] !== color) continue;

        visited.add(key);
        group.push([r, c]);

        queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
      }

      return group;
    }

    // ---- Gravity ----
    _applyGravity() {
      for (let c = 0; c < COLS; c++) {
        let writePos = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (this.grid[r][c]) {
            if (r !== writePos) {
              this.grid[writePos][c] = this.grid[r][c];
              this.grid[r][c] = null;
            }
            writePos--;
          }
        }
        // Fill remaining with null
        for (let r = writePos; r >= 0; r--) {
          this.grid[r][c] = null;
        }
      }

      // Compact columns (shift non-empty columns left)
      if (this.mode !== 'zen') {
        this._compactColumns();
      }
    }

    _compactColumns() {
      // Find empty columns and shift
      let writeCol = 0;
      const newGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

      for (let c = 0; c < COLS; c++) {
        let hasContent = false;
        for (let r = 0; r < ROWS; r++) {
          if (this.grid[r][c]) {
            hasContent = true;
            break;
          }
        }
        if (hasContent) {
          for (let r = 0; r < ROWS; r++) {
            newGrid[r][writeCol] = this.grid[r][c];
          }
          writeCol++;
        }
      }

      this.grid = newGrid;
    }

    // ---- Fill Empty (Zen mode) ----
    _fillEmpty() {
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (!this.grid[r][c]) {
            this.grid[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
          }
        }
      }
    }

    // ---- Smooth Re-render ----
    _renderGridSmooth() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const el = this._getBubbleEl(r, c);
          if (!el) continue;

          const color = this.grid[r][c];

          // Remove old classes
          el.classList.remove('popping', 'highlighted', 'idle', ...COLORS, 'ocean', 'empty');

          if (color) {
            el.className = `bubble ${color} idle`;
            el.style.setProperty('--breathe-delay', (Math.random() * 3) + 's');
            el.style.setProperty('--delay', '0ms');

            // Re-bind events
            const nr = r, nc = c;
            el.onpointerenter = () => this._onBubbleHover(nr, nc);
            el.onpointerleave = () => this._clearHighlight();
            el.onclick = () => this._onBubbleClick(nr, nc);
          } else {
            el.className = 'bubble empty';
            el.onpointerenter = null;
            el.onpointerleave = null;
            el.onclick = null;
          }
        }
      }
    }

    // ---- Score Display ----
    _updateScoreDisplay() {
      this.els.scoreValue.textContent = this.score.toLocaleString();
      this.els.scoreValue.classList.remove('bump');
      void this.els.scoreValue.offsetHeight;
      this.els.scoreValue.classList.add('bump');
    }

    _showScorePopup(x, y, points, combo) {
      const popup = document.createElement('div');
      popup.className = 'score-popup';
      popup.textContent = `+${points}`;
      if (combo >= 2) popup.textContent += ` x${combo}`;
      popup.style.left = x + 'px';
      popup.style.top = y + 'px';
      popup.style.transform = 'translateX(-50%)';

      this.els.scorePopups.appendChild(popup);
      setTimeout(() => popup.remove(), 1000);
    }

    // ---- Timer (Blitz mode) ----
    _startTimer() {
      this.gameTimer = setInterval(() => {
        if (this.state !== 'playing') return;
        this.timeLeft--;

        const pct = (this.timeLeft / BLITZ_TIME) * 100;
        this.els.timerFill.style.width = pct + '%';
        this.els.timerText.textContent = this.timeLeft;

        // Timer visual feedback
        this.els.timerFill.classList.remove('warning', 'critical');
        if (this.timeLeft <= 10) {
          this.els.timerFill.classList.add('critical');
        } else if (this.timeLeft <= 30) {
          this.els.timerFill.classList.add('warning');
        }

        if (this.timeLeft <= 0) {
          clearInterval(this.gameTimer);
          this._endGame();
        }
      }, 1000);
    }

    // ---- Game Over Check ----
    _checkGameOver() {
      // Blitz: handled by timer
      if (this.mode === 'blitz') return false;

      // Puzzle: no moves left or board clear
      if (this.mode === 'puzzle') {
        const boardClear = this._isBoardClear();
        if (boardClear || this.movesLeft <= 0 || !this._hasValidMoves()) return true;
        return false;
      }

      // Zen: check if any valid moves
      if (!this._hasValidMoves()) return true;
      return false;
    }

    _hasValidMoves() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.grid[r][c]) {
            const group = this._findGroup(r, c);
            if (group.length >= MIN_GROUP) return true;
          }
        }
      }
      return false;
    }

    _isBoardClear() {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.grid[r][c]) return false;
        }
      }
      return true;
    }

    // ---- End Game ----
    _endGame() {
      this.state = 'gameover';
      if (this.gameTimer) clearInterval(this.gameTimer);
      this.sound.stopMusic();
      this.sound.play('gameover');

      // Calculate & save
      const bestKey = `zenpop_best_${this.mode}`;
      const prevBest = parseInt(localStorage.getItem(bestKey) || '0');
      const isNewBest = this.score > prevBest;

      if (isNewBest && this.score > 0) {
        localStorage.setItem(bestKey, this.score.toString());
        this.sound.play('newbest');

        // Confetti burst
        setTimeout(() => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          this.particles.emitConfetti(vw / 2, vh / 3, 50);
          this.particles.emitConfetti(vw * 0.3, vh / 3, 30);
          this.particles.emitConfetti(vw * 0.7, vh / 3, 30);
        }, 300);
      }

      // Save to history
      this._saveScore(this.mode, this.score);

      // Update UI
      const best = isNewBest ? this.score : prevBest;
      this.els.finalScore.textContent = this.score.toLocaleString();
      this.els.finalBest.textContent = best.toLocaleString();
      this.els.statBubbles.textContent = this.bubblesPopped;
      this.els.statMaxCombo.textContent = this.maxCombo;
      this.els.statBiggest.textContent = this.biggestPop;

      // New best badge
      if (isNewBest && this.score > 0) {
        this.els.newBestBadge.classList.add('show');
      } else {
        this.els.newBestBadge.classList.remove('show');
      }

      // Title & emoji based on score
      if (this.score >= 5000) {
        this.els.gameOverEmoji.textContent = '🤩';
        this.els.gameOverTitle.textContent = 'Legendary!';
      } else if (this.score >= 2000) {
        this.els.gameOverEmoji.textContent = '🎉';
        this.els.gameOverTitle.textContent = 'Amazing!';
      } else if (this.score >= 1000) {
        this.els.gameOverEmoji.textContent = '😎';
        this.els.gameOverTitle.textContent = 'Great Job!';
      } else if (this.score >= 500) {
        this.els.gameOverEmoji.textContent = '👏';
        this.els.gameOverTitle.textContent = 'Nice!';
      } else {
        this.els.gameOverEmoji.textContent = '✨';
        this.els.gameOverTitle.textContent = 'Good Try!';
      }

      setTimeout(() => {
        this._showOverlay('gameOverOverlay');
      }, 500);
    }

    // ---- Pause / Resume ----
    _pauseGame() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      this.els.pauseScore.textContent = this.score.toLocaleString();
      this._showOverlay('pauseOverlay');
    }

    _resumeGame() {
      this.state = 'playing';
      this._hideOverlay('pauseOverlay');
    }

    _quitToMenu() {
      this.state = 'menu';
      if (this.gameTimer) clearInterval(this.gameTimer);
      this.sound.stopMusic();
      this._hideOverlay('pauseOverlay');
      this._showScreen('menuScreen');
    }

    // ---- High Scores ----
    _showHighScores() {
      this._showOverlay('highScoresOverlay');
      // Reset tabs
      document.querySelectorAll('.score-tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.score-tab[data-tab="zen"]').classList.add('active');
      this._renderScores('zen');
    }

    _renderScores(mode) {
      const scores = this._getScores(mode);
      const list = this.els.scoresList;

      if (scores.length === 0) {
        list.innerHTML = '<div class="no-scores">No scores yet. Play to set records!</div>';
        return;
      }

      list.innerHTML = scores.slice(0, 10).map((s, i) => `
        <div class="score-entry">
          <span class="score-rank">#${i + 1}</span>
          <span class="score-date">${new Date(s.date).toLocaleDateString()}</span>
          <span class="score-points">${s.score.toLocaleString()}</span>
        </div>
      `).join('');
    }

    // ---- Score Storage ----
    _saveScore(mode, score) {
      const key = `zenpop_scores_${mode}`;
      const scores = this._getScores(mode);
      scores.push({ score, date: Date.now() });
      scores.sort((a, b) => b.score - a.score);
      localStorage.setItem(key, JSON.stringify(scores.slice(0, 20)));
    }

    _getScores(mode) {
      try {
        return JSON.parse(localStorage.getItem(`zenpop_scores_${mode}`) || '[]');
      } catch {
        return [];
      }
    }

    _updateMenuBestScore() {
      const best = Math.max(
        parseInt(localStorage.getItem('zenpop_best_zen') || '0'),
        parseInt(localStorage.getItem('zenpop_best_blitz') || '0'),
        parseInt(localStorage.getItem('zenpop_best_puzzle') || '0')
      );
      this.els.menuBestValue.textContent = best.toLocaleString();
    }

    // ---- Settings ----
    _loadSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem('zenpop_settings'));
        return saved || { sound: true, vibration: true, music: false };
      } catch {
        return { sound: true, vibration: true, music: false };
      }
    }

    _saveSettings() {
      this.settings.sound = document.getElementById('toggleSound').checked;
      this.settings.vibration = document.getElementById('toggleVibration').checked;
      this.settings.music = document.getElementById('toggleMusic').checked;
      localStorage.setItem('zenpop_settings', JSON.stringify(this.settings));
    }

    _applySavedSettings() {
      document.getElementById('toggleSound').checked = this.settings.sound;
      document.getElementById('toggleVibration').checked = this.settings.vibration;
      document.getElementById('toggleMusic').checked = this.settings.music;
      this.sound.enabled = this.settings.sound;
      this.sound.musicEnabled = this.settings.music;
    }

    // ---- Share ----
    async _shareScore() {
      const text = `🎮 ZenPop ✨\n🏆 Score: ${this.score.toLocaleString()}\n🔥 Max Combo: x${this.maxCombo}\n💥 Bubbles Popped: ${this.bubblesPopped}\n\nCan you beat my score? 🎯`;

      if (navigator.share) {
        try {
          await navigator.share({ title: 'ZenPop Score', text });
        } catch (e) {
          this._copyToClipboard(text);
        }
      } else {
        this._copyToClipboard(text);
      }
    }

    _copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btnShare');
        const original = btn.textContent;
        btn.textContent = 'Copied! 📋';
        setTimeout(() => { btn.textContent = original; }, 2000);
      }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);

        const btn = document.getElementById('btnShare');
        const original = btn.textContent;
        btn.textContent = 'Copied! 📋';
        setTimeout(() => { btn.textContent = original; }, 2000);
      });
    }
  }

  // ---- Initialize ----
  window.addEventListener('DOMContentLoaded', () => {
    new ZenPopGame();
  });

})();
