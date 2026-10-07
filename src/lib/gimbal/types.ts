import type { DataSource } from "@/lib/equipment/types";
import type { Range } from "@/types/geometry";

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
  mountingSystem?: string;
  dimensions?: { width: number; height: number; depth: number };
  custom?: boolean;
};
