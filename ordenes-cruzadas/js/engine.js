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

  const { ARENAS, TILE_TYPES } = mapsData;

  // Direcciones: 0: Norte, 1: Este, 2: Sur, 3: Oeste
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
    { type: 'forward_1', name: 'Avanzar 1', icon: '⬆️', desc: 'Avanza 1 casilla hacia adelante', priorities: [45, 50, 55, 60, 65] },
    // 2. Avanzar 2 (3 copias)
    { type: 'forward_2', name: 'Avanzar 2', icon: '⏫', desc: 'Avanza 2 casillas hacia adelante', priorities: [70, 75, 80] },
    // 3. Turbo 3 (1 copia)
    { type: 'forward_3', name: 'Turbo 3', icon: '🚀', desc: 'Avanza 3 casillas a máxima velocidad', priorities: [90] },
    // 4. Retroceder 1 (2 copias)
    { type: 'backward_1', name: 'Retroceder 1', icon: '⬇️', desc: 'Retrocede 1 casilla sin girar', priorities: [35, 40] },
    // 5. Girar Derecha (4 copias)
    { type: 'turn_cw', name: 'Girar Derecha', icon: '↪️', desc: 'Gira 90° en sentido horario', priorities: [15, 20, 25, 30] },
    // 6. Girar Izquierda (4 copias)
    { type: 'turn_ccw', name: 'Girar Izquierda', icon: '↩️', desc: 'Gira 90° en sentido antihorario', priorities: [12, 18, 22, 28] },
    // 7. Giro en U (2 copias)
    { type: 'u_turn', name: 'Giro en U (180°)', icon: '🔄', desc: 'Gira 180° mirando al lado opuesto', priorities: [10, 14] },
    // 8. SobreCarga / Láser Doble (2 copias)
    { type: 'overload', name: 'SobreCarga Láser', icon: '⚡', desc: 'Disparo frontal: quita 2 HP y empuja', priorities: [85, 88] },
    // 9. Escudo + Reparar (1 copia)
    { type: 'shield_repair', name: 'Escudo + Reparar', icon: '🛡️', desc: 'Bloquea láseres este paso y recupera +1 HP', priorities: [95] }
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
      roundNumber: 1,
      phase: 'programming', // 'programming', 'executing', 'finished'
      currentStep: 0, // 0..3
      winner: null,
      players
    };
  }

  /**
   * Reparte 7 cartas a cada jugador vivo para la fase de programación
   */
  function dealRoundCards(state) {
    for (const player of state.players) {
      // Barajar mazo completo
      const shuffledDeck = shuffle(player.deck);
      player.hand = shuffledDeck.slice(0, 7);

      // Limpiar programa previo respetando slots bloqueados por daño táctico
      const newProgram = [null, null, null, null];
      const newLocked = [false, false, false, false];

      if (state.damageRule === 'tactical' && player.alive) {
        if (player.hp <= 1) {
          // Bloquea Slot 2 y Slot 3 (los dos últimos)
          newLocked[2] = true;
          newLocked[3] = true;
          newProgram[2] = player.program[2] || player.hand[0] || null;
          newProgram[3] = player.program[3] || player.hand[1] || null;
        } else if (player.hp <= 2) {
          // Bloquea Slot 3 (el último)
          newLocked[3] = true;
          newProgram[3] = player.program[3] || player.hand[0] || null;
        }
      }

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
   * - Si detrás del último robot empujado hay un 'wall' o límite del mapa: NADIE se mueve.
   * - Si detrás hay celda transitable o 'pit': toda la fila avanza.
   * - Si algún robot entra a un 'pit', se destruye inmediatamente.
   */
  function tryMoveRobotInDirection(grid, players, robotId, dir) {
    const robot = players.find(p => p.id === robotId && p.alive);
    if (!robot) return { success: false, movedRobots: [], destroyedRobots: [] };

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

      // Muro sólido = bloqueo
      const tile = grid[nextY][nextX];
      if (tile === TILE_TYPES.WALL) {
        return { success: false, blockedBy: 'wall', movedRobots: [], destroyedRobots: [] };
      }

      // ¿Hay otro robot vivo en la celda destino?
      const otherRobot = players.find(p => p.id !== robot.id && p.alive && p.x === nextX && p.y === nextY);
      if (otherRobot) {
        chain.push(otherRobot);
        curX = nextX;
        curY = nextY;
      } else {
        // Celda vacía encontrada (puede ser piso, cinta, o pit)
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

    return {
      success: true,
      movedRobots,
      destroyedRobots
    };
  }

  /**
   * Ejecuta un disparo láser en línea recta desde (fromX, fromY) en dirección dir
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

      // Choca con muro
      if (grid[curY][curX] === TILE_TYPES.WALL) {
        hitWall = true;
        break;
      }

      // Choca con un robot vivo
      const target = players.find(p => p.alive && p.x === curX && p.y === curY && p.id !== shooterId);
      if (target) {
        hitRobot = target;
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
   * Resuelve 1 Paso Completo (Paso 0 a 3) de manera determinista y registra
   * todos los eventos para la animación en la TV.
   */
  function executeStep(state, stepIndex) {
    const grid = state.arena.grid;
    const players = state.players;
    const stepEvents = {
      stepIndex,
      subStepA_Cards: [],
      subStepB_Conveyors: [],
      subStepC_Gears: [],
      subStepD_Lasers: [],
      subStepE_CheckpointsRepair: [],
      destroyedInStep: [],
      winner: null
    };

    // Reiniciar escudos activos al inicio del paso
    for (const p of players) {
      p.shieldActive = false;
    }

    // =========================================================================
    // SUB-PASO A: Cartas de los Robots por Prioridad (Mayor a Menor)
    // =========================================================================
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

      const cardResult = {
        playerId: p.id,
        playerName: p.name,
        playerColor: p.color,
        card,
        actions: []
      };

      if (card.type === 'forward_1' || card.type === 'forward_2' || card.type === 'forward_3') {
        const moves = card.type === 'forward_1' ? 1 : card.type === 'forward_2' ? 2 : 3;
        for (let m = 0; m < moves; m++) {
          if (!p.alive) break;
          const moveRes = tryMoveRobotInDirection(grid, players, p.id, p.facing);
          cardResult.actions.push({
            actionType: 'move_forward',
            subMove: m + 1,
            success: moveRes.success,
            movedRobots: moveRes.movedRobots,
            destroyedRobots: moveRes.destroyedRobots
          });
          if (moveRes.destroyedRobots && moveRes.destroyedRobots.length > 0) {
            stepEvents.destroyedInStep.push(...moveRes.destroyedRobots);
          }
          if (!moveRes.success) break; // Bloqueado
        }
      } else if (card.type === 'backward_1') {
        // Retroceder 1 casilla sin cambiar la dirección a la que mira
        const backDir = (p.facing + 2) % 4;
        const moveRes = tryMoveRobotInDirection(grid, players, p.id, backDir);
        cardResult.actions.push({
          actionType: 'move_backward',
          success: moveRes.success,
          movedRobots: moveRes.movedRobots,
          destroyedRobots: moveRes.destroyedRobots
        });
        if (moveRes.destroyedRobots && moveRes.destroyedRobots.length > 0) {
          stepEvents.destroyedInStep.push(...moveRes.destroyedRobots);
        }
      } else if (card.type === 'turn_cw') {
        p.facing = turnDirection(p.facing, 90);
        cardResult.actions.push({ actionType: 'turn', angle: 90, newFacing: p.facing });
      } else if (card.type === 'turn_ccw') {
        p.facing = turnDirection(p.facing, -90);
        cardResult.actions.push({ actionType: 'turn', angle: -90, newFacing: p.facing });
      } else if (card.type === 'u_turn') {
        p.facing = turnDirection(p.facing, 180);
        cardResult.actions.push({ actionType: 'turn', angle: 180, newFacing: p.facing });
      } else if (card.type === 'overload') {
        // SobreCarga: Disparo frontal potente de 2 HP + empuje
        const ray = traceLaserRay(grid, players, p.x, p.y, p.facing, p.id);
        const actionObj = {
          actionType: 'overload_laser',
          rayPath: ray.path,
          hitRobotId: ray.hitRobot ? ray.hitRobot.id : null,
          damageDealt: 0,
          pushedResult: null
        };

        if (ray.hitRobot && ray.hitRobot.alive) {
          const target = ray.hitRobot;
          p.stats.lasersHit++;
          if (target.shieldActive) {
            actionObj.damageDealt = 0;
            actionObj.shieldBlocked = true;
          } else {
            actionObj.damageDealt = 2;
            p.stats.damageDealt += 2;
            target.hp = Math.max(0, target.hp - 2);
            if (target.hp === 0) {
              target.alive = false;
              target.stats.timesDestroyed++;
              stepEvents.destroyedInStep.push({
                id: target.id,
                name: target.name,
                color: target.color,
                reason: 'laser_damage',
                x: target.x,
                y: target.y
              });
            }
          }

          // Empujar al robot impactado 1 casilla en la dirección del láser
          if (target.alive) {
            const pushRes = tryMoveRobotInDirection(grid, players, target.id, p.facing);
            actionObj.pushedResult = pushRes;
            if (pushRes.destroyedRobots && pushRes.destroyedRobots.length > 0) {
              stepEvents.destroyedInStep.push(...pushRes.destroyedRobots);
            }
          }
        }
        cardResult.actions.push(actionObj);
      } else if (card.type === 'shield_repair') {
        p.shieldActive = true;
        const healed = p.hp < p.maxHp;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        cardResult.actions.push({
          actionType: 'shield_repair',
          shieldActive: true,
          hp: p.hp,
          healed
        });
      }

      stepEvents.subStepA_Cards.push(cardResult);
    }

    // =========================================================================
    // SUB-PASO B: Cintas Transportadoras
    // =========================================================================
    const conveyorMoves = [];
    const conveyorDirMap = {
      [TILE_TYPES.CONVEYOR_N]: 0,
      [TILE_TYPES.CONVEYOR_E]: 1,
      [TILE_TYPES.CONVEYOR_S]: 2,
      [TILE_TYPES.CONVEYOR_W]: 3
    };

    // Identificar robots en cintas
    for (const p of players) {
      if (!p.alive) continue;
      const tile = grid[p.y][p.x];
      if (conveyorDirMap[tile] !== undefined) {
        conveyorMoves.push({
          player: p,
          dir: conveyorDirMap[tile]
        });
      }
    }

    for (const cm of conveyorMoves) {
      if (!cm.player.alive) continue;
      const moveRes = tryMoveRobotInDirection(grid, players, cm.player.id, cm.dir);
      if (moveRes.success) {
        stepEvents.subStepB_Conveyors.push({
          playerId: cm.player.id,
          dir: cm.dir,
          movedRobots: moveRes.movedRobots,
          destroyedRobots: moveRes.destroyedRobots
        });
        if (moveRes.destroyedRobots && moveRes.destroyedRobots.length > 0) {
          stepEvents.destroyedInStep.push(...moveRes.destroyedRobots);
        }
      }
    }

    // =========================================================================
    // SUB-PASO C: Engranajes Giratorios
    // =========================================================================
    for (const p of players) {
      if (!p.alive) continue;
      const tile = grid[p.y][p.x];
      if (tile === TILE_TYPES.GEAR_CW) {
        p.facing = turnDirection(p.facing, 90);
        stepEvents.subStepC_Gears.push({
          playerId: p.id,
          type: 'gear_cw',
          angle: 90,
          newFacing: p.facing
        });
      } else if (tile === TILE_TYPES.GEAR_CCW) {
        p.facing = turnDirection(p.facing, -90);
        stepEvents.subStepC_Gears.push({
          playerId: p.id,
          type: 'gear_ccw',
          angle: -90,
          newFacing: p.facing
        });
      }
    }

    // =========================================================================
    // SUB-PASO D: Láseres Automáticos (Torretas Fijas + Robots)
    // =========================================================================
    const turretDirMap = {
      [TILE_TYPES.TURRET_N]: 0,
      [TILE_TYPES.TURRET_E]: 1,
      [TILE_TYPES.TURRET_S]: 2,
      [TILE_TYPES.TURRET_W]: 3
    };

    // 1. Torretas Fijas
    const height = grid.length;
    const width = grid[0].length;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (turretDirMap[tile] !== undefined) {
          const dir = turretDirMap[tile];
          const ray = traceLaserRay(grid, players, x, y, dir, null);
          const laserEvent = {
            sourceType: 'turret',
            fromX: x,
            fromY: y,
            dir,
            path: ray.path,
            hitRobotId: ray.hitRobot ? ray.hitRobot.id : null,
            damageDealt: 0
          };

          if (ray.hitRobot && ray.hitRobot.alive) {
            const target = ray.hitRobot;
            if (target.shieldActive) {
              laserEvent.shieldBlocked = true;
            } else {
              target.hp = Math.max(0, target.hp - 1);
              laserEvent.damageDealt = 1;
              if (target.hp === 0) {
                target.alive = false;
                target.stats.timesDestroyed++;
                stepEvents.destroyedInStep.push({
                  id: target.id,
                  name: target.name,
                  color: target.color,
                  reason: 'turret_laser',
                  x: target.x,
                  y: target.y
                });
              }
            }
          }
          stepEvents.subStepD_Lasers.push(laserEvent);
        }
      }
    }

    // 2. Láseres frontales de los robots vivos
    const robotLaserEvents = [];
    for (const p of players) {
      if (!p.alive) continue;
      const ray = traceLaserRay(grid, players, p.x, p.y, p.facing, p.id);
      robotLaserEvents.push({
        sourceType: 'robot',
        shooterId: p.id,
        shooterName: p.name,
        fromX: p.x,
        fromY: p.y,
        dir: p.facing,
        path: ray.path,
        hitRobot: ray.hitRobot,
        damageDealt: 0
      });
    }

    // Aplicar daños simultáneos de robots
    for (const rLaser of robotLaserEvents) {
      if (rLaser.hitRobot && rLaser.hitRobot.alive) {
        const target = rLaser.hitRobot;
        const shooter = players.find(p => p.id === rLaser.shooterId);
        if (shooter) shooter.stats.lasersHit++;

        if (target.shieldActive) {
          rLaser.shieldBlocked = true;
        } else {
          rLaser.damageDealt = 1;
          if (shooter) shooter.stats.damageDealt += 1;
          target.hp = Math.max(0, target.hp - 1);
          if (target.hp === 0) {
            target.alive = false;
            target.stats.timesDestroyed++;
            stepEvents.destroyedInStep.push({
              id: target.id,
              name: target.name,
              color: target.color,
              reason: 'robot_laser',
              x: target.x,
              y: target.y
            });
          }
        }
      }
      stepEvents.subStepD_Lasers.push({
        sourceType: 'robot',
        shooterId: rLaser.shooterId,
        fromX: rLaser.fromX,
        fromY: rLaser.fromY,
        dir: rLaser.dir,
        path: rLaser.path,
        hitRobotId: rLaser.hitRobot ? rLaser.hitRobot.id : null,
        damageDealt: rLaser.damageDealt,
        shieldBlocked: rLaser.shieldBlocked
      });
    }

    // =========================================================================
    // SUB-PASO E: Checkpoints y Estaciones de Reparación
    // =========================================================================
    for (const p of players) {
      if (!p.alive) continue;
      const tile = grid[p.y][p.x];

      // Checkpoints en orden secuencial (1 -> 2 -> 3)
      if (tile === TILE_TYPES.CP_1 && p.lastCheckpoint === 0) {
        p.lastCheckpoint = 1;
        p.stats.checkpointsReached++;
        stepEvents.subStepE_CheckpointsRepair.push({
          playerId: p.id,
          playerName: p.name,
          type: 'checkpoint',
          checkpointId: 1,
          x: p.x,
          y: p.y
        });
      } else if (tile === TILE_TYPES.CP_2 && p.lastCheckpoint === 1) {
        p.lastCheckpoint = 2;
        p.stats.checkpointsReached++;
        stepEvents.subStepE_CheckpointsRepair.push({
          playerId: p.id,
          playerName: p.name,
          type: 'checkpoint',
          checkpointId: 2,
          x: p.x,
          y: p.y
        });
      } else if (tile === TILE_TYPES.CP_3 && p.lastCheckpoint === 2) {
        p.lastCheckpoint = 3;
        p.stats.checkpointsReached++;
        stepEvents.subStepE_CheckpointsRepair.push({
          playerId: p.id,
          playerName: p.name,
          type: 'checkpoint',
          checkpointId: 3,
          x: p.x,
          y: p.y
        });
        // ¡Victoria!
        state.winner = p;
        stepEvents.winner = {
          id: p.id,
          name: p.name,
          color: p.color
        };
      }

      // Estación de reparación (+1 HP, máx 5)
      if (tile === TILE_TYPES.REPAIR && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + 1);
        stepEvents.subStepE_CheckpointsRepair.push({
          playerId: p.id,
          playerName: p.name,
          type: 'repair',
          newHp: p.hp,
          x: p.x,
          y: p.y
        });
      }
    }

    return stepEvents;
  }

  /**
   * Finaliza una ronda, reaparece a los robots destruidos y prepara la siguiente
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
                  if (tile !== TILE_TYPES.WALL && tile !== TILE_TYPES.PIT && !isOccupied(nx, ny)) {
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

    // Repartir cartas y aplicar bloqueos tácticos
    dealRoundCards(state);
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
