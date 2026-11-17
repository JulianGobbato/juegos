/**
 * EL FALSO ARTISTA - Motor de Juego y Conectividad PeerJS
 * Basado en "A Fake Artist Goes to New York"
 * Pantalla TV (Host) + Celulares (Mando Privado & Lienzo Táctil)
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTES Y CONFIGURACIÓN
  // ============================================================================
  const PEER_PREFIX = 'falso-art-';
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Paleta de 10 colores vibrantes de pincel para fondo blanco
  const BRUSH_PALETTE = [
    { name: 'Rojo', hex: '#ef4444' },
    { name: 'Azul', hex: '#2563eb' },
    { name: 'Verde', hex: '#16a34a' },
    { name: 'Naranja', hex: '#ea580c' },
    { name: 'Violeta', hex: '#9333ea' },
    { name: 'Turquesa', hex: '#0891b2' },
    { name: 'Rosa', hex: '#db2777' },
    { name: 'Marrón', hex: '#854d0e' },
    { name: 'Índigo', hex: '#4f46e5' },
    { name: 'Lima', hex: '#4d7c0f' }
  ];

  const AVATARS = ['🦊', '🐱', '🐼', '🦁', '🐸', '🐨', '🐯', '🐰', '🦉', '🐙', '🦄', '🐵'];

  // ============================================================================
  // SÍNTESIS DE AUDIO (Web Audio API)
  // ============================================================================
  const SoundEffects = {
    ctx: null,
    enabled: true,

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },

    toggle() {
      this.enabled = !this.enabled;
      const icon = document.getElementById('soundIcon');
      if (icon) icon.textContent = this.enabled ? '🔊' : '🔇';
      return this.enabled;
    },

    playTone(freq, duration, type = 'sine', gainVal = 0.2) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    },

    playJoin() {
      if (!this.enabled) return;
      this.playTone(523.25, 0.15, 'triangle', 0.2); // C5
      setTimeout(() => this.playTone(659.25, 0.2, 'triangle', 0.2), 80); // E5
    },

    playRoleAssigned() {
      if (!this.enabled) return;
      this.playTone(392.00, 0.25, 'sine', 0.25); // G4
      setTimeout(() => this.playTone(466.16, 0.25, 'sine', 0.25), 120); // Bb4
      setTimeout(() => this.playTone(587.33, 0.45, 'sine', 0.3), 240); // D5
    },

    playStrokeDone() {
      if (!this.enabled) return;
      this.playTone(880, 0.08, 'triangle', 0.15);
      setTimeout(() => this.playTone(1174.66, 0.12, 'sine', 0.15), 50);
    },

    playDrumroll() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      let count = 0;
      const interval = setInterval(() => {
        this.playTone(150 + count * 8, 0.06, 'triangle', 0.15);
        count++;
        if (count > 16) clearInterval(interval);
      }, 70);
    },

    playCaught() {
      if (!this.enabled) return;
      this.playTone(300, 0.2, 'sawtooth', 0.3);
      setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.3), 150);
    },

    playEscaped() {
      if (!this.enabled) return;
      this.playTone(587.33, 0.12, 'sine', 0.25);
      setTimeout(() => this.playTone(739.99, 0.12, 'sine', 0.25), 100);
      setTimeout(() => this.playTone(880.00, 0.3, 'sine', 0.3), 200);
    },

    playVictory() {
      if (!this.enabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.35, 'triangle', 0.25), i * 140);
      });
    }
  };

  // ============================================================================
  // ANIMACIÓN DE CONFETI EN LIENZO
  // ============================================================================
  const Confetti = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,

    init() {
      this.canvas = document.getElementById('confettiCanvas');
      if (this.canvas) {
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
      }
    },

    resize() {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    start(durationMs = 4000) {
      if (!this.ctx) return;
      this.particles = [];
      const colors = ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#f43f5e'];
      for (let i = 0; i < 120; i++) {
        this.particles.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * -this.canvas.height,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: Math.random() * 4 - 2,
          vy: Math.random() * 4 + 3,
          rot: Math.random() * 360,
          vRot: Math.random() * 8 - 4
        });
      }

      const animate = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        let alive = false;
        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vRot;
          if (p.y < this.canvas.height) alive = true;

          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rot * Math.PI) / 180);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          this.ctx.restore();
        });

        if (alive) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.stop();
        }
      };

      cancelAnimationFrame(this.animationId);
      this.animationId = requestAnimationFrame(animate);

      setTimeout(() => this.stop(), durationMs);
    },

    stop() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  };

  // ============================================================================
  // UTILIDADES GENERALES
  // ============================================================================
  function generarCodigoSala() {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += letras.charAt(Math.floor(Math.random() * letras.length));
    }
    return code;
  }

  function normalizarTexto(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  function obtenerCoordenadas(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    };
  }

  function renderizarTrazo(ctx, stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    ctx.save();
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;

    ctx.beginPath();
    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, 3, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function redibujarLienzo(canvas, ctx, strokesHistory, liveStroke = null) {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (strokesHistory && strokesHistory.length > 0) {
      strokesHistory.forEach(s => renderizarTrazo(ctx, s));
    }
    if (liveStroke) {
      renderizarTrazo(ctx, liveStroke);
    }
  }

  // ============================================================================
  // ESTADO GLOBAL DE LA APLICACIÓN
  // ============================================================================
  const appState = {
    mode: null, // 'TV' | 'PHONE'
    peer: null,
    roomCode: '',
    heartbeatInterval: null,
    catalog: null // { categorias: [...] }
  };

  // Limpieza segura de conexiones PeerJS
  function limpiarConexionPrevia() {
    if (appState.heartbeatInterval) {
      clearInterval(appState.heartbeatInterval);
      appState.heartbeatInterval = null;
    }
    if (PhoneClient.conn) {
      try { PhoneClient.conn.close(); } catch (e) {}
      PhoneClient.conn = null;
    }
    if (appState.peer && !appState.peer.destroyed) {
      try { appState.peer.destroy(); } catch (e) {}
      appState.peer = null;
    }
  }

  // ============================================================================
  // CONTROLADOR DE PANTALLA TV (HOST)
  // ============================================================================
  const TvHost = {
    players: [], // { id, name, avatar, color, peerConn, score, roundDelta, strokesDone }
    roundIndex: 0,
    totalRounds: 5,
    selectedCategoryIds: ['animales', 'comida_y_bebida', 'objetos', 'lugares_y_vehiculos', 'personajes_y_oficios', 'argentina'],
    
    currentCategory: null,
    secretWord: '',
    fakeArtistId: '',
    
    turnOrder: [], // Array de playerIds
    currentTurnIndex: 0, // 0 a (players.length * 2) - 1
    strokesHistory: [], // Array de { playerId, color, points }
    currentLiveStroke: null,
    
    votes: {}, // { [voterId]: candidatePlayerId }
    fakeGuess: '',
    
    tvCanvas: null,
    tvCtx: null,
    debateCanvas: null,
    debateCtx: null,

    init() {
      appState.mode = 'TV';
      document.getElementById('screenLanding').classList.remove('active');
      document.getElementById('screenLanding').classList.add('d-none');
      document.getElementById('screenTv').classList.remove('d-none');
      document.getElementById('screenTv').classList.add('active');

      this.tvCanvas = document.getElementById('tvDrawingCanvas');
      if (this.tvCanvas) this.tvCtx = this.tvCanvas.getContext('2d');

      this.debateCanvas = document.getElementById('tvDebateCanvas');
      if (this.debateCanvas) this.debateCtx = this.debateCanvas.getContext('2d');

      this.setupPeer();
      this.bindEvents();
    },

    setupPeer() {
      limpiarConexionPrevia();
      appState.roomCode = generarCodigoSala();
      const peerId = PEER_PREFIX + appState.roomCode;

      document.getElementById('headerRoomCode').textContent = appState.roomCode;
      document.getElementById('roomBadgeWrap').classList.remove('d-none');
      document.getElementById('tvRoomCode').textContent = appState.roomCode;

      this.renderQrCode();

      const peer = new Peer(peerId, { debug: 1 });
      appState.peer = peer;

      peer.on('open', (id) => {
        console.log('TV Host Peer abierto:', id);
        this.showView('tvViewLobby');
      });

      peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      peer.on('error', (err) => {
        console.error('Error Peer TV:', err);
        if (err.type === 'unavailable-id') {
          // Si el ID ya existe, reintentar con otro código
          setTimeout(() => this.setupPeer(), 1000);
        }
      });
    },

    renderQrCode() {
      const qrContainer = document.getElementById('tvQrContainer');
      if (!qrContainer) return;
      qrContainer.innerHTML = '';

      // URL absoluta para el celular
      const url = new URL(window.location.href);
      url.searchParams.set('sala', appState.roomCode);
      const joinUrl = url.toString();

      document.getElementById('tvJoinUrlText').textContent = joinUrl;

      if (window.QRCode) {
        new QRCode(qrContainer, {
          text: joinUrl,
          width: 220,
          height: 220,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    },

    bindEvents() {
      document.getElementById('btnTvStartGame')?.addEventListener('click', () => {
        this.startMatch();
      });

      document.getElementById('btnTvShowScores')?.addEventListener('click', () => {
        this.startPhase5();
      });

      document.getElementById('btnTvNextRound')?.addEventListener('click', () => {
        this.nextRound();
      });

      document.getElementById('btnTvRestartGame')?.addEventListener('click', () => {
        this.restartGame();
      });

      // Juez manual en TV si hace falta
      document.getElementById('btnTvJudgeValid')?.addEventListener('click', () => {
        this.resolveFakeGuess(true);
      });

      document.getElementById('btnTvJudgeInvalid')?.addEventListener('click', () => {
        this.resolveFakeGuess(false);
      });
    },

    handleIncomingConnection(conn) {
      conn.on('data', (data) => {
        this.handleClientMessage(conn, data);
      });

      conn.on('close', () => {
        this.handlePlayerDisconnect(conn.peer);
      });

      conn.on('error', (e) => {
        console.warn('Error conexión con jugador:', e);
      });
    },

    handleClientMessage(conn, msg) {
      switch (msg.type) {
        case 'JOIN_GAME':
          this.registerPlayer(conn, msg.payload);
          break;
        case 'VIP_SETTINGS':
          this.updateVipSettings(msg.payload);
          break;
        case 'VIP_START_MATCH':
          this.startMatch();
          break;
        case 'DRAW_LIVE_POINT':
          this.handleLivePoint(msg.payload);
          break;
        case 'STROKE_RESET':
          this.handleStrokeReset(msg.payload);
          break;
        case 'STROKE_CONFIRMED':
          this.handleStrokeConfirmed(msg.payload);
          break;
        case 'SUBMIT_VOTE':
          this.registerVote(msg.payload.voterId, msg.payload.candidateId);
          break;
        case 'SUBMIT_FAKE_GUESS':
          this.handleFakeGuessSubmission(msg.payload.guess);
          break;
        case 'VIP_JUDGE_RESULT':
          this.resolveFakeGuess(msg.payload.isValid);
          break;
        case 'VIP_NEXT_ROUND':
          this.nextRound();
          break;
        case 'VIP_RESTART_MATCH':
          this.restartGame();
          break;
        case 'PING':
          try { conn.send({ type: 'PONG' }); } catch (e) {}
          break;
      }
    },

    registerPlayer(conn, info) {
      if (this.players.length >= 10) {
        conn.send({ type: 'JOIN_REJECTED', payload: { reason: 'La sala está completa (máx. 10 jugadores)' } });
        return;
      }

      // Asignar color único de la paleta
      const colorIndex = this.players.length % BRUSH_PALETTE.length;
      const assignedColor = BRUSH_PALETTE[colorIndex];
      const isVip = this.players.length === 0;

      const player = {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        peerId: conn.peer,
        peerConn: conn,
        name: (info.name || 'Artista').trim().substring(0, 14),
        avatar: info.avatar || '🎨',
        color: assignedColor,
        isVip: isVip,
        score: 0,
        roundDelta: 0,
        strokesDone: 0
      };

      this.players.push(player);
      SoundEffects.playJoin();

      // Enviar confirmación al celular
      conn.send({
        type: 'JOIN_ACCEPTED',
        payload: {
          playerId: player.id,
          name: player.name,
          avatar: player.avatar,
          color: player.color,
          isVip: player.isVip,
          roomCode: appState.roomCode,
          categories: appState.catalog ? appState.catalog.categorias : []
        }
      });

      this.renderLobbyRoster();
      this.broadcastRoster();
    },

    handlePlayerDisconnect(peerId) {
      const idx = this.players.findIndex(p => p.peerId === peerId);
      if (idx !== -1) {
        const removed = this.players.splice(idx, 1)[0];
        console.log('Jugador desconectado:', removed.name);
        
        // Si el que se fue era el VIP y quedan jugadores, asignar nuevo VIP
        if (removed.isVip && this.players.length > 0) {
          this.players[0].isVip = true;
          try {
            this.players[0].peerConn.send({ type: 'ASSIGNED_VIP' });
          } catch (e) {}
        }

        this.renderLobbyRoster();
        this.broadcastRoster();
      }
    },

    updateVipSettings(settings) {
      if (settings.totalRounds) {
        this.totalRounds = parseInt(settings.totalRounds, 10) || 5;
      }
      if (settings.categoryIds && Array.isArray(settings.categoryIds)) {
        this.selectedCategoryIds = settings.categoryIds;
      }
    },

    renderLobbyRoster() {
      const rosterEl = document.getElementById('tvPlayerRoster');
      const countEl = document.getElementById('tvPlayerCount');
      const btnStartTv = document.getElementById('btnTvStartGame');
      const statusMsg = document.getElementById('tvLobbyStatusMsg');

      if (!rosterEl) return;
      rosterEl.innerHTML = '';

      countEl.textContent = `${this.players.length} / 10 (Mínimo 3)`;

      this.players.forEach(p => {
        const card = document.createElement('div');
        card.className = `player-lobby-card ${p.isVip ? 'is-vip' : ''}`;
        card.innerHTML = `
          <div class="player-avatar-badge">${p.avatar}</div>
          <div class="player-meta">
            <div class="player-name-text">
              ${p.name} ${p.isVip ? '<span class="vip-crown-tag" title="Anfitrión VIP">👑</span>' : ''}
            </div>
            <div class="player-color-pill">
              <span class="color-dot" style="background-color: ${p.color.hex}; color: ${p.color.hex};"></span>
              <span>Pincel ${p.color.name}</span>
            </div>
          </div>
        `;
        rosterEl.appendChild(card);
      });

      if (this.players.length >= 3) {
        btnStartTv.classList.remove('d-none');
        statusMsg.textContent = '¡Listos para arrancar! El VIP puede iniciar desde su celular o podés tocar el botón de abajo.';
      } else {
        btnStartTv.classList.add('d-none');
        statusMsg.textContent = `Se necesitan al menos 3 jugadores para jugar (conectados: ${this.players.length}).`;
      }
    },

    broadcastRoster() {
      const rosterData = this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        isVip: p.isVip,
        score: p.score
      }));

      this.broadcast({
        type: 'ROSTER_UPDATE',
        payload: {
          players: rosterData,
          canStart: this.players.length >= 3
        }
      });
    },

    broadcast(message) {
      this.players.forEach(p => {
        try {
          if (p.peerConn && p.peerConn.open) {
            p.peerConn.send(message);
          }
        } catch (e) {
          console.warn('Fallo al enviar mensaje a', p.name, e);
        }
      });
    },

    showView(viewId) {
      const views = ['tvViewLobby', 'tvViewPhase1', 'tvViewPhase2', 'tvViewPhase3', 'tvViewPhase4', 'tvViewPhase5'];
      views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
          if (v === viewId) el.classList.remove('d-none');
          else el.classList.add('d-none');
        }
      });
    },

    // ==========================================================================
    // FLUJO DE JUEGO (5 FASES)
    // ==========================================================================
    startMatch() {
      if (this.players.length < 3) return;
      this.roundIndex = 0;
      this.players.forEach(p => { p.score = 0; });
      this.startRound();
    },

    startRound() {
      this.strokesHistory = [];
      this.currentLiveStroke = null;
      this.votes = {};
      this.fakeGuess = '';
      this.players.forEach(p => {
        p.roundDelta = 0;
        p.strokesDone = 0;
      });

      // 1. Elegir Categoría y Palabra Secreta
      const categoriesPool = appState.catalog.categorias.filter(c => this.selectedCategoryIds.includes(c.id));
      const chosenCat = categoriesPool.length > 0 
        ? categoriesPool[Math.floor(Math.random() * categoriesPool.length)]
        : appState.catalog.categorias[0];
      
      this.currentCategory = chosenCat;
      const wordList = chosenCat.palabras;
      this.secretWord = wordList[Math.floor(Math.random() * wordList.length)];

      // 2. Elegir al azar al Falso Artista
      const fakeIdx = Math.floor(Math.random() * this.players.length);
      this.fakeArtistId = this.players[fakeIdx].id;

      // 3. Crear orden de turnos aleatorio para la ronda
      this.turnOrder = [...this.players].sort(() => Math.random() - 0.5).map(p => p.id);
      this.currentTurnIndex = 0;

      // Iniciar FASE 1: Reparto de Roles
      this.startPhase1();
    },

    // FASE 1: REPARTO SECRETO
    startPhase1() {
      this.showView('tvViewPhase1');
      SoundEffects.playRoleAssigned();

      document.getElementById('tvRoundNumPill').textContent = (this.roundIndex + 1);
      document.getElementById('tvCategoryName').textContent = `${this.currentCategory.icono} ${this.currentCategory.nombre.toUpperCase()}`;

      // Enviar a cada celular su rol en privado
      this.players.forEach(p => {
        const isFake = (p.id === this.fakeArtistId);
        try {
          p.peerConn.send({
            type: 'ROUND_ROLE_ASSIGNED',
            payload: {
              roundNumber: this.roundIndex + 1,
              categoryName: `${this.currentCategory.icono} ${this.currentCategory.nombre}`,
              isFakeArtist: isFake,
              secretWord: isFake ? null : this.secretWord
            }
          });
        } catch (e) {}
      });

      // Cuenta regresiva visual en la TV antes del dibujo
      let secondsLeft = 7;
      const countEl = document.getElementById('tvRoleCountdown');
      countEl.textContent = `Iniciando dibujo en ${secondsLeft}s...`;

      const timer = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          countEl.textContent = `Iniciando dibujo en ${secondsLeft}s...`;
        } else {
          clearInterval(timer);
          this.startPhase2();
        }
      }, 1000);
    },

    // FASE 2: LAS 2 VUELTAS DE DIBUJO (1 TRAZO POR TURNO)
    startPhase2() {
      this.showView('tvViewPhase2');
      this.renderTvCanvasHeader();
      this.renderTvPaletteSidebar();
      redibujarLienzo(this.tvCanvas, this.tvCtx, this.strokesHistory);

      this.promptNextTurn();
    },

    renderTvCanvasHeader() {
      const totalTurns = this.players.length * 2;
      const currentLap = Math.floor(this.currentTurnIndex / this.players.length) + 1;
      
      document.getElementById('tvLapBadge').textContent = `VUELTA ${currentLap} DE 2`;
      document.getElementById('tvGameCategory').textContent = `${this.currentCategory.icono} ${this.currentCategory.nombre}`;
      document.getElementById('tvStrokesCounter').textContent = `Trazo ${this.currentTurnIndex + 1} / ${totalTurns}`;

      const activePlayerId = this.turnOrder[this.currentTurnIndex % this.players.length];
      const activePlayer = this.players.find(p => p.id === activePlayerId);

      if (activePlayer) {
        document.getElementById('tvTurnAvatar').textContent = activePlayer.avatar;
        document.getElementById('tvTurnName').textContent = activePlayer.name;
        const dot = document.getElementById('tvTurnColorDot');
        dot.style.backgroundColor = activePlayer.color.hex;
        dot.style.color = activePlayer.color.hex;
      }
    },

    renderTvPaletteSidebar() {
      const paletteList = document.getElementById('tvPaletteList');
      if (!paletteList) return;
      paletteList.innerHTML = '';

      const activePlayerId = this.turnOrder[this.currentTurnIndex % this.players.length];

      this.players.forEach(p => {
        const row = document.createElement('div');
        const isActive = (p.id === activePlayerId);
        row.className = `palette-player-row ${isActive ? 'active-turn' : ''}`;
        row.innerHTML = `
          <div class="palette-left-info">
            <span class="palette-color-box" style="background-color: ${p.color.hex}; color: ${p.color.hex};"></span>
            <span style="font-size: 1.3rem;">${p.avatar}</span>
            <span class="palette-player-name">${p.name}</span>
          </div>
          <div class="stroke-status-dots">
            <span class="stroke-dot-pill ${p.strokesDone >= 1 ? 'done' : ''}" title="Vuelta 1"></span>
            <span class="stroke-dot-pill ${p.strokesDone >= 2 ? 'done' : ''}" title="Vuelta 2"></span>
          </div>
        `;
        paletteList.appendChild(row);
      });
    },

    promptNextTurn() {
      const totalTurns = this.players.length * 2;
      if (this.currentTurnIndex >= totalTurns) {
        // Fin de las 2 vueltas -> FASE 3: Debate y Votación
        this.startPhase3();
        return;
      }

      this.renderTvCanvasHeader();
      this.renderTvPaletteSidebar();

      const activePlayerId = this.turnOrder[this.currentTurnIndex % this.players.length];
      const activePlayer = this.players.find(p => p.id === activePlayerId);
      const currentLap = Math.floor(this.currentTurnIndex / this.players.length) + 1;

      // Notificar a todos los celulares del turno
      this.players.forEach(p => {
        const isMyTurn = (p.id === activePlayerId);
        try {
          p.peerConn.send({
            type: 'TURN_CHANGE',
            payload: {
              activePlayerId: activePlayerId,
              activePlayerName: activePlayer.name,
              activePlayerAvatar: activePlayer.avatar,
              activeColor: activePlayer.color,
              isMyTurn: isMyTurn,
              lap: currentLap,
              strokesHistory: this.strokesHistory
            }
          });
        } catch (e) {}
      });
    },

    handleLivePoint(payload) {
      // payload: { playerId, point: {x, y} }
      const activePlayerId = this.turnOrder[this.currentTurnIndex % this.players.length];
      if (payload.playerId !== activePlayerId) return;

      const player = this.players.find(p => p.id === payload.playerId);
      if (!player) return;

      if (!this.currentLiveStroke) {
        this.currentLiveStroke = {
          playerId: player.id,
          color: player.color.hex,
          points: []
        };
        document.getElementById('tvCanvasLiveIndicator')?.classList.remove('d-none');
      }

      this.currentLiveStroke.points.push(payload.point);
      redibujarLienzo(this.tvCanvas, this.tvCtx, this.strokesHistory, this.currentLiveStroke);
    },

    handleStrokeReset(payload) {
      this.currentLiveStroke = null;
      document.getElementById('tvCanvasLiveIndicator')?.classList.add('d-none');
      redibujarLienzo(this.tvCanvas, this.tvCtx, this.strokesHistory);
    },

    handleStrokeConfirmed(payload) {
      // payload: { playerId, stroke: { points } }
      const activePlayerId = this.turnOrder[this.currentTurnIndex % this.players.length];
      if (payload.playerId !== activePlayerId) return;

      const player = this.players.find(p => p.id === payload.playerId);
      if (player && payload.stroke && payload.stroke.points && payload.stroke.points.length > 0) {
        const finalStroke = {
          playerId: player.id,
          color: player.color.hex,
          points: payload.stroke.points
        };
        this.strokesHistory.push(finalStroke);
        player.strokesDone++;
        SoundEffects.playStrokeDone();
      }

      this.currentLiveStroke = null;
      document.getElementById('tvCanvasLiveIndicator')?.classList.add('d-none');
      redibujarLienzo(this.tvCanvas, this.tvCtx, this.strokesHistory);

      this.currentTurnIndex++;
      this.promptNextTurn();
    },

    // FASE 3: DEBATE Y VOTACIÓN SECRETA
    startPhase3() {
      this.showView('tvViewPhase3');
      redibujarLienzo(this.debateCanvas, this.debateCtx, this.strokesHistory);

      this.votes = {};
      this.renderTvDebateSidebar();

      // Enviar a los celulares la pantalla de votación (candidatos excepto uno mismo)
      this.players.forEach(voter => {
        const candidates = this.players
          .filter(p => p.id !== voter.id)
          .map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            color: p.color
          }));

        try {
          voter.peerConn.send({
            type: 'START_VOTING',
            payload: {
              candidates: candidates
            }
          });
        } catch (e) {}
      });
    },

    renderTvDebateSidebar() {
      const votesCount = Object.keys(this.votes).length;
      const total = this.players.length;
      const pct = Math.round((votesCount / total) * 100);

      document.getElementById('tvVotesCountLabel').textContent = `${votesCount} / ${total} votos emitidos`;
      document.getElementById('tvVotesProgressBar').style.width = `${pct}%`;

      const listEl = document.getElementById('tvDebatePaletteList');
      if (!listEl) return;
      listEl.innerHTML = '';

      this.players.forEach(p => {
        const hasVoted = !!this.votes[p.id];
        const row = document.createElement('div');
        row.className = 'palette-player-row';
        row.innerHTML = `
          <div class="palette-left-info">
            <span class="palette-color-box" style="background-color: ${p.color.hex}; color: ${p.color.hex};"></span>
            <span style="font-size: 1.2rem;">${p.avatar}</span>
            <span class="palette-player-name">${p.name}</span>
          </div>
          <span style="font-size: 1.1rem;">${hasVoted ? '✅' : '⏳'}</span>
        `;
        listEl.appendChild(row);
      });
    },

    registerVote(voterId, candidateId) {
      if (!this.votes[voterId]) {
        this.votes[voterId] = candidateId;
        this.renderTvDebateSidebar();

        // Si todos votaron -> FASE 4: Revelación
        if (Object.keys(this.votes).length === this.players.length) {
          setTimeout(() => this.startPhase4(), 1000);
        }
      }
    },

    // FASE 4: REVELACIÓN Y ÚLTIMA OPORTUNIDAD
    startPhase4() {
      this.showView('tvViewPhase4');
      SoundEffects.playDrumroll();

      // Notificar a celulares que se está revelando
      this.broadcast({ type: 'START_REVEAL' });

      // Contabilizar votos
      const tally = {};
      this.players.forEach(p => { tally[p.id] = 0; });
      Object.values(this.votes).forEach(cid => {
        if (tally[cid] !== undefined) tally[cid]++;
      });

      // Renderizar grilla de votos en TV
      const gridEl = document.getElementById('tvVotesRevealGrid');
      gridEl.innerHTML = '';

      this.players.forEach(p => {
        const vCount = tally[p.id] || 0;
        const card = document.createElement('div');
        card.id = `voteCard_${p.id}`;
        card.className = `vote-reveal-card ${p.id === this.fakeArtistId ? 'is-fake-target' : ''}`;
        card.innerHTML = `
          <div class="vote-reveal-header">
            <div class="vote-reveal-player">
              <span class="color-dot" style="background-color: ${p.color.hex}; color: ${p.color.hex};"></span>
              <span style="font-size: 1.4rem;">${p.avatar}</span>
              <span>${p.name}</span>
            </div>
            <div class="vote-count-badge">${vCount} ${vCount === 1 ? 'voto' : 'votos'}</div>
          </div>
          <div class="progress" style="height: 8px; background: rgba(255,255,255,0.1);">
            <div class="progress-bar bg-danger" style="width: ${(vCount / this.players.length) * 100}%;"></div>
          </div>
        `;
        gridEl.appendChild(card);
      });

      // Calcular mayoría de votos
      const sortedByVotes = [...this.players].sort((a, b) => (tally[b.id] || 0) - (tally[a.id] || 0));
      const topVotes = tally[sortedByVotes[0].id] || 0;
      const topPlayers = sortedByVotes.filter(p => tally[p.id] === topVotes);

      const isFakeCaught = (topPlayers.length === 1 && topPlayers[0].id === this.fakeArtistId);
      const fakeArtist = this.players.find(p => p.id === this.fakeArtistId);

      // Ocultar zonas condicionales
      document.getElementById('tvFakeGuessStage').classList.add('d-none');
      document.getElementById('tvGuessComparisonBox').classList.add('d-none');
      document.getElementById('tvHostJudgeActions').classList.add('d-none');
      document.getElementById('btnTvShowScores').classList.add('d-none');

      document.getElementById('tvVerdictPlayerName').textContent = `${fakeArtist.avatar} ${fakeArtist.name}`;

      if (!isFakeCaught) {
        // CASO A: EL FALSO ARTISTA ESCAPÓ
        SoundEffects.playEscaped();
        document.getElementById('tvVerdictBadge').textContent = '🎉 ¡EL FALSO ARTISTA ESCAPÓ SIN SER DESCUBIERTO!';
        document.getElementById('tvVerdictDesc').innerHTML = `
          El grupo no logró una mayoría en su contra. Logró pasar desapercibido.<br>
          La palabra secreta era: <strong class="text-warning fs-3">${this.secretWord.toUpperCase()}</strong>.
        `;

        // Puntajes: +2 para el Falso Artista
        fakeArtist.score += 2;
        fakeArtist.roundDelta = 2;

        document.getElementById('btnTvShowScores').classList.remove('d-none');
      } else {
        // CASO B: EL FALSO ARTISTA FUE ATRAPADO (ÚLTIMA OPORTUNIDAD)
        SoundEffects.playCaught();
        document.getElementById('tvVerdictBadge').textContent = '🚨 ¡ATRAPARON AL FALSO ARTISTA!';
        document.getElementById('tvVerdictDesc').textContent = 
          'Pero tiene 1 ÚLTIMA OPORTUNIDAD: si adivina qué estaban dibujando, ¡les roba la victoria a todos!';

        document.getElementById('tvFakeGuessStage').classList.remove('d-none');
        document.getElementById('tvGuessWaitBadge').classList.remove('d-none');

        // Notificar al Falso Artista para que ingrese la palabra
        try {
          fakeArtist.peerConn.send({
            type: 'PROMPT_FAKE_GUESS'
          });
        } catch (e) {}

        // Notificar a los demás que esperen
        this.players.filter(p => p.id !== this.fakeArtistId).forEach(p => {
          try {
            p.peerConn.send({
              type: 'WAIT_FOR_FAKE_GUESS',
              payload: { fakeArtistName: fakeArtist.name }
            });
          } catch (e) {}
        });
      }
    },

    handleFakeGuessSubmission(guess) {
      this.fakeGuess = (guess || '').trim();
      const fakeArtist = this.players.find(p => p.id === this.fakeArtistId);

      document.getElementById('tvGuessWaitBadge').classList.add('d-none');
      document.getElementById('tvGuessComparisonBox').classList.remove('d-none');
      document.getElementById('tvFakeGuessValue').textContent = `"${this.fakeGuess}"`;
      document.getElementById('tvRealWordValue').textContent = `"${this.secretWord}"`;

      // Comprobación automática normalizada
      const normGuess = normalizarTexto(this.fakeGuess);
      const normReal = normalizarTexto(this.secretWord);

      if (normGuess === normReal) {
        // Acierto automático exacto!
        this.resolveFakeGuess(true);
      } else {
        // Mostrar botones de validación en la TV y al VIP
        document.getElementById('tvHostJudgeActions').classList.remove('d-none');
        const vipPlayer = this.players.find(p => p.isVip);
        if (vipPlayer) {
          try {
            vipPlayer.peerConn.send({
              type: 'VIP_JUDGE_PROMPT',
              payload: {
                fakeGuess: this.fakeGuess,
                realWord: this.secretWord
              }
            });
          } catch (e) {}
        }
      }
    },

    resolveFakeGuess(isValid) {
      document.getElementById('tvHostJudgeActions').classList.add('d-none');
      const fakeArtist = this.players.find(p => p.id === this.fakeArtistId);

      if (isValid) {
        SoundEffects.playEscaped();
        document.getElementById('tvVerdictDesc').innerHTML = `
          🎯 <strong>¡EL FALSO ARTISTA ADIVINÓ LA PALABRA!</strong> Roba la victoria (+2 pts).
        `;
        fakeArtist.score += 2;
        fakeArtist.roundDelta = 2;
      } else {
        SoundEffects.playVictory();
        document.getElementById('tvVerdictDesc').innerHTML = `
          ❌ <strong>¡PALABRA INCORRECTA!</strong> Ganan los Artistas Reales (+2 pts para cada uno).
        `;
        this.players.filter(p => p.id !== this.fakeArtistId).forEach(p => {
          p.score += 2;
          p.roundDelta = 2;
        });
      }

      document.getElementById('btnTvShowScores').classList.remove('d-none');
    },

    // FASE 5: TABLA DE POSICIONES Y PODIO
    startPhase5() {
      this.showView('tvViewPhase5');
      const isFinal = (this.roundIndex + 1 >= this.totalRounds);

      if (isFinal) {
        Confetti.start(6000);
        SoundEffects.playVictory();
        document.getElementById('tvScoresPill').textContent = 'PODIO FINAL';
        document.getElementById('tvScoresTitle').textContent = '🏆 ¡GANADORES DE LA PARTIDA!';
        document.getElementById('btnTvNextRound').classList.add('d-none');
        document.getElementById('btnTvRestartGame').classList.remove('d-none');
      } else {
        document.getElementById('tvScoresPill').textContent = `RONDA ${this.roundIndex + 1} DE ${this.totalRounds}`;
        document.getElementById('tvScoresTitle').textContent = 'PUNTAJES ACUMULADOS';
        document.getElementById('btnTvNextRound').classList.remove('d-none');
        document.getElementById('btnTvRestartGame').classList.add('d-none');
      }

      // Ordenar por puntaje
      const ranking = [...this.players].sort((a, b) => b.score - a.score);
      const tableEl = document.getElementById('tvLeaderboardTable');
      tableEl.innerHTML = '';

      ranking.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = `leaderboard-row ${idx === 0 ? 'rank-1' : ''}`;
        row.innerHTML = `
          <div class="leaderboard-user">
            <span class="rank-number">#${idx + 1}</span>
            <span class="color-dot" style="background-color: ${p.color.hex}; color: ${p.color.hex};"></span>
            <span style="font-size: 1.8rem;">${p.avatar}</span>
            <span class="leaderboard-name">${p.name} ${p.isVip ? '👑' : ''}</span>
          </div>
          <div class="leaderboard-score">
            <span>${p.score} PTS</span>
            <span class="score-delta-chip">+${p.roundDelta}</span>
          </div>
        `;
        tableEl.appendChild(row);
      });

      // Notificar a celulares los resultados personales
      ranking.forEach((p, idx) => {
        try {
          p.peerConn.send({
            type: 'ROUND_RESULTS',
            payload: {
              rank: idx + 1,
              score: p.score,
              delta: p.roundDelta,
              isFinal: isFinal,
              roundIndex: this.roundIndex + 1,
              totalRounds: this.totalRounds
            }
          });
        } catch (e) {}
      });
    },

    nextRound() {
      this.roundIndex++;
      if (this.roundIndex < this.totalRounds) {
        this.startRound();
      } else {
        this.startPhase5();
      }
    },

    restartGame() {
      this.roundIndex = 0;
      this.players.forEach(p => { p.score = 0; });
      this.startRound();
    }
  };

  // ============================================================================
  // CONTROLADOR DE CELULAR (MANDO PRIVADO Y LIENZO TÁCTIL)
  // ============================================================================
  const PhoneClient = {
    conn: null,
    playerId: null,
    name: '',
    avatar: '🦊',
    color: null,
    isVip: false,

    isMyTurn: false,
    hasDrawnThisTurn: false,
    currentStrokePoints: [],
    lastSentTimestamp: 0,

    phoneCanvas: null,
    phoneCtx: null,

    init(preloadedRoomCode = '') {
      appState.mode = 'PHONE';
      document.getElementById('screenLanding').classList.remove('active');
      document.getElementById('screenLanding').classList.add('d-none');
      document.getElementById('screenPhone').classList.remove('d-none');
      document.getElementById('screenPhone').classList.add('active');

      this.phoneCanvas = document.getElementById('phoneDrawingCanvas');
      if (this.phoneCanvas) this.phoneCtx = this.phoneCanvas.getContext('2d');

      this.renderAvatarPicker();
      this.bindEvents();

      if (preloadedRoomCode) {
        const inputRoom = document.getElementById('inputPhoneRoom');
        if (inputRoom) inputRoom.value = preloadedRoomCode.toUpperCase();
      }

      this.showView('phoneViewJoin');
    },

    renderAvatarPicker() {
      const container = document.getElementById('phoneAvatarPicker');
      if (!container) return;
      container.innerHTML = '';

      AVATARS.forEach((av, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `avatar-opt-btn ${i === 0 ? 'active' : ''}`;
        btn.textContent = av;
        btn.addEventListener('click', () => {
          container.querySelectorAll('.avatar-opt-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          document.getElementById('inputPhoneAvatar').value = av;
          this.avatar = av;
        });
        container.appendChild(btn);
      });
    },

    bindEvents() {
      document.getElementById('btnPhoneJoin')?.addEventListener('click', () => {
        this.attemptJoin();
      });

      document.getElementById('btnToggleRolePeek')?.addEventListener('click', () => {
        this.toggleRolePeek();
      });

      document.getElementById('phoneRolePeekCard')?.addEventListener('click', () => {
        this.toggleRolePeek();
      });

      // Botones de trazo
      document.getElementById('btnPhoneRedoStroke')?.addEventListener('click', () => {
        this.redoCurrentStroke();
      });

      document.getElementById('btnPhoneConfirmStroke')?.addEventListener('click', () => {
        this.confirmCurrentStroke();
      });

      // Respuesta del Falso Artista
      document.getElementById('btnPhoneSubmitGuess')?.addEventListener('click', () => {
        const guess = document.getElementById('inputFakeGuess').value.trim();
        if (guess) {
          this.send({ type: 'SUBMIT_FAKE_GUESS', payload: { guess: guess } });
          document.getElementById('phoneFakeGuessForm').classList.add('d-none');
          document.getElementById('phoneWaitGuessBox').classList.remove('d-none');
          document.getElementById('phoneWaitGuessBox').querySelector('h4').textContent = 'Respuesta enviada';
          document.getElementById('phoneWaitGuessBox').querySelector('p').textContent = 'Mirá la TV para ver el veredicto...';
        }
      });

      // Juez VIP Celular
      document.getElementById('btnPhoneVipAccept')?.addEventListener('click', () => {
        this.send({ type: 'VIP_JUDGE_RESULT', payload: { isValid: true } });
        document.getElementById('phoneVipJudgeBox').classList.add('d-none');
      });

      document.getElementById('btnPhoneVipReject')?.addEventListener('click', () => {
        this.send({ type: 'VIP_JUDGE_RESULT', payload: { isValid: false } });
        document.getElementById('phoneVipJudgeBox').classList.add('d-none');
      });

      // VIP Iniciar Partida
      document.getElementById('btnPhoneVipStart')?.addEventListener('click', () => {
        this.send({ type: 'VIP_START_MATCH' });
      });

      // VIP Siguiente Ronda
      document.getElementById('btnPhoneVipNextRound')?.addEventListener('click', () => {
        this.send({ type: 'VIP_NEXT_ROUND' });
      });

      document.getElementById('btnPhoneVipRestart')?.addEventListener('click', () => {
        this.send({ type: 'VIP_RESTART_MATCH' });
      });

      // Cambio de sala
      document.getElementById('btnChangeRoomPhone')?.addEventListener('click', () => {
        sessionStorage.removeItem('falso_artista_room');
        limpiarConexionPrevia();
        this.showView('phoneViewJoin');
      });

      // Manejador del Lienzo Táctil (Pointer Events)
      this.bindCanvasTouchEvents();
    },

    bindCanvasTouchEvents() {
      if (!this.phoneCanvas) return;

      const canvas = this.phoneCanvas;

      canvas.addEventListener('pointerdown', (e) => {
        if (!this.isMyTurn || this.hasDrawnThisTurn) return;
        canvas.setPointerCapture(e.pointerId);

        const coords = obtenerCoordenadas(canvas, e);
        this.currentStrokePoints = [coords];

        // Dibujar localmente
        renderizarTrazo(this.phoneCtx, { color: this.color.hex, points: this.currentStrokePoints });

        // Enviar a la TV
        this.send({
          type: 'DRAW_LIVE_POINT',
          payload: { playerId: this.playerId, point: coords }
        });
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!this.isMyTurn || this.hasDrawnThisTurn || this.currentStrokePoints.length === 0) return;

        const coords = obtenerCoordenadas(canvas, e);
        this.currentStrokePoints.push(coords);

        // Render local suave
        renderizarTrazo(this.phoneCtx, { color: this.color.hex, points: this.currentStrokePoints });

        // Throttled ~25ms hacia la TV
        const now = Date.now();
        if (now - this.lastSentTimestamp > 25) {
          this.lastSentTimestamp = now;
          this.send({
            type: 'DRAW_LIVE_POINT',
            payload: { playerId: this.playerId, point: coords }
          });
        }
      });

      const handlePointerEnd = (e) => {
        if (!this.isMyTurn || this.hasDrawnThisTurn || this.currentStrokePoints.length === 0) return;

        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

        // Enviar último punto si lo hubo
        const coords = obtenerCoordenadas(canvas, e);
        this.currentStrokePoints.push(coords);
        this.send({
          type: 'DRAW_LIVE_POINT',
          payload: { playerId: this.playerId, point: coords }
        });

        // 1 ÚNICO TRAZO: Bloquear lienzo y mostrar acciones
        this.hasDrawnThisTurn = true;
        document.getElementById('phoneCanvasOverlayLock')?.classList.remove('d-none');
        document.getElementById('phoneStrokeActions')?.classList.remove('d-none');
      };

      canvas.addEventListener('pointerup', handlePointerEnd);
      canvas.addEventListener('pointercancel', handlePointerEnd);
    },

    redoCurrentStroke() {
      this.currentStrokePoints = [];
      this.hasDrawnThisTurn = false;

      // Ocultar acciones y desbloquear
      document.getElementById('phoneStrokeActions')?.classList.add('d-none');
      document.getElementById('phoneCanvasOverlayLock')?.classList.add('d-none');

      // Avisar a la TV que resetee el trazo en vivo
      this.send({ type: 'STROKE_RESET', payload: { playerId: this.playerId } });

      // Redibujar historial
      redibujarLienzo(this.phoneCanvas, this.phoneCtx, this.cachedStrokesHistory || []);
    },

    confirmCurrentStroke() {
      if (this.currentStrokePoints.length === 0) return;

      this.isMyTurn = false;
      document.getElementById('phoneStrokeActions')?.classList.add('d-none');
      document.getElementById('phoneTurnBanner').textContent = '✅ Trazo confirmado. Turno terminado.';
      document.getElementById('phoneTurnStatusBadge').className = 'phone-my-turn-badge';
      document.getElementById('phoneTurnStatusBadge').textContent = '👀 Mirá la TV';

      this.send({
        type: 'STROKE_CONFIRMED',
        payload: {
          playerId: this.playerId,
          stroke: { points: this.currentStrokePoints }
        }
      });
      this.currentStrokePoints = [];
    },

    toggleRolePeek() {
      const hidden = document.getElementById('phoneRoleHiddenState');
      const visible = document.getElementById('phoneRoleVisibleState');
      if (hidden.classList.contains('d-none')) {
        hidden.classList.remove('d-none');
        visible.classList.add('d-none');
      } else {
        hidden.classList.add('d-none');
        visible.classList.remove('d-none');
      }
    },

    attemptJoin() {
      const roomInput = document.getElementById('inputPhoneRoom').value.trim().toUpperCase();
      const nameInput = document.getElementById('inputPhoneName').value.trim();
      const alertBox = document.getElementById('phoneJoinAlert');

      if (roomInput.length !== 4) {
        alertBox.textContent = 'Por favor ingresá un código de sala de 4 letras.';
        alertBox.classList.remove('d-none');
        return;
      }
      if (!nameInput) {
        alertBox.textContent = 'Por favor ingresá tu nombre o apodo.';
        alertBox.classList.remove('d-none');
        return;
      }

      alertBox.classList.add('d-none');
      appState.roomCode = roomInput;
      this.name = nameInput;
      this.avatar = document.getElementById('inputPhoneAvatar').value || '🦊';

      sessionStorage.setItem('falso_artista_room', roomInput);
      this.connectToTv(roomInput);
    },

    connectToTv(roomCode) {
      limpiarConexionPrevia();
      const alertBox = document.getElementById('phoneJoinAlert');

      const peer = new Peer({ debug: 1 });
      appState.peer = peer;

      peer.on('open', (myId) => {
        const targetId = PEER_PREFIX + roomCode;
        const conn = peer.connect(targetId, { reliable: true });
        this.conn = conn;

        conn.on('open', () => {
          console.log('Conectado a la TV:', roomCode);
          this.send({
            type: 'JOIN_GAME',
            payload: { name: this.name, avatar: this.avatar }
          });

          // Heartbeat cada 5 segundos
          appState.heartbeatInterval = setInterval(() => {
            if (this.conn && this.conn.open) {
              this.conn.send({ type: 'PING' });
            }
          }, 5000);
        });

        conn.on('data', (data) => {
          this.handleTvMessage(data);
        });

        conn.on('close', () => {
          this.handlePeerUnavailable(roomCode);
        });

        conn.on('error', () => {
          this.handlePeerUnavailable(roomCode);
        });
      });

      peer.on('error', (err) => {
        console.error('Error Peer Celular:', err);
        if (err.type === 'peer-unavailable') {
          this.handlePeerUnavailable(roomCode);
        } else {
          alertBox.textContent = 'Error de conexión. Verificá tu red o código.';
          alertBox.classList.remove('d-none');
        }
      });
    },

    handlePeerUnavailable(roomCode) {
      sessionStorage.removeItem('falso_artista_room');
      limpiarConexionPrevia();
      this.showView('phoneViewJoin');

      const alertEl = document.getElementById('phoneJoinAlert');
      alertEl.innerHTML = `
        <div>⚠️ La sala <strong>${roomCode}</strong> no existe o se cerró.</div>
        <button type="button" class="btn btn-sm btn-outline-light mt-2" id="btnRetryOtherRoom">🔄 Conectar a otra sala</button>
      `;
      alertEl.classList.remove('d-none');

      document.getElementById('btnRetryOtherRoom')?.addEventListener('click', () => {
        alertEl.classList.add('d-none');
        const input = document.getElementById('inputPhoneRoom');
        if (input) {
          input.value = '';
          input.focus();
        }
      });
    },

    send(msg) {
      if (this.conn && this.conn.open) {
        try {
          this.conn.send(msg);
        } catch (e) {
          console.warn('Error enviando mensaje a TV:', e);
        }
      }
    },

    handleTvMessage(msg) {
      switch (msg.type) {
        case 'JOIN_ACCEPTED':
          this.onJoinAccepted(msg.payload);
          break;
        case 'JOIN_REJECTED':
          alert(msg.payload.reason);
          this.showView('phoneViewJoin');
          break;
        case 'ROSTER_UPDATE':
          this.updateLobbyPlayers(msg.payload);
          break;
        case 'ASSIGNED_VIP':
          this.isVip = true;
          document.getElementById('phoneVipPanel')?.classList.remove('d-none');
          document.getElementById('phoneWaitHostPanel')?.classList.add('d-none');
          break;
        case 'ROUND_ROLE_ASSIGNED':
          this.showPhase1Role(msg.payload);
          break;
        case 'TURN_CHANGE':
          this.onTurnChange(msg.payload);
          break;
        case 'START_VOTING':
          this.showPhase3Voting(msg.payload.candidates);
          break;
        case 'START_REVEAL':
          // Mostrar espera de revelación
          this.showView('phonePhase4');
          document.getElementById('phoneFakeGuessForm')?.classList.add('d-none');
          document.getElementById('phoneWaitGuessBox')?.classList.remove('d-none');
          break;
        case 'PROMPT_FAKE_GUESS':
          this.showView('phonePhase4');
          document.getElementById('phoneFakeGuessForm')?.classList.remove('d-none');
          document.getElementById('phoneWaitGuessBox')?.classList.add('d-none');
          break;
        case 'WAIT_FOR_FAKE_GUESS':
          this.showView('phonePhase4');
          document.getElementById('phoneFakeGuessForm')?.classList.add('d-none');
          document.getElementById('phoneWaitGuessBox')?.classList.remove('d-none');
          break;
        case 'VIP_JUDGE_PROMPT':
          document.getElementById('phoneJudgeSaid').textContent = `"${msg.payload.fakeGuess}"`;
          document.getElementById('phoneJudgeReal').textContent = `"${msg.payload.realWord}"`;
          document.getElementById('phoneVipJudgeBox')?.classList.remove('d-none');
          break;
        case 'ROUND_RESULTS':
          this.showPhase5Results(msg.payload);
          break;
      }
    },

    onJoinAccepted(data) {
      this.playerId = data.playerId;
      this.name = data.name;
      this.avatar = data.avatar;
      this.color = data.color;
      this.isVip = data.isVip;

      document.getElementById('phoneMyAvatar').textContent = this.avatar;
      document.getElementById('phoneMyName').textContent = this.name;
      document.getElementById('phoneRoomLabel').textContent = data.roomCode;
      
      const dot = document.getElementById('phoneMyColorDot');
      dot.style.backgroundColor = this.color.hex;
      dot.style.color = this.color.hex;
      document.getElementById('phoneMyColorName').textContent = this.color.name;

      if (this.isVip) {
        document.getElementById('phoneVipPanel').classList.remove('d-none');
        document.getElementById('phoneWaitHostPanel').classList.add('d-none');
        this.renderVipCategoryToggles(data.categories);
      } else {
        document.getElementById('phoneVipPanel').classList.add('d-none');
        document.getElementById('phoneWaitHostPanel').classList.remove('d-none');
      }

      this.showView('phoneViewLobby');
    },

    renderVipCategoryToggles(categories) {
      const container = document.getElementById('phoneCategoryToggles');
      if (!container || !categories) return;
      container.innerHTML = '';

      const selectedIds = categories.map(c => c.id);

      categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cat-check-btn active';
        btn.innerHTML = `<span>${cat.icono}</span> <span>${cat.nombre}</span>`;
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          const isAct = btn.classList.contains('active');
          if (isAct) {
            if (!selectedIds.includes(cat.id)) selectedIds.push(cat.id);
          } else {
            const idx = selectedIds.indexOf(cat.id);
            if (idx !== -1) selectedIds.splice(idx, 1);
          }
          PhoneClient.send({
            type: 'VIP_SETTINGS',
            payload: { categoryIds: selectedIds }
          });
        });
        container.appendChild(btn);
      });

      // Botones de rondas
      document.querySelectorAll('.btn-round-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-round-opt').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const r = btn.getAttribute('data-rounds');
          PhoneClient.send({
            type: 'VIP_SETTINGS',
            payload: { totalRounds: r }
          });
        });
      });
    },

    updateLobbyPlayers(data) {
      const listEl = document.getElementById('phonePlayersList');
      const countEl = document.getElementById('phonePlayersCount');
      if (countEl) countEl.textContent = data.players.length;

      if (listEl) {
        listEl.innerHTML = '';
        data.players.forEach(p => {
          const pill = document.createElement('span');
          pill.className = 'phone-player-pill';
          pill.innerHTML = `
            <span class="color-dot" style="background-color: ${p.color.hex}; color: ${p.color.hex};"></span>
            <span>${p.avatar} ${p.name} ${p.isVip ? '👑' : ''}</span>
          `;
          listEl.appendChild(pill);
        });
      }

      const btnStart = document.getElementById('btnPhoneVipStart');
      if (btnStart) {
        btnStart.disabled = !data.canStart;
        btnStart.innerHTML = data.canStart
          ? '<span>▶️ ¡Arrancar Partida!</span>'
          : `<span>Esperando jugadores (${data.players.length}/3)</span>`;
      }
    },

    showPhase1Role(data) {
      this.showView('phonePhase1');
      document.getElementById('phoneRoundNum').textContent = data.roundNumber;
      document.getElementById('phoneMyCategory').textContent = data.categoryName;

      const pill = document.getElementById('phoneMyRolePill');
      const word = document.getElementById('phoneMySecretWord');
      const advice = document.getElementById('phoneMyRoleAdvice');

      // Ocultar peek por defecto
      document.getElementById('phoneRoleHiddenState').classList.remove('d-none');
      document.getElementById('phoneRoleVisibleState').classList.add('d-none');

      if (data.isFakeArtist) {
        pill.className = 'role-badge-pill role-fake-artist';
        pill.textContent = '🕵️ ¡SOS EL FALSO ARTISTA!';
        word.textContent = '??? (Oculta)';
        advice.textContent = 'Mirate los primeros trazos y disimulá como si supieras qué están dibujando.';
      } else {
        pill.className = 'role-badge-pill role-real-artist';
        pill.textContent = '🎨 ARTISTA REAL';
        word.textContent = data.secretWord.toUpperCase();
        advice.textContent = 'Hacé un trazo que demuestre que sabés la palabra sin hacérsela demasiado obvia al impostor.';
      }

      // Guardar palabra para recordatorio en fase 2
      this.cachedSecretWord = data.secretWord;
      this.isFakeArtist = data.isFakeArtist;
    },

    onTurnChange(data) {
      this.showView('phonePhase2');
      this.cachedStrokesHistory = data.strokesHistory || [];

      document.getElementById('phoneDrawRoundLabel').textContent = `V${data.lap}`;
      document.getElementById('phoneDrawLapLabel').textContent = `Vuelta ${data.lap} de 2`;

      // Recordatorio de palabra
      const reminder = document.getElementById('phoneWordReminder');
      const reminderWord = document.getElementById('phoneReminderWord');
      if (this.isFakeArtist) {
        reminderWord.textContent = '??? (Sos el Falso Artista)';
      } else if (this.cachedSecretWord) {
        reminderWord.textContent = this.cachedSecretWord.toUpperCase();
      }

      this.isMyTurn = data.isMyTurn;
      this.hasDrawnThisTurn = false;
      this.currentStrokePoints = [];

      // Redibujar historial en canvas
      redibujarLienzo(this.phoneCanvas, this.phoneCtx, this.cachedStrokesHistory);

      const banner = document.getElementById('phoneTurnBanner');
      const badge = document.getElementById('phoneTurnStatusBadge');
      const overlayLock = document.getElementById('phoneCanvasOverlayLock');
      const actions = document.getElementById('phoneStrokeActions');

      actions.classList.add('d-none');

      if (this.isMyTurn) {
        badge.className = 'phone-my-turn-badge is-my-turn';
        badge.textContent = '✏️ ¡TU TURNO!';
        banner.innerHTML = '✏️ ¡Tu turno! Apoyá el dedo y hacé <strong>UN SOLO TRAZO</strong> continuo';
        overlayLock.classList.add('d-none');
      } else {
        badge.className = 'phone-my-turn-badge';
        badge.textContent = '👀 Mirá la TV';
        banner.innerHTML = `Turno de <strong>${data.activePlayerAvatar} ${data.activePlayerName}</strong>. Mirá su trazo...`;
        overlayLock.classList.remove('d-none');
        overlayLock.textContent = `Turno de ${data.activePlayerName}...`;
      }
    },

    showPhase3Voting(candidates) {
      this.showView('phonePhase3');
      const listEl = document.getElementById('phoneVoteList');
      const confirmedMsg = document.getElementById('phoneVoteConfirmedMsg');

      listEl.classList.remove('d-none');
      confirmedMsg.classList.add('d-none');
      listEl.innerHTML = '';

      candidates.forEach(cand => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vote-candidate-btn';
        btn.innerHTML = `
          <div>
            <span class="candidate-avatar">${cand.avatar}</span>
            <span>${cand.name}</span>
          </div>
          <span class="candidate-swatch" style="background-color: ${cand.color.hex};"></span>
        `;
        btn.addEventListener('click', () => {
          listEl.querySelectorAll('.vote-candidate-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          if (confirm(`¿Confirmás tu voto acusando a ${cand.name}?`)) {
            listEl.classList.add('d-none');
            confirmedMsg.classList.remove('d-none');
            PhoneClient.send({
              type: 'SUBMIT_VOTE',
              payload: { voterId: PhoneClient.playerId, candidateId: cand.id }
            });
          }
        });
        listEl.appendChild(btn);
      });
    },

    showPhase5Results(data) {
      this.showView('phonePhase5');
      document.getElementById('phoneMyRankBadge').textContent = `#${data.rank}`;
      document.getElementById('phoneMyTotalScore').textContent = data.score;
      document.getElementById('phoneMyScoreDelta').textContent = `+${data.delta} pts en esta ronda`;

      const breakdown = document.getElementById('phoneRoundBreakdown');
      breakdown.textContent = data.delta > 0
        ? '🎉 ¡Sumaste puntos en esta ronda!'
        : 'Esta ronda no sumaste puntos. ¡A prepararse para la próxima!';

      const vipWrap = document.getElementById('phoneVipNextWrap');
      if (this.isVip) {
        vipWrap.classList.remove('d-none');
        const btnNext = document.getElementById('btnPhoneVipNextRound');
        const btnRestart = document.getElementById('btnPhoneVipRestart');

        if (data.isFinal) {
          btnNext.classList.add('d-none');
          btnRestart.classList.remove('d-none');
        } else {
          btnNext.classList.remove('d-none');
          btnRestart.classList.add('d-none');
        }
      } else {
        vipWrap.classList.add('d-none');
      }
    },

    showView(viewId) {
      const views = ['phoneViewJoin', 'phoneViewLobby', 'phonePhase1', 'phonePhase2', 'phonePhase3', 'phonePhase4', 'phonePhase5'];
      views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
          if (v === viewId) el.classList.remove('d-none');
          else el.classList.add('d-none');
        }
      });
    }
  };

  // ============================================================================
  // PANTALLA COMPLETA Y CONTROL DE AUDIO EN HEADER
  // ============================================================================
  function setupHeaderControls() {
    const btnSound = document.getElementById('btnToggleSound');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        SoundEffects.toggle();
      });
    }

    const btnFs = document.getElementById('btnToggleFs');
    const fsIcon = document.getElementById('fsIcon');

    function isFs() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
    }

    if (btnFs) {
      btnFs.addEventListener('click', () => {
        if (!isFs()) {
          const docEl = document.documentElement;
          if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
          else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      });
    }

    const updateFsIcon = () => {
      if (fsIcon) fsIcon.textContent = isFs() ? '🪟' : '📺';
    };
    document.addEventListener('fullscreenchange', updateFsIcon);
    document.addEventListener('webkitfullscreenchange', updateFsIcon);
  }

  // ============================================================================
  // CARGA DE DATOS Y ENTRADA PRINCIPAL
  // ============================================================================
  async function cargarCatalogoPalabras() {
    if (window.PALABRAS_FALSO_ARTISTA) {
      appState.catalog = window.PALABRAS_FALSO_ARTISTA;
      return;
    }
    try {
      const resp = await fetch('data/palabras.json');
      appState.catalog = await resp.json();
    } catch (e) {
      console.error('Error cargando palabras.json:', e);
      // Fallback básico si falla el fetch
      appState.catalog = {
        categorias: [
          { id: 'animales', nombre: 'Animales', icono: '🐾', palabras: ['Jirafa', 'Pulpo', 'Pingüino', 'Camello', 'Canguro'] }
        ]
      };
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    Confetti.init();
    setupHeaderControls();
    await cargarCatalogoPalabras();

    // Detección automática por URL: si trae ?sala=XXXX va directo al celular
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('sala');

    if (roomParam) {
      const cleanRoom = roomParam.trim().toUpperCase();
      const storedRoom = (sessionStorage.getItem('falso_artista_room') || '').trim().toUpperCase();
      if (cleanRoom !== storedRoom) {
        sessionStorage.setItem('falso_artista_room', cleanRoom);
      }
      PhoneClient.init(cleanRoom);
    } else {
      // Pantalla de Portada
      document.getElementById('screenLanding').classList.add('active');

      document.getElementById('btnSelectTvMode')?.addEventListener('click', () => {
        SoundEffects.init();
        TvHost.init();
      });

      document.getElementById('btnSelectPhoneMode')?.addEventListener('click', () => {
        SoundEffects.init();
        PhoneClient.init();
      });

      document.getElementById('btnManualJoinRoom')?.addEventListener('click', () => {
        SoundEffects.init();
        const code = document.getElementById('inputManualRoomCode').value.trim();
        if (code.length === 4) {
          const clean = code.toUpperCase();
          sessionStorage.setItem('falso_artista_room', clean);
          PhoneClient.init(clean);
        } else {
          alert('Por favor ingresá un código de 4 letras.');
        }
      });
    }
  });

})();
