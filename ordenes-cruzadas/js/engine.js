/**
 * Órdenes Cruzadas - Motor de Física y Resolución Determinista
 * Compatible con Node.js (CommonJS) y Navegadores Web.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const maps = require('./maps.js');
    module.exports = factory(maps);
  } else {
    root.ROBO_ENGINE = factory(root.ARENAS_DATA);
  }
})(typeof self !== 'undefined' ? self : this, function (mapsData) {
  'use strict';

  const { ARENAS, TILE_TYPES, isSolidObstacle } = mapsData;

  // Direcciones: 0: Norte (dy: -1), 1: Este (dx: 1), 2: Sur (dy: 1), 3: Oeste (dx: -1)
  const DIR_VECTORS = [
    { dx: 0, dy: -1, name: 'Norte', symbol: '▲' },
    { dx: 1, dy: 0,  name: 'Este',  symbol: '▶' },
    { dx: 0, dy: 1,  name: 'Sur',   symbol: '▼' },
    { dx: -1, dy: 0, name: 'Oeste', symbol: '◀' }
  ];

  /**
   * Catálogo Maestro de las 24 Cartas de Órdenes por Jugador
   * Total = 5 + 3 + 1 + 2 + 4 + 4 + 2 + 2 + 1 = 24 cartas
   */
  const CARD_DEFINITIONS = [
    // 1. Avanzar 1 (5 copias)
    { type: 'forward_1', category: 'move', name: 'Avanzar 1', icon: '⬆️', desc: 'Avanza 1 casilla hacia adelante', priorities: [45, 50, 55, 60, 65] },
    // 2. Avanzar 2 (3 copias)
    { type: 'forward_2', category: 'move', name: 'Avanzar 2', icon: '⏫', desc: 'Avanza 2 casillas hacia adelante', priorities: [70, 75, 80] },
    // 3. Turbo 3 (1 copia)
    { type: 'forward_3', category: 'move', name: 'Turbo 3', icon: '🚀', desc: 'Avanza 3 casillas a máxima velocidad', priorities: [90] },
    // 4. Retroceder 1 (2 copias)
    { type: 'backward_1', category: 'move', name: 'Retroceder 1', icon: '⬇️', desc: 'Retrocede 1 casilla sin girar', priorities: [35, 40] },
    // 5. Girar Derecha (4 copias)
    { type: 'turn_cw', category: 'turn', name: 'Girar Derecha', icon: '↻', desc: 'Gira 90° en sentido horario', priorities: [15, 20, 25, 30] },
    // 6. Girar Izquierda (4 copias)
    { type: 'turn_ccw', category: 'turn', name: 'Girar Izquierda', icon: '↺', desc: 'Gira 90° en sentido antihorario', priorities: [12, 18, 22, 28] },
    // 7. Giro en U (2 copias)
    { type: 'u_turn', category: 'turn', name: 'Giro en U (180°)', icon: '🔄', desc: 'Gira 180° mirando al lado opuesto', priorities: [10, 14] },
    // 8. SobreCarga / Láser Doble (2 copias)
    { type: 'overload', category: 'attack', name: 'SobreCarga Láser', icon: '⚡', desc: 'Disparo frontal: quita 2 HP y empuja', priorities: [85, 88] },
    // 9. Escudo + Reparar (1 copia)
    { type: 'shield_repair', category: 'defense', name: 'Escudo + Reparar', icon: '🛡️', desc: 'Bloquea láseres este paso y recupera +1 HP', priorities: [95] }
  ];

  /**
   * Genera el mazo completo de 24 cartas para un jugador
   */
  function createPlayerDeck(playerId) {
    const deck = [];
    let counter = 1;
    for (const def of CARD_DEFINITIONS) {
      for (const prio of def.priorities) {
        deck.push({
          id: `${playerId}_c_${counter++}`,
          type: def.type,
          category: def.category,
          name: def.name,
          icon: def.icon,
          desc: def.desc,
          priority: prio
        });
      }
    }
    return deck;
  }

  /**
   * Baraja un array (Fisher-Yates)
   */
  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Gira una dirección
   */
  function turnDirection(facing, angle) {
    if (angle === 90) return (facing + 1) % 4;
    if (angle === -90) return (facing + 3) % 4;
    if (angle === 180) return (facing + 2) % 4;
    return facing;
  }

  /**
   * Verifica si una coordenada está dentro del mapa
   */
  function isInBounds(x, y, width = 10, height = 8) {
    return x >= 0 && x < width && y >= 0 && y < height;
  }

  /**
   * Obtiene el tipo de celda en una coordenada
   */
  function getTile(grid, x, y) {
    if (!isInBounds(x, y, grid[0].length, grid.length)) return 'wall';
    return grid[y][x];
  }

  /**
   * Obtiene la orientación hacia el centro del tablero desde un punto
   */
  function getFacingTowardsCenter(x, y, width = 10, height = 8) {
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const dx = cx - x;
    const dy = cy - y;
    if (Math.abs(dy) >= Math.abs(dx)) {
      return dy < 0 ? 0 : 2; // 0=Norte, 2=Sur
    } else {
      return dx > 0 ? 1 : 3; // 1=Este, 3=Oeste
    }
  }

  /**
   * Crea el estado inicial de una partida
   */
  function createGameState(config) {
    const arenaId = config.arenaId || 'fabrica';
    const arena = ARENAS[arenaId] || ARENAS.fabrica;
    const damageRule = config.damageRule || 'tactical'; // 'tactical' o 'simple'
    const roundTimer = typeof config.roundTimer === 'number' ? config.roundTimer : 45; // seg
    const executionSpeed = config.executionSpeed || 'normal'; // 'slow' o 'normal'

    const players = (config.players || []).map((p, idx) => {
      const spawn = arena.spawns[idx % arena.spawns.length];
      return {
        id: p.id,
        name: p.name || `Robot ${idx + 1}`,
        color: p.color || '#3b82f6',
        avatar: p.avatar || '🤖',
        isVip: !!p.isVip,
        spawnIdx: idx,
        x: spawn.x,
        y: spawn.y,
        facing: spawn.facing !== undefined ? spawn.facing : 0,
        hp: 5,
        maxHp: 5,
        alive: true,
        shieldActive: false,
        lastCheckpoint: 0,
        deck: createPlayerDeck(p.id),
        hand: [],
        program: [null, null, null, null],
        lockedSlots: [false, false, false, false],
        programLocked: false,
        stats: {
          lasersHit: 0,
          timesDestroyed: 0,
          checkpointsReached: 0,
          damageDealt: 0
        }
      };
    });

    return {
      arenaId,
      arena,
      damageRule,
      roundTimer,
      executionSpeed,
      roundNumber: 1,
      phase: 'programming', // 'programming', 'executing', 'finished'
      currentStep: 0, // 0..3
      winner: null,
      players
    };
  }

  /**
   * Reparte 7 cartas a cada jugador vivo para la fase de programación,
   * excluyendo del mazo las cartas que quedan fijas en slots bloqueados por daño táctico.
   */
  function dealRoundCards(state) {
    for (const player of state.players) {
      if (!player.alive) {
        player.hand = [];
        player.program = [null, null, null, null];
        player.lockedSlots = [false, false, false, false];
        player.programLocked = true;
        continue;
      }

      const newProgram = [null, null, null, null];
      const newLocked = [false, false, false, false];

      // Determinar qué slots se bloquean si la regla es 'tactical'
      if (state.damageRule === 'tactical') {
        if (player.hp <= 1) {
          // Bloquea Slot 2 y Slot 3
          newLocked[2] = true;
          newLocked[3] = true;
          newProgram[2] = player.program[2] || null;
          newProgram[3] = player.program[3] || null;
        } else if (player.hp <= 2) {
          // Bloquea Slot 3
          newLocked[3] = true;
          newProgram[3] = player.program[3] || null;
        }
      }

      // Reunir IDs de cartas retenidas en slots bloqueados para no duplicarlas
      const lockedCardIds = new Set(
        newProgram.filter((c, idx) => newLocked[idx] && c && c.id).map(c => c.id)
      );

      // Barajar el mazo disponible (restando las cartas que ya están bloqueadas)
      const availableDeck = player.deck.filter(c => !lockedCardIds.has(c.id));
      const shuffledDeck = shuffle(availableDeck);

      // Si un slot bloqueado no tenía carta aún (ej. daño recién sufrido), asignarle la primera carta del mazo
      for (let i = 0; i < 4; i++) {
        if (newLocked[i] && !newProgram[i]) {
          const lockedCard = shuffledDeck.shift();
          newProgram[i] = lockedCard || null;
          if (lockedCard) lockedCardIds.add(lockedCard.id);
        }
      }

      // Repartir 7 cartas de mano entre las restantes
      player.hand = shuffledDeck.slice(0, 7);
      player.program = newProgram;
      player.lockedSlots = newLocked;
      player.programLocked = false;
    }
  }

  /**
   * Mecánica de Empuje Determinista (Pushing)
   * Intenta mover un robot 1 celda en la dirección `dir`.
   * Si hay otros robots en la línea, se evalúa el empuje en cadena recursivo.
   *
   * Reglas estrictas:
   * - Muros y Torretas (`laser_turret_*`) son obstáculos sólidos infranqueables.
   * - Si detrás del último robot empujado hay un muro, torreta o límite del mapa: NADIE se mueve (bloqueo total).
   * - Si detrás hay celda transitable o abismo (`pit`): toda la fila avanza 1 celda.
   * - Si algún robot entra a un `pit`, se destruye inmediatamente.
   */
  function tryMoveRobotInDirection(grid, players, robotId, dir) {
    const robot = players.find(p => p.id === robotId && p.alive);
    if (!robot) return { success: false, blockedBy: 'none', movedRobots: [], destroyedRobots: [] };

    const vec = DIR_VECTORS[dir];
    const width = grid[0].length;
    const height = grid.length;

    // 1. Recorrer la cadena de robots en línea en esa dirección
    const chain = [robot];
    let curX = robot.x;
    let curY = robot.y;

    while (true) {
      const nextX = curX + vec.dx;
      const nextY = curY + vec.dy;

      // Fuera de límites = bloqueo
      if (!isInBounds(nextX, nextY, width, height)) {
        return { success: false, blockedBy: 'border', movedRobots: [], destroyedRobots: [] };
      }

      // Muro o torreta sólida = bloqueo
      const tile = grid[nextY][nextX];
      if (isSolidObstacle(tile)) {
        return { success: false, blockedBy: tile.startsWith('laser_turret') ? 'turret' : 'wall', movedRobots: [], destroyedRobots: [] };
      }

      // ¿Hay otro robot vivo en la celda destino?
      const otherRobot = players.find(p => p.id !== robot.id && p.alive && p.x === nextX && p.y === nextY);
      if (otherRobot) {
        chain.push(otherRobot);
        curX = nextX;
        curY = nextY;
      } else {
        // Celda vacía encontrada (piso, cinta, engranaje, reparación, spawn, checkpoint o abismo)
        break;
      }
    }

    // 2. Todos en la cadena pueden moverse. Se mueven desde el último hacia el primero
    const movedRobots = [];
    const destroyedRobots = [];

    for (let i = chain.length - 1; i >= 0; i--) {
      const r = chain[i];
      const fromX = r.x;
      const fromY = r.y;
      const toX = r.x + vec.dx;
      const toY = r.y + vec.dy;

      r.x = toX;
      r.y = toY;

      movedRobots.push({
        id: r.id,
        name: r.name,
        color: r.color,
        fromX,
        fromY,
        toX,
        toY,
        pushed: i > 0
      });

      // Verificar si cayó a un abismo
      const landingTile = grid[toY][toX];
      if (landingTile === TILE_TYPES.PIT) {
        r.alive = false;
        r.hp = 0;
        r.stats.timesDestroyed++;
        destroyedRobots.push({
          id: r.id,
          name: r.name,
          color: r.color,
          reason: 'pit',
          x: toX,
          y: toY
        });
      }
    }

    // Revertir para que movedRobots tenga primero al robot impulsor
    movedRobots.reverse();

    return {
      success: true,
      movedRobots,
      destroyedRobots
    };
  }

  /**
   * Traza un rayo láser en línea recta desde (fromX, fromY) en dirección `dir`.
   * Muros y Torretas detienen el rayo (la torreta de origen no se detiene a sí misma).
   */
  function traceLaserRay(grid, players, fromX, fromY, dir, shooterId) {
    const vec = DIR_VECTORS[dir];
    const width = grid[0].length;
    const height = grid.length;

    let curX = fromX + vec.dx;
    let curY = fromY + vec.dy;
    const path = [];
    let hitRobot = null;
    let hitWall = false;

    while (isInBounds(curX, curY, width, height)) {
      path.push({ x: curX, y: curY });

      // Choca con un robot vivo
      const target = players.find(p => p.alive && p.x === curX && p.y === curY && p.id !== shooterId);
      if (target) {
        hitRobot = target;
        break;
      }

      // Choca con muro o torreta
      const tile = grid[curY][curX];
      if (isSolidObstacle(tile)) {
        hitWall = true;
        break;
      }

      curX += vec.dx;
      curY += vec.dy;
    }

    return {
      path,
      hitRobot,
      hitWall,
      endX: path.length > 0 ? path[path.length - 1].x : fromX,
      endY: path.length > 0 ? path[path.length - 1].y : fromY
    };
  }

  /**
   * Resuelve 1 Paso Completo (Paso 0 a 3) de manera determinista y genera una
   * LÍNEA DE TIEMPO ATÓMICA (`timeline`) con todos los eventos exactos en orden cronológico.
   */
  function executeStep(state, stepIndex) {
    const grid = state.arena.grid;
    const players = state.players;
    const timeline = [];

    // Reiniciar escudos activos al inicio del paso
    for (const p of players) {
      p.shieldActive = false;
    }

    // =========================================================================
    // SUB-PASO A: Cartas de los Robots por Prioridad (Mayor a Menor)
    // =========================================================================
    timeline.push({
      type: 'SUBPHASE',
      phase: 'cards',
      title: `Paso ${stepIndex + 1} • Cartas de Órdenes`,
      subtitle: 'Ejecución por orden estricto de prioridad'
    });

    const activeCards = [];
    for (const player of players) {
      if (player.alive && player.program[stepIndex]) {
        activeCards.push({
          player,
          card: player.program[stepIndex]
        });
      }
    }

    // Orden descendente por Prioridad
    activeCards.sort((a, b) => b.card.priority - a.card.priority);

    for (const item of activeCards) {
      const p = item.player;
      const card = item.card;

      // Si el robot murió antes de que llegue su turno en este paso, saltear
      if (!p.alive) continue;

      timeline.push({
        type: 'CARD_START',
        playerId: p.id,
        playerName: p.name,
        playerColor: p.color,
        card
      });

      if (card.type === 'forward_1' || card.type === 'forward_2' || card.type === 'forward_3') {
        const movesCount = card.type === 'forward_1' ? 1 : card.type === 'forward_2' ? 2 : 3;
        for (let m = 0; m < movesCount; m++) {
          if (!p.alive) break;
          const moveRes = tryMoveRobotInDirection(grid, players, p.id, p.facing);
          if (moveRes.success) {
            timeline.push({
              type: 'MOVE',
              playerId: p.id,
              moves: moveRes.movedRobots,
              blocked: false
            });

            if (moveRes.destroyedRobots && moveRes.destroyedRobots.length > 0) {
              for (const d of moveRes.destroyedRobots) {
                timeline.push({ type: 'PIT_FALL', playerId: d.id, playerName: d.name, x: d.x, y: d.y });
                timeline.push({ type: 'DESTROYED', playerId: d.id, playerName: d.name, x: d.x, y: d.y, reason: 'pit' });
              }
            }
          } else {
            // Choque contra muro / torreta / borde
            timeline.push({
              type: 'BUMP',
              playerId: p.id,
              dir: p.facing,
              blockedBy: moveRes.blockedBy
            });
            break; // Se interrumpe avance múltiple
          }
        }
      } else if (card.type === 'backward_1') {
        const backDir = (p.facing + 2) % 4;
        const moveRes = tryMoveRobotInDirection(grid, players, p.id, backDir);
        if (moveRes.success) {
          timeline.push({
            type: 'MOVE',
            playerId: p.id,
            moves: moveRes.movedRobots,
            blocked: false
          });

          if (moveRes.destroyedRobots && moveRes.destroyedRobots.length > 0) {
            for (const d of moveRes.destroyedRobots) {
              timeline.push({ type: 'PIT_FALL', playerId: d.id, playerName: d.name, x: d.x, y: d.y });
              timeline.push({ type: 'DESTROYED', playerId: d.id, playerName: d.name, x: d.x, y: d.y, reason: 'pit' });
            }
          }
        } else {
          timeline.push({
            type: 'BUMP',
            playerId: p.id,
            dir: backDir,
            blockedBy: moveRes.blockedBy
          });
        }
      } else if (card.type === 'turn_cw') {
        p.facing = turnDirection(p.facing, 90);
        timeline.push({
          type: 'TURN',
          playerId: p.id,
          deltaAngle: 90,
          newFacing: p.facing
        });
      } else if (card.type === 'turn_ccw') {
        p.facing = turnDirection(p.facing, -90);
        timeline.push({
          type: 'TURN',
          playerId: p.id,
          deltaAngle: -90,
          newFacing: p.facing
        });
      } else if (card.type === 'u_turn') {
        p.facing = turnDirection(p.facing, 180);
        timeline.push({
          type: 'TURN',
          playerId: p.id,
          deltaAngle: 180,
          newFacing: p.facing
        });
      } else if (card.type === 'overload') {
        // Disparo frontal potente de 2 HP + empuje
        const ray = traceLaserRay(grid, players, p.x, p.y, p.facing, p.id);
        const target = ray.hitRobot && ray.hitRobot.alive ? ray.hitRobot : null;

        let damage = 0;
        let shieldBlocked = false;

        if (target) {
          p.stats.lasersHit++;
          if (target.shieldActive) {
            shieldBlocked = true;
          } else {
            damage = 2;
            p.stats.damageDealt += 2;
            target.hp = Math.max(0, target.hp - 2);
            if (target.hp === 0) {
              target.alive = false;
              target.stats.timesDestroyed++;
            }
          }
        }

        timeline.push({
          type: 'LASER',
          sourceType: 'overload',
          color: p.color,
          shooterId: p.id,
          shooterName: p.name,
          fromX: p.x,
          fromY: p.y,
          toX: ray.endX,
          toY: ray.endY,
          hitRobotId: target ? target.id : null,
          hitX: target ? target.x : null,
          hitY: target ? target.y : null,
          damage,
          shieldBlocked,
          targetNewHp: target ? target.hp : null
        });

        if (target && !target.alive) {
          timeline.push({
            type: 'DESTROYED',
            playerId: target.id,
            playerName: target.name,
            x: target.x,
            y: target.y,
            reason: 'laser_damage'
          });
        } else if (target && target.alive) {
          // Empujar al robot impactado 1 casilla en la dirección del láser
          const pushRes = tryMoveRobotInDirection(grid, players, target.id, p.facing);
          if (pushRes.success) {
            timeline.push({
              type: 'MOVE',
              playerId: target.id,
              moves: pushRes.movedRobots,
              blocked: false
            });
            if (pushRes.destroyedRobots && pushRes.destroyedRobots.length > 0) {
              for (const d of pushRes.destroyedRobots) {
                timeline.push({ type: 'PIT_FALL', playerId: d.id, playerName: d.name, x: d.x, y: d.y });
                timeline.push({ type: 'DESTROYED', playerId: d.id, playerName: d.name, x: d.x, y: d.y, reason: 'pit' });
              }
            }
          }
        }
      } else if (card.type === 'shield_repair') {
        p.shieldActive = true;
        const healed = p.hp < p.maxHp;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        timeline.push({
          type: 'SHIELD_REPAIR',
          playerId: p.id,
          x: p.x,
          y: p.y,
          newHp: p.hp,
          healed
        });
      }
    }

    // =========================================================================
    // SUB-PASO B: Cintas Transportadoras
    // =========================================================================
    const conveyorDirMap = {
      [TILE_TYPES.CONVEYOR_N]: 0,
      [TILE_TYPES.CONVEYOR_E]: 1,
      [TILE_TYPES.CONVEYOR_S]: 2,
      [TILE_TYPES.CONVEYOR_W]: 3
    };

    // Identificar robots parados en cintas
    const conveyorRobots = [];
    for (const p of players) {
      if (!p.alive) continue;
      const tile = grid[p.y][p.x];
      if (conveyorDirMap[tile] !== undefined) {
        conveyorRobots.push({ player: p, dir: conveyorDirMap[tile] });
      }
    }

    if (conveyorRobots.length > 0) {
      let subphaseEmitted = false;
      const movedInConveyors = new Set();

      for (const cm of conveyorRobots) {
        if (!cm.player.alive || movedInConveyors.has(cm.player.id)) continue;

        const moveRes = tryMoveRobotInDirection(grid, players, cm.player.id, cm.dir);
        if (moveRes.success) {
          if (!subphaseEmitted) {
            timeline.push({
              type: 'SUBPHASE',
              phase: 'conveyors',
              title: 'Fase 2: Cintas Transportadoras',
              subtitle: 'Desplazamiento automático de robots'
            });
            subphaseEmitted = true;
          }

          moveRes.movedRobots.forEach(m => movedInConveyors.add(m.id));

          timeline.push({
            type: 'MOVE',
            playerId: cm.player.id,
            moves: moveRes.movedRobots,
            blocked: false
          });

          if (moveRes.destroyedRobots && moveRes.destroyedRobots.length > 0) {
            for (const d of moveRes.destroyedRobots) {
              timeline.push({ type: 'PIT_FALL', playerId: d.id, playerName: d.name, x: d.x, y: d.y });
              timeline.push({ type: 'DESTROYED', playerId: d.id, playerName: d.name, x: d.x, y: d.y, reason: 'pit' });
            }
          }
        }
      }
    }

    // =========================================================================
    // SUB-PASO C: Engranajes Giratorios
    // =========================================================================
    const gearRobots = [];
    for (const p of players) {
      if (!p.alive) continue;
      const tile = grid[p.y][p.x];
      if (tile === TILE_TYPES.GEAR_CW || tile === TILE_TYPES.GEAR_CCW) {
        gearRobots.push({ player: p, tile });
      }
    }

    if (gearRobots.length > 0) {
      timeline.push({
        type: 'SUBPHASE',
        phase: 'gears',
        title: 'Fase 3: Engranajes Giratorios',
        subtitle: 'Rotación obligatoria de chasis'
      });

      for (const gr of gearRobots) {
        const p = gr.player;
        const isCw = gr.tile === TILE_TYPES.GEAR_CW;
        const delta = isCw ? 90 : -90;
        p.facing = turnDirection(p.facing, delta);
        timeline.push({
          type: 'TURN',
          playerId: p.id,
          deltaAngle: delta,
          newFacing: p.facing
        });
      }
    }

    // =========================================================================
    // SUB-PASO D: Láseres Automáticos (Torretas Fijas + Robots)
    // =========================================================================
    timeline.push({
      type: 'SUBPHASE',
      phase: 'lasers',
      title: 'Fase 4: ¡Fuego de Láseres!',
      subtitle: 'Disparo de torretas y cañones frontales'
    });

    const turretDirMap = {
      [TILE_TYPES.TURRET_N]: 0,
      [TILE_TYPES.TURRET_E]: 1,
      [TILE_TYPES.TURRET_S]: 2,
      [TILE_TYPES.TURRET_W]: 3
    };

    // 1. Torretas fijas del mapa
    const height = grid.length;
    const width = grid[0].length;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (turretDirMap[tile] !== undefined) {
          const dir = turretDirMap[tile];
          const ray = traceLaserRay(grid, players, x, y, dir, null);
          const target = ray.hitRobot && ray.hitRobot.alive ? ray.hitRobot : null;

          let damage = 0;
          let shieldBlocked = false;

          if (target) {
            if (target.shieldActive) {
              shieldBlocked = true;
            } else {
              damage = 1;
              target.hp = Math.max(0, target.hp - 1);
              if (target.hp === 0) {
                target.alive = false;
                target.stats.timesDestroyed++;
              }
            }
          }

          timeline.push({
            type: 'LASER',
            sourceType: 'turret',
            color: '#ef4444',
            fromX: x,
            fromY: y,
            toX: ray.endX,
            toY: ray.endY,
            hitRobotId: target ? target.id : null,
            hitX: target ? target.x : null,
            hitY: target ? target.y : null,
            damage,
            shieldBlocked,
            targetNewHp: target ? target.hp : null
          });

          if (target && !target.alive) {
            timeline.push({
              type: 'DESTROYED',
              playerId: target.id,
              playerName: target.name,
              x: target.x,
              y: target.y,
              reason: 'turret_laser'
            });
          }
        }
      }
    }

    // 2. Cañones frontales de los robots vivos (disparo simultáneo)
    const robotShooters = players.filter(p => p.alive);
    const robotRays = robotShooters.map(p => ({
      shooter: p,
      ray: traceLaserRay(grid, players, p.x, p.y, p.facing, p.id)
    }));

    for (const rItem of robotRays) {
      const shooter = rItem.shooter;
      const ray = rItem.ray;
      const target = ray.hitRobot && ray.hitRobot.alive ? ray.hitRobot : null;

      let damage = 0;
      let shieldBlocked = false;

      if (target) {
        shooter.stats.lasersHit++;
        if (target.shieldActive) {
          shieldBlocked = true;
        } else {
          damage = 1;
          shooter.stats.damageDealt += 1;
          target.hp = Math.max(0, target.hp - 1);
          if (target.hp === 0) {
            target.alive = false;
            target.stats.timesDestroyed++;
          }
        }
      }

      timeline.push({
        type: 'LASER',
        sourceType: 'robot',
        color: shooter.color || '#38bdf8',
        shooterId: shooter.id,
        shooterName: shooter.name,
        fromX: shooter.x,
        fromY: shooter.y,
        toX: ray.endX,
        toY: ray.endY,
        hitRobotId: target ? target.id : null,
        hitX: target ? target.x : null,
        hitY: target ? target.y : null,
        damage,
        shieldBlocked,
        targetNewHp: target ? target.hp : null
      });

      if (target && !target.alive) {
        timeline.push({
          type: 'DESTROYED',
          playerId: target.id,
          playerName: target.name,
          x: target.x,
          y: target.y,
          reason: 'robot_laser'
        });
      }
    }

    // =========================================================================
    // SUB-PASO E: Checkpoints y Estaciones de Reparación
    // =========================================================================
    const objEvents = [];
    for (const p of players) {
      if (!p.alive) continue;
      const tile = grid[p.y][p.x];

      // Checkpoints secuenciales 1 -> 2 -> 3
      if (tile === TILE_TYPES.CP_1 && p.lastCheckpoint === 0) {
        p.lastCheckpoint = 1;
        p.stats.checkpointsReached++;
        objEvents.push({
          type: 'CHECKPOINT',
          playerId: p.id,
          playerName: p.name,
          cpId: 1,
          x: p.x,
          y: p.y
        });
      } else if (tile === TILE_TYPES.CP_2 && p.lastCheckpoint === 1) {
        p.lastCheckpoint = 2;
        p.stats.checkpointsReached++;
        objEvents.push({
          type: 'CHECKPOINT',
          playerId: p.id,
          playerName: p.name,
          cpId: 2,
          x: p.x,
          y: p.y
        });
      } else if (tile === TILE_TYPES.CP_3 && p.lastCheckpoint === 2) {
        p.lastCheckpoint = 3;
        p.stats.checkpointsReached++;
        state.winner = p;
        objEvents.push({
          type: 'CHECKPOINT',
          playerId: p.id,
          playerName: p.name,
          cpId: 3,
          x: p.x,
          y: p.y
        });
        objEvents.push({
          type: 'WINNER',
          winner: {
            id: p.id,
            name: p.name,
            color: p.color,
            avatar: p.avatar
          }
        });
      }

      // Estación de reparación (+1 HP, máx 5)
      if (tile === TILE_TYPES.REPAIR && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 1);
        objEvents.push({
          type: 'REPAIR_TILE',
          playerId: p.id,
          playerName: p.name,
          x: p.x,
          y: p.y,
          newHp: p.hp
        });
      }
    }

    if (objEvents.length > 0) {
      timeline.push({
        type: 'SUBPHASE',
        phase: 'objectives',
        title: 'Fase 5: Checkpoints y Reparación',
        subtitle: 'Registro de objetivos alcanzados'
      });
      timeline.push(...objEvents);
    }

    return {
      stepIndex,
      timeline,
      winner: state.winner ? {
        id: state.winner.id,
        name: state.winner.name,
        color: state.winner.color,
        avatar: state.winner.avatar
      } : null
    };
  }

  /**
   * Finaliza una ronda, reaparece a los robots destruidos y resetea contadores para la siguiente.
   * NOTA: dealRoundCards() se llama en startNewRound() para evitar doble reparto.
   */
  function finishRoundAndRespawn(state) {
    const arena = state.arena;
    const grid = arena.grid;
    const width = grid[0].length;
    const height = grid.length;

    // Resucitar robots destruidos
    for (const p of state.players) {
      if (!p.alive || p.hp <= 0) {
        p.alive = true;
        p.hp = 5;

        // Ubicación de reaparición: último Checkpoint capturado o su Muelle de Salida
        let targetX, targetY;
        if (p.lastCheckpoint === 1) {
          const cp = arena.checkpoints.find(c => c.id === 1);
          targetX = cp.x; targetY = cp.y;
        } else if (p.lastCheckpoint === 2) {
          const cp = arena.checkpoints.find(c => c.id === 2);
          targetX = cp.x; targetY = cp.y;
        } else {
          const spawn = arena.spawns[p.spawnIdx % arena.spawns.length];
          targetX = spawn.x; targetY = spawn.y;
        }

        // Si la casilla está ocupada, buscar la casilla adyacente libre más cercana
        const isOccupied = (tx, ty) => state.players.some(other => other.id !== p.id && other.alive && other.x === tx && other.y === ty);
        if (isOccupied(targetX, targetY)) {
          let foundFree = false;
          for (let radius = 1; radius <= 3 && !foundFree; radius++) {
            for (let dy = -radius; dy <= radius && !foundFree; dy++) {
              for (let dx = -radius; dx <= radius && !foundFree; dx++) {
                const nx = targetX + dx;
                const ny = targetY + dy;
                if (isInBounds(nx, ny, width, height)) {
                  const tile = grid[ny][nx];
                  if (!isSolidObstacle(tile) && tile !== TILE_TYPES.PIT && !isOccupied(nx, ny)) {
                    targetX = nx;
                    targetY = ny;
                    foundFree = true;
                  }
                }
              }
            }
          }
        }

        p.x = targetX;
        p.y = targetY;
        p.facing = getFacingTowardsCenter(targetX, targetY, width, height);
      }
    }

    state.roundNumber++;
    state.currentStep = 0;
    state.phase = 'programming';
  }

  return {
    DIR_VECTORS,
    CARD_DEFINITIONS,
    createPlayerDeck,
    createGameState,
    dealRoundCards,
    tryMoveRobotInDirection,
    traceLaserRay,
    executeStep,
    finishRoundAndRespawn,
    turnDirection,
    isInBounds,
    getTile,
    getFacingTowardsCenter
  };
});
