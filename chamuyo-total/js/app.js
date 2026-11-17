/**
 * CHAMUYO TOTAL - Motor de Juego y Red PeerJS
 * Inspirado en Fibbage y Balderdash.
 */

(function() {
  'use strict';

  // =========================================================================
  // 1. CONSTANTES Y CONFIGURACIÓN
  // =========================================================================
  const PEER_PREFIX = 'chamuyo-total-';
  const AVATARS = ['🦊', '🐸', '🦁', '🐼', '🐙', '🦖', '👽', '🤖', '🤠', '🕵️', '🧙', '🧛', '🍕', '🧉', '🔥', '⚡'];

  // =========================================================================
  // 2. MÓDULO DE AUDIO SINTETIZADO (Web Audio API)
  // =========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playJoin() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }

    playSubmitted() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(650, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }

    playDrumroll() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Pequeño redoble con oscilador de frecuencia modulada
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(240, now + 0.8);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.85);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);
    }

    playFooled() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Sonido de caída cómica (trompeta triste o slide)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.5);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    }

    playTruth() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Fanfarria C-E-G-C brillante
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.35);
      });
    }

    playTick() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  const sound = new SoundEngine();

  // =========================================================================
  // 3. NORMALIZADOR ANTI-VERDAD Y HELPERS DE TEXTO
  // =========================================================================
  function removeAccents(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeAnswerText(str) {
    let clean = removeAccents(str || '').toLowerCase().trim();
    // Quitar puntuación
    clean = clean.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    // Quitar artículos iniciales (el, la, los, las, un, una, unos, unas)
    clean = clean.replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '');
    return clean.trim();
  }

  function capitalizeUniform(str) {
    if (!str) return '';
    let clean = str.trim().replace(/\.+$/, '');
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // =========================================================================
  // 4. ESTADO GLOBAL DE LA APLICACIÓN
  // =========================================================================
  const appState = {
    mode: null, // 'tv' o 'phone'
    roomCode: null,
    peer: null,
    
    // Si es TV
    tv: {
      players: new Map(), // playerId -> { id, name, avatar, isVip, score, roundScore, fooledVictims, conn, submittedLie, votedOptionId }
      questions: [],
      currentRoundIndex: 0,
      totalRounds: 7,
      settings: {
        categories: ['argentina', 'historia_insolita', 'leyes_absurdas', 'ciencia_y_animales', 'cultura_curiosa'],
        rounds: 7,
        timerSec: 45
      },
      currentQuestion: null,
      currentPhase: 'lobby', // 'phase1', 'phase2', 'phase3', 'phase4', 'phase5'
      options: [], // [{ id, text, isTruth, authorId }]
      timerInterval: null,
      timerRemaining: 0
    },

    // Si es Celular
    phone: {
      playerId: null,
      name: '',
      avatar: '🦊',
      isVip: false,
      conn: null,
      myLie: '',
      myVotedId: null,
      myScore: 0,
      myDelta: 0
    }
  };

  // =========================================================================
  // 5. BANCO DE DATOS (Carga y Selección)
  // =========================================================================
  let ALL_DATOS = [];

  async function loadQuestionsData() {
    if (window.CHAMUYO_DATOS && Array.isArray(window.CHAMUYO_DATOS) && window.CHAMUYO_DATOS.length >= 100) {
      ALL_DATOS = window.CHAMUYO_DATOS;
      return;
    }
    try {
      const res = await fetch('data/datos.json');
      if (res.ok) {
        ALL_DATOS = await res.json();
      } else if (window.CHAMUYO_DATOS) {
        ALL_DATOS = window.CHAMUYO_DATOS;
      }
    } catch (e) {
      if (window.CHAMUYO_DATOS) {
        ALL_DATOS = window.CHAMUYO_DATOS;
      }
    }
  }

  function pickGameQuestions(categories, count) {
    const filtered = ALL_DATOS.filter(d => categories.includes(d.categoria));
    // Mezclar
    const pool = [...filtered].sort(() => Math.random() - 0.5);
    return pool.slice(0, Math.min(count, pool.length));
  }

  // =========================================================================
  // LIMPIEZA DE CONEXIONES PREVIAS (Anti-bloqueos al cambiar de sala)
  // =========================================================================
  function limpiarConexionPrevia() {
    if (appState.heartbeatInterval) {
      clearInterval(appState.heartbeatInterval);
      appState.heartbeatInterval = null;
    }
    if (appState.phone && appState.phone.conn) {
      try { appState.phone.conn.close(); } catch(e) {}
      appState.phone.conn = null;
    }
    if (appState.tv && appState.tv.players) {
      appState.tv.players.forEach(p => {
        if (p.conn) {
          try { p.conn.close(); } catch(e) {}
          p.conn = null;
        }
      });
    }
    if (appState.peer && !appState.peer.destroyed) {
      try { appState.peer.destroy(); } catch(e) {}
      appState.peer = null;
    }
  }

  // =========================================================================
  // 6. MOTOR DE PANTALLA TV (HOST)
  // =========================================================================
  const TvHost = {
    init(customCode) {
      limpiarConexionPrevia();
      appState.mode = 'tv';
      appState.roomCode = (customCode || generateRoomCode()).toUpperCase();

      document.getElementById('screenLanding').classList.add('d-none');
      document.getElementById('screenLanding').classList.remove('active');
      document.getElementById('screenTv').classList.remove('d-none');
      document.getElementById('screenTv').classList.add('active');

      document.getElementById('roomBadgeWrap').classList.remove('d-none');
      document.getElementById('headerRoomCode').textContent = appState.roomCode;
      document.getElementById('tvRoomCodeText').textContent = appState.roomCode;

      this.generateQR();
      this.initPeerServer();
      this.bindUiEvents();
    },

    generateQR() {
      const qrContainer = document.getElementById('tvQrCodeContainer');
      qrContainer.innerHTML = '';
      const joinUrl = `${window.location.origin}${window.location.pathname}?sala=${appState.roomCode}`;
      document.getElementById('tvRoomUrlSub').textContent = joinUrl;

      if (window.QRCode) {
        new window.QRCode(qrContainer, {
          text: joinUrl,
          width: 200,
          height: 200,
          colorDark: '#0f172a',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      }
    },

    initPeerServer() {
      const peerId = PEER_PREFIX + appState.roomCode;
      const peer = new Peer(peerId, { debug: 1 });
      appState.peer = peer;

      peer.on('open', (id) => {
        console.log('TV Host iniciado en Peer:', id);
      });

      peer.on('connection', (conn) => {
        this.handleIncomingConnection(conn);
      });

      peer.on('error', (err) => {
        console.warn('Error en Peer TV:', err);
      });
    },

    handleIncomingConnection(conn) {
      conn.on('data', (data) => {
        if (!data || !data.type) return;

        switch (data.type) {
          case 'JOIN_OR_RECONNECT':
            this.handlePlayerJoinOrReconnect(conn, data);
            break;
          case 'VIP_UPDATE_SETTINGS':
            this.handleVipUpdateSettings(conn, data);
            break;
          case 'VIP_START_GAME':
            this.handleVipStartGame(conn);
            break;
          case 'SUBMIT_CHAMUYO':
            this.handlePlayerSubmitChamuyo(conn, data);
            break;
          case 'SUBMIT_VOTE':
            this.handlePlayerSubmitVote(conn, data);
            break;
          case 'VIP_NEXT_PHASE':
            this.handleVipNextPhase(conn);
            break;
          case 'VIP_RESTART_GAME':
            this.handleVipRestartGame();
            break;
        }
      });

      conn.on('close', () => {
        this.handlePlayerDisconnect(conn);
      });
    },

    handlePlayerJoinOrReconnect(conn, data) {
      const { playerId, name, avatar } = data;
      if (!playerId || !name) return;

      const tv = appState.tv;
      let player = tv.players.get(playerId);

      if (player) {
        // Reconexión de un jugador existente
        player.conn = conn;
        player.connected = true;
        player.name = name;
        player.avatar = avatar || player.avatar;
      } else {
        // Nuevo jugador
        if (tv.players.size >= 10 && tv.currentPhase === 'lobby') {
          conn.send({ type: 'JOIN_REJECTED', reason: 'La sala está completa (máximo 10 jugadores).' });
          return;
        }

        const isFirstPlayer = tv.players.size === 0;
        player = {
          id: playerId,
          name: name.substring(0, 12),
          avatar: avatar || '🦊',
          isVip: isFirstPlayer,
          score: 0,
          roundScore: 0,
          fooledVictims: 0,
          connected: true,
          conn: conn,
          submittedLie: '',
          votedOptionId: null
        };
        tv.players.set(playerId, player);
        sound.playJoin();
      }

      this.updateLobbyPlayersUI();

      // Enviar confirmación al celular con el estado sincronizado
      this.sendPlayerStateSync(player);
      this.broadcastLobbySummary();
    },

    handlePlayerDisconnect(conn) {
      const tv = appState.tv;
      for (const [id, p] of tv.players.entries()) {
        if (p.conn === conn) {
          p.connected = false;
          // Si era el VIP y hay otros jugadores conectados, transferir el rol de VIP
          if (p.isVip) {
            p.isVip = false;
            for (const [, other] of tv.players.entries()) {
              if (other.connected) {
                other.isVip = true;
                this.sendPlayerStateSync(other);
                break;
              }
            }
          }
          break;
        }
      }
      this.updateLobbyPlayersUI();
    },

    updateLobbyPlayersUI() {
      const tv = appState.tv;
      const count = Array.from(tv.players.values()).filter(p => p.connected).length;
      document.getElementById('tvPlayerCountBadge').textContent = count;

      const grid = document.getElementById('tvPlayersGrid');
      grid.innerHTML = '';

      if (count === 0) {
        grid.innerHTML = '<div class="no-players-hint">Esperando que se conecte el primer jugador...</div>';
      } else {
        tv.players.forEach(p => {
          if (!p.connected) return;
          const card = document.createElement('div');
          card.className = 'player-tv-card';
          card.innerHTML = `
            ${p.isVip ? '<span class="player-vip-badge">👑 VIP</span>' : ''}
            <span class="player-tv-avatar">${p.avatar}</span>
            <span class="player-tv-name">${p.name}</span>
          `;
          grid.appendChild(card);
        });
      }

      const btnStart = document.getElementById('btnTvStartGame');
      const hint = document.getElementById('tvStartHint');
      if (count >= 3) {
        btnStart.disabled = false;
        hint.textContent = '¡Todo listo para arrancar!';
        hint.classList.replace('text-muted', 'text-success');
      } else {
        btnStart.disabled = true;
        hint.textContent = `Se necesitan al menos 3 jugadores (${count}/3)`;
        hint.classList.replace('text-success', 'text-muted');
      }
    },

    handleVipUpdateSettings(conn, data) {
      const tv = appState.tv;
      if (data.settings) {
        tv.settings = { ...tv.settings, ...data.settings };
        tv.totalRounds = parseInt(tv.settings.rounds, 10) || 7;
        
        // Actualizar resumen en la TV
        document.getElementById('tvSummaryCats').textContent = 
          tv.settings.categories.length === 5 ? 'Todas' : `${tv.settings.categories.length} elegidas`;
        document.getElementById('tvSummaryRounds').textContent = `${tv.totalRounds} rondas`;
        document.getElementById('tvSummaryTimer').textContent = 
          tv.settings.timerSec > 0 ? `${tv.settings.timerSec}s` : 'Sin tiempo';

        this.broadcastLobbySummary();
      }
    },

    broadcastLobbySummary() {
      const tv = appState.tv;
      const playersList = Array.from(tv.players.values())
        .filter(p => p.connected)
        .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, isVip: p.isVip }));

      this.broadcast({
        type: 'LOBBY_UPDATE',
        players: playersList,
        settings: tv.settings
      });
    },

    handleVipStartGame(conn) {
      const tv = appState.tv;
      const connectedCount = Array.from(tv.players.values()).filter(p => p.connected).length;
      if (connectedCount < 3) return;

      this.startGame();
    },

    startGame() {
      const tv = appState.tv;
      tv.questions = pickGameQuestions(tv.settings.categories, tv.totalRounds);
      tv.currentRoundIndex = 0;

      // Reset de puntos de partida
      tv.players.forEach(p => {
        p.score = 0;
        p.fooledVictims = 0;
      });

      // Cambiar a vista de juego en la TV
      document.getElementById('tvViewLobby').classList.add('d-none');
      document.getElementById('tvViewGame').classList.remove('d-none');

      this.startRound();
    },

    startRound() {
      const tv = appState.tv;
      if (tv.currentRoundIndex >= tv.questions.length) {
        this.showFinalPodium();
        return;
      }

      tv.currentQuestion = tv.questions[tv.currentRoundIndex];
      const isFinalRound = tv.currentRoundIndex === tv.totalRounds - 1;

      // Limpiar estados de ronda previa
      tv.players.forEach(p => {
        p.submittedLie = '';
        p.votedOptionId = null;
        p.roundScore = 0;
      });
      tv.options = [];

      // UI Topbar TV
      document.getElementById('tvCurrentRoundBadge').textContent = `Ronda ${tv.currentRoundIndex + 1} de ${tv.totalRounds}`;
      const doubleBadge = document.getElementById('tvDoublePtsBadge');
      if (isFinalRound) {
        doubleBadge.classList.remove('d-none');
      } else {
        doubleBadge.classList.add('d-none');
      }

      // Nombre de Categoría
      const catNames = {
        argentina: '🇦🇷 Argentina',
        historia_insolita: '📜 Historia Insólita',
        leyes_absurdas: '⚖️ Leyes Absurdas',
        ciencia_y_animales: '🔬 Ciencia y Animales',
        cultura_curiosa: '🎩 Cultura Curiosa'
      };
      document.getElementById('tvCurrentCatBadge').textContent = catNames[tv.currentQuestion.categoria] || tv.currentQuestion.categoria;

      // FASE 1: LECTURA
      this.setPhase('phase1');
      document.getElementById('tvConsignaText').innerHTML = tv.currentQuestion.consigna.replace('________', '<strong>________</strong>');

      this.broadcastPhaseState();

      // Pasar automáticamente a Fase 2 luego de 4 segundos
      let count = 4;
      const hint = document.getElementById('tvPhase1Countdown');
      hint.textContent = `Habilitando celulares en ${count}s...`;
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          hint.textContent = `Habilitando celulares en ${count}s...`;
        } else {
          clearInterval(interval);
          this.beginPhase2Writing();
        }
      }, 1000);
    },

    beginPhase2Writing() {
      const tv = appState.tv;
      this.setPhase('phase2');
      document.getElementById('tvConsignaMiniText').innerHTML = tv.currentQuestion.consigna.replace('________', '<strong>________</strong>');

      this.renderPhase2PlayersGrid();
      this.broadcastPhaseState();

      // Temporizador si está activado
      this.startPhaseTimer(tv.settings.timerSec, () => {
        this.beginPhase3Voting();
      });
    },

    renderPhase2PlayersGrid() {
      const tv = appState.tv;
      const grid = document.getElementById('tvPhase2PlayersGrid');
      grid.innerHTML = '';

      tv.players.forEach(p => {
        if (!p.connected) return;
        const pill = document.createElement('div');
        pill.className = `player-status-pill ${p.submittedLie ? 'ready' : ''}`;
        pill.id = `pill-p2-${p.id}`;
        pill.innerHTML = `
          <span>${p.avatar}</span>
          <span>${p.name}:</span>
          <strong>${p.submittedLie ? '✅ ¡Listo!' : '✍️ Pensando...'}</strong>
        `;
        grid.appendChild(pill);
      });
    },

    handlePlayerSubmitChamuyo(conn, data) {
      const tv = appState.tv;
      if (tv.currentPhase !== 'phase2') return;

      const player = tv.players.get(data.playerId);
      if (!player) return;

      const rawLie = (data.lie || '').trim();
      const normLie = normalizeAnswerText(rawLie);
      const normReal = normalizeAnswerText(tv.currentQuestion.respuesta);

      // 1. Detección Anti-Verdad
      let isTruth = normLie === normReal;
      if (!isTruth && Array.isArray(tv.currentQuestion.aceptadas)) {
        isTruth = tv.currentQuestion.aceptadas.some(acc => {
          const normAcc = normalizeAnswerText(acc);
          return normLie === normAcc || normLie.includes(normAcc);
        });
      }

      if (isTruth) {
        conn.send({
          type: 'CHAMUYO_REJECTED',
          reason: 'TRUTH',
          message: '😱 ¡Eso es la VERDAD! Sos un crack, pero tenés que inventar una mentira distinta para engañar al resto.'
        });
        return;
      }

      // 2. Detección de duplicados entre jugadores en la misma ronda
      for (const [, other] of tv.players.entries()) {
        if (other.id !== player.id && other.submittedLie) {
          if (normalizeAnswerText(other.submittedLie) === normLie) {
            conn.send({
              type: 'CHAMUYO_REJECTED',
              reason: 'DUPLICATE',
              message: '⚠️ ¡Otro jugador ya escribió exactamente ese chamuyo! Inventá otro distinto.'
            });
            return;
          }
        }
      }

      // Chamuyo aceptado
      player.submittedLie = capitalizeUniform(rawLie);
      sound.playSubmitted();

      conn.send({
        type: 'CHAMUYO_ACCEPTED',
        lie: player.submittedLie
      });

      this.renderPhase2PlayersGrid();

      // Si todos terminaron, avanzar a votación
      const allSubmitted = Array.from(tv.players.values())
        .filter(p => p.connected)
        .every(p => Boolean(p.submittedLie));

      if (allSubmitted) {
        this.clearPhaseTimer();
        setTimeout(() => this.beginPhase3Voting(), 1200);
      }
    },

    beginPhase3Voting() {
      const tv = appState.tv;
      this.clearPhaseTimer();
      this.setPhase('phase3');

      // Si algún jugador no escribió chamuyo, le asignamos uno por omisión gracioso
      const fallbackLies = ['Una empanada voladora', 'La suegra enojada', 'Un mate con edulcorante', 'Un perro policía'];
      let fIdx = 0;
      tv.players.forEach(p => {
        if (p.connected && !p.submittedLie) {
          p.submittedLie = fallbackLies[fIdx % fallbackLies.length];
          fIdx++;
        }
      });

      // Construir pool de opciones: Chamuyos + Verdad Real
      const options = [];
      tv.players.forEach(p => {
        if (p.connected && p.submittedLie) {
          options.push({
            id: 'opt_' + p.id,
            text: capitalizeUniform(p.submittedLie),
            isTruth: false,
            authorId: p.id,
            authorName: p.name,
            authorAvatar: p.avatar,
            voters: []
          });
        }
      });

      // Agregar la verdad
      options.push({
        id: 'opt_truth',
        text: capitalizeUniform(tv.currentQuestion.respuesta),
        isTruth: true,
        authorId: null,
        authorName: null,
        voters: []
      });

      // Mezclar opciones
      options.sort(() => Math.random() - 0.5);
      tv.options = options;

      // Renderizar Opciones en TV
      document.getElementById('tvConsignaMiniTextVotacion').innerHTML = tv.currentQuestion.consigna.replace('________', '<strong>________</strong>');
      const grid = document.getElementById('tvOptionsGrid');
      grid.innerHTML = '';
      const letters = 'ABCDEFGHIJKLMN';

      options.forEach((opt, idx) => {
        const card = document.createElement('div');
        card.className = 'tv-option-card';
        card.id = `tv-card-${opt.id}`;
        card.innerHTML = `
          <div class="tv-option-letter">OPCIÓN ${letters[idx] || idx + 1}</div>
          <div class="tv-option-text">${opt.text}</div>
          <div class="voters-container" id="voters-${opt.id}"></div>
        `;
        grid.appendChild(card);
      });

      this.renderPhase3VotedGrid();
      this.broadcastPhaseState();

      // Temporizador para votar
      this.startPhaseTimer(tv.settings.timerSec, () => {
        this.beginPhase4Reveal();
      });
    },

    renderPhase3VotedGrid() {
      const tv = appState.tv;
      const grid = document.getElementById('tvPhase3VotedGrid');
      grid.innerHTML = '';

      tv.players.forEach(p => {
        if (!p.connected) return;
        const pill = document.createElement('div');
        pill.className = `player-status-pill ${p.votedOptionId ? 'ready' : ''}`;
        pill.id = `pill-p3-${p.id}`;
        pill.innerHTML = `
          <span>${p.avatar}</span>
          <span>${p.name}:</span>
          <strong>${p.votedOptionId ? '🗳️ ¡Votó!' : '🤔 Eligiendo...'}</strong>
        `;
        grid.appendChild(pill);
      });
    },

    handlePlayerSubmitVote(conn, data) {
      const tv = appState.tv;
      if (tv.currentPhase !== 'phase3') return;

      const player = tv.players.get(data.playerId);
      if (!player) return;

      const optionId = data.optionId;
      const opt = tv.options.find(o => o.id === optionId);
      if (!opt) return;

      // Validación anti-autovoto
      if (opt.authorId === player.id) {
        conn.send({ type: 'VOTE_REJECTED', message: 'No podés votar tu propio chamuyo.' });
        return;
      }

      player.votedOptionId = optionId;
      opt.voters.push({ id: player.id, name: player.name, avatar: player.avatar });
      sound.playSubmitted();

      conn.send({
        type: 'VOTE_ACCEPTED',
        optionId: optionId,
        optionText: opt.text
      });

      this.renderPhase3VotedGrid();

      // Si todos votaron, avanzar a revelación
      const allVoted = Array.from(tv.players.values())
        .filter(p => p.connected)
        .every(p => Boolean(p.votedOptionId));

      if (allVoted) {
        this.clearPhaseTimer();
        setTimeout(() => this.beginPhase4Reveal(), 1200);
      }
    },

    async beginPhase4Reveal() {
      const tv = appState.tv;
      this.clearPhaseTimer();
      this.setPhase('phase4');

      document.getElementById('tvConsignaMiniTextReveal').innerHTML = tv.currentQuestion.consigna.replace('________', '<strong>________</strong>');
      document.getElementById('tvPhase4Actions').classList.add('d-none');
      document.getElementById('tvRoundSummarySection').classList.add('d-none');

      const stage = document.getElementById('tvSpotlightStage');
      stage.classList.remove('d-none');

      this.broadcastPhaseState();

      const isFinalRound = tv.currentRoundIndex === tv.totalRounds - 1;
      const pointsPerFool = isFinalRound ? 1000 : 500;
      const pointsForTruth = isFinalRound ? 2000 : 1000;

      // 1. Filtrar chamuyos que recibieron al menos 1 voto, ordenados de menor a mayor votos
      const votedLies = tv.options
        .filter(o => !o.isTruth && o.voters.length > 0)
        .sort((a, b) => a.voters.length - b.voters.length);

      const spotlightCard = document.getElementById('spotlightCard');
      const spotlightOptLabel = document.getElementById('spotlightOptionLabel');
      const spotlightAnswer = document.getElementById('spotlightAnswerText');
      const spotlightVotersTitle = document.getElementById('spotlightVotersTitle');
      const spotlightVotersWrap = document.getElementById('spotlightVotersWrap');
      const spotlightBottomBar = document.getElementById('spotlightBottomBar');
      const spotlightVerdict = document.getElementById('spotlightVerdictContent');
      const spotlightPoints = document.getElementById('spotlightPointsBadge');
      const spotlightDatoExtra = document.getElementById('spotlightDatoExtra');

      // Secuencia de revelación en Spotlight para cada chamuyo votado
      let lieIndex = 1;
      for (const lie of votedLies) {
        spotlightCard.className = 'spotlight-card revealing';
        spotlightOptLabel.textContent = `CHAMUYO #${lieIndex}`;
        spotlightAnswer.textContent = lie.text;
        spotlightVotersTitle.textContent = `¿Quiénes cayeron en esta trampa?`;
        spotlightDatoExtra.classList.add('d-none');
        spotlightBottomBar.classList.add('d-none');

        spotlightVotersWrap.innerHTML = lie.voters.map(v => 
          `<span class="spotlight-voter-pill">${v.avatar} ${v.name}</span>`
        ).join('');

        sound.playDrumroll();
        await this.delay(1200);

        // Desplegar veredicto inferior tras 1.2 segundos
        spotlightCard.className = 'spotlight-card is-lie';
        sound.playFooled();

        const author = tv.players.get(lie.authorId);
        const earned = lie.voters.length * pointsPerFool;
        if (author) {
          author.score += earned;
          author.roundScore += earned;
          author.fooledVictims += lie.voters.length;
        }

        spotlightBottomBar.className = 'spotlight-bottom-bar lie-verdict';
        spotlightVerdict.innerHTML = `🤥 ¡CHAMUYO DE ${lie.authorAvatar} ${lie.authorName}!`;
        spotlightPoints.textContent = `+${earned} PTS`;
        spotlightBottomBar.classList.remove('d-none');

        lieIndex++;
        await this.delay(3000);
      }

      // 2. Revelar la VERDAD en Spotlight
      const truthOpt = tv.options.find(o => o.isTruth);
      if (truthOpt) {
        spotlightCard.className = 'spotlight-card revealing';
        spotlightOptLabel.textContent = 'LA VERDAD';
        spotlightAnswer.textContent = truthOpt.text;
        spotlightVotersTitle.textContent = '¿Quiénes descubrieron la verdad?';
        spotlightBottomBar.classList.add('d-none');
        spotlightDatoExtra.classList.add('d-none');

        if (truthOpt.voters.length > 0) {
          spotlightVotersWrap.innerHTML = truthOpt.voters.map(v => 
            `<span class="spotlight-voter-pill">${v.avatar} ${v.name}</span>`
          ).join('');
        } else {
          spotlightVotersWrap.innerHTML = '<span class="spotlight-zero-voters">¡Nadie acertó la verdad!</span>';
        }

        sound.playDrumroll();
        await this.delay(1200);

        spotlightCard.className = 'spotlight-card is-truth';
        sound.playTruth();

        // Asignar puntos a los que acertaron la verdad
        truthOpt.voters.forEach(v => {
          const p = tv.players.get(v.id);
          if (p) {
            p.score += pointsForTruth;
            p.roundScore += pointsForTruth;
          }
        });

        spotlightBottomBar.className = 'spotlight-bottom-bar truth-verdict';
        spotlightVerdict.innerHTML = '✅ ¡LA VERDAD!';
        spotlightPoints.textContent = `+${pointsForTruth} PTS a cada acertante`;
        spotlightBottomBar.classList.remove('d-none');

        // Mostrar Dato Extra
        document.getElementById('spotlightDatoExtraText').textContent = tv.currentQuestion.datoExtra;
        spotlightDatoExtra.classList.remove('d-none');

        await this.delay(3500);
      }

      // 3. Momento B: Resumen Final de la Ronda (Grilla Limpia de 2 Columnas)
      stage.classList.add('d-none');

      const summaryGrid = document.getElementById('tvSummaryGrid');
      summaryGrid.innerHTML = '';

      // Ordenar: primero la verdad, luego el resto de opciones
      const orderedOptions = [...tv.options].sort((a, b) => (b.isTruth ? 1 : 0) - (a.isTruth ? 1 : 0));

      orderedOptions.forEach(opt => {
        const card = document.createElement('div');
        card.className = `summary-card ${opt.isTruth ? 'is-truth' : 'is-lie'}`;

        const badgeHtml = opt.isTruth
          ? `<span class="summary-author-badge">✅ LA VERDAD</span>`
          : `<span class="summary-author-badge">🤥 De: ${opt.authorAvatar} ${opt.authorName}</span>`;

        let votersHtml = '';
        if (opt.voters && opt.voters.length > 0) {
          votersHtml = opt.voters.map(v => 
            `<span class="summary-voter-pill">${v.avatar} ${v.name}</span>`
          ).join('');
        } else {
          votersHtml = opt.isTruth 
            ? `<span class="summary-zero-voters">Nadie acertó</span>`
            : `<span class="summary-zero-voters">Nadie cayó en este chamuyo</span>`;
        }

        card.innerHTML = `
          <div class="summary-card-header">
            <span class="summary-answer-title">${opt.text}</span>
            ${badgeHtml}
          </div>
          <div class="summary-card-footer">
            ${votersHtml}
          </div>
        `;
        summaryGrid.appendChild(card);
      });

      document.getElementById('tvRoundSummarySection').classList.remove('d-none');
      document.getElementById('tvPhase4Actions').classList.remove('d-none');

      this.broadcast({
        type: 'PHASE4_REVEAL_DONE'
      });
    },

    showLeaderboard() {
      const tv = appState.tv;
      this.setPhase('phase5');

      const isFinalRound = tv.currentRoundIndex === tv.totalRounds - 1;
      const sorted = Array.from(tv.players.values()).sort((a, b) => b.score - a.score);

      const tbody = document.getElementById('tvLeaderboardBody');
      tbody.innerHTML = '';

      sorted.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = `rank-${idx + 1}`;
        tr.innerHTML = `
          <td><span class="rank-pill">${idx + 1}</span></td>
          <td>
            <div class="player-cell">
              <span class="avatar">${p.avatar}</span>
              <span>${p.name}</span>
            </div>
          </td>
          <td><span class="delta-badge">+${p.roundScore}</span></td>
          <td class="total-score">${p.score}</td>
        `;
        tbody.appendChild(tr);
      });

      const btnNext = document.getElementById('btnTvNextRound');
      const btnRestart = document.getElementById('btnTvRestartGame');
      const podium = document.getElementById('tvPodiumContainer');

      if (isFinalRound) {
        document.getElementById('tvLeaderboardTitle').textContent = 'PODIO FINAL';
        podium.classList.remove('d-none');
        this.renderPodiumSteps(sorted);

        btnNext.classList.add('d-none');
        btnRestart.classList.remove('d-none');
        this.launchConfetti();
      } else {
        document.getElementById('tvLeaderboardTitle').textContent = 'TABLA DE POSICIONES';
        podium.classList.add('d-none');
        btnNext.classList.remove('d-none');
        btnRestart.classList.add('d-none');
      }

      this.broadcastPhaseState();
    },

    renderPodiumSteps(sorted) {
      const tv = appState.tv;
      const steps = document.getElementById('tvPodiumSteps');
      steps.innerHTML = '';

      const top3 = sorted.slice(0, 3);
      top3.forEach((p, idx) => {
        const step = document.createElement('div');
        step.className = `podium-step step-${idx + 1}`;
        step.innerHTML = `
          <div class="podium-avatar">${p.avatar}</div>
          <div class="podium-name">${p.name}</div>
          <div class="podium-score">${p.score} pts</div>
          <div class="podium-block">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</div>
        `;
        steps.appendChild(step);
      });

      // Mención especial Rey del Chamuyo
      let bestFooled = sorted[0];
      sorted.forEach(p => {
        if (p.fooledVictims > bestFooled.fooledVictims) {
          bestFooled = p;
        }
      });

      if (bestFooled && bestFooled.fooledVictims > 0) {
        document.getElementById('tvReyChamuyoName').textContent = `${bestFooled.avatar} ${bestFooled.name}`;
        document.getElementById('tvReyChamuyoVictims').textContent = `¡Engañó a ${bestFooled.fooledVictims} amigos en toda la partida!`;
      } else {
        document.getElementById('tvReyChamuyoName').textContent = 'Nadie engañó a nadie';
        document.getElementById('tvReyChamuyoVictims').textContent = 'Faltó filo para el chamuyo';
      }
    },

    handleVipNextPhase(conn) {
      const tv = appState.tv;
      if (tv.currentPhase === 'phase4') {
        this.showLeaderboard();
      } else if (tv.currentPhase === 'phase5') {
        tv.currentRoundIndex++;
        this.startRound();
      }
    },

    handleVipRestartGame() {
      const tv = appState.tv;
      document.getElementById('tvPodiumContainer').classList.add('d-none');
      this.startGame();
    },

    setPhase(phaseName) {
      const tv = appState.tv;
      tv.currentPhase = phaseName;
      ['tvPhase1', 'tvPhase2', 'tvPhase3', 'tvPhase4', 'tvPhase5'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.add('d-none');
          el.classList.remove('active');
        }
      });
      const currentEl = document.getElementById('tvPhase' + phaseName.slice(5));
      if (currentEl) {
        currentEl.classList.remove('d-none');
        currentEl.classList.add('active');
      }
    },

    startPhaseTimer(seconds, onExpire) {
      this.clearPhaseTimer();
      const tv = appState.tv;
      const box = document.getElementById('tvTimerBox');
      const text = document.getElementById('tvTimerSec');

      if (!seconds || seconds <= 0) {
        box.classList.add('d-none');
        return;
      }

      box.classList.remove('d-none');
      tv.timerRemaining = seconds;
      text.textContent = tv.timerRemaining;

      tv.timerInterval = setInterval(() => {
        tv.timerRemaining--;
        text.textContent = tv.timerRemaining;
        if (tv.timerRemaining <= 5 && tv.timerRemaining > 0) {
          sound.playTick();
        }
        if (tv.timerRemaining <= 0) {
          this.clearPhaseTimer();
          if (typeof onExpire === 'function') onExpire();
        }
      }, 1000);
    },

    clearPhaseTimer() {
      const tv = appState.tv;
      if (tv.timerInterval) {
        clearInterval(tv.timerInterval);
        tv.timerInterval = null;
      }
      document.getElementById('tvTimerBox').classList.add('d-none');
    },

    sendPlayerStateSync(player) {
      if (!player.conn || !player.connected) return;
      const tv = appState.tv;

      // Opciones para votar (excluyendo su propia mentira)
      const optionsForPlayer = tv.options
        ? tv.options
            .filter(o => o.authorId !== player.id)
            .map(o => ({ id: o.id, text: o.text }))
        : [];

      // Calcular puesto y delta del jugador
      const sorted = Array.from(tv.players.values()).sort((a, b) => b.score - a.score);
      const myRank = sorted.findIndex(p => p.id === player.id) + 1;

      player.conn.send({
        type: 'SYNC_PLAYER_STATE',
        phase: tv.currentPhase,
        isVip: player.isVip,
        settings: tv.settings,
        question: tv.currentQuestion ? {
          consigna: tv.currentQuestion.consigna,
          categoria: tv.currentQuestion.categoria,
          roundIndex: tv.currentRoundIndex + 1,
          totalRounds: tv.totalRounds,
          isDoublePoints: tv.currentRoundIndex === tv.totalRounds - 1
        } : null,
        myLie: player.submittedLie,
        options: optionsForPlayer,
        myVotedId: player.votedOptionId,
        myScore: player.score,
        myDelta: player.roundScore,
        myRank: myRank || 1
      });
    },

    broadcastPhaseState() {
      const tv = appState.tv;
      tv.players.forEach(p => {
        this.sendPlayerStateSync(p);
      });
    },

    broadcast(msg) {
      const tv = appState.tv;
      tv.players.forEach(p => {
        if (p.conn && p.connected) {
          p.conn.send(msg);
        }
      });
    },

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    launchConfetti() {
      const canvas = document.getElementById('confettiCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const pieces = [];
      const colors = ['#f59e0b', '#d946ef', '#10b981', '#06b6d4', '#ef4444', '#fff'];
      for (let i = 0; i < 120; i++) {
        pieces.push({
          x: Math.random() * canvas.width,
          y: Math.random() * -canvas.height,
          w: Math.random() * 12 + 6,
          h: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 4 + 3,
          rot: Math.random() * 360,
          vrot: (Math.random() - 0.5) * 6
        });
      }

      let frames = 0;
      function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vrot;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });

        frames++;
        if (frames < 200) {
          requestAnimationFrame(render);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      render();
    },

    bindUiEvents() {
      // Botón TV Iniciar Partida
      document.getElementById('btnTvStartGame').addEventListener('click', () => {
        this.startGame();
      });

      // Botón TV Saltar Fase
      document.getElementById('btnTvSkipPhase').addEventListener('click', () => {
        const tv = appState.tv;
        if (tv.currentPhase === 'phase2') {
          this.beginPhase3Voting();
        } else if (tv.currentPhase === 'phase3') {
          this.beginPhase4Reveal();
        } else if (tv.currentPhase === 'phase4') {
          this.showLeaderboard();
        } else if (tv.currentPhase === 'phase5') {
          tv.currentRoundIndex++;
          this.startRound();
        }
      });

      // Botón TV desde Revelación a Posiciones
      document.getElementById('btnTvNextFromReveal').addEventListener('click', () => {
        this.showLeaderboard();
      });

      // Botón TV Siguiente Ronda
      document.getElementById('btnTvNextRound').addEventListener('click', () => {
        appState.tv.currentRoundIndex++;
        this.startRound();
      });

      // Botón TV Reiniciar
      document.getElementById('btnTvRestartGame').addEventListener('click', () => {
        this.handleVipRestartGame();
      });
    }
  };

  // =========================================================================
  // 7. MOTOR DE CELULAR JUGADOR (MANDO)
  // =========================================================================
  const PhoneClient = {
    init(preloadedRoomCode) {
      limpiarConexionPrevia();
      appState.mode = 'phone';
      const phone = appState.phone;

      // Obtener o generar playerId persistente
      phone.playerId = sessionStorage.getItem('chamuyo_player_id') || 
        ('p_' + Math.random().toString(36).substring(2, 9));
      sessionStorage.setItem('chamuyo_player_id', phone.playerId);

      // Cargar datos previos
      phone.name = sessionStorage.getItem('chamuyo_player_name') || '';
      phone.avatar = sessionStorage.getItem('chamuyo_player_avatar') || '🦊';
      
      const storedRoom = (sessionStorage.getItem('chamuyo_room_code') || sessionStorage.getItem('codigoSala') || '').trim().toUpperCase();
      const targetRoom = (preloadedRoomCode || storedRoom || '').trim().toUpperCase();

      // Si el código target es diferente al guardado previamente, sobrescribir y limpiar ronda previa
      if (targetRoom && targetRoom !== storedRoom) {
        sessionStorage.setItem('chamuyo_room_code', targetRoom);
        sessionStorage.setItem('codigoSala', targetRoom);
        phone.myLie = '';
        phone.myVotedId = null;
      }

      document.getElementById('screenLanding').classList.add('d-none');
      document.getElementById('screenLanding').classList.remove('active');
      document.getElementById('screenPhone').classList.remove('d-none');
      document.getElementById('screenPhone').classList.add('active');

      this.renderAvatarPicker();
      this.bindUiEvents();

      if (targetRoom) {
        document.getElementById('inputPhoneRoom').value = targetRoom;
      }
      if (phone.name) {
        document.getElementById('inputPhoneName').value = phone.name;
      }

      // Si ya tiene sala y nombre, conectar automáticamente
      if (targetRoom && phone.name) {
        this.connectToTv(targetRoom, phone.name, phone.avatar);
      }
    },

    renderAvatarPicker() {
      const grid = document.getElementById('avatarPickerGrid');
      grid.innerHTML = '';
      const phone = appState.phone;

      AVATARS.forEach(av => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `avatar-btn ${av === phone.avatar ? 'selected' : ''}`;
        btn.textContent = av;
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          phone.avatar = av;
          document.getElementById('inputChosenAvatar').value = av;
        });
        grid.appendChild(btn);
      });
    },

    connectToTv(roomCode, playerName, avatar) {
      limpiarConexionPrevia();
      const phone = appState.phone;
      phone.name = playerName;
      phone.avatar = avatar;
      appState.roomCode = (roomCode || '').trim().toUpperCase();

      sessionStorage.setItem('chamuyo_room_code', appState.roomCode);
      sessionStorage.setItem('codigoSala', appState.roomCode);
      sessionStorage.setItem('chamuyo_player_name', playerName);
      sessionStorage.setItem('chamuyo_player_avatar', avatar);

      document.getElementById('roomBadgeWrap').classList.remove('d-none');
      document.getElementById('headerRoomCode').textContent = appState.roomCode;
      document.getElementById('phoneRoomLabel').textContent = appState.roomCode;
      document.getElementById('phoneMyAvatar').textContent = avatar;
      document.getElementById('phoneMyName').textContent = playerName;

      const alertEl = document.getElementById('phoneJoinAlert');
      alertEl.className = 'phone-alert alert-warning';
      alertEl.textContent = 'Conectando con la TV...';
      alertEl.classList.remove('d-none');

      // Crear Peer cliente
      const peer = new Peer({ debug: 1 });
      appState.peer = peer;

      peer.on('open', (id) => {
        const targetHostId = PEER_PREFIX + appState.roomCode;
        const conn = peer.connect(targetHostId, { reliable: true });
        phone.conn = conn;

        conn.on('open', () => {
          alertEl.classList.add('d-none');
          // Enviar JOIN o RECONNECT con identidad persistente
          conn.send({
            type: 'JOIN_OR_RECONNECT',
            playerId: phone.playerId,
            name: phone.name,
            avatar: phone.avatar
          });

          this.showView('phoneViewLobby');

          // Heartbeat para mantener activo el canal WebRTC en celular
          if (appState.heartbeatInterval) clearInterval(appState.heartbeatInterval);
          appState.heartbeatInterval = setInterval(() => {
            if (conn && conn.open) {
              conn.send({ type: 'PING' });
            }
          }, 5000);
        });

        conn.on('data', (data) => {
          this.handleIncomingData(data);
        });

        conn.on('close', () => {
          console.warn('Conexión cerrada con la TV');
        });

        conn.on('error', (err) => {
          console.error('Error de conexión con TV:', err);
          this.handlePeerUnavailable(appState.roomCode);
        });
      });

      peer.on('error', (err) => {
        console.error('Error Peer Celular:', err);
        if (err.type === 'peer-unavailable') {
          this.handlePeerUnavailable(appState.roomCode);
        } else {
          alertEl.className = 'phone-alert alert-danger';
          alertEl.textContent = 'Error de red. Verificá tu conexión o código de sala.';
          alertEl.classList.remove('d-none');
        }
      });
    },

    handlePeerUnavailable(roomCode) {
      sessionStorage.removeItem('chamuyo_room_code');
      sessionStorage.removeItem('codigoSala');
      limpiarConexionPrevia();

      this.showView('phoneViewJoin');
      const alertEl = document.getElementById('phoneJoinAlert');
      alertEl.className = 'phone-alert alert-warning';
      alertEl.innerHTML = `
        <div>⚠️ La sala <strong>${roomCode}</strong> ya no existe o la TV cambió de sala.</div>
        <button type="button" class="btn btn-sm btn-outline-light mt-2" id="btnRetryOtherRoom">🔄 Conectar a otra sala</button>
      `;
      alertEl.classList.remove('d-none');

      document.getElementById('btnRetryOtherRoom')?.addEventListener('click', () => {
        alertEl.classList.add('d-none');
        const inputRoom = document.getElementById('inputPhoneRoom');
        if (inputRoom) {
          inputRoom.value = '';
          inputRoom.focus();
        }
      });
    },

    handleIncomingData(data) {
      if (!data || !data.type) return;
      const phone = appState.phone;

      switch (data.type) {
        case 'SYNC_PLAYER_STATE':
          this.handleStateSync(data);
          break;
        case 'LOBBY_UPDATE':
          this.handleLobbyUpdate(data);
          break;
        case 'CHAMUYO_ACCEPTED':
          document.getElementById('phoneWriteBox').classList.add('d-none');
          document.getElementById('phoneChamuyoSent').classList.remove('d-none');
          document.getElementById('phoneMyLieText').textContent = data.lie;
          break;
        case 'CHAMUYO_REJECTED':
          const cAlert = document.getElementById('phoneChamuyoAlert');
          cAlert.className = data.reason === 'TRUTH' ? 'phone-alert alert-truth' : 'phone-alert alert-danger';
          cAlert.textContent = data.message;
          cAlert.classList.remove('d-none');
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          break;
        case 'VOTE_ACCEPTED':
          document.getElementById('phoneVotingOptionsList').classList.add('d-none');
          document.getElementById('phoneVoteSent').classList.remove('d-none');
          document.getElementById('phoneMyVotedOption').textContent = data.optionText;
          break;
        case 'VOTE_REJECTED':
          alert(data.message);
          break;
        case 'PHASE4_REVEAL_DONE':
          if (phone.isVip) {
            document.getElementById('phoneVipPhase4Action').classList.remove('d-none');
          }
          break;
      }
    },

    handleLobbyUpdate(data) {
      const phone = appState.phone;
      if (data.players) {
        const me = data.players.find(p => p.id === phone.playerId);
        if (me && me.isVip !== phone.isVip) {
          phone.isVip = me.isVip;
          this.updateVipRoleUI();
        }

        const count = data.players.length;
        const btnVip = document.getElementById('btnPhoneVipStart');
        const hintVip = document.getElementById('phoneVipStartHint');
        if (btnVip) {
          if (count >= 3) {
            btnVip.disabled = false;
            hintVip.textContent = `¡Todo listo! (${count} jugadores)`;
          } else {
            btnVip.disabled = true;
            hintVip.textContent = `Se necesitan al menos 3 jugadores (${count}/3)`;
          }
        }
      }
    },

    handleStateSync(state) {
      const phone = appState.phone;
      phone.isVip = Boolean(state.isVip);
      this.updateVipRoleUI();

      if (state.phase === 'lobby') {
        this.showView('phoneViewLobby');
      } else if (state.phase === 'phase1') {
        this.showView('phonePhase1');
        if (state.question) {
          document.getElementById('phoneP1Round').textContent = state.question.roundIndex;
        }
      } else if (state.phase === 'phase2') {
        this.showView('phonePhase2');
        if (state.question) {
          document.getElementById('phoneP2Consigna').textContent = state.question.consigna;
        }
        const alertBox = document.getElementById('phoneChamuyoAlert');
        alertBox.classList.add('d-none');

        if (state.myLie) {
          document.getElementById('phoneWriteBox').classList.add('d-none');
          document.getElementById('phoneChamuyoSent').classList.remove('d-none');
          document.getElementById('phoneMyLieText').textContent = state.myLie;
        } else {
          document.getElementById('phoneWriteBox').classList.remove('d-none');
          document.getElementById('phoneChamuyoSent').classList.add('d-none');
          document.getElementById('inputChamuyo').value = '';
          document.getElementById('chamuyoCharCount').textContent = '0';
        }
      } else if (state.phase === 'phase3') {
        this.showView('phonePhase3');
        if (state.question) {
          document.getElementById('phoneP3Consigna').textContent = state.question.consigna;
        }
        if (state.myVotedId) {
          document.getElementById('phoneVotingOptionsList').classList.add('d-none');
          document.getElementById('phoneVoteSent').classList.remove('d-none');
        } else {
          document.getElementById('phoneVotingOptionsList').classList.remove('d-none');
          document.getElementById('phoneVoteSent').classList.add('d-none');
          this.renderVotingButtons(state.options || []);
        }
      } else if (state.phase === 'phase4') {
        this.showView('phonePhase4');
        if (phone.isVip) {
          document.getElementById('phoneVipPhase4Action').classList.add('d-none');
        }
      } else if (state.phase === 'phase5') {
        this.showView('phonePhase5');
        document.getElementById('phoneMyRankBadge').textContent = `#${state.myRank || 1}`;
        document.getElementById('phoneMyTotalScore').textContent = state.myScore || 0;
        document.getElementById('phoneMyScoreDelta').textContent = `+${state.myDelta || 0} pts en esta ronda`;

        const vipNextWrap = document.getElementById('phoneVipNextRoundWrap');
        const btnNext = document.getElementById('phoneVipNextRound');
        const btnRestart = document.getElementById('phoneVipRestart');

        if (phone.isVip) {
          vipNextWrap.classList.remove('d-none');
          if (state.question && state.question.roundIndex >= state.question.totalRounds) {
            btnNext.classList.add('d-none');
            btnRestart.classList.remove('d-none');
          } else {
            btnNext.classList.remove('d-none');
            btnRestart.classList.add('d-none');
          }
        } else {
          vipNextWrap.classList.add('d-none');
        }
      }
    },

    updateVipRoleUI() {
      const phone = appState.phone;
      const vipBadge = document.getElementById('phoneVipBadge');
      const nonVipMsg = document.getElementById('phoneNonVipMsg');
      const vipControls = document.getElementById('phoneVipControls');

      if (phone.isVip) {
        vipBadge.classList.remove('d-none');
        nonVipMsg.classList.add('d-none');
        vipControls.classList.remove('d-none');
      } else {
        vipBadge.classList.add('d-none');
        nonVipMsg.classList.remove('d-none');
        vipControls.classList.add('d-none');
      }
    },

    renderVotingButtons(options) {
      const list = document.getElementById('phoneVotingOptionsList');
      list.innerHTML = '';

      if (!options || options.length === 0) {
        list.innerHTML = '<p class="text-muted text-center">No hay opciones disponibles para votar.</p>';
        return;
      }

      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-vote-option';
        btn.textContent = opt.text;
        btn.addEventListener('click', () => {
          if (confirm(`¿Querés votar por "${opt.text}"?`)) {
            appState.phone.conn.send({
              type: 'SUBMIT_VOTE',
              playerId: appState.phone.playerId,
              optionId: opt.id
            });
          }
        });
        list.appendChild(btn);
      });
    },

    showView(viewId) {
      ['phoneViewJoin', 'phoneViewLobby', 'phonePhase1', 'phonePhase2', 'phonePhase3', 'phonePhase4', 'phonePhase5'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.add('d-none');
          el.classList.remove('active');
        }
      });
      const target = document.getElementById(viewId);
      if (target) {
        target.classList.remove('d-none');
        target.classList.add('active');
      }
    },

    bindUiEvents() {
      const phone = appState.phone;

      // Botón Enviar Registro
      document.getElementById('btnSubmitJoin').addEventListener('click', () => {
        const roomInput = document.getElementById('inputPhoneRoom').value.trim().toUpperCase();
        const nameInput = document.getElementById('inputPhoneName').value.trim();
        const avatarInput = document.getElementById('inputChosenAvatar').value;

        if (!roomInput || roomInput.length !== 4) {
          alert('Por favor ingresá un código de sala válido de 4 letras.');
          return;
        }
        if (!nameInput) {
          alert('Por favor escribí tu nombre o apodo.');
          return;
        }

        this.connectToTv(roomInput, nameInput, avatarInput);
      });

      // Botón Toggle Categorías VIP
      document.getElementById('btnVipToggleAllCats').addEventListener('click', () => {
        const boxes = document.querySelectorAll('input[name="vipCat"]');
        const anyUnchecked = Array.from(boxes).some(b => !b.checked);
        boxes.forEach(b => b.checked = anyUnchecked);
        this.emitVipSettings();
      });

      // Cambios en Configuración VIP
      document.querySelectorAll('input[name="vipCat"], input[name="vipRounds"], input[name="vipTimer"]').forEach(el => {
        el.addEventListener('change', () => this.emitVipSettings());
      });

      // Botón Arrancar Partida VIP
      document.getElementById('btnPhoneVipStart').addEventListener('click', () => {
        if (phone.conn && phone.conn.open) {
          phone.conn.send({ type: 'VIP_START_GAME' });
        }
      });

      // Contador de caracteres de Chamuyo
      const txtChamuyo = document.getElementById('inputChamuyo');
      txtChamuyo.addEventListener('input', () => {
        document.getElementById('chamuyoCharCount').textContent = txtChamuyo.value.length;
        document.getElementById('phoneChamuyoAlert').classList.add('d-none');
      });

      // Botón Enviar Chamuyo
      document.getElementById('btnSubmitChamuyo').addEventListener('click', () => {
        const val = txtChamuyo.value.trim();
        if (!val) {
          alert('Escribí una mentira creíble antes de enviar.');
          return;
        }
        if (phone.conn && phone.conn.open) {
          phone.conn.send({
            type: 'SUBMIT_CHAMUYO',
            playerId: phone.playerId,
            lie: val
          });
        }
      });

      // Botón VIP Continuar desde Revelación
      document.getElementById('btnPhoneVipNextFromReveal').addEventListener('click', () => {
        if (phone.conn && phone.conn.open) {
          phone.conn.send({ type: 'VIP_NEXT_PHASE' });
        }
      });

      // Botón VIP Siguiente Ronda
      document.getElementById('btnPhoneVipNextRound').addEventListener('click', () => {
        if (phone.conn && phone.conn.open) {
          phone.conn.send({ type: 'VIP_NEXT_PHASE' });
        }
      });

      // Botón VIP Reiniciar Partida
      document.getElementById('btnPhoneVipRestart').addEventListener('click', () => {
        if (phone.conn && phone.conn.open) {
          phone.conn.send({ type: 'VIP_RESTART_GAME' });
        }
      });

      // Botón Cambiar de Sala desde el Celular
      document.getElementById('btnChangeRoomPhone')?.addEventListener('click', () => {
        sessionStorage.removeItem('chamuyo_room_code');
        sessionStorage.removeItem('codigoSala');
        limpiarConexionPrevia();
        this.showView('phoneViewJoin');
        const inputRoom = document.getElementById('inputPhoneRoom');
        if (inputRoom) {
          inputRoom.value = '';
          inputRoom.focus();
        }
      });
    },

    emitVipSettings() {
      const phone = appState.phone;
      if (!phone.isVip || !phone.conn || !phone.conn.open) return;

      const checkedCats = Array.from(document.querySelectorAll('input[name="vipCat"]:checked')).map(el => el.value);
      const rounds = parseInt(document.querySelector('input[name="vipRounds"]:checked')?.value || '7', 10);
      const timerSec = parseInt(document.querySelector('input[name="vipTimer"]:checked')?.value || '45', 10);

      phone.conn.send({
        type: 'VIP_UPDATE_SETTINGS',
        settings: {
          categories: checkedCats.length > 0 ? checkedCats : ['argentina', 'historia_insolita', 'leyes_absurdas', 'ciencia_y_animales', 'cultura_curiosa'],
          rounds: rounds,
          timerSec: timerSec
        }
      });
    }
  };

  // =========================================================================
  // 8. ROUTING & CONTROLES UNIVERSALES
  // =========================================================================
  function initRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('sala');

    if (roomParam) {
      const cleanRoom = roomParam.trim().toUpperCase();
      const storedRoom = (sessionStorage.getItem('chamuyo_room_code') || sessionStorage.getItem('codigoSala') || '').trim().toUpperCase();
      if (cleanRoom !== storedRoom) {
        sessionStorage.setItem('chamuyo_room_code', cleanRoom);
        sessionStorage.setItem('codigoSala', cleanRoom);
      }
      // Escaneo de QR o enlace directo a sala -> Mando Celular directo
      PhoneClient.init(cleanRoom);
    } else {
      // Portada con opciones
      document.getElementById('screenLanding').classList.add('active');

      document.getElementById('btnSelectTvMode').addEventListener('click', () => {
        TvHost.init();
      });

      document.getElementById('btnManualJoinRoom').addEventListener('click', () => {
        const code = document.getElementById('inputManualRoomCode').value.trim();
        if (code.length === 4) {
          const cleanManual = code.toUpperCase();
          sessionStorage.setItem('chamuyo_room_code', cleanManual);
          sessionStorage.setItem('codigoSala', cleanManual);
          PhoneClient.init(cleanManual);
        } else {
          alert('Por favor ingresá un código de 4 letras.');
        }
      });

      document.getElementById('inputManualRoomCode').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('btnManualJoinRoom').click();
        }
      });
    }
  }

  function bindGlobalControls() {
    // Sonido
    const btnSound = document.getElementById('btnToggleSound');
    const soundIcon = document.getElementById('soundIcon');
    btnSound.addEventListener('click', () => {
      const on = sound.toggle();
      soundIcon.textContent = on ? '🔊' : '🔇';
    });

    // Pantalla Completa
    const btnFs = document.getElementById('btnToggleFs');
    btnFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const fsIcon = document.getElementById('fsIcon');
      if (document.fullscreenElement) {
        fsIcon.textContent = '📺';
      } else {
        fsIcon.textContent = '📺';
      }
    });
  }

  // =========================================================================
  // 9. INICIALIZACIÓN
  // =========================================================================
  window.addEventListener('DOMContentLoaded', async () => {
    bindGlobalControls();
    await loadQuestionsData();
    initRouting();
  });

})();
