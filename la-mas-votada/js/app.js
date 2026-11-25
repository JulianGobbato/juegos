/**
 * LA MÁS VOTADA - Lógica Principal del Juego
 * Inspirado en "100 Argentinos Dicen" / "Family Feud"
 * Conexión TV + 1 Celular Control Remoto vía WebRTC (PeerJS) y Modo 1 Dispositivo.
 */

(function(window, document) {
  'use strict';

  // =========================================================================
  // CONSTANTES Y CONFIGURACIÓN
  // =========================================================================
  const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const PEER_PREFIX = 'la-mas-votada-';
  const SOUND_STORAGE_KEY = 'la_mas_votada_sound_enabled';
  const ROOM_STORAGE_KEY = 'la_mas_votada_room';

  const CATEGORY_NAMES = {
    argentina: '🇦🇷 Bien Argento',
    cotidiano: '🏠 Casa, Comida y Vida Diaria',
    cultura_pop: '🎬 Cine, Música y Deportes',
    situaciones: '😅 Situaciones, Excusas y Vida Social'
  };

  // =========================================================================
  // SISTEMA DE AUDIO (Web Audio API nativo sintetizado)
  // =========================================================================
  let audioCtx = null;
  let soundEnabled = localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';

  function initAudioContext() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function setSoundEnabled(val) {
    soundEnabled = !!val;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, soundEnabled);
    } catch (_) {}
    updateSoundIcons();
  }

  function updateSoundIcons() {
    document.querySelectorAll('.btn-sound-toggle span').forEach(el => {
      el.textContent = soundEnabled ? '🔊' : '🔇';
    });
  }

  // 1. Campana de acierto (playDing): Doble tono brillante ascendente
  function playDing() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      // Primer tono (E5: 659.25 Hz)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.24, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Segundo tono brillante (B5: 987.77 Hz)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.12);
      gain2.gain.setValueAtTime(0.28, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);
    } catch (_) {}
  }

  // 2. Bocina de error (playBuzz): Tono grave áspero de 0.6s
  function playBuzz() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.linearRampToValueAtTime(115, now + 0.6);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.setValueAtTime(0.28, now + 0.48);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch (_) {}
  }

  // 3. Transferencia de puntos / Victoria (playFanfare): Acorde triunfal
  function playFanfare() {
    if (!soundEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const chords = [
        { f: 523.25, t: 0.0, d: 0.16 }, // C5
        { f: 659.25, t: 0.14, d: 0.16 }, // E5
        { f: 783.99, t: 0.28, d: 0.2 }, // G5
        { f: 1046.50, t: 0.45, d: 0.7 } // C6
      ];

      chords.forEach(c => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(c.f, now + c.t);
        gain.gain.setValueAtTime(0.25, now + c.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + c.d);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + c.t);
        osc.stop(now + c.t + c.d + 0.05);
      });
    } catch (_) {}
  }

  // =========================================================================
  // SISTEMA DE CONFETI PARA VICTORIA
  // =========================================================================
  let confettiParticles = [];
  let confettiAnimId = null;

  function launchConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    confettiParticles = [];
    const colors = ['#2563eb', '#dc2626', '#f59e0b', '#fbbf24', '#38bdf8', '#10b981'];

    for (let i = 0; i < 120; i++) {
      confettiParticles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 350,
        y: canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 20,
        vy: -Math.random() * 18 - 8,
        size: Math.random() * 10 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 14,
        gravity: 0.38,
        alpha: 1
      });
    }

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

    function update() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      confettiParticles.forEach(p => {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.007;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (alive) {
        confettiAnimId = requestAnimationFrame(update);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    update();
  }

  // =========================================================================
  // MODELO DE ESTADO DEL JUEGO
  // =========================================================================
  let consignasPool = [];

  let state = {
    role: 'menu', // 'menu' | 'tv' | 'remote' | 'single'
    status: 'setup', // 'setup' | 'playing' | 'gameover'
    config: {
      categories: ['argentina', 'cotidiano', 'cultura_pop', 'situaciones'],
      targetScore: 500,
      doubleFinalRound: true
    },
    scoreAzul: 0,
    scoreRojo: 0,
    roundIndex: 0,
    deck: [],
    currentQuestion: null,
    revealedSlots: [false, false, false, false, false, false],
    roundPot: 0,
    strikes: 0,
    isDoubleRound: false,
    winner: null,
    potAwarded: false,
    potWinnerTeam: null
  };

  let roomCode = '';
  let peer = null;
  let activeConn = null;
  let singleControlsVisible = false;
  let peerResilienceHost = null;
  let peerResilienceClient = null;
  let reconnectRetryTimer = null;
  let tvHostInitRetries = 0;

  function clearReconnectRetryTimer() {
    if (reconnectRetryTimer) {
      clearTimeout(reconnectRetryTimer);
      reconnectRetryTimer = null;
    }
  }

  function cleanupPeer() {
    clearReconnectRetryTimer();
    if (activeConn) {
      try { activeConn.close(); } catch (_) {}
      activeConn = null;
    }
    if (peer) {
      try {
        if (!peer.destroyed) peer.destroy();
      } catch (_) {}
      peer = null;
    }
  }

  // =========================================================================
  // CARGA DE DATOS (Offline Bundle o Fetch)
  // =========================================================================
  function loadConsignasBank() {
    if (window.CONSIGNAS_BUNDLE && Array.isArray(window.CONSIGNAS_BUNDLE) && window.CONSIGNAS_BUNDLE.length > 0) {
      consignasPool = window.CONSIGNAS_BUNDLE;
      return;
    }

    fetch('data/consignas.json')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) consignasPool = data;
      })
      .catch(() => {});
  }

  // =========================================================================
  // INICIALIZACIÓN DE LA APLICACIÓN
  // =========================================================================
  function initApp() {
    loadConsignasBank();
    setupHeaderButtons();
    setupMenuRoleButtons();
    checkAutoConnectParams();
  }

  function checkAutoConnectParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const salaParam = urlParams.get('sala') || urlParams.get('code');
    const storedRoom = sessionStorage.getItem(ROOM_STORAGE_KEY);

    if (salaParam) {
      startRemoteRole(salaParam.toUpperCase().trim());
    } else if (storedRoom && window.location.hash === '#remote') {
      startRemoteRole(storedRoom);
    } else {
      showView('viewMenu');
    }
  }

  function setupHeaderButtons() {
    updateSoundIcons();
    document.querySelectorAll('.btn-sound-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        initAudioContext();
        setSoundEnabled(!soundEnabled);
      });
    });

    const btnFs = document.getElementById('btnToggleFullscreen');
    if (btnFs) {
      btnFs.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      const fsIcon = document.getElementById('fsIcon');
      if (fsIcon) fsIcon.textContent = isFs ? '🪟' : '📺';
    });
  }

  function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
  }

  // =========================================================================
  // SELECCIÓN DE ROL DESDE EL MENÚ
  // =========================================================================
  function setupMenuRoleButtons() {
    const btnTv = document.getElementById('btnSelectRoleTv');
    if (btnTv) {
      btnTv.addEventListener('click', () => {
        initAudioContext();
        startTvRole();
      });
    }

    const btnRemote = document.getElementById('btnSelectRoleRemote');
    if (btnRemote) {
      btnRemote.addEventListener('click', () => {
        renderRemoteJoinScreen('');
      });
    }

    const btnSingle = document.getElementById('btnSelectRoleSingle');
    if (btnSingle) {
      btnSingle.addEventListener('click', () => {
        initAudioContext();
        startSingleDeviceRole();
      });
    }
  }

  // =========================================================================
  // ROL 1: PANTALLA TV (HOST VISUAL)
  // =========================================================================
  function generateRoomCode() {
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    }
    return res;
  }

  function startTvRole() {
    cleanupPeer();
    state.role = 'tv';
    const panelWrap = document.getElementById('singleDevicePanelWrap');
    if (panelWrap) panelWrap.classList.add('d-none');

    showView('viewTv');

    // Inicializar Host de Resiliencia para TV
    if (!peerResilienceHost && typeof PeerResilience !== 'undefined') {
      peerResilienceHost = PeerResilience.createHost({
        onPlayerSleepChange: (playerId, isAsleep) => {
          const ticker = document.getElementById('tvStatusTicker');
          if (ticker) {
            if (isAsleep) {
              ticker.innerHTML = '<span class="text-warning">💤 Celular Conductor en reposo (pantalla bloqueada)...</span>';
            } else {
              ticker.innerHTML = '<span class="text-success">🟢 Celular Conductor activo.</span>';
            }
          }
        },
        getPhaseKey: () => `phase_${state.status}_round_${state.roundIndex}`
      });
      peerResilienceHost.startSleepMonitor();
    }

    roomCode = generateRoomCode();
    const peerId = PEER_PREFIX + roomCode;

    showTvConnectModal(roomCode);

    try {
      peer = new Peer(peerId);

      peer.on('open', () => {
        tvHostInitRetries = 0;
      });

      peer.on('connection', (conn) => {
        conn._playerId = 'remote';
        if (peerResilienceHost) {
          peerResilienceHost.registerPlayerConnection('remote', conn);
        }
        activeConn = conn;
        hideTvConnectModal();

        conn.on('open', () => {
          broadcastStateToRemote();
        });

        conn.on('data', (data) => {
          try {
            const senderId = (data && data.playerId) || conn._playerId || 'remote';
            if (peerResilienceHost && peerResilienceHost.handleIncomingHostData(senderId, conn, data)) return;
            if (peerResilienceHost && !peerResilienceHost.isConnectionActive(senderId, conn)) return;
            handleRemoteMessage(data);
          } catch (err) {
            console.error('Error procesando mensaje remoto:', err);
          }
        });

        conn.on('close', () => {
          if (peerResilienceHost && !peerResilienceHost.isConnectionActive('remote', conn)) return;
          if (activeConn === conn) activeConn = null;
          const ticker = document.getElementById('tvStatusTicker');
          if (ticker) ticker.textContent = '⚠️ Celular desconectado temporalmente. Esperando reconexión...';
        });
      });

      peer.on('error', (err) => {
        if (err && err.type === 'unavailable-id' && tvHostInitRetries < 5) {
          tvHostInitRetries++;
          startTvRole();
        }
      });
    } catch (e) {
      console.error(e);
    }

    renderTvBoard();
  }

  function showTvConnectModal(code) {
    const modal = document.getElementById('tvConnectModal');
    if (!modal) return;
    modal.classList.remove('d-none');

    const codeBadge = document.getElementById('tvRoomCodeText');
    if (codeBadge) codeBadge.textContent = code;

    const url = `${window.location.origin}${window.location.pathname}?sala=${code}`;
    const qrContainer = document.getElementById('tvQrContainer');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrContainer, {
          text: url,
          width: 200,
          height: 200,
          colorDark: '#070a14',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } else {
        const img = document.createElement('img');
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
        img.alt = 'Código QR de conexión';
        qrContainer.appendChild(img);
      }
    }
  }

  function hideTvConnectModal() {
    const modal = document.getElementById('tvConnectModal');
    if (modal) modal.classList.add('d-none');
    const ticker = document.getElementById('tvStatusTicker');
    if (ticker) ticker.textContent = '🟢 Celular Conductor conectado. ¡Configuren la partida desde el teléfono!';
  }

  function broadcastStateToRemote() {
    if (activeConn && activeConn.open) {
      const payload = {
        ...state,
        phaseKey: `phase_${state.status}_round_${state.roundIndex}`
      };
      activeConn.send({ type: 'FULL_STATE_SYNC', payload });
    }
  }

  // =========================================================================
  // ROL 2: CELULAR CONTROL REMOTO (CONDUCTOR)
  // =========================================================================
  function renderRemoteJoinScreen(errorMessage = '') {
    state.role = 'remote';
    showView('viewRemote');
    const dot = document.getElementById('remoteConnDot');
    const label = document.getElementById('remoteConnLabel');
    const codeLabel = document.getElementById('remoteRoomCodeDisplay');
    if (dot) dot.className = 'connection-dot offline';
    if (label) label.textContent = errorMessage ? 'Sala no encontrada' : 'Ingresá código de TV';
    if (codeLabel) codeLabel.textContent = '----';

    const container = document.getElementById('remoteDynamicContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="setup-box my-0">
        <h2 class="setup-title">📱 CONECTAR A LA TV</h2>
        ${errorMessage ? `<div class="alert alert-danger py-2 px-3 small mb-3">${escapeHtml(errorMessage)}</div>` : ''}
        <p class="setup-subtitle mb-3">
          Ingresá el código de 4 letras que aparece en la pantalla de la TV.
        </p>
        <form id="remoteManualJoinForm" class="room-join-row mb-3">
          <input type="text" id="remoteRoomCodeInput" class="form-control form-control-lg bg-dark text-white border-secondary room-join-input" maxlength="4" placeholder="ABCD" autocomplete="off" required>
          <button type="submit" class="btn btn-warning fw-bold px-3 room-join-btn">Unirse</button>
        </form>
        <button type="button" class="btn btn-outline-light w-100" id="btnRemoteBackMenu">⬅️ Volver al Menú</button>
      </div>
    `;

    const form = document.getElementById('remoteManualJoinForm');
    const input = document.getElementById('remoteRoomCodeInput');
    if (input) input.focus();
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = (input ? input.value : '').toUpperCase().trim();
        if (code.length >= 4) {
          startRemoteRole(code);
        }
      });
    }
    const backBtn = document.getElementById('btnRemoteBackMenu');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (peerResilienceClient) peerResilienceClient.stop();
        cleanupPeer();
        sessionStorage.removeItem(ROOM_STORAGE_KEY);
        if (window.location.hash === '#remote') {
          history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        showView('viewMenu');
      });
    }
  }

  function applySyncedState(payload) {
    if (!payload) return;
    state = { ...payload, role: 'remote' };
    renderRemoteUI();
  }

  function startRemoteRole(code) {
    clearReconnectRetryTimer();
    state.role = 'remote';
    roomCode = code;
    sessionStorage.setItem(ROOM_STORAGE_KEY, code);
    window.location.hash = '#remote';

    showView('viewRemote');
    renderRemoteHeader();

    // Inicializar Cliente de Resiliencia
    if (!peerResilienceClient && typeof PeerResilience !== 'undefined') {
      peerResilienceClient = PeerResilience.createClient({
        getConn: () => activeConn,
        getPeer: () => peer,
        getRoomCode: () => roomCode,
        onReconnect: () => {
          initRemotePeerConnection(true);
        },
        onStateSync: (payload) => {
          applySyncedState(payload);
        }
      });
    }
    if (peerResilienceClient) {
      peerResilienceClient.start();
    }
    if (typeof PeerResilience !== 'undefined') {
      PeerResilience.enableWakeLock();
    }

    initRemotePeerConnection(false);
  }

  function renderRemoteHeader() {
    const label = document.getElementById('remoteRoomCodeDisplay');
    if (label) label.textContent = roomCode;
  }

  function initRemotePeerConnection(isReconnecting = false) {
    clearReconnectRetryTimer();
    const peerIdTv = PEER_PREFIX + roomCode;
    const dot = document.getElementById('remoteConnDot');
    const label = document.getElementById('remoteConnLabel');

    if (dot) dot.className = 'connection-dot offline';
    if (label) label.textContent = 'Conectando a TV (' + roomCode + ')...';

    if (activeConn) {
      try { activeConn.close(); } catch (e) {}
      activeConn = null;
    }

    if (isReconnecting || !peer || peer.destroyed) {
      cleanupPeer();
    }

    try {
      if (!peer || peer.destroyed) {
        peer = new Peer();

        peer.on('open', () => {
          connectToTvHost(peerIdTv);
        });

        peer.on('error', (err) => {
          if (err && err.type === 'peer-unavailable') {
            if (peerResilienceClient) peerResilienceClient.stop();
            sessionStorage.removeItem(ROOM_STORAGE_KEY);
            cleanupPeer();
            if (window.location.search.includes('sala=') || window.location.search.includes('code=')) {
              history.replaceState(null, '', window.location.pathname);
            }
            renderRemoteJoinScreen(`La sala "${roomCode}" no existe o se cerró en la TV.`);
            return;
          }
          if (label) label.textContent = 'Error de conexión. Reintentando...';
          clearReconnectRetryTimer();
          reconnectRetryTimer = setTimeout(() => connectToTvHost(peerIdTv), 2500);
        });
      } else {
        connectToTvHost(peerIdTv);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function connectToTvHost(targetId) {
    if (!peer || peer.destroyed) return;
    clearReconnectRetryTimer();
    const dot = document.getElementById('remoteConnDot');
    const label = document.getElementById('remoteConnLabel');

    if (activeConn) {
      try { activeConn.close(); } catch (e) {}
      activeConn = null;
    }

    const conn = peer.connect(targetId, { reliable: true });
    activeConn = conn;

    conn.on('open', () => {
      if (activeConn !== conn) return;
      if (peerResilienceClient) peerResilienceClient.onConnected();
      if (dot) dot.className = 'connection-dot';
      if (label) label.textContent = '🟢 Conectado (' + roomCode + ')';
    });

    conn.on('data', (data) => {
      if (activeConn !== conn) return;
      try {
        if (peerResilienceClient && peerResilienceClient.handleIncomingData(data)) return;
        if (data && (data.type === 'SYNC_STATE' || data.type === 'FULL_STATE_SYNC')) {
          applySyncedState(data.payload || data);
        }
      } catch (err) {
        console.error('Error aplicando estado en celular:', err);
      }
    });

    conn.on('close', () => {
      if (activeConn !== conn) return;
      if (dot) dot.className = 'connection-dot offline';
      if (label) label.textContent = '⚠️ Reconectando con la TV...';
      if (peerResilienceClient) {
        peerResilienceClient.checkConnectionInstantly();
      } else {
        clearReconnectRetryTimer();
        reconnectRetryTimer = setTimeout(() => connectToTvHost(targetId), 2000);
      }
    });
  }

  function sendRemoteAction(type, payload = {}) {
    if (state.role === 'single' || state.role === 'tv') {
      handleRemoteMessage({ type, ...payload });
      return;
    }
    if (activeConn && activeConn.open) {
      activeConn.send({ type, playerId: 'remote', ...payload });
    }
  }

  // =========================================================================
  // GESTOR DE MENSAJES (Ejecutados en el Host TV o Modo Single)
  // =========================================================================
  function handleRemoteMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'START_GAME':
        state.config = { ...state.config, ...msg.config };
        startNewGameMatch();
        break;

      case 'REVEAL_ANSWER':
        revealAnswerSlot(msg.slotIndex, msg.addToPot !== false);
        break;

      case 'ADD_STRIKE':
        addStrikeToRound();
        break;

      case 'REVEAL_REMAINING':
        revealAllRemainingAnswersWithoutPoints();
        break;

      case 'AWARD_POT':
        awardPotToTeam(msg.team);
        break;

      case 'NEXT_QUESTION':
        advanceToNextQuestion();
        break;

      case 'REMATCH':
        startNewGameMatch();
        break;
    }
  }

  // =========================================================================
  // ROL 3: UN SOLO DISPOSITIVO
  // =========================================================================
  function startSingleDeviceRole() {
    state.role = 'single';
    showView('viewTv');

    const panelWrap = document.getElementById('singleDevicePanelWrap');
    if (panelWrap) panelWrap.classList.remove('d-none');

    const toggleBtn = document.getElementById('btnToggleSinglePanel');
    const controlsBox = document.getElementById('singleControlsContent');
    if (toggleBtn && controlsBox) {
      toggleBtn.onclick = () => {
        singleControlsVisible = !singleControlsVisible;
        if (singleControlsVisible) {
          controlsBox.classList.remove('d-none');
        } else {
          controlsBox.classList.add('d-none');
        }
      };
    }

    renderSingleDeviceControls();
    renderTvBoard();
  }

  function renderSingleDeviceControls() {
    const container = document.getElementById('singleControlsContent');
    if (!container) return;
    renderRemoteUIIntoContainer(container);
  }

  // =========================================================================
  // LÓGICA DE PARTIDA Y RONDAS
  // =========================================================================
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function startNewGameMatch() {
    const categories = state.config.categories;
    const pool = (consignasPool.length > 0 ? consignasPool : window.CONSIGNAS_BUNDLE || [])
      .filter(q => categories.includes(q.categoria));

    if (pool.length === 0) {
      alert('No hay preguntas disponibles para las categorías seleccionadas.');
      return;
    }

    state.deck = shuffleArray(pool);
    state.roundIndex = 0;
    state.scoreAzul = 0;
    state.scoreRojo = 0;
    state.winner = null;
    state.status = 'playing';

    prepareRound(0);
  }

  function checkIfDoubleRound() {
    if (!state.config.doubleFinalRound) return false;
    const target = state.config.targetScore;
    return (state.scoreAzul >= target - 100) || (state.scoreRojo >= target - 100);
  }

  function prepareRound(index) {
    if (index >= state.deck.length) {
      state.deck = shuffleArray(state.deck);
      state.roundIndex = 0;
      index = 0;
    }

    state.roundIndex = index;
    state.currentQuestion = state.deck[index];
    state.revealedSlots = [false, false, false, false, false, false];
    state.roundPot = 0;
    state.strikes = 0;
    state.potAwarded = false;
    state.potWinnerTeam = null;
    state.isDoubleRound = checkIfDoubleRound();

    // Limpiar DOM de las respuestas en la TV (REGLA DE SEGURIDAD / ANTI-CHEAT)
    clearTvAnswersDom();

    renderTvBoard();
    broadcastStateToRemote();
    if (state.role === 'single') renderSingleDeviceControls();
  }

  function clearTvAnswersDom() {
    for (let i = 1; i <= 6; i++) {
      const slot = document.getElementById('tvCardSlot' + i);
      const back = document.getElementById('tvCardBack' + i);
      if (slot) slot.classList.remove('revealed');
      if (back) back.innerHTML = '';
    }
  }

  function revealAnswerSlot(slotIndex, addToPot = true) {
    if (slotIndex < 0 || slotIndex >= 6) return;
    if (state.revealedSlots[slotIndex]) return; // ya revelado

    state.revealedSlots[slotIndex] = true;
    const ans = state.currentQuestion.respuestas[slotIndex];

    if (addToPot) {
      const multiplier = state.isDoubleRound ? 2 : 1;
      state.roundPot += (ans.puntos * multiplier);
    }

    playDing();

    // Actualizar visual en la TV
    updateTvSlotVisual(slotIndex, ans);
    updateTvPotVisual();

    broadcastStateToRemote();
    if (state.role === 'single') renderSingleDeviceControls();
  }

  function updateTvSlotVisual(slotIndex, ans) {
    const slotEl = document.getElementById('tvCardSlot' + (slotIndex + 1));
    const backEl = document.getElementById('tvCardBack' + (slotIndex + 1));

    if (slotEl && backEl) {
      // Inyección dinámica SOLO al revelar
      backEl.innerHTML = `
        <div class="card-answer-text">${escapeHtml(ans.texto)}</div>
        <div class="card-points-badge">${ans.puntos}</div>
      `;
      slotEl.classList.add('revealed');
    }
  }

  function addStrikeToRound() {
    if (state.strikes >= 3) return;
    state.strikes++;

    playBuzz();
    showGiantStrikeOverlay(state.strikes);
    updateTvStrikesVisual();

    broadcastStateToRemote();
    if (state.role === 'single') renderSingleDeviceControls();
  }

  function showGiantStrikeOverlay(count) {
    const overlay = document.getElementById('tvGiantStrikeOverlay');
    const content = document.getElementById('tvGiantStrikeContent');
    if (!overlay || !content) return;

    let text = '❌';
    if (count === 2) text = '❌ ❌';
    if (count === 3) text = '❌ ❌ ❌';
    content.textContent = text;

    overlay.classList.remove('d-none');
    setTimeout(() => {
      overlay.classList.add('d-none');
    }, 1500);
  }

  function revealAllRemainingAnswersWithoutPoints() {
    state.currentQuestion.respuestas.forEach((ans, idx) => {
      if (!state.revealedSlots[idx]) {
        state.revealedSlots[idx] = true;
        updateTvSlotVisual(idx, ans);
      }
    });

    broadcastStateToRemote();
    if (state.role === 'single') renderSingleDeviceControls();
  }

  function awardPotToTeam(team) {
    if (state.potAwarded) return;
    state.potAwarded = true;
    state.potWinnerTeam = team;

    if (team === 'azul') {
      state.scoreAzul += state.roundPot;
    } else {
      state.scoreRojo += state.roundPot;
    }

    playFanfare();

    // Verificar si algún equipo alcanzó el objetivo
    const target = state.config.targetScore;
    if (state.scoreAzul >= target || state.scoreRojo >= target) {
      state.status = 'gameover';
      state.winner = state.scoreAzul >= state.scoreRojo ? 'azul' : 'rojo';
      launchConfetti();
      showVictoryOverlay();
    }

    renderTvBoard();
    broadcastStateToRemote();
    if (state.role === 'single') renderSingleDeviceControls();
  }

  function advanceToNextQuestion() {
    prepareRound(state.roundIndex + 1);
  }

  // =========================================================================
  // RENDERIZADO VISUAL EN LA TV
  // =========================================================================
  function renderTvBoard() {
    // Marcador
    const scoreAzul = document.getElementById('tvScoreAzul');
    const scoreRojo = document.getElementById('tvScoreRojo');
    const pot = document.getElementById('tvRoundPot');
    const goal = document.getElementById('tvTargetGoalDisplay');
    const doubleBadge = document.getElementById('tvDoublePointsBadge');

    if (scoreAzul) scoreAzul.textContent = state.scoreAzul;
    if (scoreRojo) scoreRojo.textContent = state.scoreRojo;
    if (pot) pot.textContent = state.roundPot;
    if (goal) goal.textContent = `Objetivo: ${state.config.targetScore} pts`;

    if (doubleBadge) {
      if (state.isDoubleRound) {
        doubleBadge.classList.remove('d-none');
      } else {
        doubleBadge.classList.add('d-none');
      }
    }

    // Pregunta y Categoría
    const catEl = document.getElementById('tvQuestionCategory');
    const qEl = document.getElementById('tvQuestionText');
    if (state.currentQuestion) {
      if (catEl) catEl.textContent = CATEGORY_NAMES[state.currentQuestion.categoria] || state.currentQuestion.categoria.toUpperCase();
      if (qEl) qEl.textContent = state.currentQuestion.pregunta;
    }

    // Cruces inferiores
    updateTvStrikesVisual();

    // Actualizar slots revelados
    if (state.currentQuestion) {
      state.revealedSlots.forEach((rev, idx) => {
        if (rev) {
          updateTvSlotVisual(idx, state.currentQuestion.respuestas[idx]);
        }
      });
    }

    // Overlay de victoria
    if (state.status === 'gameover') {
      showVictoryOverlay();
    } else {
      const vicOverlay = document.getElementById('tvVictoryOverlay');
      if (vicOverlay) vicOverlay.classList.add('d-none');
    }
  }

  function updateTvPotVisual() {
    const pot = document.getElementById('tvRoundPot');
    if (pot) pot.textContent = state.roundPot;
  }

  function updateTvStrikesVisual() {
    for (let i = 1; i <= 3; i++) {
      const strikeEl = document.getElementById('tvStrike' + i);
      if (strikeEl) {
        if (i <= state.strikes) {
          strikeEl.classList.add('active');
        } else {
          strikeEl.classList.remove('active');
        }
      }
    }
  }

  function showVictoryOverlay() {
    const overlay = document.getElementById('tvVictoryOverlay');
    const title = document.getElementById('tvVictoryTitle');
    const sub = document.getElementById('tvVictorySub');
    const summary = document.getElementById('tvVictoryScoreSummary');
    const btnRematch = document.getElementById('btnVictoryRematch');

    if (!overlay) return;
    overlay.classList.remove('d-none');

    const winnerIsBlue = state.winner === 'azul';
    if (title) {
      title.textContent = winnerIsBlue ? '🔵 ¡GANÓ EL EQUIPO AZUL!' : '🔴 ¡GANÓ EL EQUIPO ROJO!';
      title.style.color = winnerIsBlue ? '#60a5fa' : '#f87171';
    }
    if (sub) {
      sub.textContent = `Superaron el objetivo de ${state.config.targetScore} puntos`;
    }
    if (summary) {
      summary.innerHTML = `🔵 Azul: <strong>${state.scoreAzul} pts</strong> &nbsp;|&nbsp; 🔴 Rojo: <strong>${state.scoreRojo} pts</strong>`;
    }

    if (btnRematch) {
      btnRematch.onclick = () => {
        sendRemoteAction('REMATCH');
      };
    }
  }

  // =========================================================================
  // RENDERIZADO VISUAL DEL CELULAR (CONDUCTOR)
  // =========================================================================
  function renderRemoteUI() {
    const container = document.getElementById('remoteDynamicContainer');
    if (!container) return;
    renderRemoteUIIntoContainer(container);
  }

  function renderRemoteUIIntoContainer(container) {
    if (state.status === 'setup') {
      renderRemoteSetup(container);
    } else if (state.status === 'playing') {
      renderRemoteLiveRound(container);
    } else if (state.status === 'gameover') {
      renderRemoteGameOver(container);
    }
  }

  // PANTALLA DE CONFIGURACIÓN DEL CONDUCTOR
  function renderRemoteSetup(container) {
    container.innerHTML = `
      <div class="setup-box">
        <h2 class="setup-title">⚙️ CONFIGURAR PARTIDA</h2>
        <p class="setup-subtitle">Elegí las categorías y el puntaje para iniciar el juego en la TV.</p>

        <div class="d-flex justify-content-between align-items-center mb-2">
          <label style="font-weight: 700; font-size: 0.95rem; color: #fff;">Categorías de Consignas:</label>
          <button type="button" id="btnSelectAllCats" class="btn btn-sm btn-outline-warning" style="font-size: 0.78rem; font-weight: 700;">
            Seleccionar Todas
          </button>
        </div>

        <div class="category-checkboxes-grid">
          <label class="category-check-item">
            <input type="checkbox" name="catOption" value="argentina" ${state.config.categories.includes('argentina') ? 'checked' : ''}>
            <span>🇦🇷 <strong>Bien Argento</strong></span>
          </label>
          <label class="category-check-item">
            <input type="checkbox" name="catOption" value="cotidiano" ${state.config.categories.includes('cotidiano') ? 'checked' : ''}>
            <span>🏠 <strong>Casa, Comida y Vida Diaria</strong></span>
          </label>
          <label class="category-check-item">
            <input type="checkbox" name="catOption" value="cultura_pop" ${state.config.categories.includes('cultura_pop') ? 'checked' : ''}>
            <span>🎬 <strong>Cine, Música y Deportes</strong></span>
          </label>
          <label class="category-check-item">
            <input type="checkbox" name="catOption" value="situaciones" ${state.config.categories.includes('situaciones') ? 'checked' : ''}>
            <span>😅 <strong>Situaciones, Excusas y Vida Social</strong></span>
          </label>
        </div>

        <label style="font-weight: 700; font-size: 0.95rem; color: #fff; margin-bottom: 8px; display: block;">
          Puntaje Objetivo para Ganar:
        </label>
        <div class="goal-selector-row">
          <div class="goal-option-btn ${state.config.targetScore === 300 ? 'active' : ''}" data-target="300">
            300 pts
          </div>
          <div class="goal-option-btn ${state.config.targetScore === 500 ? 'active' : ''}" data-target="500">
            500 pts
          </div>
          <div class="goal-option-btn ${state.config.targetScore === 750 ? 'active' : ''}" data-target="750">
            750 pts
          </div>
        </div>

        <label class="category-check-item mb-4">
          <input type="checkbox" id="chkDoubleRound" ${state.config.doubleFinalRound ? 'checked' : ''}>
          <span style="font-size: 0.9rem;">⚡ <strong>Ronda Final Doble:</strong> Los puntos valen x2 cuando un equipo está a menos de 100 pts de ganar.</span>
        </label>

        <button type="button" id="btnStartGameAction" class="btn-start-game">
          🚀 ¡COMENZAR PARTIDA!
        </button>
      </div>
    `;

    // Eventos de configuración
    const btnSelectAll = container.querySelector('#btnSelectAllCats');
    if (btnSelectAll) {
      btnSelectAll.onclick = () => {
        container.querySelectorAll('input[name="catOption"]').forEach(chk => {
          chk.checked = true;
        });
      };
    }

    container.querySelectorAll('.goal-option-btn').forEach(btn => {
      btn.onclick = () => {
        container.querySelectorAll('.goal-option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.config.targetScore = parseInt(btn.dataset.target, 10);
      };
    });

    const btnStart = container.querySelector('#btnStartGameAction');
    if (btnStart) {
      btnStart.onclick = () => {
        const checkedCats = Array.from(container.querySelectorAll('input[name="catOption"]:checked'))
          .map(el => el.value);

        if (checkedCats.length === 0) {
          alert('Por favor seleccioná al menos una categoría de consignas.');
          return;
        }

        const doubleChecked = container.querySelector('#chkDoubleRound').checked;
        const target = state.config.targetScore || 500;

        sendRemoteAction('START_GAME', {
          config: {
            categories: checkedCats,
            targetScore: target,
            doubleFinalRound: doubleChecked
          }
        });
      };
    }
  }

  // PANTALLA EN VIVO DEL CONDUCTOR (MANEJO DE RONDA)
  function renderRemoteLiveRound(container) {
    if (!state.currentQuestion) return;

    const q = state.currentQuestion;
    const catName = CATEGORY_NAMES[q.categoria] || q.categoria.toUpperCase();
    const mult = state.isDoubleRound ? 2 : 1;

    let answersHtml = '';
    q.respuestas.forEach((ans, idx) => {
      const isRev = state.revealedSlots[idx];
      const ptsShow = ans.puntos * mult;
      answersHtml += `
        <button type="button" class="btn-reveal-answer ${isRev ? 'revealed' : ''}" data-idx="${idx}" ${isRev ? 'disabled' : ''}>
          <span>${isRev ? '✔️' : '✅'} #${idx + 1}: ${escapeHtml(ans.texto)}</span>
          <span class="answer-pts-pill">${ptsShow} pts</span>
        </button>
      `;
    });

    const potVal = state.roundPot;
    const isThreeStrikes = state.strikes >= 3;

    container.innerHTML = `
      <!-- PREGUNTA ACTUAL -->
      <div class="remote-round-card">
        <div class="remote-question-pill">${catName}</div>
        <h3 class="remote-question-title">${escapeHtml(q.pregunta)}</h3>
        ${state.isDoubleRound ? '<div class="double-warning-banner">⚡ ¡RONDA CON PUNTAJE DOBLE (x2)!</div>' : ''}
      </div>

      <!-- BOTONES DE LAS 6 RESPUESTAS -->
      <div class="remote-answers-stack">
        ${answersHtml}
      </div>

      <!-- BOTÓN ROJO DE CRUZ -->
      <button type="button" class="btn-add-strike" id="btnAddStrikeAction" ${state.strikes >= 3 ? 'disabled style="opacity: 0.6;"' : ''}>
        ❌ RESPUESTA INCORRECTA (${state.strikes}/3 CRUCES)
      </button>

      <!-- FASE DE ROBO AL LLEGAR A 3 CRUCES -->
      ${isThreeStrikes ? `
        <div class="steal-phase-box">
          <div class="steal-phase-title">⚡ ¡3 CRUCES! OPORTUNIDAD DE ROBO</div>
          <div class="steal-phase-desc">
            El equipo rival tiene 1 intento para decir una respuesta oculta. Si acierta, ¡se roba todo el pozo!
          </div>
          <button type="button" class="btn-reveal-remaining" id="btnRevealRemainingAction">
            👁️ Destapar restantes (sin sumar puntos)
          </button>
        </div>
      ` : ''}

      <!-- TRANSFERENCIA DE POZO Y SIGUIENTE PREGUNTA -->
      <div class="pot-transfer-section">
        <div class="pot-transfer-title">
          POZO ACTUAL: <strong style="color: var(--color-gold-light); font-size: 1.1rem;">${potVal} PTS</strong>
        </div>

        ${!state.potAwarded ? `
          <div class="pot-team-buttons-grid">
            <button type="button" class="btn-give-pot-blue" id="btnGivePotBlue">
              🔵 Dar Pozo a Azul (+${potVal})
            </button>
            <button type="button" class="btn-give-pot-red" id="btnGivePotRed">
              🔴 Dar Pozo a Rojo (+${potVal})
            </button>
          </div>
        ` : `
          <div class="alert alert-success text-center mb-2" style="font-weight: 700; font-size: 0.95rem;">
            ✅ Pozo de ${potVal} pts entregado al Equipo ${state.potWinnerTeam === 'azul' ? 'Azul 🔵' : 'Rojo 🔴'}
          </div>
          <button type="button" class="btn-next-question" id="btnNextQuestionAction">
            ➡️ SIGUIENTE PREGUNTA
          </button>
        `}
      </div>
    `;

    // Eventos de botones
    container.querySelectorAll('.btn-reveal-answer:not(.revealed)').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        sendRemoteAction('REVEAL_ANSWER', { slotIndex: idx, addToPot: true });
      };
    });

    const btnStrike = container.querySelector('#btnAddStrikeAction');
    if (btnStrike && state.strikes < 3) {
      btnStrike.onclick = () => {
        sendRemoteAction('ADD_STRIKE');
      };
    }

    const btnRemaining = container.querySelector('#btnRevealRemainingAction');
    if (btnRemaining) {
      btnRemaining.onclick = () => {
        sendRemoteAction('REVEAL_REMAINING');
      };
    }

    const btnBlue = container.querySelector('#btnGivePotBlue');
    if (btnBlue) {
      btnBlue.onclick = () => {
        sendRemoteAction('AWARD_POT', { team: 'azul' });
      };
    }

    const btnRed = container.querySelector('#btnGivePotRed');
    if (btnRed) {
      btnRed.onclick = () => {
        sendRemoteAction('AWARD_POT', { team: 'rojo' });
      };
    }

    const btnNext = container.querySelector('#btnNextQuestionAction');
    if (btnNext) {
      btnNext.onclick = () => {
        sendRemoteAction('NEXT_QUESTION');
      };
    }
  }

  // PANTALLA DE FIN DE PARTIDA EN EL CELULAR
  function renderRemoteGameOver(container) {
    const winnerName = state.winner === 'azul' ? '🔵 EQUIPO AZUL' : '🔴 EQUIPO ROJO';
    container.innerHTML = `
      <div class="setup-box text-center">
        <div style="font-size: 4rem; margin-bottom: 12px;">🏆</div>
        <h2 class="setup-title" style="color: var(--color-gold-light); font-size: 2.2rem;">¡${winnerName} GANADOR!</h2>
        <p class="setup-subtitle">Superaron el objetivo de ${state.config.targetScore} puntos.</p>

        <div class="alert alert-dark border-secondary p-3 mb-4" style="font-family: var(--font-display); font-size: 1.4rem;">
          🔵 Azul: ${state.scoreAzul} pts &nbsp;|&nbsp; 🔴 Rojo: ${state.scoreRojo} pts
        </div>

        <button type="button" class="btn-start-game" id="btnRematchRemoteAction">
          🔄 JUGAR REVANCHA
        </button>
      </div>
    `;

    const btnRematch = container.querySelector('#btnRematchRemoteAction');
    if (btnRematch) {
      btnRematch.onclick = () => {
        sendRemoteAction('REMATCH');
      };
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Iniciar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(window, document);
