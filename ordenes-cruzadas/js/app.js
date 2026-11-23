/**
 * Órdenes Cruzadas - Aplicación Principal y Control de Red PeerJS
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. SISTEMA DE AUDIO (WEB AUDIO API)
  // ==========================================================================
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function playTone(freq, type, duration, gainStart = 0.25, gainEnd = 0.001) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gain.gain.setValueAtTime(gainStart, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainEnd, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playJoin() {
    playTone(440, 'sine', 0.1, 0.2, 0.01);
    setTimeout(() => playTone(660, 'sine', 0.18, 0.25, 0.01), 100);
  }

  function playProgramLocked() {
    playTone(523.25, 'triangle', 0.12, 0.2, 0.01);
    setTimeout(() => playTone(784, 'triangle', 0.2, 0.25, 0.01), 100);
  }

  function playRobotMove() {
    playTone(280, 'sawtooth', 0.1, 0.15, 0.01);
  }

  function playLaser() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(900, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } catch (e) {}
  }

  function playExplosion() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      // Ruido grave + oscilador descendente
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  }

  function playCheckpoint() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'sine', 0.25, 0.25, 0.01), i * 90);
    });
  }

  function playVictory() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 'square', 0.35, 0.2, 0.01), i * 140);
    });
  }

  // ==========================================================================
  // 2. CONSTANTES Y CONFIGURACIÓN
  // ==========================================================================
  const PEER_PREFIX = 'ORD_';
  const ROBOT_COLORS = [
    { id: 'red', hex: '#ef4444', name: 'Rojo Neón' },
    { id: 'blue', hex: '#3b82f6', name: 'Azul Eléctrico' },
    { id: 'green', hex: '#10b981', name: 'Verde Esmeralda' },
    { id: 'yellow', hex: '#f59e0b', name: 'Amarillo Solar' },
    { id: 'purple', hex: '#a855f7', name: 'Violeta Plasma' },
    { id: 'orange', hex: '#f97316', name: 'Naranja Fuego' }
  ];

  // ==========================================================================
  // 3. ESTADO GLOBAL
  // ==========================================================================
  let peer = null;
  let isTvMode = false;
  let isPhoneMode = false;
  let currentRoomCode = '';
  let peerResilienceHost = null;
  let peerResilienceClient = null;

  // Host state
  let hostConnections = new Map(); // playerId -> dataConnection
  let gameState = null;
  let timerInterval = null;
  let remainingTimerSecs = 0;
  let currentExecutingStep = 0;

  // Phone state
  let myPlayerId = '';
  let myPlayerName = '';
  let myPlayerColor = ROBOT_COLORS[0].hex;
  let myPlayerAvatar = '🤖';
  let myPhoneConn = null;
  let myHandCards = [];
  let myProgramSlots = [null, null, null, null];
  let myLockedSlots = [false, false, false, false];
  let myProgramLocked = false;
  let isVipPlayer = false;

  // ==========================================================================
  // 4. ELEMENTOS DEL DOM
  // ==========================================================================
  const dom = {
    // Header
    roomBadgeWrap: document.getElementById('roomBadgeWrap'),
    headerRoomCode: document.getElementById('headerRoomCode'),
    btnToggleSound: document.getElementById('btnToggleSound'),
    soundIcon: document.getElementById('soundIcon'),
    btnToggleFs: document.getElementById('btnToggleFs'),
    fsIcon: document.getElementById('fsIcon'),

    // Screens
    screenLanding: document.getElementById('screenLanding'),
    screenTv: document.getElementById('screenTv'),
    screenPhone: document.getElementById('screenPhone'),

    // Landing
    btnSelectTvMode: document.getElementById('btnSelectTvMode'),
    btnSelectPhoneMode: document.getElementById('btnSelectPhoneMode'),
    inputManualRoomCode: document.getElementById('inputManualRoomCode'),
    btnManualJoinRoom: document.getElementById('btnManualJoinRoom'),

    // TV Views
    tvViewLobby: document.getElementById('tvViewLobby'),
    tvRoomCodeText: document.getElementById('tvRoomCodeText'),
    tvLobbyQr: document.getElementById('tvLobbyQr'),
    tvConfigArenaName: document.getElementById('tvConfigArenaName'),
    tvConfigDamageRule: document.getElementById('tvConfigDamageRule'),
    tvConfigRoundTimer: document.getElementById('tvConfigRoundTimer'),
    tvLobbyStatusMsg: document.getElementById('tvLobbyStatusMsg'),
    btnTvStartGame: document.getElementById('btnTvStartGame'),
    tvPlayerCount: document.getElementById('tvPlayerCount'),
    tvPlayersList: document.getElementById('tvPlayersList'),

    tvViewArena: document.getElementById('tvViewArena'),
    tvHudRound: document.getElementById('tvHudRound'),
    tvHudArenaName: document.getElementById('tvHudArenaName'),
    tvHudBannerTitle: document.getElementById('tvHudBannerTitle'),
    tvHudBannerSub: document.getElementById('tvHudBannerSub'),
    tvHudTimerWrap: document.getElementById('tvHudTimerWrap'),
    tvHudTimerSecs: document.getElementById('tvHudTimerSecs'),
    tvPilotsStrip: document.getElementById('tvPilotsStrip'),
    tvExecutionCardsBar: document.getElementById('tvExecutionCardsBar'),
    tvExecStepTitle: document.getElementById('tvExecStepTitle'),
    tvExecCardsRow: document.getElementById('tvExecCardsRow'),
    tvBoardGrid: document.getElementById('tvBoardGrid'),
    tvLaserSvg: document.getElementById('tvLaserSvg'),
    tvRobotsLayer: document.getElementById('tvRobotsLayer'),

    tvViewPodium: document.getElementById('tvViewPodium'),
    tvWinnerCard: document.getElementById('tvWinnerCard'),
    tvPodiumStats: document.getElementById('tvPodiumStats'),
    btnTvPlayAgain: document.getElementById('btnTvPlayAgain'),
    btnTvBackToLobby: document.getElementById('btnTvBackToLobby'),

    // Phone Views
    phoneViewJoin: document.getElementById('phoneViewJoin'),
    phoneJoinAlert: document.getElementById('phoneJoinAlert'),
    inputPhoneRoom: document.getElementById('inputPhoneRoom'),
    inputPhoneName: document.getElementById('inputPhoneName'),
    phoneColorPalette: document.getElementById('phoneColorPalette'),
    btnPhoneConnect: document.getElementById('btnPhoneConnect'),

    phoneViewLobby: document.getElementById('phoneViewLobby'),
    phoneLobbyRobotBadge: document.getElementById('phoneLobbyRobotBadge'),
    phoneLobbyPlayerName: document.getElementById('phoneLobbyPlayerName'),
    phoneLobbyRoomCode: document.getElementById('phoneLobbyRoomCode'),
    phoneVipControls: document.getElementById('phoneVipControls'),
    selectArenaMap: document.getElementById('selectArenaMap'),
    selectDamageRule: document.getElementById('selectDamageRule'),
    selectRoundTimer: document.getElementById('selectRoundTimer'),
    btnPhoneVipStart: document.getElementById('btnPhoneVipStart'),
    phoneRegularWaiting: document.getElementById('phoneRegularWaiting'),

    phoneViewProgramming: document.getElementById('phoneViewProgramming'),
    phoneHudAvatar: document.getElementById('phoneHudAvatar'),
    phoneHudName: document.getElementById('phoneHudName'),
    phoneHudFacing: document.getElementById('phoneHudFacing'),
    phoneHudHp: document.getElementById('phoneHudHp'),
    phoneHudObjective: document.getElementById('phoneHudObjective'),
    phoneTimerText: document.getElementById('phoneTimerText'),
    slot_0: document.getElementById('slot_0'),
    slot_1: document.getElementById('slot_1'),
    slot_2: document.getElementById('slot_2'),
    slot_3: document.getElementById('slot_3'),
    btnPhoneLockProgram: document.getElementById('btnPhoneLockProgram'),
    phoneHandList: document.getElementById('phoneHandList'),

    phoneViewExecuting: document.getElementById('phoneViewExecuting'),
    phoneExecStatusText: document.getElementById('phoneExecStatusText'),
    phoneLiveStepCard: document.getElementById('phoneLiveStepCard'),
    phoneLiveStepBadge: document.getElementById('phoneLiveStepBadge'),
    phoneLiveCardInfo: document.getElementById('phoneLiveCardInfo'),
    phoneLiveHpText: document.getElementById('phoneLiveHpText'),
    phoneLiveTargetText: document.getElementById('phoneLiveTargetText')
  };

  // ==========================================================================
  // 5. UTILIDADES GENERALES
  // ==========================================================================
  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  function limpiarConexionPrevia() {
    if (peer && !peer.destroyed) {
      try {
        peer.destroy();
      } catch (e) {}
      peer = null;
    }
  }

  function updateRoomHeader(code) {
    currentRoomCode = code;
    if (code) {
      dom.headerRoomCode.textContent = code;
      dom.roomBadgeWrap.classList.remove('d-none');
    } else {
      dom.roomBadgeWrap.classList.add('d-none');
    }
  }

  function getFacingSymbol(dir) {
    const syms = ['▲ Norte', '▶ Este', '▼ Sur', '◀ Oeste'];
    return syms[dir] || '▲ Norte';
  }

  function getFacingAngle(dir) {
    return dir * 90; // 0: 0deg, 1: 90deg, 2: 180deg, 3: 270deg
  }

  function renderHearts(hp, max = 5) {
    let s = '';
    for (let i = 0; i < max; i++) {
      s += i < hp ? '❤️' : '🖤';
    }
    return s;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // 6. INICIALIZACIÓN Y DETECCIÓN DE URL
  // ==========================================================================
  function init() {
    setupUniversalHeader();
    setupColorPalette();
    bindEvents();

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('sala') ? params.get('sala').trim().toUpperCase() : null;

    if (roomParam) {
      sessionStorage.setItem('oc_room_code', roomParam);
      switchToScreen('phone');
      dom.inputPhoneRoom.value = roomParam;
      showPhoneView('join');
    } else {
      switchToScreen('landing');
    }
  }

  function setupUniversalHeader() {
    dom.btnToggleSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      dom.soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    });

    dom.btnToggleFs.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', () => {
      dom.fsIcon.textContent = document.fullscreenElement ? '🪟' : '📺';
    });
  }

  function setupColorPalette() {
    dom.phoneColorPalette.innerHTML = '';
    ROBOT_COLORS.forEach((c, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-color-choice ${idx === 0 ? 'is-selected' : ''}`;
      btn.style.backgroundColor = c.hex;
      btn.title = c.name;
      btn.dataset.color = c.hex;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-color-choice').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        myPlayerColor = c.hex;
      });
      dom.phoneColorPalette.appendChild(btn);
    });
  }

  function bindEvents() {
    // Selección en Landing
    dom.btnSelectTvMode.addEventListener('click', () => {
      startTvMode();
    });

    dom.btnSelectPhoneMode.addEventListener('click', (e) => {
      if (e.target !== dom.inputManualRoomCode && e.target !== dom.btnManualJoinRoom) {
        switchToScreen('phone');
        showPhoneView('join');
      }
    });

    dom.btnManualJoinRoom.addEventListener('click', () => {
      const code = dom.inputManualRoomCode.value.trim().toUpperCase();
      if (code.length === 4) {
        sessionStorage.setItem('oc_room_code', code);
        dom.inputPhoneRoom.value = code;
        switchToScreen('phone');
        showPhoneView('join');
      } else {
        dom.inputManualRoomCode.focus();
      }
    });

    dom.inputManualRoomCode.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') dom.btnManualJoinRoom.click();
    });

    // Formulario de ingreso Celular
    dom.btnPhoneConnect.addEventListener('click', handlePhoneConnect);

    // VIP Iniciar Partida
    dom.btnPhoneVipStart.addEventListener('click', () => {
      if (!isVipPlayer || !myPhoneConn) return;
      const arenaId = dom.selectArenaMap.value;
      const damageRule = dom.selectDamageRule.value;
      const roundTimer = parseInt(dom.selectRoundTimer.value, 10);

      myPhoneConn.send({
        type: 'VIP_START_GAME',
        config: { arenaId, damageRule, roundTimer }
      });
    });

    // Host Iniciar Partida desde TV
    dom.btnTvStartGame.addEventListener('click', () => {
      if (!isTvMode) return;
      startHostGame();
    });

    // Revancha / Fin de partida
    dom.btnTvPlayAgain.addEventListener('click', () => {
      resetGameForRematch();
    });

    dom.btnTvBackToLobby.addEventListener('click', () => {
      dom.tvViewPodium.classList.add('d-none');
      dom.tvViewArena.classList.add('d-none');
      dom.tvViewLobby.classList.remove('d-none');
    });

    // Slots de Celular
    [dom.slot_0, dom.slot_1, dom.slot_2, dom.slot_3].forEach((el, idx) => {
      el.addEventListener('click', () => {
        handleSlotClick(idx);
      });
    });

    // Botón Confirmar Programa
    dom.btnPhoneLockProgram.addEventListener('click', handleToggleLockProgram);
  }

  function switchToScreen(screen) {
    dom.screenLanding.classList.add('d-none');
    dom.screenTv.classList.add('d-none');
    dom.screenPhone.classList.add('d-none');

    if (screen === 'landing') dom.screenLanding.classList.remove('d-none');
    if (screen === 'tv') dom.screenTv.classList.remove('d-none');
    if (screen === 'phone') dom.screenPhone.classList.remove('d-none');
  }

  function showPhoneView(view) {
    dom.phoneViewJoin.classList.add('d-none');
    dom.phoneViewLobby.classList.add('d-none');
    dom.phoneViewProgramming.classList.add('d-none');
    dom.phoneViewExecuting.classList.add('d-none');

    if (view === 'join') dom.phoneViewJoin.classList.remove('d-none');
    if (view === 'lobby') dom.phoneViewLobby.classList.remove('d-none');
    if (view === 'programming') dom.phoneViewProgramming.classList.remove('d-none');
    if (view === 'executing') dom.phoneViewExecuting.classList.remove('d-none');
  }

  // ==========================================================================
  // 7. MODO TV (HOST)
  // ==========================================================================
  function startTvMode() {
    isTvMode = true;
    switchToScreen('tv');
    limpiarConexionPrevia();

    if (!peerResilienceHost && typeof PeerResilience !== 'undefined') {
      peerResilienceHost = PeerResilience.createHost({
        onPlayerSleepChange: (playerId, isAsleep) => {
          const p = gameState && gameState.players.find(pl => pl.id === playerId);
          if (p) {
            p.isAsleep = isAsleep;
            renderTvPlayersList();
            renderTvPilotsStrip();
          }
        },
        getPhaseKey: () => `${gameState ? gameState.phase : 'lobby'}_round_${gameState ? gameState.round : 0}`
      });
      peerResilienceHost.startSleepMonitor();
    }

    const room = generateRoomCode();
    updateRoomHeader(room);
    dom.tvRoomCodeText.textContent = room;

    // Generar QR
    dom.tvLobbyQr.innerHTML = '';
    const joinUrl = `${window.location.origin}${window.location.pathname}?sala=${room}`;
    new QRCode(dom.tvLobbyQr, {
      text: joinUrl,
      width: 170,
      height: 170,
      colorDark: '#040711',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    // Iniciar Peer Host
    const fullPeerId = PEER_PREFIX + room;
    peer = new Peer(fullPeerId);

    peer.on('open', (id) => {
      console.log('Host TV Peer abierto:', id);
    });

    peer.on('connection', (conn) => {
      setupHostConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('Error en Host TV Peer:', err);
      if (err.type === 'unavailable-id') {
        // Reintentar con otro código
        setTimeout(startTvMode, 500);
      }
    });

    // Configuración inicial de juego
    gameState = ROBO_ENGINE.createGameState({
      arenaId: 'fabrica',
      damageRule: 'tactical',
      roundTimer: 45,
      players: []
    });

    updateTvConfigDisplay();
    renderTvPlayersList();
  }

  function setupHostConnection(conn) {
    conn.on('data', (data) => {
      if (!data || !data.type) return;

      const pId = data.playerId || conn._playerId;
      if (pId && peerResilienceHost) {
        if (peerResilienceHost.handleIncomingHostData(pId, conn, data)) return;
        if (data.type !== 'PLAYER_JOIN' && !peerResilienceHost.isConnectionActive(pId, conn)) return;
      }

      handleHostDataReceived(conn, data);
    });

    conn.on('close', () => {
      const pId = conn._playerId;
      if (pId && peerResilienceHost && !peerResilienceHost.isConnectionActive(pId, conn)) return;
      if (pId) {
        const p = gameState && gameState.players.find(pl => pl.id === pId);
        if (p) {
          p.isAsleep = true;
          renderTvPlayersList();
          renderTvPilotsStrip();
        }
      }
    });
  }

  function handleHostDataReceived(conn, data) {
    if (!data || !data.type) return;

    if (data.type === 'PLAYER_JOIN') {
      const { playerId, name, color, avatar } = data;
      conn._playerId = playerId;
      if (peerResilienceHost) {
        peerResilienceHost.registerPlayerConnection(playerId, conn);
      }

      let player = gameState.players.find(p => p.id === playerId);

      if (player) {
        player.isAsleep = false;
      } else {
        if (gameState.players.length >= 6) {
          conn.send({ type: 'JOIN_REJECTED', reason: 'La arena está completa (máx 6 pilotos).' });
          return;
        }

        const isVip = gameState.players.length === 0;
        const arena = gameState.arena;
        const spawnIdx = gameState.players.length;
        const spawn = arena.spawns[spawnIdx % arena.spawns.length];

        player = {
          id: playerId,
          name: name || `Piloto ${spawnIdx + 1}`,
          color: color || ROBOT_COLORS[spawnIdx % ROBOT_COLORS.length].hex,
          avatar: avatar || '🤖',
          isVip,
          spawnIdx,
          x: spawn.x,
          y: spawn.y,
          facing: spawn.facing !== undefined ? spawn.facing : 0,
          hp: 5,
          maxHp: 5,
          alive: true,
          shieldActive: false,
          lastCheckpoint: 0,
          deck: ROBO_ENGINE.createPlayerDeck(playerId),
          hand: [],
          program: [null, null, null, null],
          lockedSlots: [false, false, false, false],
          programLocked: false,
          isAsleep: false,
          stats: {
            lasersHit: 0,
            timesDestroyed: 0,
            checkpointsReached: 0,
            damageDealt: 0
          }
        };
        gameState.players.push(player);
        playJoin();
      }

      hostConnections.set(playerId, conn);

      // Confirmar al jugador
      conn.send({
        type: 'JOIN_ACCEPTED',
        roomCode: currentRoomCode,
        player,
        isVip: player.isVip,
        gameState: getSanitizedGameStateForPlayer(player.id)
      });

      // Enviar sincronización completa
      conn.send({
        type: 'FULL_STATE_SYNC',
        payload: {
          phase: gameState.phase,
          round: gameState.round,
          isVip: player.isVip,
          playerId: player.id,
          name: player.name,
          color: player.color,
          avatar: player.avatar,
          hp: player.hp,
          facing: player.facing,
          lastCheckpoint: player.lastCheckpoint,
          hand: player.hand,
          program: player.program,
          lockedSlots: player.lockedSlots,
          programLocked: player.programLocked,
          yaEnvioEnEstaFase: Boolean(player.programLocked),
          phaseKey: `${gameState.phase}_round_${gameState.round}`
        }
      });

      if (gameState.phase === 'programming') {
        conn.send({
          type: 'ROUND_STARTED',
          round: gameState.round,
          hand: player.hand,
          program: player.program,
          lockedSlots: player.lockedSlots,
          hp: player.hp,
          facing: player.facing,
          lastCheckpoint: player.lastCheckpoint,
          timer: gameState.roundTimer
        });
      }

      // Actualizar lobby
      broadcastToPlayers({
        type: 'LOBBY_UPDATE',
        players: gameState.players.map(p => ({
          id: p.id,
          name: p.name,
          color: p.color,
          avatar: p.avatar,
          isVip: p.isVip
        }))
      });

      renderTvPlayersList();

      // Permitir iniciar si hay al menos 2
      if (gameState.players.length >= 2) {
        dom.btnTvStartGame.classList.remove('d-none');
        dom.tvLobbyStatusMsg.textContent = '¡Listos para combatir! El VIP puede iniciar desde su móvil o pueden pulsar el botón de abajo.';
      } else {
        dom.btnTvStartGame.classList.add('d-none');
        dom.tvLobbyStatusMsg.textContent = 'Esperando al menos 2 pilotos para comenzar...';
      }
    }

    if (data.type === 'VIP_UPDATE_CONFIG') {
      const player = gameState.players.find(p => p.id === data.playerId && p.isVip);
      if (player && data.config) {
        if (data.config.arenaId && ARENAS_DATA.ARENAS[data.config.arenaId]) {
          gameState.arenaId = data.config.arenaId;
          gameState.arena = ARENAS_DATA.ARENAS[data.config.arenaId];
        }
        if (data.config.damageRule) gameState.damageRule = data.config.damageRule;
        if (typeof data.config.roundTimer === 'number') gameState.roundTimer = data.config.roundTimer;

        updateTvConfigDisplay();
      }
    }

    if (data.type === 'VIP_START_GAME') {
      const player = gameState.players.find(p => p.id === data.playerId && p.isVip);
      if (player && gameState.players.length >= 2) {
        if (data.config) {
          if (data.config.arenaId && ARENAS_DATA.ARENAS[data.config.arenaId]) {
            gameState.arenaId = data.config.arenaId;
            gameState.arena = ARENAS_DATA.ARENAS[data.config.arenaId];
          }
          if (data.config.damageRule) gameState.damageRule = data.config.damageRule;
          if (typeof data.config.roundTimer === 'number') gameState.roundTimer = data.config.roundTimer;
        }
        startHostGame();
      }
    }

    if (data.type === 'PLAYER_SUBMIT_PROGRAM') {
      const player = gameState.players.find(p => p.id === data.playerId);
      if (player && gameState.phase === 'programming') {
        player.program = data.program;
        player.programLocked = true;
        playProgramLocked();

        // Notificar al móvil
        conn.send({ type: 'PROGRAM_ACCEPTED', locked: true });

        // Actualizar chips de TV
        renderTvPilotsStrip();

        // Verificar si todos confirmaron
        checkAllProgramsLocked();
      }
    }

    if (data.type === 'PLAYER_UNLOCK_PROGRAM') {
      const player = gameState.players.find(p => p.id === data.playerId);
      if (player && gameState.phase === 'programming') {
        player.programLocked = false;
        conn.send({ type: 'PROGRAM_ACCEPTED', locked: false });
        renderTvPilotsStrip();
      }
    }
  }

  function broadcastToPlayers(msg) {
    for (const conn of hostConnections.values()) {
      if (conn && conn.open) {
        conn.send(msg);
      }
    }
  }

  function getSanitizedGameStateForPlayer(playerId) {
    const p = gameState.players.find(pl => pl.id === playerId);
    return {
      roundNumber: gameState.roundNumber,
      arenaId: gameState.arenaId,
      arenaName: gameState.arena.name,
      damageRule: gameState.damageRule,
      phase: gameState.phase,
      currentStep: gameState.currentStep,
      myPlayer: p ? {
        id: p.id,
        name: p.name,
        color: p.color,
        hp: p.hp,
        facing: p.facing,
        lastCheckpoint: p.lastCheckpoint,
        hand: p.hand,
        program: p.program,
        lockedSlots: p.lockedSlots,
        programLocked: p.programLocked
      } : null
    };
  }

  function updateTvConfigDisplay() {
    dom.tvConfigArenaName.textContent = gameState.arena.name;
    dom.tvConfigDamageRule.textContent = gameState.damageRule === 'tactical' ? '🛡️ Daño Táctico' : '💥 Daño Simple';
    dom.tvConfigRoundTimer.textContent = gameState.roundTimer > 0 ? `⏱️ ${gameState.roundTimer} Segundos` : '♾️ Sin Límite';
  }

  function renderTvPlayersList() {
    dom.tvPlayerCount.textContent = gameState.players.length;
    dom.tvPlayersList.innerHTML = '';

    gameState.players.forEach(p => {
      const card = document.createElement('div');
      card.className = `tv-player-card ${p.isVip ? 'is-vip' : ''}`;
      card.innerHTML = `
        <div class="tv-player-avatar-circle" style="background-color: ${p.color};">
          ${p.avatar}
        </div>
        <div class="tv-player-info">
          <div class="tv-player-name">${p.name} ${p.isVip ? '👑' : ''} ${p.isAsleep ? '💤' : ''}</div>
          <div class="tv-player-status">${p.isAsleep ? 'En pausa (pantalla bloqueada)' : 'Chasis listo para combate'}</div>
        </div>
      `;
      dom.tvPlayersList.appendChild(card);
    });
  }

  // ==========================================================================
  // 8. BUCLE PRINCIPAL DE PARTIDA (HOST)
  // ==========================================================================
  function startHostGame() {
    dom.tvViewLobby.classList.add('d-none');
    dom.tvViewArena.classList.remove('d-none');

    // Inicializar posiciones de spawn
    const arena = gameState.arena;
    gameState.players.forEach((p, idx) => {
      const sp = arena.spawns[idx % arena.spawns.length];
      p.x = sp.x;
      p.y = sp.y;
      p.facing = sp.facing !== undefined ? sp.facing : 0;
      p.hp = 5;
      p.alive = true;
      p.lastCheckpoint = 0;
    });

    renderTvBoardGrid();
    startNewRound();
  }

  function startNewRound() {
    gameState.phase = 'programming';
    gameState.currentStep = 0;

    // Repartir cartas
    ROBO_ENGINE.dealRoundCards(gameState);

    // Ocultar barra de ejecución previa
    dom.tvExecutionCardsBar.classList.add('d-none');

    // Actualizar HUD
    dom.tvHudRound.textContent = `RONDA ${gameState.roundNumber}`;
    dom.tvHudArenaName.textContent = gameState.arena.name;
    dom.tvHudBannerTitle.textContent = '⚡ FASE DE PROGRAMACIÓN';
    dom.tvHudBannerSub.textContent = 'Los pilotos están eligiendo sus 4 órdenes secretas...';

    renderTvPilotsStrip();
    renderTvRobotsLayer();

    // Notificar a cada móvil con su mano
    for (const p of gameState.players) {
      const conn = hostConnections.get(p.id);
      if (conn && conn.open) {
        conn.send({
          type: 'ROUND_STARTED',
          roundNumber: gameState.roundNumber,
          hand: p.hand,
          program: p.program,
          lockedSlots: p.lockedSlots,
          hp: p.hp,
          facing: p.facing,
          lastCheckpoint: p.lastCheckpoint
        });
      }
    }

    // Iniciar temporizador
    startProgrammingTimer();
  }

  function startProgrammingTimer() {
    if (timerInterval) clearInterval(timerInterval);

    if (gameState.roundTimer <= 0) {
      dom.tvHudTimerWrap.classList.add('d-none');
      return;
    }

    dom.tvHudTimerWrap.classList.remove('d-none');
    remainingTimerSecs = gameState.roundTimer;
    dom.tvHudTimerSecs.textContent = remainingTimerSecs;

    timerInterval = setInterval(() => {
      remainingTimerSecs--;
      dom.tvHudTimerSecs.textContent = remainingTimerSecs;

      broadcastToPlayers({
        type: 'TIMER_TICK',
        seconds: remainingTimerSecs
      });

      if (remainingTimerSecs <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        forceSubmitPendingPlayers();
      }
    }, 1000);
  }

  function forceSubmitPendingPlayers() {
    for (const p of gameState.players) {
      if (p.alive && !p.programLocked) {
        // Rellenar slots vacíos con cartas disponibles de la mano
        const availableHand = [...p.hand];
        for (let i = 0; i < 4; i++) {
          if (!p.program[i] && availableHand.length > 0) {
            p.program[i] = availableHand.shift();
          }
        }
        p.programLocked = true;

        const conn = hostConnections.get(p.id);
        if (conn && conn.open) {
          conn.send({
            type: 'FORCE_SUBMIT_CONFIRMED',
            program: p.program
          });
        }
      }
    }
    renderTvPilotsStrip();
    checkAllProgramsLocked();
  }

  function checkAllProgramsLocked() {
    const alivePlayers = gameState.players.filter(p => p.alive);
    const allLocked = alivePlayers.every(p => p.programLocked);

    if (allLocked) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      runExecutionPhase();
    }
  }

  /**
   * FASE 2: EJECUCIÓN ANIMADA PASO A PASO EN LA TV
   */
  async function runExecutionPhase() {
    gameState.phase = 'executing';
    dom.tvHudTimerWrap.classList.add('d-none');
    dom.tvHudBannerTitle.textContent = '🚀 EJECUTANDO ÓRDENES';
    dom.tvHudBannerSub.textContent = '¡Miren la TV! Los robots ejecutan sus pasos en la Arena';

    broadcastToPlayers({ type: 'EXECUTION_STARTED' });

    for (let step = 0; step < 4; step++) {
      gameState.currentStep = step;
      dom.tvHudBannerTitle.textContent = `⚡ EJECUTANDO PASO ${step + 1} DE 4`;

      // Mostrar barra de cartas
      dom.tvExecutionCardsBar.classList.remove('d-none');
      dom.tvExecStepTitle.textContent = `PASO ${step + 1} &bull; ÓRDENES REVELADAS:`;

      // Recopilar cartas activas de este paso y ordenarlas por prioridad
      const stepCards = [];
      for (const p of gameState.players) {
        if (p.alive && p.program[step]) {
          stepCards.push({ player: p, card: p.program[step] });
        }
      }
      stepCards.sort((a, b) => b.card.priority - a.card.priority);

      renderTvExecCardsRow(stepCards);

      broadcastToPlayers({
        type: 'STEP_START',
        stepIndex: step + 1
      });

      await delay(1200);

      // Ejecutar con el motor determinista
      const stepEvents = ROBO_ENGINE.executeStep(gameState, step);

      // 1. Animar Sub-paso A (Cartas de los Robots)
      for (const cardRes of stepEvents.subStepA_Cards) {
        highlightExecCard(cardRes.playerId);
        broadcastToPlayers({
          type: 'PLAYER_CARD_EXECUTING',
          playerId: cardRes.playerId,
          card: cardRes.card
        });

        for (const action of cardRes.actions) {
          if (action.actionType === 'move_forward' || action.actionType === 'move_backward') {
            playRobotMove();
            renderTvRobotsLayer();
            await delay(450);
          } else if (action.actionType === 'turn') {
            playRobotMove();
            renderTvRobotsLayer();
            await delay(350);
          } else if (action.actionType === 'overload_laser') {
            playLaser();
            if (action.rayPath && action.rayPath.length > 0) {
              const shooter = gameState.players.find(p => p.id === cardRes.playerId);
              const lastPoint = action.rayPath[action.rayPath.length - 1];
              if (shooter) {
                drawLaserBeam(shooter.x, shooter.y, lastPoint.x, lastPoint.y, shooter.color);
              }
            }
            await delay(500);
            renderTvPilotsStrip();
            renderTvRobotsLayer();
          } else if (action.actionType === 'shield_repair') {
            renderTvPilotsStrip();
            await delay(350);
          }
        }

        // Si alguien murió en este sub-paso
        if (stepEvents.destroyedInStep && stepEvents.destroyedInStep.length > 0) {
          playExplosion();
          renderTvPilotsStrip();
          renderTvRobotsLayer();
          await delay(500);
        }
      }

      // 2. Animar Sub-paso B (Cintas Transportadoras)
      if (stepEvents.subStepB_Conveyors.length > 0) {
        playRobotMove();
        renderTvRobotsLayer();
        await delay(500);
      }

      // 3. Animar Sub-paso C (Engranajes)
      if (stepEvents.subStepC_Gears.length > 0) {
        playRobotMove();
        renderTvRobotsLayer();
        await delay(400);
      }

      // 4. Animar Sub-paso D (Láseres automáticos y de robots)
      if (stepEvents.subStepD_Lasers.length > 0) {
        playLaser();
        for (const lEv of stepEvents.subStepD_Lasers) {
          if (lEv.path && lEv.path.length > 0) {
            const endPt = lEv.path[lEv.path.length - 1];
            const color = lEv.sourceType === 'turret' ? '#ef4444' : '#38bdf8';
            drawLaserBeam(lEv.fromX, lEv.fromY, endPt.x, endPt.y, color);
          }
        }
        await delay(600);
        renderTvPilotsStrip();
        renderTvRobotsLayer();
      }

      // 5. Animar Sub-paso E (Checkpoints y Reparación)
      for (const cpEv of stepEvents.subStepE_CheckpointsRepair) {
        if (cpEv.type === 'checkpoint') {
          playCheckpoint();
          renderTvPilotsStrip();
          await delay(600);
        }
      }

      // Notificar a los celulares sobre sus estadísticas actuales
      for (const p of gameState.players) {
        const conn = hostConnections.get(p.id);
        if (conn && conn.open) {
          conn.send({
            type: 'LIVE_STATUS_UPDATE',
            hp: p.hp,
            alive: p.alive,
            lastCheckpoint: p.lastCheckpoint
          });
        }
      }

      // Verificar si hay ganador
      if (stepEvents.winner) {
        showPodiumScreen(stepEvents.winner);
        return;
      }

      await delay(800);
    }

    // Fin de los 4 pasos: Preparar siguiente ronda
    await delay(1000);
    ROBO_ENGINE.finishRoundAndRespawn(gameState);
    startNewRound();
  }

  function drawLaserBeam(fromX, fromY, toX, toY, color) {
    const svg = dom.tvLaserSvg;
    const fx = (fromX + 0.5) * 100;
    const fy = (fromY + 0.5) * 100;
    const tx = (toX + 0.5) * 100;
    const ty = (toY + 0.5) * 100;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fx);
    line.setAttribute('y1', fy);
    line.setAttribute('x2', tx);
    line.setAttribute('y2', ty);
    line.setAttribute('stroke', color || '#ef4444');
    line.setAttribute('class', 'laser-beam');

    svg.appendChild(line);

    setTimeout(() => {
      if (line.parentNode) line.parentNode.removeChild(line);
    }, 450);
  }

  function renderTvBoardGrid() {
    const grid = gameState.arena.grid;
    dom.tvBoardGrid.innerHTML = '';

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 10; x++) {
        const tile = grid[y][x];
        const cell = document.createElement('div');
        cell.className = `board-cell cell-${tile.split('_')[0]}`;
        cell.dataset.x = x;
        cell.dataset.y = y;

        if (tile === 'wall') {
          cell.className = 'board-cell cell-wall';
        } else if (tile === 'pit') {
          cell.className = 'board-cell cell-pit';
        } else if (tile.startsWith('conveyor_')) {
          cell.className = 'board-cell cell-conveyor';
          const dir = tile.split('_')[1];
          const arrSymbol = dir === 'N' ? '⬆️' : dir === 'E' ? '➡️' : dir === 'S' ? '⬇️' : '⬅️';
          cell.innerHTML = `<span class="conveyor-arrow">${arrSymbol}</span>`;
        } else if (tile.startsWith('gear_')) {
          cell.className = 'board-cell cell-gear';
          const ccw = tile === 'gear_ccw';
          cell.innerHTML = `<span class="gear-icon ${ccw ? 'ccw' : ''}">⚙️</span>`;
        } else if (tile.startsWith('laser_turret_')) {
          cell.className = 'board-cell cell-turret';
          cell.innerHTML = `<span class="turret-icon">🚨</span>`;
        } else if (tile === 'repair') {
          cell.className = 'board-cell cell-repair';
          cell.innerHTML = `<span class="repair-icon">🔧</span>`;
        } else if (tile.startsWith('cp_')) {
          cell.className = 'board-cell cell-checkpoint';
          const num = tile.split('_')[1];
          cell.innerHTML = `<span class="cp-badge">${num}🚩</span>`;
        } else if (tile.startsWith('spawn_')) {
          cell.className = 'board-cell cell-spawn';
          const sNum = tile.split('_')[1];
          cell.innerHTML = `<span class="spawn-num">${sNum}</span>`;
        } else {
          cell.className = 'board-cell cell-floor';
        }

        dom.tvBoardGrid.appendChild(cell);
      }
    }
  }

  function renderTvRobotsLayer() {
    dom.tvRobotsLayer.innerHTML = '';

    gameState.players.forEach(p => {
      const token = document.createElement('div');
      token.className = `robot-token ${!p.alive ? 'is-dead' : ''}`;
      token.id = `robot_token_${p.id}`;

      // Posicionamiento en % del tablero
      token.style.left = `${p.x * 10}%`;
      token.style.top = `${p.y * 12.5}%`;

      // Flecha de dirección frontal rotada
      const angle = getFacingAngle(p.facing);
      const initials = p.name.substring(0, 3).toUpperCase();

      token.innerHTML = `
        <div class="robot-body" style="background-color: ${p.color}; border-color: #fff;">
          <div class="robot-visor-arrow" style="transform: translateX(-50%) rotate(${angle}deg); transform-origin: 50% 24px;"></div>
          <span class="robot-avatar-img">${p.avatar}</span>
          <span class="robot-initials-badge">${initials}</span>
        </div>
      `;

      dom.tvRobotsLayer.appendChild(token);
    });
  }

  function renderTvPilotsStrip() {
    dom.tvPilotsStrip.innerHTML = '';

    gameState.players.forEach(p => {
      const chip = document.createElement('div');
      chip.className = `pilot-chip ${p.programLocked ? 'is-ready' : ''} ${!p.alive ? 'is-dead' : ''}`;
      chip.style.borderColor = p.color;

      const hearts = renderHearts(p.hp);
      const statusText = !p.alive
        ? '💀 DESTRUIDO'
        : p.isAsleep
        ? '💤 En reposo'
        : p.programLocked
        ? '✅ Listo'
        : '🧠 Programando...';

      chip.innerHTML = `
        <span class="chip-avatar">${p.avatar}</span>
        <div>
          <div class="chip-name" style="color: ${p.color};">${p.name} ${p.isAsleep ? '💤' : ''}</div>
          <div class="chip-hp">${hearts}</div>
          <div class="chip-status">${statusText} | CP: ${p.lastCheckpoint}/3</div>
        </div>
      `;
      dom.tvPilotsStrip.appendChild(chip);
    });
  }

  function renderTvExecCardsRow(cards) {
    dom.tvExecCardsRow.innerHTML = '';
    cards.forEach(item => {
      const cardEl = document.createElement('div');
      cardEl.className = 'exec-card-item';
      cardEl.id = `exec_card_${item.player.id}`;
      cardEl.style.borderColor = item.player.color;
      cardEl.innerHTML = `
        <span style="font-weight: 800; color: ${item.player.color};">${item.player.name}:</span>
        <span>${item.card.icon} ${item.card.name}</span>
        <span style="color: #fbbf24; font-family: var(--font-hud);">[${item.card.priority}]</span>
      `;
      dom.tvExecCardsRow.appendChild(cardEl);
    });
  }

  function highlightExecCard(playerId) {
    document.querySelectorAll('.exec-card-item').forEach(el => el.classList.remove('is-current'));
    const target = document.getElementById(`exec_card_${playerId}`);
    if (target) target.classList.add('is-current');
  }

  function showPodiumScreen(winner) {
    playVictory();
    dom.tvViewArena.classList.add('d-none');
    dom.tvViewPodium.classList.remove('d-none');

    // Ganador
    dom.tvWinnerCard.innerHTML = `
      <div class="d-flex align-items-center justify-content-center gap-3">
        <span style="font-size: 3rem;">${winner.avatar || '🤖'}</span>
        <div>
          <h3 style="font-family: var(--font-display); font-size: 2.8rem; margin: 0; color: ${winner.color};">${winner.name}</h3>
          <span style="color: #fbbf24; font-family: var(--font-hud); letter-spacing: 1px;">¡PRIMER PILOTO EN CAPTURAR EL CHECKPOINT 3!</span>
        </div>
      </div>
    `;

    // Estadísticas
    const sortedByLasers = [...gameState.players].sort((a, b) => b.stats.lasersHit - a.stats.lasersHit);
    const sortedByDeaths = [...gameState.players].sort((a, b) => b.stats.timesDestroyed - a.stats.timesDestroyed);

    const topSniper = sortedByLasers[0];
    const topScrap = sortedByDeaths[0];

    dom.tvPodiumStats.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon">🎯</div>
        <div class="stat-title">FRANCOTIRADOR DE LA ARENA</div>
        <div class="stat-value">${topSniper ? `${topSniper.name} (${topSniper.stats.lasersHit} impactos)` : 'N/A'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💥</div>
        <div class="stat-title">CHATARRA HEROICA</div>
        <div class="stat-value">${topScrap ? `${topScrap.name} (${topScrap.stats.timesDestroyed} caídas)` : 'N/A'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚩</div>
        <div class="stat-title">EXPLORADOR SUPREMO</div>
        <div class="stat-value">${winner.name} (3 Checkpoints)</div>
      </div>
    `;

    broadcastToPlayers({
      type: 'GAME_OVER',
      winner: {
        id: winner.id,
        name: winner.name,
        color: winner.color
      }
    });
  }

  function resetGameForRematch() {
    dom.tvViewPodium.classList.add('d-none');
    dom.tvViewArena.classList.remove('d-none');

    gameState.roundNumber = 1;
    gameState.winner = null;
    gameState.players.forEach((p, idx) => {
      const sp = gameState.arena.spawns[idx % gameState.arena.spawns.length];
      p.x = sp.x;
      p.y = sp.y;
      p.facing = sp.facing !== undefined ? sp.facing : 0;
      p.hp = 5;
      p.alive = true;
      p.lastCheckpoint = 0;
      p.stats = { lasersHit: 0, timesDestroyed: 0, checkpointsReached: 0, damageDealt: 0 };
    });

    renderTvBoardGrid();
    startNewRound();
  }

  // ==========================================================================
  // 9. MODO CELULAR (MANDO DEL JUGADOR)
  // ==========================================================================
  function handlePhoneConnect() {
    const roomCode = dom.inputPhoneRoom.value.trim().toUpperCase();
    const name = dom.inputPhoneName.value.trim();

    if (roomCode.length !== 4) {
      alert('Ingresá el código de sala de 4 letras que ves en la TV.');
      return;
    }
    if (!name) {
      alert('Ingresá un nombre para tu robot.');
      return;
    }

    myPlayerName = name;
    sessionStorage.setItem('oc_room_code', roomCode);
    sessionStorage.setItem('oc_player_name', name);
    sessionStorage.setItem('oc_player_color', myPlayerColor);

    if (!sessionStorage.getItem('oc_player_id')) {
      sessionStorage.setItem('oc_player_id', 'p_' + Math.random().toString(36).substring(2, 9));
    }
    myPlayerId = sessionStorage.getItem('oc_player_id');

    limpiarConexionPrevia();
    peer = new Peer();

    peer.on('open', () => {
      connectToHost(roomCode);
    });

    peer.on('error', (err) => {
      console.error('Error en Peer celular:', err);
      if (err.type === 'peer-unavailable') {
        sessionStorage.removeItem('oc_room_code');
        dom.phoneJoinAlert.innerHTML = `
          <div>⚠️ La sala <strong>${roomCode}</strong> no existe o la TV cambió de sala.</div>
          <button type="button" class="btn btn-sm btn-outline-light mt-2" id="btnRetryOtherRoom">🔄 Conectar a otra sala</button>
        `;
        dom.phoneJoinAlert.classList.remove('d-none');
        document.getElementById('btnRetryOtherRoom')?.addEventListener('click', () => {
          dom.phoneJoinAlert.classList.add('d-none');
          dom.inputPhoneRoom.value = '';
          dom.inputPhoneRoom.focus();
        });
      }
    });
  }

  function connectToHost(roomCode) {
    if (!peerResilienceClient && typeof PeerResilience !== 'undefined') {
      peerResilienceClient = PeerResilience.createClient({
        getConn: () => myPhoneConn,
        getPeer: () => peer,
        getRoomCode: () => currentRoomCode || roomCode,
        onReconnect: () => {
          connectToHost(currentRoomCode || roomCode);
        },
        onStateSync: (payload) => {
          applyPhoneFullStateSync(payload);
        }
      });
    }
    if (peerResilienceClient) {
      peerResilienceClient.start();
    }
    if (typeof PeerResilience !== 'undefined') {
      PeerResilience.enableWakeLock();
    }

    const hostPeerId = PEER_PREFIX + roomCode;
    myPhoneConn = peer.connect(hostPeerId, { reliable: true });

    myPhoneConn.on('open', () => {
      if (peerResilienceClient) peerResilienceClient.onConnected();
      dom.phoneJoinAlert.classList.add('d-none');
      myPhoneConn.send({
        type: 'PLAYER_JOIN',
        playerId: myPlayerId,
        name: myPlayerName,
        color: myPlayerColor,
        avatar: myPlayerAvatar
      });
    });

    myPhoneConn.on('data', (data) => {
      if (peerResilienceClient && peerResilienceClient.handleIncomingData(data)) return;
      handlePhoneDataReceived(data);
    });

    myPhoneConn.on('close', () => {
      console.log('Conexión cerrada con el host');
      if (peerResilienceClient) {
        peerResilienceClient.checkConnectionInstantly();
      }
    });

    myPhoneConn.on('error', () => {
      if (peerResilienceClient) {
        peerResilienceClient.checkConnectionInstantly();
      }
    });
  }

  function applyPhoneFullStateSync(payload) {
    if (!payload) return;
    if (payload.phase === 'programming') {
      myHandCards = payload.hand || [];
      myProgramSlots = payload.program || [null, null, null, null];
      myLockedSlots = payload.lockedSlots || [false, false, false, false];
      myProgramLocked = Boolean(payload.yaEnvioEnEstaFase || payload.programLocked);

      updatePhoneHud(payload.hp, payload.facing, payload.lastCheckpoint);
      renderPhoneProgramSlots();
      renderPhoneHandList();
      updateLockProgramButton();

      showPhoneView('programming');
    } else if (payload.phase === 'execution') {
      showPhoneView('executing');
    } else if (payload.phase === 'lobby') {
      showPhoneView('lobby');
    }
  }

  function handlePhoneDataReceived(data) {
    if (!data || !data.type) return;

    if (data.type === 'FULL_STATE_SYNC') {
      applyPhoneFullStateSync(data.payload || data);
      return;
    }

    if (data.type === 'JOIN_ACCEPTED') {
      currentRoomCode = data.roomCode;
      updateRoomHeader(currentRoomCode);
      isVipPlayer = !!data.isVip;

      dom.phoneLobbyPlayerName.textContent = myPlayerName;
      dom.phoneLobbyRoomCode.textContent = currentRoomCode;
      dom.phoneLobbyRobotBadge.style.backgroundColor = myPlayerColor;

      if (isVipPlayer) {
        dom.phoneVipControls.classList.remove('d-none');
        dom.phoneRegularWaiting.classList.add('d-none');
      } else {
        dom.phoneVipControls.classList.add('d-none');
        dom.phoneRegularWaiting.classList.remove('d-none');
      }

      showPhoneView('lobby');
    }

    if (data.type === 'ROUND_STARTED') {
      myHandCards = data.hand || [];
      myProgramSlots = data.program || [null, null, null, null];
      myLockedSlots = data.lockedSlots || [false, false, false, false];
      myProgramLocked = false;

      updatePhoneHud(data.hp, data.facing, data.lastCheckpoint);
      renderPhoneProgramSlots();
      renderPhoneHandList();
      updateLockProgramButton();

      showPhoneView('programming');
    }

    if (data.type === 'TIMER_TICK') {
      dom.phoneTimerText.textContent = `${data.seconds}s`;
    }

    if (data.type === 'FORCE_SUBMIT_CONFIRMED') {
      myProgramSlots = data.program;
      myProgramLocked = true;
      renderPhoneProgramSlots();
      renderPhoneHandList();
      updateLockProgramButton();
    }

    if (data.type === 'PROGRAM_ACCEPTED') {
      myProgramLocked = !!data.locked;
      updateLockProgramButton();
    }

    if (data.type === 'EXECUTION_STARTED') {
      showPhoneView('executing');
    }

    if (data.type === 'STEP_START') {
      dom.phoneLiveStepBadge.textContent = `Paso ${data.stepIndex} de 4`;
    }

    if (data.type === 'PLAYER_CARD_EXECUTING') {
      if (data.playerId === myPlayerId) {
        dom.phoneLiveCardInfo.innerHTML = `
          <span class="live-card-icon">${data.card.icon}</span>
          <strong class="live-card-name">${data.card.name}</strong>
        `;
      }
    }

    if (data.type === 'LIVE_STATUS_UPDATE') {
      dom.phoneLiveHpText.textContent = renderHearts(data.hp);
      dom.phoneLiveTargetText.textContent = `${data.lastCheckpoint + 1} 🚩`;
    }

    if (data.type === 'GAME_OVER') {
      dom.phoneExecStatusText.textContent = `¡Fin de la Partida! Campeón: ${data.winner.name}`;
    }
  }

  function updatePhoneHud(hp = 5, facing = 0, lastCp = 0) {
    dom.phoneHudAvatar.style.backgroundColor = myPlayerColor;
    dom.phoneHudName.textContent = myPlayerName;
    dom.phoneHudFacing.textContent = `Mirando: ${getFacingSymbol(facing)}`;
    dom.phoneHudHp.textContent = renderHearts(hp);
    dom.phoneHudObjective.textContent = `Objetivo: Checkpoint ${lastCp + 1} 🚩`;
  }

  function renderPhoneProgramSlots() {
    [dom.slot_0, dom.slot_1, dom.slot_2, dom.slot_3].forEach((slotEl, idx) => {
      const card = myProgramSlots[idx];
      const isLocked = myLockedSlots[idx];

      slotEl.className = `program-slot ${card ? 'is-filled' : ''} ${isLocked ? 'is-locked' : ''}`;

      if (isLocked) {
        slotEl.innerHTML = `
          <span class="slot-num">${idx + 1} 🔒</span>
          <div class="slot-card-icon">${card ? card.icon : '🔒'}</div>
          <div class="slot-card-name">${card ? card.name : 'BLOQUEADO'}</div>
          <div class="slot-card-prio">${card ? `[${card.priority}]` : ''}</div>
        `;
      } else if (card) {
        slotEl.innerHTML = `
          <span class="slot-num">${idx + 1}</span>
          <div class="slot-card-icon">${card.icon}</div>
          <div class="slot-card-name">${card.name}</div>
          <div class="slot-card-prio">[${card.priority}]</div>
        `;
      } else {
        slotEl.innerHTML = `
          <span class="slot-num">${idx + 1}</span>
          <div class="slot-content">Vacío</div>
        `;
      }
    });
  }

  function renderPhoneHandList() {
    dom.phoneHandList.innerHTML = '';

    myHandCards.forEach((card, idx) => {
      // Verificar si ya está colocada en algún slot
      const isUsed = myProgramSlots.some(s => s && s.id === card.id);

      const item = document.createElement('div');
      item.className = `hand-card-item ${isUsed ? 'is-used' : ''}`;
      item.innerHTML = `
        <div class="hand-card-icon">${card.icon}</div>
        <div class="hand-card-details">
          <div class="hand-card-name">${card.name}</div>
          <div class="hand-card-desc">${card.desc}</div>
        </div>
        <div class="hand-card-prio-badge">Prio ${card.priority}</div>
      `;

      item.addEventListener('click', () => {
        if (isUsed || myProgramLocked) return;
        assignCardToFirstFreeSlot(card);
      });

      dom.phoneHandList.appendChild(item);
    });
  }

  function assignCardToFirstFreeSlot(card) {
    for (let i = 0; i < 4; i++) {
      if (!myLockedSlots[i] && !myProgramSlots[i]) {
        myProgramSlots[i] = card;
        renderPhoneProgramSlots();
        renderPhoneHandList();
        updateLockProgramButton();
        break;
      }
    }
  }

  function handleSlotClick(slotIdx) {
    if (myProgramLocked || myLockedSlots[slotIdx]) return;
    if (myProgramSlots[slotIdx]) {
      myProgramSlots[slotIdx] = null;
      renderPhoneProgramSlots();
      renderPhoneHandList();
      updateLockProgramButton();
    }
  }

  function updateLockProgramButton() {
    const filledCount = myProgramSlots.filter(s => s !== null).length;
    dom.btnPhoneLockProgram.disabled = filledCount < 4;

    if (myProgramLocked) {
      dom.btnPhoneLockProgram.disabled = false;
      dom.btnPhoneLockProgram.innerHTML = '<span>✏️ Editar Programa</span>';
      dom.btnPhoneLockProgram.classList.replace('btn-action-primary', 'btn-outline-warning');
    } else {
      dom.btnPhoneLockProgram.innerHTML = `<span>🔒 ¡Confirmar Programa! (${filledCount}/4)</span>`;
      dom.btnPhoneLockProgram.classList.replace('btn-outline-warning', 'btn-action-primary');
    }
  }

  function handleToggleLockProgram() {
    if (!myPhoneConn) return;

    if (!myProgramLocked) {
      const filledCount = myProgramSlots.filter(s => s !== null).length;
      if (filledCount < 4) return;

      myPhoneConn.send({
        type: 'PLAYER_SUBMIT_PROGRAM',
        playerId: myPlayerId,
        program: myProgramSlots
      });
    } else {
      myPhoneConn.send({
        type: 'PLAYER_UNLOCK_PROGRAM',
        playerId: myPlayerId
      });
    }
  }

  // ==========================================================================
  // 10. ARRANQUE
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', init);

})();
