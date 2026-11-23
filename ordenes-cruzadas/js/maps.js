/**
 * Órdenes Cruzadas - Definición de Mapas y Arenas Tácticas
 * Grilla estándar: 10 columnas (x: 0..9) x 8 filas (y: 0..7) = 80 casillas
 *
 * Orientaciones:
 * 0: Norte (▲, dy: -1, dx: 0)
 * 1: Este  (▶, dy: 0,  dx: 1)
 * 2: Sur   (▼, dy: 1,  dx: 0)
 * 3: Oeste (◀, dy: 0,  dx: -1)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ARENAS_DATA = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Helper para verificar tipos de casillas
  const TILE_TYPES = {
    FLOOR: 'floor',
    WALL: 'wall',
    PIT: 'pit',
    CONVEYOR_N: 'conveyor_N',
    CONVEYOR_E: 'conveyor_E',
    CONVEYOR_S: 'conveyor_S',
    CONVEYOR_W: 'conveyor_W',
    GEAR_CW: 'gear_cw',
    GEAR_CCW: 'gear_ccw',
    TURRET_N: 'laser_turret_N',
    TURRET_E: 'laser_turret_E',
    TURRET_S: 'laser_turret_S',
    TURRET_W: 'laser_turret_W',
    REPAIR: 'repair',
    CP_1: 'cp_1',
    CP_2: 'cp_2',
    CP_3: 'cp_3',
    SPAWN_1: 'spawn_1',
    SPAWN_2: 'spawn_2',
    SPAWN_3: 'spawn_3',
    SPAWN_4: 'spawn_4',
    SPAWN_5: 'spawn_5',
    SPAWN_6: 'spawn_6'
  };

  function isSolidObstacle(tile) {
    if (!tile) return true;
    if (tile === 'wall' || tile === TILE_TYPES.WALL) return true;
    if (typeof tile === 'string' && tile.startsWith('laser_turret_')) return true;
    return false;
  }

  /**
   * 1. FÁBRICA CENTRAL (Equilibrado - Por Defecto)
   * Cintas transportadoras moderadas, 2 abismos centrales, muros tácticos de cobertura,
   * 2 estaciones de reparación y 3 checkpoints estratégicos.
   */
  const FABRICA_GRID = [
    // y=0: Muro superior con torreta y pasillos
    ['wall', 'floor',      'repair',     'conveyor_E', 'conveyor_E', 'conveyor_E', 'floor',      'cp_3',       'floor',      'wall'],
    // y=1:
    ['floor','conveyor_N', 'wall',       'floor',      'floor',      'floor',      'floor',      'wall',       'conveyor_S', 'floor'],
    // y=2: Checkpoint 2 a la izquierda, engranajes y torreta
    ['floor','cp_2',       'laser_turret_E','floor',   'gear_cw',    'gear_ccw',   'floor',      'laser_turret_W','floor',  'floor'],
    // y=3: Centro con 2 abismos rodeados de cintas
    ['conveyor_N','floor', 'floor',      'conveyor_E', 'pit',        'pit',        'conveyor_W', 'floor',      'floor',      'conveyor_S'],
    // y=4: Pasarela central con reparación
    ['conveyor_N','floor', 'wall',       'conveyor_E', 'floor',      'floor',      'conveyor_W', 'wall',       'floor',      'conveyor_S'],
    // y=5: Checkpoint 1 accesible en cuadrante inferior
    ['floor','repair',     'floor',      'floor',      'cp_1',       'floor',      'floor',      'floor',      'repair',     'floor'],
    // y=6: Pasillo previo a spawns
    ['floor','floor',      'conveyor_W', 'conveyor_W', 'floor',      'floor',      'conveyor_E', 'conveyor_E', 'floor',      'floor'],
    // y=7: Muelles de Salida para los 6 jugadores
    ['spawn_5','spawn_1',  'floor',      'spawn_2',    'wall',       'wall',       'spawn_3',    'floor',      'spawn_4',    'spawn_6']
  ];

  /**
   * 2. PUENTE SOBRE EL ABISMO (Caótico / Empujes)
   * Pasarelas estrechas rodeadas de lava/abismos donde empujar rivales es letal.
   * Modificado para garantizar fluidez desde CP1 hacia CP2 sin cintas en contramano.
   */
  const ABISMO_GRID = [
    // y=0: Plataforma norte con Checkpoint 3
    ['pit',   'pit',   'floor',      'conveyor_E', 'cp_3',       'repair',     'conveyor_W', 'floor',      'pit',   'pit'],
    // y=1: Conectores a la plataforma norte
    ['pit',   'pit',   'laser_turret_S','pit',     'floor',      'floor',      'pit',        'laser_turret_S','pit', 'pit'],
    // y=2: Puente medio norte con Checkpoint 2 (cinta OESTE hacia cp_2 en x=3)
    ['floor', 'cp_2',  'floor',      'conveyor_W', 'gear_cw',    'gear_ccw',   'conveyor_E', 'floor',      'floor', 'floor'],
    // y=3: Pasarela central estrecha sobre el abismo
    ['pit',   'pit',   'pit',        'wall',       'floor',      'floor',      'wall',       'pit',        'pit',   'pit'],
    // y=4: Pasarela central con Checkpoint 1
    ['pit',   'repair','conveyor_E', 'floor',      'cp_1',       'floor',      'floor',      'conveyor_W', 'repair','pit'],
    // y=5: Cruce sobre abismo
    ['pit',   'pit',   'pit',        'floor',      'gear_ccw',   'gear_cw',    'floor',      'pit',        'pit',   'pit'],
    // y=6: Plataforma de acceso a spawns
    ['floor', 'conveyor_E','conveyor_E','floor',   'floor',      'floor',      'floor',      'conveyor_W', 'conveyor_W','floor'],
    // y=7: Spawns en plataforma sur segura
    ['spawn_1','spawn_2',  'floor',  'spawn_3',    'wall',       'wall',       'spawn_4',    'floor',      'spawn_5',  'spawn_6']
  ];

  /**
   * 3. CIRCUITO TURBO (Alta Velocidad)
   * Autopistas perimetrales e internas de cintas transportadoras, torretas cruzadas
   * y engranajes rápidos.
   */
  const TURBO_GRID = [
    // y=0: Autopista norte hacia el Este
    ['wall',      'conveyor_E','conveyor_E','conveyor_E','conveyor_E','conveyor_E','conveyor_E','conveyor_E','cp_3',       'wall'],
    // y=1:
    ['conveyor_N','laser_turret_E','floor', 'floor',      'repair',   'wall',       'floor',      'floor',     'laser_turret_W','conveyor_S'],
    // y=2: Autopista interna
    ['conveyor_N','floor',      'conveyor_E','conveyor_E','gear_cw',   'gear_ccw',   'conveyor_S', 'floor',     'floor',      'conveyor_S'],
    // y=3: Checkpoint 2 en bucle medio
    ['conveyor_N','cp_2',       'conveyor_N','wall',       'pit',      'pit',        'conveyor_S', 'wall',      'floor',      'conveyor_S'],
    // y=4: Cruce central
    ['conveyor_N','floor',      'conveyor_N','repair',     'gear_ccw', 'gear_cw',    'conveyor_S', 'repair',    'floor',      'conveyor_S'],
    // y=5: Checkpoint 1 en zona de aceleración
    ['conveyor_N','floor',      'floor',     'conveyor_W', 'cp_1',     'conveyor_W', 'conveyor_W', 'floor',     'floor',      'conveyor_S'],
    // y=6: Pasillo sur
    ['conveyor_N','laser_turret_E','floor',  'floor',      'wall',     'wall',       'floor',      'floor',     'laser_turret_W','conveyor_S'],
    // y=7: Autopista sur con muelles de salida
    ['spawn_1',   'spawn_2',    'conveyor_E','spawn_3',    'floor',    'floor',      'spawn_4',    'conveyor_W','spawn_5',   'spawn_6']
  ];

  const ARENAS = {
    fabrica: {
      id: 'fabrica',
      name: '🏭 Fábrica Central',
      subtitle: 'Equilibrado & Táctico',
      description: 'Cintas transportadoras moderadas, 2 abismos centrales, muros de cobertura y 3 checkpoints.',
      width: 10,
      height: 8,
      grid: FABRICA_GRID,
      spawns: [
        { id: 1, x: 1, y: 7, facing: 0 },
        { id: 2, x: 3, y: 7, facing: 0 },
        { id: 3, x: 6, y: 7, facing: 0 },
        { id: 4, x: 8, y: 7, facing: 0 },
        { id: 5, x: 0, y: 7, facing: 0 },
        { id: 6, x: 9, y: 7, facing: 0 }
      ],
      checkpoints: [
        { id: 1, x: 4, y: 5 },
        { id: 2, x: 1, y: 2 },
        { id: 3, x: 7, y: 0 }
      ]
    },
    abismo: {
      id: 'abismo',
      name: '🌋 Puente sobre el Abismo',
      subtitle: 'Caótico & Empujes Letales',
      description: 'Pasarelas estrechas sobre lava donde empujar rivales es letal. Camino fluido entre checkpoints.',
      width: 10,
      height: 8,
      grid: ABISMO_GRID,
      spawns: [
        { id: 1, x: 0, y: 7, facing: 0 },
        { id: 2, x: 1, y: 7, facing: 0 },
        { id: 3, x: 3, y: 7, facing: 0 },
        { id: 4, x: 6, y: 7, facing: 0 },
        { id: 5, x: 8, y: 7, facing: 0 },
        { id: 6, x: 9, y: 7, facing: 0 }
      ],
      checkpoints: [
        { id: 1, x: 4, y: 4 },
        { id: 2, x: 1, y: 2 },
        { id: 3, x: 4, y: 0 }
      ]
    },
    turbo: {
      id: 'turbo',
      name: '⚡ Circuito Turbo',
      subtitle: 'Alta Velocidad & Láseres',
      description: 'Autopistas de cintas transportadoras, plataformas giratorias y torretas láser cruzadas.',
      width: 10,
      height: 8,
      grid: TURBO_GRID,
      spawns: [
        { id: 1, x: 0, y: 7, facing: 0 },
        { id: 2, x: 1, y: 7, facing: 0 },
        { id: 3, x: 3, y: 7, facing: 0 },
        { id: 4, x: 6, y: 7, facing: 0 },
        { id: 5, x: 8, y: 7, facing: 0 },
        { id: 6, x: 9, y: 7, facing: 0 }
      ],
      checkpoints: [
        { id: 1, x: 4, y: 5 },
        { id: 2, x: 1, y: 3 },
        { id: 3, x: 8, y: 0 }
      ]
    }
  };

  return {
    TILE_TYPES,
    isSolidObstacle,
    ARENAS,
    DEFAULT_ARENA_ID: 'fabrica'
  };
});
