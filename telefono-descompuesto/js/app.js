/**
 * TELÉFONO DESCOMPUESTO - Motor de Juego y Conectividad PeerJS
 * Inspirado en Gartic Phone y Telestrations
 * Pantalla TV (Host) + Celulares (Mando Privado, Escribir, Dibujar y Adivinar)
 */

(function() {
  'use strict';

  // ============================================================================
  // CONSTANTES Y CONFIGURACIÓN
  // ============================================================================
  const PEER_PREFIX = 'tel-desc-';
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Paleta de 10 colores para la herramienta de dibujo
  const DRAWING_PALETTE = [
    { name: 'Negro', hex: '#111827' },
    { name: 'Gris', hex: '#6b7280' },
    { name: 'Rojo', hex: '#ef4444' },
    { name: 'Naranja', hex: '#f97316' },
    { name: 'Amarillo', hex: '#eab308' },
    { name: 'Verde', hex: '#22c55e' },
    { name: 'Celeste', hex: '#06b6d4' },
    { name: 'Azul', hex: '#2563eb' },
    { name: 'Violeta', hex: '#9333ea' },
    { name: 'Marrón', hex: '#854d0e' }
  ];

  // Paleta de colores para avatares de jugadores en el lobby
  const PLAYER_COLORS = [
    '#facc15', '#f43f5e', '#a855f7', '#06b6d4', '#10b981',
    '#f97316', '#3b82f6', '#ec4899', '#84cc16', '#6366f1'
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
      this.playTone(440, 0.12, 'triangle', 0.2);
      setTimeout(() => this.playTone(554.37, 0.15, 'triangle', 0.2), 70);
    },

    playPhaseStart() {
      if (!this.enabled) return;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((f, i) => {
        setTimeout(() => this.playTone(f, 0.2, 'triangle', 0.25), i * 90);
      });
    },

    playPlayerReady() {
      if (!this.enabled) return;
      this.playTone(880, 0.08, 'sine', 0.15);
      setTimeout(() => this.playTone(1174.66, 0.12, 'sine', 0.15), 60);
    },

    playTick() {
      if (!this.enabled) return;
      this.playTone(900, 0.04, 'square', 0.1);
    },

    playRevealText() {
      if (!this.enabled) return;
      this.playTone(392.00, 0.15, 'sine', 0.25);
      setTimeout(() => this.playTone(587.33, 0.25, 'triangle', 0.25), 80);
    },

    playRevealDrawing() {
      if (!this.enabled) return;
      this.playTone(330, 0.12, 'sawtooth', 0.2);
      setTimeout(() => this.playTone(493.88, 0.15, 'sawtooth', 0.2), 80);
      setTimeout(() => this.playTone(659.25, 0.25, 'triangle', 0.25), 160);
    },

    playApplause() {
      if (!this.enabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.35, 'triangle', 0.22), i * 130);
      });
    },

    playReaction() {
      if (!this.enabled) return;
      this.playTone(600 + Math.random() * 400, 0.12, 'sine', 0.15);
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
      const colors = ['#facc15', '#f43f5e', '#a855f7', '#06b6d4', '#10b981', '#f97316'];
      for (let i = 0; i < 110; i++) {
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

  function obtenerCoordenadas(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    };
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
    players: [], // { id, peerId, conn, name, avatar, color, isVip, isReady }
    
    // Configuración de la partida
    config: {
      phraseMode: 'free', // 'free' (Libre + Sugerencias) | 'cards' (Solo Cartas)
      timeWrite: 45,      // 0 (sin límite), 30, 45, 60
      timeDraw: 90,       // 0 (sin límite), 60, 90, 120
      chainLength: 'full' // 'full' (N pasos) | 'short' (máx 4 pasos)
    },

    stepIndex: 0,
    totalSteps: 0,
    timerSeconds: 0,
    timerInterval: null,

    // N Libretas simultáneas
    // cadenas[k]: { chainId, authorPlayerId, authorName, authorAvatar, eslabones: [ { tipo, autorId, autorName, autorAvatar, contenido } ] }
    cadenas: [],

    // Estado del Show Final
    showState: {
      albumIndex: 0,
      stepRevealIndex: 0,
      autoPlay: false,
      autoPlayInterval: null
    },

    init() {
      appState.mode = 'TV';
      document.getElementById('screenLanding').classList.remove('active');
      document.getElementById('screenLanding').classList.add('d-none');
      document.getElementById('screenTv').classList.remove('d-none');
      document.getElementById('screenTv').classList.add('active');

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
          setTimeout(() => this.setupPeer(), 1000);
        }
      });
    },

    renderQrCode() {
      const qrContainer = document.getElementById('tvQrContainer');
      if (!qrContainer) return;
      qrContainer.innerHTML = '';

      const url = new URL(window.location.href);
      url.searchParams.set('sala', appState.roomCode);
      const joinUrl = url.toString();

      document.getElementById('tvJoinUrlText').textContent = joinUrl;

      if (window.QRCode) {
        new QRCode(qrContainer, {
          text: joinUrl,
          width: 220,
          height: 220,
          colorDark: '#131127',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    },

    bindEvents() {
      document.getElementById('btnTvStartGame')?.addEventListener('click', () => {
        this.startMatch();
      });

      document.getElementById('btnTvNextShowStep')?.addEventListener('click', () => {
        this.revealNextShowStep();
      });

      document.getElementById('btnTvNextAlbum')?.addEventListener('click', () => {
        this.nextAlbum();
      });

      document.getElementById('btnTvAutoPlay')?.addEventListener('click', () => {
        this.toggleAutoPlay();
      });

      document.getElementById('btnTvDownloadComic')?.addEventListener('click', () => {
        this.downloadCurrentAlbumComic();
      });

      document.getElementById('btnTvRestartMatch')?.addEventListener('click', () => {
        this.restartMatch();
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
        console.warn('Error conexión jugador:', e);
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
        case 'SUBMIT_STEP_CONTENT':
          this.handleStepSubmission(msg.payload);
          break;
        case 'PLAYER_EDITING_AGAIN':
          this.handlePlayerResumeEdit(msg.payload.playerId);
          break;
        case 'SHOW_REACTION':
          this.spawnFloatingReaction(msg.payload.emoji, msg.payload.authorName);
          break;
        case 'VIP_SHOW_NEXT_STEP':
          this.revealNextShowStep();
          break;
        case 'VIP_SHOW_NEXT_ALBUM':
          this.nextAlbum();
          break;
        case 'VIP_RESTART_MATCH':
          this.restartMatch();
          break;
        case 'PING':
          try { conn.send({ type: 'PONG' }); } catch (e) {}
          break;
      }
    },

    registerPlayer(conn, info) {
      // Comprobar si es reconexión de un jugador previo
      const existing = this.players.find(p => (info.playerId && p.id === info.playerId) || (p.name.toLowerCase() === info.name.toLowerCase()));
      if (existing) {
        console.log('Reconexión de jugador:', existing.name);
        existing.peerId = conn.peer;
        existing.conn = conn;

        conn.send({
          type: 'JOIN_ACCEPTED',
          payload: {
            playerId: existing.id,
            name: existing.name,
            avatar: existing.avatar,
            color: existing.color,
            isVip: existing.isVip,
            roomCode: appState.roomCode,
            config: this.config
          }
        });

        // Si la partida ya empezó, reenviar tarea
        if (this.totalSteps > 0 && this.stepIndex < this.totalSteps) {
          this.syncPlayerStep(existing);
        }

        this.renderLobbyRoster();
        this.broadcastRoster();
        return;
      }

      if (this.players.length >= 10) {
        conn.send({ type: 'JOIN_REJECTED', payload: { reason: 'La sala está completa (máx. 10 jugadores)' } });
        return;
      }

      const isVip = this.players.length === 0;
      const assignedColor = PLAYER_COLORS[this.players.length % PLAYER_COLORS.length];

      const player = {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        peerId: conn.peer,
        conn: conn,
        name: (info.name || 'Jugador').trim().substring(0, 14),
        avatar: info.avatar || '🦊',
        color: assignedColor,
        isVip: isVip,
        isReady: false
      };

      this.players.push(player);
      SoundEffects.playJoin();

      conn.send({
        type: 'JOIN_ACCEPTED',
        payload: {
          playerId: player.id,
          name: player.name,
          avatar: player.avatar,
          color: player.color,
          isVip: player.isVip,
          roomCode: appState.roomCode,
          config: this.config
        }
      });

      this.renderLobbyRoster();
      this.broadcastRoster();
    },

    handlePlayerDisconnect(peerId) {
      const idx = this.players.findIndex(p => p.peerId === peerId);
      if (idx !== -1) {
        const p = this.players[idx];
        console.log('Jugador desconectado:', p.name);
        // Si no empezó la partida, eliminarlo
        if (this.totalSteps === 0) {
          this.players.splice(idx, 1);
          if (p.isVip && this.players.length > 0) {
            this.players[0].isVip = true;
            try { this.players[0].conn.send({ type: 'ASSIGNED_VIP' }); } catch (e) {}
          }
          this.renderLobbyRoster();
          this.broadcastRoster();
        }
      }
    },

    updateVipSettings(newCfg) {
      if (newCfg.phraseMode !== undefined) this.config.phraseMode = newCfg.phraseMode;
      if (newCfg.timeWrite !== undefined) this.config.timeWrite = parseInt(newCfg.timeWrite, 10);
      if (newCfg.timeDraw !== undefined) this.config.timeDraw = parseInt(newCfg.timeDraw, 10);
      if (newCfg.chainLength !== undefined) this.config.chainLength = newCfg.chainLength;

      this.updateTvConfigSummary();
      this.broadcast({
        type: 'SETTINGS_SYNC',
        payload: { config: this.config }
      });
    },

    updateTvConfigSummary() {
      document.getElementById('tvConfigPhraseMode').textContent = 
        this.config.phraseMode === 'free' ? '✍️ Libre + Sugerencias' : '🃏 Solo Cartas';

      const writeStr = this.config.timeWrite === 0 ? 'Sin límite' : `${this.config.timeWrite}s`;
      const drawStr = this.config.timeDraw === 0 ? 'Sin límite' : `${this.config.timeDraw}s`;
      document.getElementById('tvConfigTimers').textContent = `${writeStr} / ${drawStr}`;

      document.getElementById('tvConfigChainLength').textContent = 
        this.config.chainLength === 'full' ? '🔄 Vuelta Completa' : '⚡ Vuelta Corta (4)';
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
              <span class="color-dot" style="background-color: ${p.color};"></span>
              <span class="text-muted small">Listo para jugar</span>
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
        isVip: p.isVip
      }));

      this.broadcast({
        type: 'ROSTER_UPDATE',
        payload: {
          players: rosterData,
          canStart: this.players.length >= 3,
          config: this.config
        }
      });
    },

    broadcast(message) {
      this.players.forEach(p => {
        try {
          if (p.conn && p.conn.open) {
            p.conn.send(message);
          }
        } catch (e) {
          console.warn('Fallo al enviar mensaje a', p.name, e);
        }
      });
    },

    showView(viewId) {
      const views = ['tvViewLobby', 'tvViewGame', 'tvViewShow', 'tvViewEnd'];
      views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
          if (v === viewId) el.classList.remove('d-none');
          else el.classList.add('d-none');
        }
      });
    },

    // ==========================================================================
    // FLUJO DE JUEGO (CADENAS PARALELAS Y ROTACIÓN)
    // ==========================================================================
    startMatch() {
      if (this.players.length < 3) return;

      const N = this.players.length;
      this.totalSteps = this.config.chainLength === 'full' ? N : Math.min(4, N);
      this.stepIndex = 0;

      // Inicializar N libretas vacías
      this.cadenas = this.players.map((p, k) => ({
        chainId: k,
        authorPlayerId: p.id,
        authorName: p.name,
        authorAvatar: p.avatar,
        eslabones: []
      }));

      this.startStep(0);
    },

    startStep(s) {
      this.stepIndex = s;
      const N = this.players.length;

      // Resetear estado de listos
      this.players.forEach(p => { p.isReady = false; });

      // Determinar si en este paso toca Escribir o Dibujar
      // Paso 0: Texto inicial (o si es 'cards', frase sorteada)
      // Paso impar (1, 3, 5...): Dibujar el texto anterior
      // Paso par (2, 4, 6...): Adivinar/escribir el dibujo anterior
      const isDrawingStep = (s % 2 === 1);
      const phaseType = isDrawingStep ? 'DIBUJAR' : 'ESCRIBIR';

      this.showView('tvViewGame');
      SoundEffects.playPhaseStart();

      // Configurar encabezado de la TV
      document.getElementById('tvStepBadge').textContent = `PASO ${s + 1} DE ${this.totalSteps}`;
      document.getElementById('tvPhaseTypeBadge').textContent = isDrawingStep ? '🎨 DIBUJANDO' : '✍️ ESCRIBIENDO';

      const headline = document.getElementById('tvWorkHeadline');
      const subheadline = document.getElementById('tvWorkSubheadline');
      if (s === 0) {
        headline.textContent = '¡Todos Escribiendo su Frase Inicial!';
        subheadline.textContent = 'Inventen una situación absurda o toquen "Tirame una idea" en el celular.';
      } else if (isDrawingStep) {
        headline.textContent = '¡Todos Dibujando la Frase que les Tocó!';
        subheadline.textContent = 'Miren la frase en su celular y dibújenla con el dedo lo mejor que puedan.';
      } else {
        headline.textContent = '¡Todos Adivinando el Dibujo que les Llegó!';
        subheadline.textContent = 'Miren el dibujo anterior en su celular y escriban qué creen que está pasando.';
      }

      this.renderTvPlayersWorkGrid();

      // Configurar reloj
      const stepDuration = isDrawingStep ? this.config.timeDraw : this.config.timeWrite;
      this.startTimer(stepDuration);

      // Enviar a cada jugador su tarea correspondiente
      this.players.forEach((p, i) => {
        this.sendTaskToPlayer(p, i, s);
      });
    },

    sendTaskToPlayer(player, i, s) {
      const N = this.players.length;
      // Rotación: en el paso s, el jugador i recibe la libreta (i - s + N) % N
      const chainIdx = (i - s + N) % N;
      const cadena = this.cadenas[chainIdx];

      const isDrawingStep = (s % 2 === 1);
      const prevEslabon = s > 0 ? cadena.eslabones[s - 1] : null;

      let payload = {
        stepIndex: s,
        totalSteps: this.totalSteps,
        phaseType: isDrawingStep ? 'DIBUJAR' : 'ESCRIBIR',
        timerSeconds: isDrawingStep ? this.config.timeDraw : this.config.timeWrite,
        phraseMode: this.config.phraseMode,
        chainOwnerName: cadena.authorName,
        chainOwnerAvatar: cadena.authorAvatar,
        promptText: null,
        promptDrawing: null,
        randomIdea: null
      };

      if (s === 0) {
        // En paso 0, si es cards o si pide idea, proveer frase de data
        payload.randomIdea = this.getRandomPhrase();
      } else if (prevEslabon) {
        if (prevEslabon.tipo === 'TEXTO') {
          payload.promptText = prevEslabon.contenido;
        } else if (prevEslabon.tipo === 'DIBUJO') {
          payload.promptDrawing = prevEslabon.contenido;
        }
      }

      try {
        player.conn.send({
          type: 'START_STEP_TASK',
          payload: payload
        });
      } catch (e) {
        console.warn('Error enviando tarea a jugador:', player.name, e);
      }
    },

    syncPlayerStep(player) {
      const i = this.players.indexOf(player);
      if (i !== -1) {
        this.sendTaskToPlayer(player, i, this.stepIndex);
      }
    },

    getRandomPhrase() {
      if (!appState.catalog || !appState.catalog.categorias) {
        return 'Un carpincho tomando mate en una reposera';
      }
      const cats = appState.catalog.categorias;
      const cat = cats[Math.floor(Math.random() * cats.length)];
      return cat.frases[Math.floor(Math.random() * cat.frases.length)];
    },

    startTimer(seconds) {
      clearInterval(this.timerInterval);
      this.timerSeconds = seconds;

      const clockBadge = document.getElementById('tvClockBadge');
      const clockText = document.getElementById('tvClockText');

      if (seconds === 0) {
        clockBadge.classList.add('d-none');
        return;
      }

      clockBadge.classList.remove('d-none');
      clockText.textContent = `${seconds}s`;

      this.timerInterval = setInterval(() => {
        this.timerSeconds--;
        if (this.timerSeconds > 0) {
          clockText.textContent = `${this.timerSeconds}s`;
          if (this.timerSeconds <= 5) {
            SoundEffects.playTick();
          }
          this.broadcast({
            type: 'TIMER_TICK',
            payload: { remaining: this.timerSeconds }
          });
        } else {
          clearInterval(this.timerInterval);
          clockText.textContent = '0s';
          this.handleTimeout();
        }
      }, 1000);
    },

    handleTimeout() {
      // El tiempo terminó: enviar FORCE_SUBMIT a los jugadores pendientes
      const pendingPlayers = this.players.filter(p => !p.isReady);
      if (pendingPlayers.length > 0) {
        console.log('Tiempo agotado. Solicitando FORCE_SUBMIT a:', pendingPlayers.map(p => p.name));
        pendingPlayers.forEach(p => {
          try {
            p.conn.send({ type: 'FORCE_SUBMIT' });
          } catch (e) {}
        });

        // Esperar ventana de gracia de 1.8s para recepción de datos
        setTimeout(() => {
          // Si alguno no llegó a enviar, inyectar respuesta de emergencia
          this.players.forEach((p, i) => {
            if (!p.isReady) {
              const N = this.players.length;
              const chainIdx = (i - this.stepIndex + N) % N;
              const isDrawing = (this.stepIndex % 2 === 1);
              this.cadenas[chainIdx].eslabones[this.stepIndex] = {
                tipo: isDrawing ? 'DIBUJO' : 'TEXTO',
                autorId: p.id,
                autorName: p.name,
                autorAvatar: p.avatar,
                contenido: isDrawing ? this.getEmergencyDrawing() : 'Algo inexplicable'
              };
              p.isReady = true;
            }
          });
          this.checkStepCompletion();
        }, 1800);
      } else {
        this.checkStepCompletion();
      }
    },

    getEmergencyDrawing() {
      // Canvas blanco básico de emergencia con un garabato
      const c = document.createElement('canvas');
      c.width = CANVAS_WIDTH;
      c.height = CANVAS_HEIGHT;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏳ (Tiempo agotado)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      return c.toDataURL('image/jpeg', 0.7);
    },

    handleStepSubmission(payload) {
      // payload: { playerId, stepIndex, contentType, content }
      if (payload.stepIndex !== this.stepIndex) return;

      const i = this.players.findIndex(p => p.id === payload.playerId);
      if (i === -1) return;

      const player = this.players[i];
      const N = this.players.length;
      const chainIdx = (i - this.stepIndex + N) % N;

      // Guardar eslabón en la cadena correspondiente
      this.cadenas[chainIdx].eslabones[this.stepIndex] = {
        tipo: payload.contentType, // 'TEXTO' o 'DIBUJO'
        autorId: player.id,
        autorName: player.name,
        autorAvatar: player.avatar,
        contenido: payload.content
      };

      player.isReady = true;
      SoundEffects.playPlayerReady();
      this.renderTvPlayersWorkGrid();

      this.checkStepCompletion();
    },

    handlePlayerResumeEdit(playerId) {
      const player = this.players.find(p => p.id === playerId);
      if (player) {
        player.isReady = false;
        this.renderTvPlayersWorkGrid();
      }
    },

    renderTvPlayersWorkGrid() {
      const grid = document.getElementById('tvPlayersWorkGrid');
      const label = document.getElementById('tvReadyProgressLabel');
      if (!grid) return;
      grid.innerHTML = '';

      const readyCount = this.players.filter(p => p.isReady).length;
      const total = this.players.length;
      if (label) label.textContent = `${readyCount} / ${total} Listos`;

      this.players.forEach(p => {
        const card = document.createElement('div');
        card.className = `player-work-card ${p.isReady ? 'is-ready' : ''}`;
        card.innerHTML = `
          <div class="work-card-user">
            <span class="work-card-avatar">${p.avatar}</span>
            <span class="work-card-name">${p.name}</span>
          </div>
          <span class="work-card-status-pill ${p.isReady ? 'status-ready' : 'status-working'}">
            ${p.isReady ? '✅ ¡Listo!' : '🎨 Trabajando...'}
          </span>
        `;
        grid.appendChild(card);
      });
    },

    checkStepCompletion() {
      const allReady = this.players.every(p => p.isReady);
      if (allReady) {
        clearInterval(this.timerInterval);
        setTimeout(() => {
          if (this.stepIndex + 1 < this.totalSteps) {
            this.startStep(this.stepIndex + 1);
          } else {
            // ¡Todos los pasos de todas las libretas completados!
            this.startFinalShow();
          }
        }, 1200);
      }
    },

    // ==========================================================================
    // EL GRAN SHOW FINAL (EXHIBICIÓN DE HISTORIAS)
    // ==========================================================================
    startFinalShow() {
      this.showView('tvViewShow');
      SoundEffects.playApplause();

      this.showState.albumIndex = 0;
      this.showState.stepRevealIndex = 0;
      this.showState.autoPlay = false;
      clearInterval(this.showState.autoPlayInterval);

      // Notificar a celulares que pasaron al Show Final
      this.broadcast({
        type: 'START_FINAL_SHOW',
        payload: {
          totalAlbums: this.cadenas.length,
          albumIndex: 0
        }
      });

      this.renderAlbumHeader();
      this.revealNextShowStep();
    },

    renderAlbumHeader() {
      const cadena = this.cadenas[this.showState.albumIndex];
      document.getElementById('tvAlbumIndexPill').textContent = `ÁLBUM ${this.showState.albumIndex + 1} DE ${this.cadenas.length}`;
      document.getElementById('tvAlbumAuthorTitle').textContent = `Iniciado por ${cadena.authorAvatar} ${cadena.authorName}`;

      const streamEl = document.getElementById('tvChainStream');
      streamEl.innerHTML = '';
      document.getElementById('tvComparisonBox').classList.add('d-none');
      document.getElementById('btnTvNextAlbum').classList.add('d-none');
      document.getElementById('btnTvDownloadComic').classList.add('d-none');
      document.getElementById('btnTvNextShowStep').classList.remove('d-none');
    },

    revealNextShowStep() {
      const cadena = this.cadenas[this.showState.albumIndex];
      const stepIdx = this.showState.stepRevealIndex;

      if (stepIdx < cadena.eslabones.length) {
        const eslabon = cadena.eslabones[stepIdx];
        this.appendChainStepToTv(eslabon, stepIdx);
        this.showState.stepRevealIndex++;

        // Sonido según tipo
        if (eslabon.tipo === 'TEXTO') {
          SoundEffects.playRevealText();
        } else {
          SoundEffects.playRevealDrawing();
        }

        // Si fue el último eslabón de este álbum:
        if (this.showState.stepRevealIndex >= cadena.eslabones.length) {
          setTimeout(() => {
            this.showAlbumComparison(cadena);
          }, 800);
        }
      }
    },

    appendChainStepToTv(eslabon, index) {
      const streamEl = document.getElementById('tvChainStream');
      const card = document.createElement('div');
      card.className = 'chain-step-card';

      let actionDesc = 'escribió la frase inicial:';
      if (index > 0) {
        actionDesc = eslabon.tipo === 'DIBUJO' ? 'dibujó esto:' : 'creyó que el dibujo era:';
      }

      let contentHtml = '';
      if (eslabon.tipo === 'TEXTO') {
        contentHtml = `<div class="step-text-bubble">"${eslabon.contenido}"</div>`;
      } else {
        contentHtml = `
          <div class="step-drawing-frame">
            <img src="${eslabon.contenido}" alt="Dibujo de ${eslabon.autorName}" class="step-drawing-img">
          </div>
        `;
      }

      card.innerHTML = `
        <div class="step-card-header">
          <span class="step-author-avatar">${eslabon.autorAvatar}</span>
          <div class="step-meta-info">
            <span class="step-author-name">${eslabon.autorName}</span>
            <span class="step-action-label">${actionDesc}</span>
          </div>
        </div>
        ${contentHtml}
      `;

      streamEl.appendChild(card);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    showAlbumComparison(cadena) {
      SoundEffects.playApplause();
      Confetti.start(3500);

      const compBox = document.getElementById('tvComparisonBox');
      compBox.classList.remove('d-none');

      const initialEslabon = cadena.eslabones[0];
      const finalEslabon = cadena.eslabones[cadena.eslabones.length - 1];

      document.getElementById('tvComparisonInitialText').textContent = `"${initialEslabon.contenido}"`;
      document.getElementById('tvComparisonInitialAuthor').textContent = `Iniciado por ${initialEslabon.autorAvatar} ${initialEslabon.autorName}`;

      document.getElementById('tvComparisonFinalText').textContent = 
        finalEslabon.tipo === 'TEXTO' ? `"${finalEslabon.contenido}"` : '(Dibujo final)';
      document.getElementById('tvComparisonFinalAuthor').textContent = `Terminado por ${finalEslabon.autorAvatar} ${finalEslabon.autorName}`;

      document.getElementById('btnTvNextShowStep').classList.add('d-none');
      document.getElementById('btnTvNextAlbum').classList.remove('d-none');
      document.getElementById('btnTvDownloadComic').classList.remove('d-none');

      compBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Notificar a celulares que pueden descargar este álbum
      this.broadcast({
        type: 'ALBUM_COMPLETED',
        payload: {
          albumIndex: this.showState.albumIndex,
          authorId: cadena.authorPlayerId,
          isLastAlbum: (this.showState.albumIndex + 1 >= this.cadenas.length)
        }
      });
    },

    nextAlbum() {
      this.showState.albumIndex++;
      this.showState.stepRevealIndex = 0;

      if (this.showState.albumIndex < this.cadenas.length) {
        this.renderAlbumHeader();
        this.revealNextShowStep();

        this.broadcast({
          type: 'ALBUM_CHANGED',
          payload: { albumIndex: this.showState.albumIndex }
        });
      } else {
        // Fin de todos los álbumes -> Vista Final
        this.showFinalRecapView();
      }
    },

    toggleAutoPlay() {
      this.showState.autoPlay = !this.showState.autoPlay;
      const btn = document.getElementById('btnTvAutoPlay');
      if (this.showState.autoPlay) {
        btn.textContent = '⏸️ Pausar Reproducción';
        this.showState.autoPlayInterval = setInterval(() => {
          const cadena = this.cadenas[this.showState.albumIndex];
          if (this.showState.stepRevealIndex < cadena.eslabones.length) {
            this.revealNextShowStep();
          } else {
            this.nextAlbum();
          }
        }, 4000);
      } else {
        btn.textContent = '▶️ Reproducción Automática';
        clearInterval(this.showState.autoPlayInterval);
      }
    },

    spawnFloatingReaction(emoji, authorName) {
      SoundEffects.playReaction();
      const container = document.getElementById('tvReactionsContainer');
      if (!container) return;

      const bubble = document.createElement('div');
      bubble.className = 'floating-reaction';
      bubble.innerHTML = `<span>${emoji}</span> <span class="reaction-author-tag">${authorName}</span>`;

      // Posición horizontal con variación
      const randOffset = Math.floor(Math.random() * 80) - 40;
      bubble.style.transform = `translateX(${randOffset}px)`;

      container.appendChild(bubble);
      setTimeout(() => { bubble.remove(); }, 3200);
    },

    downloadCurrentAlbumComic() {
      const cadena = this.cadenas[this.showState.albumIndex];
      renderAndDownloadComicStrip(cadena);
    },

    showFinalRecapView() {
      clearInterval(this.showState.autoPlayInterval);
      this.showView('tvViewEnd');
      Confetti.start(6000);
      SoundEffects.playApplause();

      const recapGrid = document.getElementById('tvEndRecapGrid');
      recapGrid.innerHTML = '';

      this.cadenas.forEach((cad, idx) => {
        const card = document.createElement('div');
        card.className = 'player-lobby-card p-3 d-flex flex-column gap-2 text-start';
        card.innerHTML = `
          <div class="d-flex justify-content-between align-items-center">
            <strong>Álbum #${idx + 1} (${cad.authorAvatar} ${cad.authorName})</strong>
            <button type="button" class="btn btn-sm btn-outline-info btn-download-single-recap" data-album="${idx}">📸 Descargar</button>
          </div>
          <div class="text-muted small">
            Inicio: "${cad.eslabones[0]?.contenido || ''}"<br>
            Fin: "${cad.eslabones[cad.eslabones.length - 1]?.contenido || ''}"
          </div>
        `;
        recapGrid.appendChild(card);
      });

      document.querySelectorAll('.btn-download-single-recap').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.album, 10);
          renderAndDownloadComicStrip(this.cadenas[idx]);
        });
      });

      this.broadcast({ type: 'MATCH_FINISHED' });
    },

    restartMatch() {
      this.showView('tvViewLobby');
      this.totalSteps = 0;
      this.stepIndex = 0;
      this.cadenas = [];
      this.renderLobbyRoster();
      this.broadcastRoster();
    }
  };

  // ============================================================================
  // GENERADOR DE TIRA CÓMICA EN IMAGEN (PNG) PARA WHATSAPP
  // ============================================================================
  function renderAndDownloadComicStrip(cadena) {
    if (!cadena || !cadena.eslabones) return;

    const canvas = document.getElementById('comicStripCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = 800;
    // Calcular alto según cantidad de eslabones
    let totalHeight = 180; // Header
    cadena.eslabones.forEach(e => {
      totalHeight += (e.tipo === 'DIBUJO' ? 620 : 150) + 40;
    });
    totalHeight += 120; // Footer

    canvas.width = width;
    canvas.height = totalHeight;

    // Fondo elegante oscuro
    ctx.fillStyle = '#131127';
    ctx.fillRect(0, 0, width, totalHeight);

    // Borde decorativo exterior
    ctx.strokeStyle = '#28244c';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, width - 10, totalHeight - 10);

    // Encabezado
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📞 TELÉFONO DESCOMPUESTO', width / 2, 65);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`Álbum de ${cadena.authorAvatar} ${cadena.authorName}`, width / 2, 105);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 130);
    ctx.lineTo(width - 60, 130);
    ctx.stroke();

    let curY = 170;

    // Dibujar cada eslabón uno debajo del otro
    const renderPromises = cadena.eslabones.map((eslabon, idx) => {
      return new Promise((resolve) => {
        // Header del eslabón
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        const action = idx === 0 ? 'escribió la frase original:' : (eslabon.tipo === 'DIBUJO' ? 'dibujó:' : 'adivinó:');
        ctx.fillText(`${eslabon.autorAvatar} ${eslabon.autorName} ${action}`, 60, curY);
        curY += 28;

        if (eslabon.tipo === 'TEXTO') {
          // Tarjeta de texto
          ctx.fillStyle = '#1d1a38';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(60, curY, width - 120, 90, 12);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 26px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`"${eslabon.contenido}"`, width / 2, curY + 54);

          curY += 120;
          resolve();
        } else {
          // Dibujo
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const frameW = width - 120;
            const frameH = 500;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(60, curY, frameW, frameH);
            ctx.drawImage(img, 60, curY, frameW, frameH);

            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 4;
            ctx.strokeRect(60, curY, frameW, frameH);

            curY += frameH + 30;
            resolve();
          };
          img.onerror = () => {
            curY += 80;
            resolve();
          };
          img.src = eslabon.contenido;
        }
      });
    });

    Promise.all(renderPromises).then(() => {
      // Pie
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Hub de Juegos de Mesa • juliangobbato.github.io/juegos', width / 2, totalHeight - 35);

      // Trigger download
      try {
        const link = document.createElement('a');
        link.download = `telefono-descompuesto-${cadena.authorName.toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Error generando descarga PNG:', err);
      }
    });
  }

  // ============================================================================
  // CONTROLADOR DE CELULAR (MANDO PRIVADO, ESCRITURA Y DIBUJO)
  // ============================================================================
  const PhoneClient = {
    conn: null,
    playerId: null,
    name: '',
    avatar: '🦊',
    isVip: false,

    currentStepIndex: 0,
    currentPhaseType: 'ESCRIBIR', // 'ESCRIBIR' o 'DIBUJAR'

    // Estado de la herramienta de dibujo
    phoneCanvas: null,
    phoneCtx: null,
    currentColor: '#111827',
    currentBrushSize: 4,
    isEraser: false,
    isDrawing: false,
    undoStack: [],

    init(preloadedRoomCode = '') {
      appState.mode = 'PHONE';
      document.getElementById('screenLanding').classList.remove('active');
      document.getElementById('screenLanding').classList.add('d-none');
      document.getElementById('screenPhone').classList.remove('d-none');
      document.getElementById('screenPhone').classList.add('active');

      this.phoneCanvas = document.getElementById('phoneDrawingCanvas');
      if (this.phoneCanvas) this.phoneCtx = this.phoneCanvas.getContext('2d');

      this.renderAvatarPicker();
      this.renderDrawingPalette();
      this.bindEvents();

      // Recuperar sesión previa si coincide el código
      const savedRoom = sessionStorage.getItem('telefono_room');
      const savedId = sessionStorage.getItem('telefono_player_id');
      const savedName = sessionStorage.getItem('telefono_name');
      const savedAvatar = sessionStorage.getItem('telefono_avatar');

      if (preloadedRoomCode) {
        const inputRoom = document.getElementById('inputPhoneRoom');
        if (inputRoom) inputRoom.value = preloadedRoomCode.toUpperCase();
      } else if (savedRoom) {
        const inputRoom = document.getElementById('inputPhoneRoom');
        if (inputRoom) inputRoom.value = savedRoom;
      }

      if (savedName) {
        const inputName = document.getElementById('inputPhoneName');
        if (inputName) inputName.value = savedName;
      }
      if (savedAvatar) {
        this.avatar = savedAvatar;
        document.getElementById('inputPhoneAvatar').value = savedAvatar;
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

    renderDrawingPalette() {
      const container = document.getElementById('phonePaletteSwatches');
      if (!container) return;
      container.innerHTML = '';

      DRAWING_PALETTE.forEach((color, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `swatch-btn ${i === 0 ? 'active' : ''}`;
        btn.style.backgroundColor = color.hex;
        btn.title = color.name;
        btn.addEventListener('click', () => {
          container.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.isEraser = false;
          document.getElementById('btnToolEraser')?.classList.remove('active');
          this.currentColor = color.hex;
        });
        container.appendChild(btn);
      });
    },

    bindEvents() {
      document.getElementById('btnPhoneJoin')?.addEventListener('click', () => {
        this.attemptJoin();
      });

      // Botón "Tirame una idea"
      document.getElementById('btnPhoneRandomIdea')?.addEventListener('click', () => {
        this.requestRandomIdea();
      });

      // Envío de Frase Escrita
      document.getElementById('btnPhoneSubmitWrite')?.addEventListener('click', () => {
        this.submitTextContent();
      });

      // Envío de Dibujo
      document.getElementById('btnPhoneSubmitDraw')?.addEventListener('click', () => {
        this.submitDrawingContent();
      });

      // Volver a editar si aún esperan
      document.getElementById('btnPhoneResumeEdit')?.addEventListener('click', () => {
        this.resumeEdit();
      });

      // Configuración VIP
      this.bindVipLobbyControls();

      // Reacciones en vivo
      document.querySelectorAll('.btn-reaction').forEach(btn => {
        btn.addEventListener('click', () => {
          const emoji = btn.getAttribute('data-emoji');
          this.send({
            type: 'SHOW_REACTION',
            payload: { emoji: emoji, authorName: this.name }
          });
        });
      });

      // Controles VIP de Show
      document.getElementById('btnPhoneVipNextStep')?.addEventListener('click', () => {
        this.send({ type: 'VIP_SHOW_NEXT_STEP' });
      });

      document.getElementById('btnPhoneVipNextAlbum')?.addEventListener('click', () => {
        this.send({ type: 'VIP_SHOW_NEXT_ALBUM' });
      });

      // Descargar mi álbum
      document.getElementById('btnPhoneDownloadMyAlbum')?.addEventListener('click', () => {
        if (TvHost && TvHost.cadenas) {
          const myChain = TvHost.cadenas.find(c => c.authorPlayerId === this.playerId) || TvHost.cadenas[TvHost.showState.albumIndex];
          renderAndDownloadComicStrip(myChain);
        }
      });

      // Conectar a otra sala
      document.getElementById('btnChangeRoomPhone')?.addEventListener('click', () => {
        sessionStorage.removeItem('telefono_room');
        limpiarConexionPrevia();
        this.showView('phoneViewJoin');
      });

      // Herramientas y eventos del canvas táctil
      this.bindCanvasDrawingEvents();
    },

    bindVipLobbyControls() {
      // Modo de frase
      document.querySelectorAll('.btn-phrase-mode').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-phrase-mode').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.send({
            type: 'VIP_SETTINGS',
            payload: { phraseMode: btn.dataset.mode }
          });
        });
      });

      // Tiempo para escribir
      document.querySelectorAll('.btn-time-write').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-time-write').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.send({
            type: 'VIP_SETTINGS',
            payload: { timeWrite: btn.dataset.time }
          });
        });
      });

      // Tiempo para dibujar
      document.querySelectorAll('.btn-time-draw').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-time-draw').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.send({
            type: 'VIP_SETTINGS',
            payload: { timeDraw: btn.dataset.time }
          });
        });
      });

      // Largo de cadena
      document.querySelectorAll('.btn-chain-len').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-chain-len').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.send({
            type: 'VIP_SETTINGS',
            payload: { chainLength: btn.dataset.len }
          });
        });
      });

      // Botón Iniciar Partida
      document.getElementById('btnPhoneVipStart')?.addEventListener('click', () => {
        this.send({ type: 'VIP_START_MATCH' });
      });
    },

    bindCanvasDrawingEvents() {
      if (!this.phoneCanvas) return;
      const canvas = this.phoneCanvas;
      const ctx = this.phoneCtx;

      // Inicializar lienzo blanco
      this.resetCanvasToWhite();

      // Botones de grosores
      document.querySelectorAll('.btn-tool-brush').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.btn-tool-brush').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentBrushSize = parseInt(btn.dataset.size, 10) || 4;
        });
      });

      // Goma
      document.getElementById('btnToolEraser')?.addEventListener('click', () => {
        this.isEraser = !this.isEraser;
        document.getElementById('btnToolEraser').classList.toggle('active', this.isEraser);
      });

      // Deshacer
      document.getElementById('btnToolUndo')?.addEventListener('click', () => {
        this.undo();
      });

      // Limpiar todo
      document.getElementById('btnToolClear')?.addEventListener('click', () => {
        if (confirm('¿Limpiar todo el dibujo?')) {
          this.saveUndoState();
          this.resetCanvasToWhite();
        }
      });

      // Manejo táctil / mouse suave
      let lastPos = null;

      const getPos = (e) => obtenerCoordenadas(canvas, e);

      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        this.isDrawing = true;
        this.saveUndoState();

        lastPos = getPos(e);
        ctx.beginPath();
        ctx.arc(lastPos.x, lastPos.y, (this.isEraser ? 18 : this.currentBrushSize) / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.isEraser ? '#ffffff' : this.currentColor;
        ctx.fill();
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!this.isDrawing || !lastPos) return;
        const currentPos = getPos(e);

        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(currentPos.x, currentPos.y);
        ctx.strokeStyle = this.isEraser ? '#ffffff' : this.currentColor;
        ctx.lineWidth = this.isEraser ? 24 : this.currentBrushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        lastPos = currentPos;
      });

      const stopDraw = (e) => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        lastPos = null;
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      };

      canvas.addEventListener('pointerup', stopDraw);
      canvas.addEventListener('pointercancel', stopDraw);
    },

    resetCanvasToWhite() {
      if (!this.phoneCtx) return;
      this.phoneCtx.fillStyle = '#ffffff';
      this.phoneCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.undoStack = [];
    },

    saveUndoState() {
      if (!this.phoneCtx) return;
      if (this.undoStack.length >= 15) {
        this.undoStack.shift();
      }
      this.undoStack.push(this.phoneCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT));
    },

    undo() {
      if (this.undoStack.length > 0) {
        const lastImg = this.undoStack.pop();
        this.phoneCtx.putImageData(lastImg, 0, 0);
      } else {
        this.resetCanvasToWhite();
      }
    },

    attemptJoin() {
      const roomInput = document.getElementById('inputPhoneRoom').value.trim().toUpperCase();
      const nameInput = document.getElementById('inputPhoneName').value.trim();
      const alertBox = document.getElementById('phoneJoinAlert');

      if (roomInput.length !== 4) {
        alertBox.textContent = 'Por favor ingresá un código de 4 letras.';
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

      sessionStorage.setItem('telefono_room', roomInput);
      sessionStorage.setItem('telefono_name', this.name);
      sessionStorage.setItem('telefono_avatar', this.avatar);

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
          const savedId = sessionStorage.getItem('telefono_player_id');
          this.send({
            type: 'JOIN_GAME',
            payload: {
              playerId: savedId,
              name: this.name,
              avatar: this.avatar
            }
          });

          // Heartbeat 5s
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
      sessionStorage.removeItem('telefono_room');
      limpiarConexionPrevia();
      this.showView('phoneViewJoin');

      const alertEl = document.getElementById('phoneJoinAlert');
      alertEl.innerHTML = `
        <div>⚠️ La sala <strong>${roomCode}</strong> ya no existe o la TV cambió de sala.</div>
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
        case 'SETTINGS_SYNC':
          this.applySettingsSync(msg.payload.config);
          break;
        case 'START_STEP_TASK':
          this.setupStepTask(msg.payload);
          break;
        case 'TIMER_TICK':
          this.updateClock(msg.payload.remaining);
          break;
        case 'FORCE_SUBMIT':
          this.autoSubmitDueToTimeout();
          break;
        case 'START_FINAL_SHOW':
          this.showView('phonePhaseShow');
          this.updateShowVipControls();
          break;
        case 'ALBUM_CHANGED':
          this.updateShowVipControls();
          break;
        case 'ALBUM_COMPLETED':
          this.onAlbumCompleted(msg.payload);
          break;
        case 'MATCH_FINISHED':
          this.showView('phonePhaseShow');
          break;
      }
    },

    onJoinAccepted(data) {
      this.playerId = data.playerId;
      this.name = data.name;
      this.avatar = data.avatar;
      this.isVip = data.isVip;

      sessionStorage.setItem('telefono_player_id', this.playerId);

      document.getElementById('phoneMyAvatar').textContent = this.avatar;
      document.getElementById('phoneMyName').textContent = this.name;
      document.getElementById('phoneRoomLabel').textContent = data.roomCode;
      
      const dot = document.getElementById('phoneMyColorDot');
      dot.style.backgroundColor = data.color;

      if (this.isVip) {
        document.getElementById('phoneVipPanel').classList.remove('d-none');
        document.getElementById('phoneWaitHostPanel').classList.add('d-none');
        if (data.config) this.applySettingsSync(data.config);
      } else {
        document.getElementById('phoneVipPanel').classList.add('d-none');
        document.getElementById('phoneWaitHostPanel').classList.remove('d-none');
      }

      this.showView('phoneViewLobby');
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
            <span class="color-dot" style="background-color: ${p.color};"></span>
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

    applySettingsSync(cfg) {
      if (!cfg) return;
      document.querySelectorAll('.btn-phrase-mode').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === cfg.phraseMode);
      });
      document.querySelectorAll('.btn-time-write').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.time, 10) === cfg.timeWrite);
      });
      document.querySelectorAll('.btn-time-draw').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.time, 10) === cfg.timeDraw);
      });
      document.querySelectorAll('.btn-chain-len').forEach(b => {
        b.classList.toggle('active', b.dataset.len === cfg.chainLength);
      });
    },

    setupStepTask(data) {
      this.currentStepIndex = data.stepIndex;
      this.currentPhaseType = data.phaseType;

      if (data.phaseType === 'ESCRIBIR') {
        this.showView('phonePhaseWrite');
        document.getElementById('phoneWriteStepBadge').textContent = `PASO ${data.stepIndex + 1}`;
        this.updateClock(data.timerSeconds);

        const promptDrawingWrap = document.getElementById('phonePromptDrawingWrap');
        const writeTitle = document.getElementById('phoneWriteTitle');
        const writeSub = document.getElementById('phoneWriteSubtitle');
        const input = document.getElementById('inputPhonePhrase');
        const btnIdea = document.getElementById('btnPhoneRandomIdea');

        input.value = '';

        if (data.stepIndex === 0) {
          promptDrawingWrap.classList.add('d-none');
          writeTitle.textContent = '✍️ Escribí tu Frase Inicial';
          writeSub.textContent = 'Inventá una situación absurda o divertida para que otro jugador la dibuje:';
          btnIdea.classList.remove('d-none');

          if (data.randomIdea) {
            this.cachedIdea = data.randomIdea;
            if (data.phraseMode === 'cards') {
              input.value = data.randomIdea;
            }
          }
        } else {
          // Adivinar el dibujo previo
          promptDrawingWrap.classList.remove('d-none');
          document.getElementById('phonePromptImg').src = data.promptDrawing || '';
          writeTitle.textContent = '🤔 ¿Qué dibujaron acá?';
          writeSub.textContent = 'Mirá el dibujo de arriba y escribí qué creés que está pasando:';
          btnIdea.classList.add('d-none');
        }

        input.focus();
      } else {
        // DIBUJAR
        this.showView('phonePhaseDraw');
        document.getElementById('phoneDrawStepBadge').textContent = `PASO ${data.stepIndex + 1}`;
        this.updateClock(data.timerSeconds);

        document.getElementById('phonePromptPhraseText').textContent = `"${data.promptText || 'Algo divertido'}"`;
        this.resetCanvasToWhite();
      }
    },

    updateClock(seconds) {
      const text = seconds === 0 ? 'Sin límite' : `⏳ ${seconds}s`;
      const wEl = document.getElementById('phoneWriteTimer');
      const dEl = document.getElementById('phoneDrawTimer');
      if (wEl) wEl.textContent = text;
      if (dEl) dEl.textContent = text;
    },

    requestRandomIdea() {
      const input = document.getElementById('inputPhonePhrase');
      if (appState.catalog && appState.catalog.categorias) {
        const cats = appState.catalog.categorias;
        const cat = cats[Math.floor(Math.random() * cats.length)];
        const phrase = cat.frases[Math.floor(Math.random() * cat.frases.length)];
        input.value = phrase;
      } else if (this.cachedIdea) {
        input.value = this.cachedIdea;
      }
    },

    submitTextContent() {
      let text = document.getElementById('inputPhonePhrase').value.trim();
      if (!text) {
        text = this.cachedIdea || 'Un carpincho tomando mate';
      }

      this.send({
        type: 'SUBMIT_STEP_CONTENT',
        payload: {
          playerId: this.playerId,
          stepIndex: this.currentStepIndex,
          contentType: 'TEXTO',
          content: text
        }
      });

      this.showView('phonePhaseWait');
    },

    submitDrawingContent() {
      if (!this.phoneCanvas) return;
      const dataUrl = this.phoneCanvas.toDataURL('image/jpeg', 0.75);

      this.send({
        type: 'SUBMIT_STEP_CONTENT',
        payload: {
          playerId: this.playerId,
          stepIndex: this.currentStepIndex,
          contentType: 'DIBUJO',
          content: dataUrl
        }
      });

      this.showView('phonePhaseWait');
    },

    autoSubmitDueToTimeout() {
      if (this.currentPhaseType === 'ESCRIBIR') {
        let text = document.getElementById('inputPhonePhrase').value.trim();
        if (!text) text = 'Algo misterioso e inexplicable';
        this.send({
          type: 'SUBMIT_STEP_CONTENT',
          payload: {
            playerId: this.playerId,
            stepIndex: this.currentStepIndex,
            contentType: 'TEXTO',
            content: text
          }
        });
      } else {
        const dataUrl = this.phoneCanvas.toDataURL('image/jpeg', 0.7);
        this.send({
          type: 'SUBMIT_STEP_CONTENT',
          payload: {
            playerId: this.playerId,
            stepIndex: this.currentStepIndex,
            contentType: 'DIBUJO',
            content: dataUrl
          }
        });
      }
      this.showView('phonePhaseWait');
    },

    resumeEdit() {
      this.send({
        type: 'PLAYER_EDITING_AGAIN',
        payload: { playerId: this.playerId }
      });
      if (this.currentPhaseType === 'ESCRIBIR') {
        this.showView('phonePhaseWrite');
      } else {
        this.showView('phonePhaseDraw');
      }
    },

    updateShowVipControls() {
      const vipBox = document.getElementById('phoneVipShowControls');
      if (vipBox) {
        vipBox.classList.toggle('d-none', !this.isVip);
      }
    },

    onAlbumCompleted(payload) {
      const downloadWrap = document.getElementById('phoneDownloadWrap');
      if (downloadWrap) {
        downloadWrap.classList.remove('d-none');
      }
    },

    showView(viewId) {
      const views = ['phoneViewJoin', 'phoneViewLobby', 'phonePhaseWrite', 'phonePhaseDraw', 'phonePhaseWait', 'phonePhaseShow'];
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
  async function cargarCatalogoFrases() {
    if (window.FRASES_TELEFONO_DESCOMPUESTO) {
      appState.catalog = window.FRASES_TELEFONO_DESCOMPUESTO;
      return;
    }
    try {
      const resp = await fetch('data/frases.json');
      appState.catalog = await resp.json();
    } catch (e) {
      console.error('Error cargando frases.json:', e);
      appState.catalog = {
        categorias: [
          { id: 'argentina', nombre: 'Argentinas', icono: '🇦🇷', frases: ['Un carpincho tomando mate en una reposera'] }
        ]
      };
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    Confetti.init();
    setupHeaderControls();
    await cargarCatalogoFrases();

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('sala');

    if (roomParam) {
      const cleanRoom = roomParam.trim().toUpperCase();
      const storedRoom = (sessionStorage.getItem('telefono_room') || '').trim().toUpperCase();
      if (cleanRoom !== storedRoom) {
        sessionStorage.setItem('telefono_room', cleanRoom);
      }
      PhoneClient.init(cleanRoom);
    } else {
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
          sessionStorage.setItem('telefono_room', clean);
          PhoneClient.init(clean);
        } else {
          alert('Por favor ingresá un código de 4 letras.');
        }
      });
    }
  });

})();
