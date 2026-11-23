/**
 * Órdenes Cruzadas - Aplicación Principal y Control de Red PeerJS
 * Versión 2.1 - Blindaje total de configuración (TV + Celular VIP) y motor de ejecución determinista
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
    playTone(280, 'sawtooth', 0.09, 0.14, 0.01);
  }

  function playBump() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (e) {}
  }

  function playShield() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  function playLaser() {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.22);

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
  let isExecuting = false; // Bandera de guardia anti-concurrencia
  let visualRobots = new Map(); // playerId -> { x, y, facing, visualAngleDeg, hp, alive, shieldActive, lastCheckpoint }

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
    btnToggleRules: document.getElementById('btnToggleRules'),
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

    // TV Lobby
    tvViewLobby: document.getElementById('tvViewLobby'),
    tvRoomCodeText: document.getElementById('tvRoomCodeText'),
    tvLobbyQr: document.getElementById('tvLobbyQr'),
    tvSelectArena: document.getElementById('tvSelectArena'),
    tvSelectDamage: document.getElementById('tvSelectDamage'),
    tvSelectTimer: document.getElementById('tvSelectTimer'),
    tvSelectSpeed: document.getElementById('tvSelectSpeed'),
    tvLobbyStatusMsg: document.getElementById('tvLobbyStatusMsg'),
    btnTvStartGame: document.getElementById('btnTvStartGame'),
    tvPlayerCount: document.getElementById('tvPlayerCount'),
    tvPlayersList: document.getElementById('tvPlayersList'),

    // TV Arena (Panoramic layout)
    tvViewArena: document.getElementById('tvViewArena'),
    tvBoardWrap: document.getElementById('tvBoardWrap'),
    tvBoardGrid: document.getElementById('tvBoardGrid'),
    tvTurretSightsSvg: document.getElementById('tvTurretSightsSvg'),
    tvLaserSvg: document.getElementById('tvLaserSvg'),
    tvRobotsLayer: document.getElementById('tvRobotsLayer'),
    tvFxLayer: document.getElementById('tvFxLayer'),

    // TV Command Column
    tvCmdRoundBadge: document.getElementById('tvCmdRoundBadge'),
    tvCmdMapName: document.getElementById('tvCmdMapName'),
    tvCmdTimerWrap: document.getElementById('tvCmdTimerWrap'),
    tvCmdTimerSecs: document.getElementById('tvCmdTimerSecs'),
    btnTvForceExecute: document.getElementById('btnTvForceExecute'),
    tvCmdStepsProgress: document.getElementById('tvCmdStepsProgress'),
    tvCmdSubphaseTracker: document.getElementById('tvCmdSubphaseTracker'),
    tvCmdSpotlightBox: document.getElementById('tvCmdSpotlightBox'),
    tvSpotlightBadge: document.getElementById('tvSpotlightBadge'),
    tvSpotlightSubtext: document.getElementById('tvSpotlightSubtext'),
    tvSpotlightText: document.getElementById('tvSpotlightText'),
    tvCmdStepCardsQueue: document.getElementById('tvCmdStepCardsQueue'),
    tvCmdQueueCardsList: document.getElementById('tvCmdQueueCardsList'),
    tvCmdPilotsTitle: document.getElementById('tvCmdPilotsTitle'),
    tvCmdPilotsGrid: document.getElementById('tvCmdPilotsGrid'),

    // TV Podium
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
    selectExecutionSpeed: document.getElementById('selectExecutionSpeed'),
    btnPhoneVipStart: document.getElementById('btnPhoneVipStart'),
    phoneRegularWaiting: document.getElementById('phoneRegularWaiting'),

    phoneViewProgramming: document.getElementById('phoneViewProgramming'),
    phoneHudAvatarFrame: document.getElementById('phoneHudAvatarFrame'),
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
    phoneExecStepsRow: document.getElementById('phoneExecStepsRow'),
    phoneLiveHpText: document.getElementById('phoneLiveHpText'),
    phoneLiveTargetText: document.getElementById('phoneLiveTargetText'),

    // Rules Modal
    rulesModal: document.getElementById('rulesModal'),
    btnCloseRules: document.getElementById('btnCloseRules'),
    btnConfirmRules: document.getElementById('btnConfirmRules')
  };

  // ==========================================================================
  // 5. GENERADORES SVG NÍTITOS (TABLERO Y ROBOTS)
  // ==========================================================================
  function getTileSvg(tile) {
    if (tile === 'wall') {
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-wall">
          <rect width="100" height="100" fill="#1e2433" rx="6"/>
          <rect x="8" y="8" width="84" height="84" fill="#0d111a" stroke="#334155" stroke-width="3" rx="4"/>
          <line x1="8" y1="8" x2="92" y2="92" stroke="#475569" stroke-width="2"/>
          <line x1="92" y1="8" x2="8" y2="92" stroke="#475569" stroke-width="2"/>
          <circle cx="16" cy="16" r="3" fill="#64748b"/>
          <circle cx="84" cy="16" r="3" fill="#64748b"/>
          <circle cx="16" cy="84" r="3" fill="#64748b"/>
          <circle cx="84" cy="84" r="3" fill="#64748b"/>
        </svg>
      `;
    }
    if (tile === 'pit') {
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-pit">
          <rect width="100" height="100" fill="#030408"/>
          <rect x="4" y="4" width="92" height="92" fill="none" stroke="#f97316" stroke-width="2" stroke-dasharray="8 6" opacity="0.6"/>
          <circle cx="50" cy="50" r="38" fill="#000" stroke="#ea580c" stroke-width="3"/>
          <circle cx="50" cy="50" r="26" fill="#0a0502" opacity="0.8"/>
          <circle cx="50" cy="50" r="14" fill="#000"/>
        </svg>
      `;
    }
    if (tile.startsWith('conveyor_')) {
      const dir = tile.split('_')[1]; // N, E, S, W
      const rot = dir === 'N' ? 0 : dir === 'E' ? 90 : dir === 'S' ? 180 : 270;
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-conveyor">
          <rect width="100" height="100" fill="#0b1329"/>
          <g transform="rotate(${rot} 50 50)">
            <path d="M50 16 L76 38 L66 44 L50 30 L34 44 L24 38 Z" fill="#00e5ff" opacity="0.95"/>
            <path d="M50 42 L76 64 L66 70 L50 56 L34 70 L24 64 Z" fill="#00e5ff" opacity="0.7"/>
            <path d="M50 68 L76 90 L66 96 L50 82 L34 96 L24 90 Z" fill="#00e5ff" opacity="0.45"/>
          </g>
        </svg>
      `;
    }
    if (tile.startsWith('gear_')) {
      const isCcw = tile === 'gear_ccw';
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-gear ${isCcw ? 'gear-ccw' : 'gear-cw'}">
          <rect width="100" height="100" fill="#131024"/>
          <circle cx="50" cy="50" r="36" fill="none" stroke="#a855f7" stroke-width="4" stroke-dasharray="10 8"/>
          <circle cx="50" cy="50" r="24" fill="#1e1838" stroke="#c084fc" stroke-width="2"/>
          <circle cx="50" cy="50" r="10" fill="#0b0816"/>
          <text x="50" y="55" font-size="18" font-weight="bold" fill="#f3e8ff" text-anchor="middle" dominant-baseline="middle">${isCcw ? '↺' : '↻'}</text>
        </svg>
      `;
    }
    if (tile.startsWith('laser_turret_')) {
      const dir = tile.split('_')[2]; // N, E, S, W
      const rot = dir === 'N' ? 0 : dir === 'E' ? 90 : dir === 'S' ? 180 : 270;
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-turret">
          <rect width="100" height="100" fill="#181014"/>
          <g transform="rotate(${rot} 50 50)">
            <circle cx="50" cy="50" r="36" fill="#2d151c" stroke="#ef4444" stroke-width="3"/>
            <circle cx="50" cy="50" r="22" fill="#451119" stroke="#f87171" stroke-width="2"/>
            <rect x="44" y="8" width="12" height="30" rx="3" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="50" cy="8" r="4" fill="#ffffff"/>
            <circle cx="50" cy="50" r="8" fill="#ef4444"/>
          </g>
        </svg>
      `;
    }
    if (tile === 'repair') {
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-repair">
          <rect width="100" height="100" fill="#071b16"/>
          <rect x="10" y="10" width="80" height="80" rx="10" fill="#0c2d25" stroke="#10b981" stroke-width="2"/>
          <rect x="42" y="24" width="16" height="52" rx="4" fill="#10b981"/>
          <rect x="24" y="42" width="52" height="16" rx="4" fill="#10b981"/>
          <circle cx="50" cy="50" r="6" fill="#ecfdf5"/>
          <text x="50" y="84" font-size="12" font-weight="bold" fill="#34d399" text-anchor="middle">+1 HP</text>
        </svg>
      `;
    }
    if (tile.startsWith('cp_')) {
      const num = tile.split('_')[1];
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-checkpoint">
          <rect width="100" height="100" fill="#1f1807"/>
          <rect x="6" y="6" width="88" height="88" rx="8" fill="#2d2208" stroke="#f59e0b" stroke-width="3"/>
          <!-- Mástil y bandera posicionados en la mitad superior izquierda -->
          <line x1="24" y1="14" x2="24" y2="52" stroke="#fbbf24" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="24" cy="14" r="3" fill="#fde68a"/>
          <polygon points="24,16 62,28 24,40" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
          <path d="M24 28 Q43 23 62 28" stroke="#fef3c7" stroke-width="1" fill="none"/>
          <!-- Badge circular nítido con el número en la mitad inferior sin interferencia -->
          <circle cx="58" cy="62" r="23" fill="#181307" stroke="#fbbf24" stroke-width="3"/>
          <circle cx="58" cy="62" r="18" fill="#2d2208" stroke="#f59e0b" stroke-width="1.5"/>
          <text x="58" y="71" font-family="'Outfit', sans-serif" font-size="26" font-weight="900" fill="#ffffff" text-anchor="middle">${num}</text>
          <!-- Etiqueta CP decorativa -->
          <rect x="14" y="66" width="22" height="14" rx="3" fill="#3b2b09" stroke="#f59e0b" stroke-width="1"/>
          <text x="25" y="77" font-family="'Chakra Petch', sans-serif" font-size="9" font-weight="700" fill="#fbbf24" text-anchor="middle">CP</text>
        </svg>
      `;
    }
    if (tile.startsWith('spawn_')) {
      const num = tile.split('_')[1];
      return `
        <svg viewBox="0 0 100 100" class="tile-svg tile-svg-spawn">
          <rect width="100" height="100" fill="#0d1424"/>
          <circle cx="50" cy="50" r="38" fill="#13203b" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4"/>
          <circle cx="50" cy="50" r="24" fill="#0b1322" stroke="#0284c7" stroke-width="1.5"/>
          <text x="50" y="58" font-family="'Chakra Petch', sans-serif" font-size="24" font-weight="700" fill="#38bdf8" text-anchor="middle">S${num}</text>
        </svg>
      `;
    }
    // Suelo estándar
    return `
      <svg viewBox="0 0 100 100" class="tile-svg tile-svg-floor">
        <rect width="100" height="100" fill="#0c101c"/>
        <rect x="2" y="2" width="96" height="96" fill="#080c16" stroke="#161f33" stroke-width="1" rx="4"/>
        <circle cx="8" cy="8" r="2" fill="#1e293b"/>
        <circle cx="92" cy="8" r="2" fill="#1e293b"/>
        <circle cx="8" cy="92" r="2" fill="#1e293b"/>
        <circle cx="92" cy="92" r="2" fill="#1e293b"/>
      </svg>
    `;
  }

  function getRobotChassisSvg(color, initials) {
    return `
      <svg viewBox="0 0 100 100" class="robot-chassis-svg">
        <ellipse cx="50" cy="54" rx="40" ry="40" fill="rgba(0,0,0,0.5)"/>
        <rect x="12" y="18" width="14" height="64" rx="5" fill="#1e293b" stroke="#475569" stroke-width="2"/>
        <rect x="74" y="18" width="14" height="64" rx="5" fill="#1e293b" stroke="#475569" stroke-width="2"/>
        <line x1="12" y1="32" x2="26" y2="32" stroke="#64748b" stroke-width="1.5"/>
        <line x1="12" y1="46" x2="26" y2="46" stroke="#64748b" stroke-width="1.5"/>
        <line x1="12" y1="60" x2="26" y2="60" stroke="#64748b" stroke-width="1.5"/>
        <line x1="74" y1="32" x2="88" y2="32" stroke="#64748b" stroke-width="1.5"/>
        <line x1="74" y1="46" x2="88" y2="46" stroke="#64748b" stroke-width="1.5"/>
        <line x1="74" y1="60" x2="88" y2="60" stroke="#64748b" stroke-width="1.5"/>
        <rect x="24" y="20" width="52" height="60" rx="10" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
        <rect x="45" y="4" width="10" height="24" rx="3" fill="#ffffff" stroke="${color}" stroke-width="2"/>
        <circle cx="50" cy="5" r="3.5" fill="#ef4444"/>
        <circle cx="50" cy="50" r="20" fill="#0a0f1d" stroke="#ffffff" stroke-width="2"/>
        <text x="50" y="56" font-family="'Outfit', sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle">${initials}</text>
        <polygon points="50,23 44,30 56,30" fill="#ffffff"/>
      </svg>
    `;
  }

  // ==========================================================================
  // 6. UTILIDADES GENERALES
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
      if (dom.headerRoomCode) dom.headerRoomCode.textContent = code;
      if (dom.roomBadgeWrap) dom.roomBadgeWrap.classList.remove('d-none');
    } else {
      if (dom.roomBadgeWrap) dom.roomBadgeWrap.classList.add('d-none');
    }
  }

  function getHumanFacing(facing) {
    const list = [
      '▲ Mirando ARRIBA (Norte)',
      '▶ Mirando DERECHA (Este)',
      '▼ Mirando ABAJO (Sur)',
      '◀ Mirando IZQUIERDA (Oeste)'
    ];
    return list[facing] || list[0];
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

  function setSpotlight(badge, text) {
    if (dom.tvSpotlightBadge) dom.tvSpotlightBadge.textContent = badge;
    if (dom.tvSpotlightText) dom.tvSpotlightText.innerHTML = text;
  }

  function showFloatingFx(gridX, gridY, text, type = 'info') {
    if (!dom.tvFxLayer) return;
    const fx = document.createElement('div');
    fx.className = `floating-fx fx-${type}`;
    const leftVal = (gridX !== undefined && !isNaN(gridX)) ? (gridX + 0.5) * 10 : 50;
    const topVal = (gridY !== undefined && !isNaN(gridY)) ? (gridY + 0.5) * 12.5 : 50;
    fx.style.left = `${leftVal}%`;
    fx.style.top = `${topVal}%`;
    fx.textContent = text;
    dom.tvFxLayer.appendChild(fx);

    setTimeout(() => {
      if (fx.parentNode) fx.parentNode.removeChild(fx);
    }, 950);
  }

  function drawLaserBeam(fromX, fromY, toX, toY, color = '#ef4444') {
    if (!dom.tvLaserSvg) return;
    const fx = fromX * 100 + 50;
    const fy = fromY * 100 + 50;
    const tx = toX * 100 + 50;
    const ty = toY * 100 + 50;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fx);
    line.setAttribute('y1', fy);
    line.setAttribute('x2', tx);
    line.setAttribute('y2', ty);
    line.setAttribute('stroke', color);
    line.setAttribute('class', 'laser-beam');

    dom.tvLaserSvg.appendChild(line);

    setTimeout(() => {
      if (line.parentNode) line.parentNode.removeChild(line);
    }, 500);
  }

  // ==========================================================================
  // 7. INICIALIZACIÓN Y DETECCIÓN DE URL
  // ==========================================================================
  function init() {
    setupUniversalHeader();
    setupColorPalette();
    setupRulesModal();
    setupVipConfigControls();
    setupTvLobbyControls();
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
    dom.btnToggleSound?.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      if (dom.soundIcon) dom.soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    });

    dom.btnToggleFs?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (dom.fsIcon) dom.fsIcon.textContent = document.fullscreenElement ? '🪟' : '📺';
    });
  }

  function setupRulesModal() {
    dom.btnToggleRules?.addEventListener('click', () => {
      dom.rulesModal?.classList.remove('d-none');
    });
    dom.btnCloseRules?.addEventListener('click', () => {
      dom.rulesModal?.classList.add('d-none');
    });
    dom.btnConfirmRules?.addEventListener('click', () => {
      dom.rulesModal?.classList.add('d-none');
    });
    dom.rulesModal?.addEventListener('click', (e) => {
      if (e.target === dom.rulesModal) {
        dom.rulesModal.classList.add('d-none');
      }
    });
  }

  function setupColorPalette() {
    if (!dom.phoneColorPalette) return;
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

  function setupVipConfigControls() {
    const sendConfig = () => {
      if (!isVipPlayer || !myPhoneConn) return;
      myPhoneConn.send({
        type: 'VIP_UPDATE_CONFIG',
        playerId: myPlayerId,
        config: {
          arenaId: dom.selectArenaMap?.value,
          damageRule: dom.selectDamageRule?.value,
          roundTimer: parseInt(dom.selectRoundTimer?.value || '45', 10),
          executionSpeed: dom.selectExecutionSpeed?.value
        }
      });
    };

    dom.selectArenaMap?.addEventListener('change', sendConfig);
    dom.selectDamageRule?.addEventListener('change', sendConfig);
    dom.selectRoundTimer?.addEventListener('change', sendConfig);
    dom.selectExecutionSpeed?.addEventListener('change', sendConfig);
  }

  function setupTvLobbyControls() {
    const handleTvConfigChange = () => {
      if (!isTvMode || !gameState) return;
      applyConfigToGameState({
        arenaId: dom.tvSelectArena?.value,
        damageRule: dom.tvSelectDamage?.value,
        roundTimer: parseInt(dom.tvSelectTimer?.value || '45', 10),
        executionSpeed: dom.tvSelectSpeed?.value
      });
      broadcastLobbyUpdate();
    };

    dom.tvSelectArena?.addEventListener('change', handleTvConfigChange);
    dom.tvSelectDamage?.addEventListener('change', handleTvConfigChange);
    dom.tvSelectTimer?.addEventListener('change', handleTvConfigChange);
    dom.tvSelectSpeed?.addEventListener('change', handleTvConfigChange);

    // Botón de forzar ejecución inmediata desde la TV
    dom.btnTvForceExecute?.addEventListener('click', () => {
      if (!isTvMode || gameState.phase !== 'programming') return;
      forceSubmitPendingPlayers();
    });
  }

  function applyConfigToPhoneControls(config) {
    if (!config) return;
    if (config.arenaId && dom.selectArenaMap) dom.selectArenaMap.value = config.arenaId;
    if (config.damageRule && dom.selectDamageRule) dom.selectDamageRule.value = config.damageRule;
    if (config.roundTimer !== undefined && dom.selectRoundTimer) dom.selectRoundTimer.value = String(config.roundTimer);
    if (config.executionSpeed && dom.selectExecutionSpeed) dom.selectExecutionSpeed.value = config.executionSpeed;
  }

  function updateVipVisibility() {
    if (isVipPlayer) {
      dom.phoneVipControls?.classList.remove('d-none');
      dom.phoneRegularWaiting?.classList.add('d-none');
    } else {
      dom.phoneVipControls?.classList.add('d-none');
      dom.phoneRegularWaiting?.classList.remove('d-none');
    }
  }

  function bindEvents() {
    // Selección en Landing
    dom.btnSelectTvMode?.addEventListener('click', () => {
      startTvMode();
    });

    dom.btnSelectPhoneMode?.addEventListener('click', (e) => {
      if (e.target !== dom.inputManualRoomCode && e.target !== dom.btnManualJoinRoom) {
        switchToScreen('phone');
        showPhoneView('join');
      }
    });

    dom.btnManualJoinRoom?.addEventListener('click', () => {
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

    dom.inputManualRoomCode?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') dom.btnManualJoinRoom.click();
    });

    // Formulario de ingreso Celular
    dom.btnPhoneConnect?.addEventListener('click', handlePhoneConnect);

    // VIP Iniciar Partida
    dom.btnPhoneVipStart?.addEventListener('click', () => {
      if (!isVipPlayer || !myPhoneConn) return;
      const arenaId = dom.selectArenaMap?.value;
      const damageRule = dom.selectDamageRule?.value;
      const roundTimer = parseInt(dom.selectRoundTimer?.value || '45', 10);
      const executionSpeed = dom.selectExecutionSpeed?.value;

      myPhoneConn.send({
        type: 'VIP_START_GAME',
        playerId: myPlayerId,
        config: { arenaId, damageRule, roundTimer, executionSpeed }
      });
    });

    // Host Iniciar Partida desde TV
    dom.btnTvStartGame?.addEventListener('click', () => {
      if (!isTvMode) return;
      startHostGame();
    });

    // Revancha / Fin de partida
    dom.btnTvPlayAgain?.addEventListener('click', () => {
      resetGameForRematch();
    });

    dom.btnTvBackToLobby?.addEventListener('click', () => {
      dom.tvViewPodium?.classList.add('d-none');
      dom.tvViewArena?.classList.add('d-none');
      dom.tvViewLobby?.classList.remove('d-none');
    });

    // Slots de Celular
    [dom.slot_0, dom.slot_1, dom.slot_2, dom.slot_3].forEach((el, idx) => {
      el?.addEventListener('click', () => {
        handleSlotClick(idx);
      });
    });

    // Botón Confirmar Programa
    dom.btnPhoneLockProgram?.addEventListener('click', handleToggleLockProgram);
  }

  function switchToScreen(screen) {
    dom.screenLanding?.classList.add('d-none');
    dom.screenTv?.classList.add('d-none');
    dom.screenPhone?.classList.add('d-none');

    if (screen === 'landing') dom.screenLanding?.classList.remove('d-none');
    if (screen === 'tv') dom.screenTv?.classList.remove('d-none');
    if (screen === 'phone') dom.screenPhone?.classList.remove('d-none');
  }

  function showPhoneView(view) {
    dom.phoneViewJoin?.classList.add('d-none');
    dom.phoneViewLobby?.classList.add('d-none');
    dom.phoneViewProgramming?.classList.add('d-none');
    dom.phoneViewExecuting?.classList.add('d-none');

    if (view === 'join') dom.phoneViewJoin?.classList.remove('d-none');
    if (view === 'lobby') dom.phoneViewLobby?.classList.remove('d-none');
    if (view === 'programming') dom.phoneViewProgramming?.classList.remove('d-none');
    if (view === 'executing') dom.phoneViewExecuting?.classList.remove('d-none');
  }

  // ==========================================================================
  // 8. MODO TV (HOST)
  // ==========================================================================
  function ensureVipPlayer() {
    if (!gameState || !gameState.players || gameState.players.length === 0) return null;
    let vip = gameState.players.find(p => p.isVip);
    if (!vip) {
      vip = gameState.players.find(p => !p.isAsleep) || gameState.players[0];
      vip.isVip = true;
    }
    // Asegurar único VIP
    gameState.players.forEach(p => {
      if (p.id !== vip.id) p.isVip = false;
    });
    return vip;
  }

  function applyConfigToGameState(config) {
    if (!config || !gameState) return;
    if (config.arenaId && ARENAS_DATA.ARENAS[config.arenaId]) {
      gameState.arenaId = config.arenaId;
      gameState.arena = ARENAS_DATA.ARENAS[config.arenaId];
    }
    if (config.damageRule) gameState.damageRule = config.damageRule;
    if (typeof config.roundTimer === 'number') gameState.roundTimer = config.roundTimer;
    if (config.executionSpeed) gameState.executionSpeed = config.executionSpeed;

    updateTvConfigDisplay();
  }

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
            renderTvPilotsGrid();
          }
        },
        getPhaseKey: () => `${gameState ? gameState.phase : 'lobby'}_round_${gameState ? gameState.roundNumber : 0}`
      });
      peerResilienceHost.startSleepMonitor();
    }

    const room = generateRoomCode();
    updateRoomHeader(room);
    if (dom.tvRoomCodeText) dom.tvRoomCodeText.textContent = room;

    // Generar QR
    if (dom.tvLobbyQr) {
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
    }

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
        setTimeout(startTvMode, 500);
      }
    });

    // Configuración inicial de juego
    gameState = ROBO_ENGINE.createGameState({
      arenaId: 'fabrica',
      damageRule: 'tactical',
      roundTimer: 45,
      executionSpeed: 'normal',
      players: []
    });

    updateTvConfigDisplay();
    renderTvPlayersList();
  }

  function setupHostConnection(conn) {
    conn.on('data', (data) => {
      if (!data || !data.type) return;

      const senderId = data.playerId || conn._playerId;
      if (!conn._playerId && data.playerId) {
        conn._playerId = data.playerId;
      }

      if (senderId && peerResilienceHost) {
        if (peerResilienceHost.handleIncomingHostData(senderId, conn, data)) return;
        if (data.type !== 'PLAYER_JOIN' && !peerResilienceHost.isConnectionActive(senderId, conn)) {
          peerResilienceHost.registerPlayerConnection(senderId, conn);
        }
      }

      handleHostDataReceived(conn, data);
    });

    conn.on('close', () => {
      const pId = conn._playerId;
      if (pId) {
        const p = gameState && gameState.players.find(pl => pl.id === pId);
        if (p) {
          p.isAsleep = true;
          renderTvPlayersList();
          renderTvPilotsGrid();
        }
      }
    });
  }

  function handleHostDataReceived(conn, data) {
    if (!data || !data.type) return;

    const senderId = data.playerId || conn._playerId;

    if (data.type === 'PLAYER_JOIN') {
      const { playerId, name, color, avatar } = data;
      conn._playerId = playerId;
      if (peerResilienceHost) {
        peerResilienceHost.registerPlayerConnection(playerId, conn);
      }

      let player = gameState.players.find(p => p.id === playerId);

      if (player) {
        player.isAsleep = false;
        ensureVipPlayer();
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
        ensureVipPlayer();
        playJoin();
      }

      hostConnections.set(playerId, conn);

      // Confirmar al jugador
      conn.send({
        type: 'JOIN_ACCEPTED',
        roomCode: currentRoomCode,
        player,
        isVip: player.isVip,
        config: {
          arenaId: gameState.arenaId,
          damageRule: gameState.damageRule,
          roundTimer: gameState.roundTimer,
          executionSpeed: gameState.executionSpeed
        },
        gameState: getSanitizedGameStateForPlayer(player.id)
      });

      // Enviar sincronización completa
      conn.send({
        type: 'FULL_STATE_SYNC',
        payload: {
          phase: gameState.phase,
          roundNumber: gameState.roundNumber,
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
          phaseKey: `${gameState.phase}_round_${gameState.roundNumber}`,
          config: {
            arenaId: gameState.arenaId,
            damageRule: gameState.damageRule,
            roundTimer: gameState.roundTimer,
            executionSpeed: gameState.executionSpeed
          }
        }
      });

      if (gameState.phase === 'programming') {
        conn.send({
          type: 'ROUND_STARTED',
          playerId: player.id,
          roundNumber: gameState.roundNumber,
          hand: player.hand,
          program: player.program,
          lockedSlots: player.lockedSlots,
          hp: player.hp,
          facing: player.facing,
          lastCheckpoint: player.lastCheckpoint,
          timer: gameState.roundTimer
        });
      }

      broadcastLobbyUpdate();
    }

    if (data.type === 'VIP_UPDATE_CONFIG') {
      ensureVipPlayer();
      const player = gameState.players.find(p => p.id === senderId && p.isVip);
      if (player && data.config) {
        applyConfigToGameState(data.config);
        broadcastLobbyUpdate();
      }
    }

    if (data.type === 'VIP_START_GAME') {
      ensureVipPlayer();
      const player = gameState.players.find(p => p.id === senderId && p.isVip);
      if (player && gameState.players.length >= 2) {
        if (data.config) {
          applyConfigToGameState(data.config);
        }
        startHostGame();
      }
    }

    if (data.type === 'PLAYER_SUBMIT_PROGRAM') {
      const player = gameState.players.find(p => p.id === senderId);
      if (player && gameState.phase === 'programming') {
        if (Array.isArray(data.program) && data.program.filter(Boolean).length === 4) {
          player.program = data.program;
          player.programLocked = true;
          playProgramLocked();

          conn.send({ type: 'PROGRAM_ACCEPTED', locked: true, playerId: senderId });
          renderTvPilotsGrid();
          checkAllProgramsLocked();
        }
      }
    }

    if (data.type === 'PLAYER_UNLOCK_PROGRAM') {
      const player = gameState.players.find(p => p.id === senderId);
      if (player && gameState.phase === 'programming') {
        player.programLocked = false;
        conn.send({ type: 'PROGRAM_ACCEPTED', locked: false, playerId: senderId });
        renderTvPilotsGrid();
      }
    }
  }

  function broadcastToPlayers(msg) {
    for (const conn of hostConnections.values()) {
      try {
        if (conn && conn.open) {
          conn.send(msg);
        }
      } catch (err) {
        console.warn('Error al transmitir mensaje a peer:', err);
      }
    }
  }

  function broadcastLobbyUpdate() {
    ensureVipPlayer();
    broadcastToPlayers({
      type: 'LOBBY_UPDATE',
      config: {
        arenaId: gameState.arenaId,
        damageRule: gameState.damageRule,
        roundTimer: gameState.roundTimer,
        executionSpeed: gameState.executionSpeed
      },
      players: gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        isVip: p.isVip,
        isAsleep: p.isAsleep
      }))
    });

    renderTvPlayersList();

    if (gameState.players.length >= 2) {
      dom.btnTvStartGame?.classList.remove('d-none');
      if (dom.tvLobbyStatusMsg) {
        dom.tvLobbyStatusMsg.textContent = '¡Listos para combatir! El VIP puede iniciar desde su móvil o pueden pulsar el botón de abajo.';
      }
    } else {
      dom.btnTvStartGame?.classList.add('d-none');
      if (dom.tvLobbyStatusMsg) {
        dom.tvLobbyStatusMsg.textContent = 'Esperando al menos 2 pilotos para comenzar...';
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
      executionSpeed: gameState.executionSpeed,
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
    if (dom.tvSelectArena) dom.tvSelectArena.value = gameState.arenaId;
    if (dom.tvSelectDamage) dom.tvSelectDamage.value = gameState.damageRule;
    if (dom.tvSelectTimer) dom.tvSelectTimer.value = String(gameState.roundTimer);
    if (dom.tvSelectSpeed) dom.tvSelectSpeed.value = gameState.executionSpeed;
  }

  function renderTvPlayersList() {
    if (!dom.tvPlayersList) return;
    if (dom.tvPlayerCount) dom.tvPlayerCount.textContent = gameState.players.length;
    dom.tvPlayersList.innerHTML = '';

    gameState.players.forEach(p => {
      const card = document.createElement('div');
      card.className = `tv-player-card ${p.isVip ? 'is-vip' : ''}`;
      const initials = p.name ? p.name.substring(0, 3).toUpperCase() : 'BOT';
      card.innerHTML = `
        <div class="tv-player-avatar-circle" style="background-color: ${p.color};">
          ${initials}
        </div>
        <div class="tv-player-info">
          <div class="tv-player-name">${p.name} ${p.isVip ? '👑' : ''} ${p.isAsleep ? '💤' : ''}</div>
          <div class="tv-player-status">${p.isAsleep ? 'En pausa (pantalla bloqueada)' : (p.isVip ? '👑 Piloto VIP (Configura la partida)' : 'Chasis listo para combate')}</div>
        </div>
      `;
      dom.tvPlayersList.appendChild(card);
    });
  }

  // ==========================================================================
  // 9. BUCLE PRINCIPAL DE PARTIDA Y ARENA PANORÁMICA (HOST)
  // ==========================================================================
  function startHostGame() {
    dom.tvViewLobby?.classList.add('d-none');
    dom.tvViewArena?.classList.remove('d-none');

    const arena = gameState.arena;
    gameState.players.forEach((p, idx) => {
      const sp = (arena.spawns && arena.spawns.length > 0) ? arena.spawns[idx % arena.spawns.length] : { x: 1, y: 7 };
      p.spawnIdx = idx;
      p.spawnIndex = idx;
      p.x = sp.x;
      p.y = sp.y;
      p.facing = sp.facing !== undefined ? sp.facing : 0;
      p.hp = 5;
      p.alive = true;
      p.shieldActive = false;
      p.lastCheckpoint = 0;
      p.programLocked = false;
      p.program = [null, null, null, null];
    });

    renderTvBoardGrid();
    renderTurretSights();
    initOrUpdateVisualRobots(true);
    startNewRound();
  }

  function renderTvBoardGrid() {
    if (!dom.tvBoardGrid) return;
    const grid = gameState.arena.grid;
    dom.tvBoardGrid.innerHTML = '';

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 10; x++) {
        const tile = grid[y][x];
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.innerHTML = getTileSvg(tile);
        dom.tvBoardGrid.appendChild(cell);
      }
    }
  }

  function renderTurretSights() {
    if (!dom.tvTurretSightsSvg) return;
    dom.tvTurretSightsSvg.innerHTML = '';
    const grid = gameState.arena.grid;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 10; x++) {
        const tile = grid[y][x];
        if (tile && tile.startsWith('laser_turret_')) {
          const dir = tile.split('_')[2];
          let dx = 0;
          let dy = 0;
          if (dir === 'N') dy = -1;
          else if (dir === 'E') dx = 1;
          else if (dir === 'S') dy = 1;
          else if (dir === 'W') dx = -1;

          let cx = x;
          let cy = y;
          let stopX = x;
          let stopY = y;

          while (true) {
            cx += dx;
            cy += dy;
            if (cx < 0 || cx >= 10 || cy < 0 || cy >= 8) break;
            const targetTile = grid[cy][cx];
            stopX = cx;
            stopY = cy;
            if (ARENAS_DATA.isSolidObstacle(targetTile)) {
              break;
            }
          }

          const x1 = x * 100 + 50;
          const y1 = y * 100 + 50;
          const x2 = stopX * 100 + 50;
          const y2 = stopY * 100 + 50;

          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', x1);
          line.setAttribute('y1', y1);
          line.setAttribute('x2', x2);
          line.setAttribute('y2', y2);
          line.setAttribute('class', 'turret-sight-line');
          dom.tvTurretSightsSvg.appendChild(line);
        }
      }
    }
  }

  function initOrUpdateVisualRobots(forceRecreate = false) {
    if (!dom.tvRobotsLayer) return;

    if (forceRecreate) {
      dom.tvRobotsLayer.innerHTML = '';
      visualRobots.clear();
    }

    gameState.players.forEach(p => {
      let vis = visualRobots.get(p.id);
      if (!vis) {
        vis = {
          x: p.x,
          y: p.y,
          facing: p.facing,
          visualAngleDeg: p.facing * 90,
          hp: p.hp,
          alive: p.alive,
          shieldActive: p.shieldActive,
          lastCheckpoint: p.lastCheckpoint
        };
        visualRobots.set(p.id, vis);
      } else {
        vis.x = p.x;
        vis.y = p.y;
        vis.facing = p.facing;
        vis.hp = p.hp;
        vis.alive = p.alive;
        vis.shieldActive = p.shieldActive;
        vis.lastCheckpoint = p.lastCheckpoint;
      }

      let token = document.getElementById(`robot_token_${p.id}`);
      if (!token) {
        token = document.createElement('div');
        token.className = `robot-token ${!p.alive ? 'is-dead' : ''}`;
        token.id = `robot_token_${p.id}`;
        token.style.left = `${vis.x * 10}%`;
        token.style.top = `${vis.y * 12.5}%`;

        const initials = p.name ? p.name.substring(0, 3).toUpperCase() : 'BOT';

        token.innerHTML = `
          <div class="robot-chassis" style="transform: rotate(${vis.visualAngleDeg}deg);">
            ${getRobotChassisSvg(p.color, initials)}
          </div>
          <div class="robot-shield-bubble ${p.shieldActive ? 'is-active' : ''}"></div>
        `;
        dom.tvRobotsLayer.appendChild(token);
      } else {
        token.className = `robot-token ${!p.alive ? 'is-dead' : ''}`;
        token.style.left = `${vis.x * 10}%`;
        token.style.top = `${vis.y * 12.5}%`;
        const chassis = token.querySelector('.robot-chassis');
        if (chassis) {
          chassis.style.transform = `rotate(${vis.visualAngleDeg}deg)`;
        }
        const shield = token.querySelector('.robot-shield-bubble');
        if (shield) {
          shield.className = `robot-shield-bubble ${p.shieldActive ? 'is-active' : ''}`;
        }
      }
    });
  }

  function startNewRound() {
    isExecuting = false;
    gameState.phase = 'programming';
    gameState.currentStep = 0;

    // Repartir cartas
    ROBO_ENGINE.dealRoundCards(gameState);

    // Ajustar vista de comando TV
    if (dom.tvCmdRoundBadge) dom.tvCmdRoundBadge.textContent = `RONDA ${gameState.roundNumber}`;
    if (dom.tvCmdMapName) dom.tvCmdMapName.textContent = gameState.arena.name;
    dom.tvCmdTimerWrap?.classList.remove('d-none');
    dom.tvCmdStepsProgress?.classList.add('d-none');
    dom.tvCmdSubphaseTracker?.classList.add('d-none');
    dom.tvCmdStepCardsQueue?.classList.add('d-none');

    setSpotlight('PROGRAMACIÓN', 'Los pilotos están eligiendo sus 4 órdenes secretas en sus celulares...');
    renderTvPilotsGrid();
    initOrUpdateVisualRobots(false);

    // Notificar a cada móvil con su mano
    for (const p of gameState.players) {
      const conn = hostConnections.get(p.id);
      if (conn && conn.open) {
        conn.send({
          type: 'ROUND_STARTED',
          playerId: p.id,
          roundNumber: gameState.roundNumber,
          hand: p.hand,
          program: p.program,
          lockedSlots: p.lockedSlots,
          hp: p.hp,
          facing: p.facing,
          lastCheckpoint: p.lastCheckpoint,
          timer: gameState.roundTimer
        });
      }
    }

    startProgrammingTimer();
  }

  function startProgrammingTimer() {
    if (timerInterval) clearInterval(timerInterval);

    if (gameState.roundTimer <= 0) {
      dom.tvCmdTimerWrap?.classList.add('d-none');
      return;
    }

    dom.tvCmdTimerWrap?.classList.remove('d-none');
    remainingTimerSecs = gameState.roundTimer;
    if (dom.tvCmdTimerSecs) dom.tvCmdTimerSecs.textContent = `${remainingTimerSecs}s`;

    timerInterval = setInterval(() => {
      remainingTimerSecs--;
      if (dom.tvCmdTimerSecs) dom.tvCmdTimerSecs.textContent = `${remainingTimerSecs}s`;

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
        const placedIds = new Set(p.program.filter(Boolean).map(c => c.id));
        const availableCards = p.hand.filter(c => !placedIds.has(c.id));

        for (let i = 0; i < 4; i++) {
          if (!p.program[i] && availableCards.length > 0) {
            p.program[i] = availableCards.shift();
          }
        }
        p.programLocked = true;

        const conn = hostConnections.get(p.id);
        if (conn && conn.open) {
          conn.send({
            type: 'FORCE_SUBMIT_CONFIRMED',
            playerId: p.id,
            program: p.program
          });
        }
      }
    }
    renderTvPilotsGrid();
    checkAllProgramsLocked();
  }

  function checkAllProgramsLocked() {
    if (gameState.phase !== 'programming') return;
    if (isExecuting) return;

    const alivePlayers = gameState.players.filter(p => p.alive);
    const allLocked = alivePlayers.length > 0 && alivePlayers.every(p => p.programLocked);

    if (allLocked) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      isExecuting = true;
      runExecutionPhase();
    }
  }

  function renderTvPilotsGrid() {
    if (!dom.tvCmdPilotsGrid) return;
    dom.tvCmdPilotsGrid.innerHTML = '';

    gameState.players.forEach(p => {
      const card = document.createElement('div');
      card.className = `cmd-pilot-card ${p.programLocked ? 'is-ready' : ''} ${!p.alive ? 'is-dead' : ''}`;
      card.id = `pilot_card_${p.id}`;
      card.style.borderLeftColor = p.color;

      const hearts = renderHearts(p.hp);
      const statusText = !p.alive
        ? '💀 DESTRUIDO'
        : p.isAsleep
        ? '💤 En reposo'
        : p.programLocked
        ? '✅ Listo'
        : '🧠 Programando...';

      const initials = p.name ? p.name.substring(0, 3).toUpperCase() : 'BOT';

      card.innerHTML = `
        <div class="cmd-pilot-avatar" style="background-color: ${p.color};">
          ${initials}
        </div>
        <div class="cmd-pilot-details">
          <div class="cmd-pilot-name" style="color: ${p.color};">
            ${p.name} ${p.isVip ? '👑' : ''} ${p.isAsleep ? '💤' : ''}
          </div>
          <div class="cmd-pilot-hp">${hearts}</div>
          <div class="cmd-pilot-meta">
            <span class="cmd-pilot-status">${statusText}</span>
            <span class="cmd-pilot-cp">🚩 ${p.lastCheckpoint}/3</span>
          </div>
        </div>
      `;
      dom.tvCmdPilotsGrid.appendChild(card);
    });
  }

  function renderTvStepCardsQueue(cards) {
    if (!dom.tvCmdQueueCardsList) return;
    dom.tvCmdQueueCardsList.innerHTML = '';

    cards.forEach(item => {
      const cardEl = document.createElement('div');
      cardEl.className = `cmd-card-queue-item cat-${item.card.category || 'move'}`;
      cardEl.id = `queue_card_${item.player.id}`;
      cardEl.style.borderLeftColor = item.player.color;
      cardEl.innerHTML = `
        <div class="q-card-pilot" style="color: ${item.player.color};">${item.player.name}</div>
        <div class="q-card-name">${item.card.icon} ${item.card.name}</div>
        <div class="q-card-prio">[${item.card.priority}]</div>
      `;
      dom.tvCmdQueueCardsList.appendChild(cardEl);
    });
  }

  function highlightQueueCard(playerId) {
    document.querySelectorAll('.cmd-card-queue-item').forEach(el => el.classList.remove('is-active'));
    const target = document.getElementById(`queue_card_${playerId}`);
    if (target) {
      target.classList.add('is-active');
    }
  }

  function highlightSubphasePill(phase) {
    document.querySelectorAll('.subphase-pill').forEach(pill => {
      if (pill.dataset.phase === phase) {
        pill.classList.add('is-active');
      } else {
        pill.classList.remove('is-active');
      }
    });
  }

  function updateStepProgress(currentStepIndex) {
    document.querySelectorAll('.cmd-step-node').forEach(node => {
      const step = parseInt(node.dataset.step, 10);
      node.classList.remove('is-current', 'is-done');
      if (step < currentStepIndex) {
        node.classList.add('is-done');
      } else if (step === currentStepIndex) {
        node.classList.add('is-current');
      }
    });
  }

  // ==========================================================================
  // 10. REPRODUCTOR DE TIMELINE ATÓMICO (FASE DE EJECUCIÓN CON BLINDAJE TRY/CATCH)
  // ==========================================================================
  async function runExecutionPhase() {
    isExecuting = true;
    gameState.phase = 'executing';
    dom.tvCmdTimerWrap?.classList.add('d-none');
    dom.tvCmdStepsProgress?.classList.remove('d-none');
    dom.tvCmdSubphaseTracker?.classList.remove('d-none');
    dom.tvCmdStepCardsQueue?.classList.remove('d-none');

    broadcastToPlayers({ type: 'EXECUTION_STARTED' });

    try {
      for (let step = 0; step < 4; step++) {
        gameState.currentStep = step;
        updateStepProgress(step);

        // Recopilar cartas activas de este paso y ordenarlas por prioridad
        const stepCards = [];
        for (const p of gameState.players) {
          if (p.alive && p.program && p.program[step]) {
            stepCards.push({ player: p, card: p.program[step] });
          }
        }
        stepCards.sort((a, b) => (b.card ? b.card.priority : 0) - (a.card ? a.card.priority : 0));

        renderTvStepCardsQueue(stepCards);

        broadcastToPlayers({
          type: 'STEP_START',
          stepIndex: step + 1
        });

        setSpotlight(`PASO ${step + 1} DE 4`, `Iniciando resolución del paso... ${stepCards.length} órdenes en cola.`);
        const speedMult = gameState.executionSpeed === 'slow' ? 1.6 : 1.0;
        await delay(900 * speedMult);

        // Ejecutar motor determinista y obtener stream de eventos atómicos
        let stepRes = null;
        try {
          stepRes = ROBO_ENGINE.executeStep(gameState, step);
        } catch (engineErr) {
          console.error('Error al ejecutar ROBO_ENGINE.executeStep:', engineErr);
        }

        // Reproducir eventos atómicos en secuencia con blindaje individual
        if (stepRes && Array.isArray(stepRes.timeline)) {
          for (const ev of stepRes.timeline) {
            try {
              await playTimelineEvent(ev);
            } catch (evErr) {
              console.error('Error al reproducir evento timeline:', ev ? ev.type : 'unknown', evErr);
              await delay(100);
            }
          }
        }

        // Notificar a los celulares sobre sus estadísticas actuales
        for (const p of gameState.players) {
          const conn = hostConnections.get(p.id);
          try {
            if (conn && conn.open) {
              conn.send({
                type: 'LIVE_STATUS_UPDATE',
                playerId: p.id,
                hp: p.hp,
                alive: p.alive,
                lastCheckpoint: p.lastCheckpoint
              });
            }
          } catch (connErr) {
            console.warn('Error al enviar LIVE_STATUS_UPDATE:', connErr);
          }
        }

        // Si hubo ganador
        if (stepRes && stepRes.winner) {
          isExecuting = false;
          showPodiumScreen(stepRes.winner);
          return;
        }

        await delay(700 * speedMult);
      }

      // Fin de los 4 pasos: preparar siguiente ronda
      setSpotlight('FIN DE RONDA', 'Reparando chasis en talleres y reapareciendo robots destruidos...');
      await delay(1200);
      try {
        ROBO_ENGINE.finishRoundAndRespawn(gameState);
      } catch (respawnErr) {
        console.error('Error al finalizar ronda en motor:', respawnErr);
      }
      isExecuting = false;
      startNewRound();
    } catch (err) {
      console.error('Error crítico durante runExecutionPhase:', err);
      isExecuting = false;
      setSpotlight('⚠️ ERROR DE ANIMACIÓN', 'Ocurrió un error inesperado al animar la ronda. Reanudando combate...');
      showFloatingFx(5, 4, '⚠️ ERROR DE ANIMACIÓN', 'damage');
      await delay(2000);
      try {
        ROBO_ENGINE.finishRoundAndRespawn(gameState);
      } catch (e) {
        console.error('Error en fallback finishRoundAndRespawn:', e);
      }
      isExecuting = false;
      startNewRound();
    } finally {
      if (gameState.phase !== 'executing') {
        isExecuting = false;
      }
    }
  }

  async function playTimelineEvent(ev) {
    if (!ev || !ev.type) return;

    const isSlow = gameState.executionSpeed === 'slow';
    const mult = isSlow ? 1.6 : 1.0;

    try {
      switch (ev.type) {
        case 'SUBPHASE': {
          highlightSubphasePill(ev.phase);
          const subphaseNames = {
            cards: { title: 'FASE 1: ÓRDENES', desc: 'Los robots ejecutan sus cartas por orden de prioridad...' },
            conveyors: { title: 'FASE 2: CINTAS', desc: 'Las cintas industriales mueven a los robots...' },
            gears: { title: 'FASE 3: ENGRANAJES', desc: 'Los engranajes rotan a los robots sobre ellos...' },
            lasers: { title: 'FASE 4: LÁSERES', desc: 'Disparos de torretas tácticas y cañones de robots...' },
            objectives: { title: 'FASE 5: METAS', desc: 'Registro de checkpoints y talleres de reparación...' }
          };
          const info = subphaseNames[ev.phase] || { title: ev.title || 'SUB-FASE', desc: ev.subtitle || '' };
          setSpotlight(info.title, info.desc);
          await delay(350 * mult);
          break;
        }

        case 'CARD_START': {
          highlightQueueCard(ev.playerId);
          const pName = ev.playerName || (ev.player ? ev.player.name : 'Piloto');
          const cIcon = ev.card ? ev.card.icon : '⚡';
          const cName = ev.card ? ev.card.name : 'Orden';
          const cPrio = ev.card ? ev.card.priority : 0;
          setSpotlight(
            `ORDEN [${cPrio}]`,
            `<strong>${pName}</strong> ejecuta <span>${cIcon} ${cName}</span>`
          );
          broadcastToPlayers({
            type: 'PLAYER_CARD_EXECUTING',
            playerId: ev.playerId,
            card: ev.card
          });
          await delay(450 * mult);
          break;
        }

        case 'MOVE': {
          const moves = Array.isArray(ev.moves) && ev.moves.length > 0
            ? ev.moves
            : (ev.toX !== undefined ? [{ id: ev.playerId, toX: ev.toX, toY: ev.toY }] : []);

          for (const m of moves) {
            if (!m || !m.id) continue;
            const vis = visualRobots.get(m.id);
            if (vis) {
              vis.x = m.toX;
              vis.y = m.toY;
            }
            const token = document.getElementById(`robot_token_${m.id}`);
            if (token) {
              token.style.left = `${m.toX * 10}%`;
              token.style.top = `${m.toY * 12.5}%`;
            }
          }
          playRobotMove();
          await delay(420 * mult);
          break;
        }

        case 'BUMP': {
          playBump();
          const vis = visualRobots.get(ev.playerId);
          const token = document.getElementById(`robot_token_${ev.playerId}`);
          if (token) {
            token.classList.add('is-bumping');
            setTimeout(() => token.classList.remove('is-bumping'), 300);
          }
          const bx = ev.x !== undefined ? ev.x : (vis ? vis.x : 5);
          const by = ev.y !== undefined ? ev.y : (vis ? vis.y : 4);
          const label = ev.blockedBy === 'turret' ? '🚨 TORRETA' : (ev.blockedBy === 'wall' ? '🧱 MURO' : '🛡️ BLOQUEADO');
          showFloatingFx(bx, by, label, 'shield');
          await delay(320 * mult);
          break;
        }

        case 'TURN': {
          const vis = visualRobots.get(ev.playerId);
          if (vis) {
            const delta = ev.deltaAngle !== undefined
              ? ev.deltaAngle
              : (ev.turnType === 'ccw' ? -90 : (ev.turnType === 'uturn' ? 180 : 90));
            vis.visualAngleDeg += delta;
            if (ev.newFacing !== undefined) vis.facing = ev.newFacing;

            const token = document.getElementById(`robot_token_${ev.playerId}`);
            if (token) {
              const chassis = token.querySelector('.robot-chassis');
              if (chassis) chassis.style.transform = `rotate(${vis.visualAngleDeg}deg)`;
            }
          }
          playRobotMove();
          await delay(360 * mult);
          break;
        }

        case 'PIT_FALL': {
          playExplosion();
          const vis = visualRobots.get(ev.playerId);
          const token = document.getElementById(`robot_token_${ev.playerId}`);
          if (token) {
            token.classList.add('is-falling');
          }
          const px = ev.x !== undefined ? ev.x : (vis ? vis.x : 5);
          const py = ev.y !== undefined ? ev.y : (vis ? vis.y : 4);
          showFloatingFx(px, py, '💥 ¡AL ABISMO!', 'damage');
          await delay(550 * mult);
          break;
        }

        case 'LASER': {
          const strokeColor = ev.color || (ev.sourceType === 'turret' ? '#ef4444' : '#38bdf8');
          drawLaserBeam(ev.fromX, ev.fromY, ev.toX, ev.toY, strokeColor);
          playLaser();

          const hitId = ev.hitRobotId || ev.hitPlayerId;
          if (hitId) {
            const hitToken = document.getElementById(`robot_token_${hitId}`);
            if (hitToken) {
              hitToken.classList.add('is-hit');
              setTimeout(() => hitToken.classList.remove('is-hit'), 350);
            }

            const hx = ev.hitX !== undefined ? ev.hitX : ev.toX;
            const hy = ev.hitY !== undefined ? ev.hitY : ev.toY;

            if (ev.shieldBlocked || ev.shieldAbsorbed) {
              playShield();
              showFloatingFx(hx, hy, '🛡️ ESCUDO', 'shield');
            } else {
              const dmg = ev.damage !== undefined ? ev.damage : 1;
              showFloatingFx(hx, hy, `-${dmg} HP`, 'damage');
            }
          }
          renderTvPilotsGrid();
          await delay(500 * mult);
          break;
        }

        case 'DESTROYED': {
          playExplosion();
          const vis = visualRobots.get(ev.playerId);
          const token = document.getElementById(`robot_token_${ev.playerId}`);
          if (token) {
            token.classList.add('is-dead');
          }
          const dx = ev.x !== undefined ? ev.x : (vis ? vis.x : 5);
          const dy = ev.y !== undefined ? ev.y : (vis ? vis.y : 4);
          showFloatingFx(dx, dy, '💥 DESTRUIDO', 'damage');
          renderTvPilotsGrid();
          await delay(500 * mult);
          break;
        }

        case 'SHIELD_REPAIR': {
          playShield();
          const p = gameState.players.find(pl => pl.id === ev.playerId);
          const sx = ev.x !== undefined ? ev.x : (p ? p.x : 5);
          const sy = ev.y !== undefined ? ev.y : (p ? p.y : 4);
          if (ev.healed) {
            showFloatingFx(sx, sy, '+1 HP', 'heal');
          } else {
            showFloatingFx(sx, sy, '🛡️ ESCUDO', 'shield');
          }
          const token = document.getElementById(`robot_token_${ev.playerId}`);
          const shield = token ? token.querySelector('.robot-shield-bubble') : null;
          if (shield) {
            shield.className = 'robot-shield-bubble is-active';
          }
          renderTvPilotsGrid();
          await delay(350 * mult);
          break;
        }

        case 'CHECKPOINT': {
          playCheckpoint();
          const cpNum = ev.cpId !== undefined ? ev.cpId : (ev.checkpointNumber || 1);
          showFloatingFx(ev.x, ev.y, `🚩 CHECKPOINT ${cpNum}`, 'checkpoint');
          renderTvPilotsGrid();
          await delay(650 * mult);
          break;
        }

        case 'REPAIR_TILE': {
          playShield();
          showFloatingFx(ev.x, ev.y, '🔧 +1 HP', 'heal');
          renderTvPilotsGrid();
          await delay(350 * mult);
          break;
        }

        case 'WINNER': {
          const w = ev.winner || ev.player || {};
          setSpotlight('🏆 ¡VICTORIA!', `<strong>${w.name || 'Un piloto'}</strong> ha capturado los 3 Checkpoints.`);
          break;
        }
      }
    } catch (eventErr) {
      console.error('Error no fatal durante playTimelineEvent:', ev ? ev.type : 'desconocido', eventErr);
      await delay(100);
    }
  }
  }

  function showPodiumScreen(winner) {
    playVictory();
    dom.tvViewArena?.classList.add('d-none');
    dom.tvViewPodium?.classList.remove('d-none');

    const winnerInitials = winner.name ? winner.name.substring(0, 3).toUpperCase() : 'BOT';

    if (dom.tvWinnerCard) {
      dom.tvWinnerCard.innerHTML = `
        <div class="d-flex align-items-center justify-content-center gap-3">
          <div class="podium-winner-avatar" style="background-color: ${winner.color}; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: 1.8rem; font-weight: 900; color: #fff; border: 3px solid #fff; box-shadow: 0 0 20px ${winner.color};">
            ${winnerInitials}
          </div>
          <div class="text-start">
            <h3 style="font-family: var(--font-display); font-size: 2.8rem; margin: 0; color: ${winner.color}; line-height: 1;">${winner.name}</h3>
            <span style="color: #fbbf24; font-family: var(--font-hud); letter-spacing: 1px; font-size: 0.95rem;">¡PRIMER PILOTO EN CAPTURAR EL CHECKPOINT 3!</span>
          </div>
        </div>
      `;
    }

    const sortedByLasers = [...gameState.players].sort((a, b) => b.stats.lasersHit - a.stats.lasersHit);
    const sortedByDeaths = [...gameState.players].sort((a, b) => b.stats.timesDestroyed - a.stats.timesDestroyed);

    const topSniper = sortedByLasers[0];
    const topScrap = sortedByDeaths[0];

    if (dom.tvPodiumStats) {
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
    }

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
    dom.tvViewPodium?.classList.add('d-none');
    dom.tvViewArena?.classList.remove('d-none');

    gameState.roundNumber = 1;
    gameState.winner = null;
    gameState.players.forEach((p, idx) => {
      const sp = gameState.arena.spawns[idx % gameState.arena.spawns.length];
      p.x = sp.x;
      p.y = sp.y;
      p.facing = sp.facing !== undefined ? sp.facing : 0;
      p.hp = 5;
      p.alive = true;
      p.shieldActive = false;
      p.lastCheckpoint = 0;
      p.programLocked = false;
      p.program = [null, null, null, null];
      p.stats = { lasersHit: 0, timesDestroyed: 0, checkpointsReached: 0, damageDealt: 0 };
    });

    renderTvBoardGrid();
    renderTurretSights();
    initOrUpdateVisualRobots(true);
    startNewRound();
  }

  // ==========================================================================
  // 11. MODO CELULAR (MANDO DEL JUGADOR)
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
        if (dom.phoneJoinAlert) {
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
      dom.phoneJoinAlert?.classList.add('d-none');
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
    myHandCards = payload.hand || [];
    myProgramSlots = payload.program || [null, null, null, null];
    myLockedSlots = payload.lockedSlots || [false, false, false, false];
    myProgramLocked = Boolean(payload.yaEnvioEnEstaFase || payload.programLocked);

    if (payload.isVip !== undefined) {
      isVipPlayer = !!payload.isVip;
      updateVipVisibility();
    }
    if (payload.config) {
      applyConfigToPhoneControls(payload.config);
    }

    updatePhoneHud(payload.hp, payload.facing, payload.lastCheckpoint);

    if (payload.phase === 'programming') {
      renderPhoneProgramSlots();
      renderPhoneHandList();
      updateLockProgramButton();
      showPhoneView('programming');
    } else if (payload.phase === 'executing') {
      renderPhoneExecStepsRow(payload.currentStep || 0);
      if (dom.phoneLiveHpText) dom.phoneLiveHpText.textContent = `${payload.hp || 5}/5`;
      if (dom.phoneLiveTargetText) dom.phoneLiveTargetText.textContent = `${(payload.lastCheckpoint || 0) + 1} 🚩`;
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

      if (dom.phoneLobbyPlayerName) dom.phoneLobbyPlayerName.textContent = myPlayerName;
      if (dom.phoneLobbyRoomCode) dom.phoneLobbyRoomCode.textContent = currentRoomCode;
      if (dom.phoneLobbyRobotBadge) dom.phoneLobbyRobotBadge.style.backgroundColor = myPlayerColor;

      if (data.config) {
        applyConfigToPhoneControls(data.config);
      }

      updateVipVisibility();
      showPhoneView('lobby');
    }

    if (data.type === 'LOBBY_UPDATE') {
      if (data.config) {
        applyConfigToPhoneControls(data.config);
      }
      if (Array.isArray(data.players)) {
        const me = data.players.find(p => p.id === myPlayerId);
        if (me) {
          isVipPlayer = !!me.isVip;
          updateVipVisibility();
        }
      }
    }

    if (data.type === 'CONFIG_UPDATED') {
      if (data.config) {
        applyConfigToPhoneControls(data.config);
      }
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
      if (dom.phoneTimerText) dom.phoneTimerText.textContent = `${data.seconds}s`;
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
      renderPhoneExecStepsRow(0);
      showPhoneView('executing');
    }

    if (data.type === 'STEP_START') {
      renderPhoneExecStepsRow(data.stepIndex - 1);
    }

    if (data.type === 'LIVE_STATUS_UPDATE') {
      if (dom.phoneLiveHpText) dom.phoneLiveHpText.textContent = `${data.hp}/5`;
      if (dom.phoneLiveTargetText) dom.phoneLiveTargetText.textContent = `${data.lastCheckpoint + 1} 🚩`;
    }

    if (data.type === 'GAME_OVER') {
      if (dom.phoneExecStatusText) {
        dom.phoneExecStatusText.textContent = `¡Fin de la Partida! Campeón: ${data.winner.name}`;
      }
    }
  }

  function updatePhoneHud(hp = 5, facing = 0, lastCp = 0) {
    if (dom.phoneHudAvatar) {
      dom.phoneHudAvatar.style.backgroundColor = myPlayerColor;
      dom.phoneHudAvatar.style.transform = `rotate(${facing * 90}deg)`;
    }
    if (dom.phoneHudName) dom.phoneHudName.textContent = myPlayerName;
    if (dom.phoneHudFacing) dom.phoneHudFacing.textContent = getHumanFacing(facing);
    if (dom.phoneHudHp) dom.phoneHudHp.textContent = renderHearts(hp);
    if (dom.phoneHudObjective) dom.phoneHudObjective.textContent = `Objetivo: Checkpoint ${lastCp + 1} 🚩`;
  }

  function renderPhoneProgramSlots() {
    [dom.slot_0, dom.slot_1, dom.slot_2, dom.slot_3].forEach((slotEl, idx) => {
      if (!slotEl) return;
      const card = myProgramSlots[idx];
      const isLocked = myLockedSlots[idx];
      const cat = card ? (card.category || 'move') : '';

      slotEl.className = `program-slot cat-${cat} ${card ? 'is-filled' : ''} ${isLocked ? 'is-locked' : ''}`;

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
    if (!dom.phoneHandList) return;
    dom.phoneHandList.innerHTML = '';

    myHandCards.forEach(card => {
      const isUsed = myProgramSlots.some(s => s && s.id === card.id);
      const cat = card.category || 'move';

      const item = document.createElement('div');
      item.className = `hand-card-item cat-${cat} ${isUsed ? 'is-used' : ''}`;
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

  function renderPhoneExecStepsRow(currentStep = 0) {
    if (!dom.phoneExecStepsRow) return;
    dom.phoneExecStepsRow.innerHTML = '';

    myProgramSlots.forEach((card, idx) => {
      const pill = document.createElement('div');
      const cat = card ? (card.category || 'move') : '';
      const isActive = idx === currentStep;
      pill.className = `exec-step-card-pill cat-${cat} ${isActive ? 'is-active' : ''}`;
      pill.innerHTML = `
        <span class="pill-step-idx">P${idx + 1}</span>
        <span class="pill-icon">${card ? card.icon : '❓'}</span>
        <span class="pill-name">${card ? card.name : 'Vacío'}</span>
      `;
      dom.phoneExecStepsRow.appendChild(pill);
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
    if (!dom.btnPhoneLockProgram) return;
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
  // 12. ARRANQUE
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', init);

})();
