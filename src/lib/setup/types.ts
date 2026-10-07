import type { Equipment } from "@/lib/equipment/types";
import type { GimbalAdjustments } from "@/lib/gimbal/types";
import type { EulerDeg, Vec3 } from "@/types/geometry";

/**
 * Referencial da carga ("payload frame"): origem no centro da base da
 * câmera, onde ela encosta na placa de engate rápido. Mesmos eixos X/Y/Z
 * descritos em types/geometry.ts.
 */
export type SetupItem = {
  /** Id da instância (o mesmo equipamento pode aparecer mais de uma vez) */
  instanceId: string;
  equipmentId: string;
  /** Centro geométrico do equipamento no referencial da carga (mm) */
  position: Vec3;
  /** Rotação do equipamento em torno do seu centro geométrico (graus) */
  rotation: EulerDeg;
};

/** Orientação simulada do gimbal (graus) — usada para estimar torque estático. */
export type GimbalPose = { pan: number; tilt: number; roll: number };

export type Setup = {
  id: string;
  name: string;
  gimbalId: string | null;
  items: SetupItem[];
  adjustments: GimbalAdjustments;
  pose: GimbalPose;
  createdAt: string;
  updatedAt: string;
};

/** Item com o equipamento resolvido a partir do catálogo. */
export type ResolvedItem = SetupItem & { equipment: Equipment };

export type SimulationSettings = {
  /** Margem de segurança sobre a carga máxima nominal (0–0.9). Ex.: 0.1 = 10% */
  safetyMargin: number;
  /** Resíduo máximo (mm) para considerar um eixo balanceado */
  balanceTolerance: number;
};

export const DEFAULT_SETTINGS: SimulationSettings = {
  safetyMargin: 0.1,
  balanceTolerance: 2,
};
