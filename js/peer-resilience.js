/**
 * HubGames - Módulo de Resiliencia WebRTC / PeerJS (peer-resilience.js)
 * 
 * Funcionalidades:
 * 1. WakeLockManager: Mantiene la pantalla encendida en celulares durante la partida.
 * 2. Detección instantánea al desbloquear celular (visibilitychange y online) con PING/PONG y timeout de 1500ms.
 * 3. Heartbeat periódico (PING cada 3000ms, reconexión tras 2 fallos consecutivos).
 * 4. Reemplazo atómico de conexiones en el Host (connectionId) para evitar conexiones zombis y carreras.
 * 5. Monitor de inactividad en la TV (icono 💤 / 📡 tras 8s sin expulsar ni alterar puntaje).
 * 6. Sincronización completa de estado (FULL_STATE_SYNC) con bandera yaEnvioEnEstaFase.
 * 7. Control de idempotencia con phaseKey.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PeerResilience = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =========================================================================
  // 1. WAKELOCK MANAGER (Pantalla Activa en Celulares)
  // =========================================================================
  let wakeLockSentinel = null;
  let isWakeLockRequested = false;

  async function requestWakeLock() {
    isWakeLockRequested = true;
    if ('wakeLock' in navigator) {
      try {
        if (!wakeLockSentinel) {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
          wakeLockSentinel.addEventListener('release', () => {
            wakeLockSentinel = null;
          });
        }
      } catch (err) {
        // Silencioso: navegadores con batería baja o permisos denegados
      }
    }
  }

  async function releaseWakeLock() {
    isWakeLockRequested = false;
    if (wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch (e) {}
      wakeLockSentinel = null;
    }
  }

  // Auto-solicitud de WakeLock en eventos táctiles si está habilitado
  if (typeof window !== 'undefined') {
    const renewWakeLock = () => {
      if (isWakeLockRequested && document.visibilityState === 'visible' && !wakeLockSentinel) {
        requestWakeLock();
      }
    };
    window.addEventListener('touchstart', renewWakeLock, { passive: true });
    window.addEventListener('pointerdown', renewWakeLock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        renewWakeLock();
      }
    });
  }

  // =========================================================================
  // 2. UI HELPERS (Overlay no bloqueante y Banner de Reconexión)
  // =========================================================================
  let checkingOverlayEl = null;
  let reconnectingBannerEl = null;

  function ensureStyles() {
    if (document.getElementById('peer-resilience-styles')) return;
    const style = document.createElement('style');
    style.id = 'peer-resilience-styles';
    style.textContent = `
      .peer-resilience-overlay {
        position: fixed;
        inset: 0;
        background: rgba(9, 13, 22, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #f8fafc;
        font-family: system-ui, -apple-system, sans-serif;
        text-align: center;
        padding: 20px;
        pointer-events: auto;
        animation: prFadeIn 0.2s ease-out;
      }
      .peer-resilience-spinner {
        width: 44px;
        height: 44px;
        border: 4px solid rgba(56, 189, 248, 0.25);
        border-top-color: #38bdf8;
        border-radius: 50%;
        animation: prSpin 0.9s linear infinite;
        margin-bottom: 14px;
      }
      .peer-resilience-text {
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .peer-resilience-subtext {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-top: 6px;
      }
      .peer-resilience-banner {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #ffffff;
        padding: 10px 20px;
        border-radius: 50px;
        z-index: 999999;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.5);
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.92rem;
        font-weight: 700;
        animation: prSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 90%;
      }
      .peer-resilience-banner-btn {
        background: #ffffff;
        color: #991b1b;
        border: none;
        padding: 5px 14px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        transition: transform 0.1s ease;
      }
      .peer-resilience-banner-btn:active {
        transform: scale(0.95);
      }
      @keyframes prSpin {
        to { transform: rotate(360deg); }
      }
      @keyframes prFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes prSlideDown {
        from { transform: translate(-50%, -100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  function showCheckingOverlay(msg = '🔄 Verificando conexión con la TV...') {
    if (typeof document === 'undefined') return;
    ensureStyles();
    if (!checkingOverlayEl) {
      checkingOverlayEl = document.createElement('div');
      checkingOverlayEl.className = 'peer-resilience-overlay';
      checkingOverlayEl.innerHTML = `
        <div class="peer-resilience-spinner"></div>
        <div class="peer-resilience-text" id="prOverlayMsg">${msg}</div>
        <div class="peer-resilience-subtext">Sincronizando partida en vivo...</div>
      `;
      document.body.appendChild(checkingOverlayEl);
    } else {
      const msgEl = checkingOverlayEl.querySelector('#prOverlayMsg');
      if (msgEl) msgEl.textContent = msg;
      checkingOverlayEl.style.display = 'flex';
    }
  }

  function hideCheckingOverlay() {
    if (checkingOverlayEl) {
      checkingOverlayEl.style.display = 'none';
    }
  }

  function showReconnectingBanner(onForceReconnect) {
    if (typeof document === 'undefined') return;
    ensureStyles();
    hideCheckingOverlay();
    if (!reconnectingBannerEl) {
      reconnectingBannerEl = document.createElement('div');
      reconnectingBannerEl.className = 'peer-resilience-banner';
      reconnectingBannerEl.innerHTML = `
        <span>📡 Reconectando con la TV...</span>
        <button type="button" class="peer-resilience-banner-btn" id="prBtnForceReconnect">Reconectar</button>
      `;
      document.body.appendChild(reconnectingBannerEl);
      const btn = reconnectingBannerEl.querySelector('#prBtnForceReconnect');
      if (btn) {
        btn.addEventListener('click', () => {
          if (typeof onForceReconnect === 'function') onForceReconnect();
        });
      }
    } else {
      reconnectingBannerEl.style.display = 'flex';
      const btn = reconnectingBannerEl.querySelector('#prBtnForceReconnect');
      if (btn) {
        btn.onclick = () => {
          if (typeof onForceReconnect === 'function') onForceReconnect();
        };
      }
    }
  }

  function hideReconnectingBanner() {
    if (reconnectingBannerEl) {
      reconnectingBannerEl.style.display = 'none';
    }
  }

  // =========================================================================
  // 3. CLIENTE DE RESILIENCIA (HEARTBEAT Y RECONEXIÓN AUTOMÁTICA)
  // =========================================================================
  function createClient(options) {
    const {
      getConn,            // () => activeDataConnection
      getPeer,            // () => peerInstance
      getRoomCode,        // () => string
      onReconnect,        // () => void (gatilla flujo de reconexión limpia)
      onStateSync         // (payload) => void (aplica FULL_STATE_SYNC recibido)
    } = options;

    let heartbeatTimer = null;
    let verifyTimeout = null;
    let missedPings = 0;
    let isVerifying = false;
    let isReconnecting = false;

    function sendPing() {
      const conn = getConn ? getConn() : null;
      if (conn && conn.open && !isVerifying) {
        try {
          conn.send({ type: 'PING', ts: Date.now() });
          missedPings++;
          if (missedPings >= 2 && !isReconnecting) {
            triggerReconnect();
          }
        } catch (e) {
          triggerReconnect();
        }
      }
    }

    function triggerReconnect() {
      isReconnecting = true;
      hideCheckingOverlay();
      showReconnectingBanner(() => {
        forceManualReconnect();
      });

      const peer = getPeer ? getPeer() : null;
      if (peer && peer.disconnected && !peer.destroyed) {
        try {
          peer.reconnect();
        } catch (e) {}
      }

      if (typeof onReconnect === 'function') {
        onReconnect();
      }
    }

    function forceManualReconnect() {
      isReconnecting = true;
      showCheckingOverlay('🔄 Forzando reconexión limpia...');
      const peer = getPeer ? getPeer() : null;
      if (peer && !peer.destroyed) {
        try { peer.destroy(); } catch (e) {}
      }
      if (typeof onReconnect === 'function') {
        onReconnect();
      }
    }

    function handleIncomingData(data) {
      if (!data) return false;

      // Respuesta PONG
      if (data.type === 'PONG') {
        missedPings = 0;
        isReconnecting = false;
        hideCheckingOverlay();
        hideReconnectingBanner();
        if (verifyTimeout) {
          clearTimeout(verifyTimeout);
          verifyTimeout = null;
        }
        isVerifying = false;
        return true;
      }

      // Sincronización completa de estado al reconectar
      if (data.type === 'FULL_STATE_SYNC') {
        missedPings = 0;
        isReconnecting = false;
        hideCheckingOverlay();
        hideReconnectingBanner();
        isVerifying = false;
        if (typeof onStateSync === 'function') {
          onStateSync(data.payload || data);
        }
        return true;
      }

      return false;
    }

    function checkConnectionInstantly() {
      if (document.visibilityState !== 'visible') return;

      requestWakeLock();
      const conn = getConn ? getConn() : null;
      const peer = getPeer ? getPeer() : null;

      // Si no hay conexión o el peer está desconectado, reconectar de inmediato
      if (!conn || !conn.open || (peer && peer.disconnected)) {
        triggerReconnect();
        return;
      }

      // No confiar en conn.open: verificar con PING rápido
      isVerifying = true;
      showCheckingOverlay('🔄 Verificando conexión con la TV...');

      try {
        conn.send({ type: 'PING', ts: Date.now() });
      } catch (e) {
        isVerifying = false;
        triggerReconnect();
        return;
      }

      if (verifyTimeout) clearTimeout(verifyTimeout);
      verifyTimeout = setTimeout(() => {
        if (isVerifying) {
          isVerifying = false;
          triggerReconnect();
        }
      }, 1500);
    }

    function start() {
      requestWakeLock();
      stop();

      // Heartbeat cada 3000ms
      heartbeatTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          sendPing();
        }
      }, 3000);

      // Listeners de reactivación al desbloquear o volver a la pestaña
      document.addEventListener('visibilitychange', checkConnectionInstantly);
      window.addEventListener('online', checkConnectionInstantly);
    }

    function stop() {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (verifyTimeout) {
        clearTimeout(verifyTimeout);
        verifyTimeout = null;
      }
      document.removeEventListener('visibilitychange', checkConnectionInstantly);
      window.removeEventListener('online', checkConnectionInstantly);
      hideCheckingOverlay();
      hideReconnectingBanner();
      isVerifying = false;
      isReconnecting = false;
    }

    function onConnected() {
      missedPings = 0;
      isVerifying = false;
      isReconnecting = false;
      hideCheckingOverlay();
      hideReconnectingBanner();
      requestWakeLock();
    }

    return {
      start,
      stop,
      onConnected,
      checkConnectionInstantly,
      handleIncomingData,
      forceManualReconnect
    };
  }

  // =========================================================================
  // 4. HOST DE RESILIENCIA (TV - ATOMIC CONNECTIONS Y MONITOR DE SUEÑO)
  // =========================================================================
  function createHost(options = {}) {
    const {
      onPlayerSleepChange, // (playerId, isAsleep) => void
      getPhaseKey          // () => string
    } = options;

    let connectionCounter = 1;
    // Map: playerId -> { connId: number, lastHeartbeat: number, isAsleep: boolean, conn: DataConnection }
    const activeRegistry = new Map();
    let sleepMonitorInterval = null;

    function registerPlayerConnection(playerId, conn) {
      if (!playerId || !conn) return null;

      const connId = connectionCounter++;
      conn._connId = connId;

      const existing = activeRegistry.get(playerId);
      if (existing && existing.conn && existing.conn !== conn) {
        try {
          existing.conn.close();
        } catch (e) {}
      }

      activeRegistry.set(playerId, {
        connId,
        lastHeartbeat: Date.now(),
        isAsleep: false,
        conn
      });

      if (typeof onPlayerSleepChange === 'function') {
        onPlayerSleepChange(playerId, false);
      }

      return connId;
    }

    function isConnectionActive(playerId, conn) {
      if (!playerId || !conn) return false;
      const reg = activeRegistry.get(playerId);
      return reg && reg.connId === conn._connId;
    }

    function handleIncomingHostData(playerId, conn, data) {
      if (!data) return false;

      // Responder a PING inmediatamente
      if (data.type === 'PING') {
        try {
          conn.send({ type: 'PONG', ts: data.ts });
        } catch (e) {}

        const reg = activeRegistry.get(playerId);
        if (reg) {
          reg.lastHeartbeat = Date.now();
          if (reg.isAsleep) {
            reg.isAsleep = false;
            if (typeof onPlayerSleepChange === 'function') {
              onPlayerSleepChange(playerId, false);
            }
          }
        }
        return true;
      }

      return false;
    }

    function startSleepMonitor() {
      stopSleepMonitor();
      sleepMonitorInterval = setInterval(() => {
        const now = Date.now();
        for (const [playerId, reg] of activeRegistry.entries()) {
          // Si pasan más de 8 segundos sin ping, marcar como dormido
          if (now - reg.lastHeartbeat > 8000) {
            if (!reg.isAsleep) {
              reg.isAsleep = true;
              if (typeof onPlayerSleepChange === 'function') {
                onPlayerSleepChange(playerId, true);
              }
            }
          }
        }
      }, 3000);
    }

    function stopSleepMonitor() {
      if (sleepMonitorInterval) {
        clearInterval(sleepMonitorInterval);
        sleepMonitorInterval = null;
      }
    }

    function removePlayer(playerId) {
      const reg = activeRegistry.get(playerId);
      if (reg && reg.conn) {
        try { reg.conn.close(); } catch (e) {}
      }
      activeRegistry.delete(playerId);
    }

    return {
      registerPlayerConnection,
      isConnectionActive,
      handleIncomingHostData,
      startSleepMonitor,
      stopSleepMonitor,
      removePlayer,
      getRegistry: () => activeRegistry
    };
  }

  return {
    enableWakeLock: requestWakeLock,
    disableWakeLock: releaseWakeLock,
    showCheckingOverlay,
    hideCheckingOverlay,
    showReconnectingBanner,
    hideReconnectingBanner,
    createClient,
    createHost
  };
});
