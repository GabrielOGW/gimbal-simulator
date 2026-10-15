import type { DataSource } from "@/lib/equipment/types";
import type { Range, Vec3 } from "@/types/geometry";

/**
 * Ajustes mecânicos de balanceamento, em mm. Modelo de gimbal de 3 eixos
 * com eixos ortogonais, onde tilt (eixo X) e roll (eixo Y) se cruzam no
 * "pivô" — a origem do referencial do gimbal.
 *
 * - plate:  deslize frente/trás da câmera na placa (move a carga em Y em relação ao eixo tilt)
 * - height: distância vertical do topo da placa até o eixo tilt (a carga fica em Z = −height)
 * - roll:   deslize lateral do braço horizontal (move a carga em X em relação ao eixo roll)
 * - pan:    deslize do braço vertical (desloca o conjunto em Y em relação ao eixo pan)
 */
export type AdjustmentKey = "plate" | "height" | "roll" | "pan";

export type GimbalAdjustments = Record<AdjustmentKey, number>;

export type AxisName = "pan" | "tilt" | "roll";

export type AxisConfig = {
  /** Limite mecânico de rotação em graus; null = rotação contínua (360°). */
  rotationLimitDeg: Range | null;
};

/** Massa (g) e centro de massa (mm) de um conjunto móvel do gimbal. */
export type MovingMass = { mass: number; com: Vec3 };

/**
 * Partes móveis do gimbal, agrupadas pelo eixo em que giram. Cada `com` está
 * no referencial do pivô (com os ajustes em zero) e acompanha os ajustes que
 * movem aquele conjunto:
 *
 * - tilt: morsa + braço em L. Gira no eixo tilt com a carga. É relativo ao
 *   ponto de montagem da carga sem a placa, (roll, 0, −height): anda com o roll
 *   e com a altura, mas não com a placa — a placa de engate rápido é item do
 *   catálogo e já entra na carga.
 * - roll: motor tilt + braço horizontal. Gira no eixo roll. Relativo a
 *   (roll, 0, 0): o braço desliza no motor roll levando o motor tilt junto.
 * - pan: motor roll + braço vertical. Gira no eixo pan. Fixo no referencial do
 *   pivô (o ajuste pan move o eixo pan, não o conjunto).
 */
export type GimbalMovingMasses = {
  tilt: MovingMass;
  roll: MovingMass;
  pan: MovingMass;
  source: DataSource;
};

export type Gimbal = {
  id: string;
  name: string;
  brand?: string;
  /** Massa do próprio gimbal (g), informativa — não entra no payload. */
  weight?: number;
  /** Faixa de carga útil em gramas */
  payload: { minimum: number; maximum: number };
  payloadSource: DataSource;
  axes: Record<AxisName, AxisConfig>;
  /** Curso de cada ajuste mecânico (mm) */
  adjustmentRanges: Record<AdjustmentKey, Range>;
  /**
   * Geometria simplificada usada para desenhar o gimbal e checar
   * interferências. Quase sempre estimada.
   */
  geometry: {
    /** Distância do eixo roll (centro) à face interna do braço do tilt (mm) */
    tiltArmInnerX: number;
    /** Distância do eixo tilt até a face frontal do motor roll, atrás da carga (mm) */
    rearClearance: number;
    /** Comprimento útil da placa de engate rápido (mm) */
    plateLength: number;
  };
  geometrySource: DataSource;
  /** Massas das partes móveis. Ausente = gimbal sem massa (modelo antigo). */
  movingMasses?: GimbalMovingMasses;
  mountingSystem?: string;
  dimensions?: { width: number; height: number; depth: number };
  custom?: boolean;
};
