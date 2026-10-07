/**
 * Sistema de coordenadas do setup (usado em TODA a aplicação):
 *
 *   X = esquerda (−) / direita (+), visto por trás da câmera (posição do operador)
 *   Y = trás (−) / frente (+); a lente aponta para +Y
 *   Z = baixo (−) / cima (+)
 *
 * Unidades internas: massa em gramas (g), distância em milímetros (mm),
 * ângulos em graus (°). Conversões existem apenas na camada de apresentação.
 */
export type Vec3 = { x: number; y: number; z: number };

/** Rotação em graus, ordem intrínseca XYZ (mesma convenção do Three.js). */
export type EulerDeg = { x: number; y: number; z: number };

export type Dimensions = {
  /** Extensão em X (mm) */
  width: number;
  /** Extensão em Z (mm) */
  height: number;
  /** Extensão em Y (mm) — para lentes, o comprimento */
  depth: number;
};

export type Range = { min: number; max: number };

export const ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 }) as Vec3;
