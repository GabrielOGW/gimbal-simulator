import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { GimbalPose, ResolvedItem, SimulationSettings } from "@/lib/setup/types";
import type { Vec3 } from "@/types/geometry";
import { evaluateBalance, gimbalBodies, toPivotFrame, type BalanceResult } from "./balance";
import { calculateCenterOfMass, calculateTotalMass, itemUsesGeometricCenter, toMassPoints } from "./centerOfMass";
import { checkClearance, type ClearanceIssue } from "./clearance";
import { rotatedBoxBounds, unionBounds, type Bounds } from "./geometry";
import { evaluatePayload, type PayloadEvaluation } from "./payload";
import { torqueAtPose, type PoseTorque } from "./statics";

export type SetupAnalysis = {
  totalMass: number;
  /** CM no referencial da carga (mm); null se setup vazio */
  centerOfMass: Vec3 | null;
  /** Itens cujo CM é estimado pelo centro geométrico */
  estimatedComCount: number;
  /** Itens com peso/dimensões não oficiais */
  nonOfficialCount: number;
  bounds: Bounds | null;
  payload: PayloadEvaluation | null;
  balance: BalanceResult | null;
  poseTorque: PoseTorque | null;
  clearance: ClearanceIssue[];
};

export function payloadBounds(items: readonly ResolvedItem[]): Bounds | null {
  return unionBounds(items.map((i) => rotatedBoxBounds(i.position, i.equipment.dimensions, i.rotation)));
}

/** Ponto de entrada único da simulação — a UI só chama esta função. */
export function analyzeSetup(
  items: readonly ResolvedItem[],
  gimbal: Gimbal | null,
  adjustments: GimbalAdjustments,
  pose: GimbalPose,
  settings: SimulationSettings,
): SetupAnalysis {
  const points = toMassPoints(items);
  const totalMass = calculateTotalMass(points);
  const centerOfMass = calculateCenterOfMass(points);
  const bounds = payloadBounds(items);

  const payload = gimbal ? evaluatePayload(totalMass, gimbal.payload, settings.safetyMargin) : null;
  const balance =
    gimbal && centerOfMass
      ? evaluateBalance(centerOfMass, totalMass, adjustments, gimbal, settings.balanceTolerance)
      : null;
  const poseTorque =
    gimbal && centerOfMass
      ? torqueAtPose(toPivotFrame(centerOfMass, adjustments), totalMass, pose, gimbalBodies(gimbal, adjustments))
      : null;

  return {
    totalMass,
    centerOfMass,
    estimatedComCount: items.filter(itemUsesGeometricCenter).length,
    nonOfficialCount: items.filter((i) => i.equipment.source.kind !== "official").length,
    bounds,
    payload,
    balance,
    poseTorque,
    clearance: gimbal ? checkClearance(bounds, adjustments, gimbal) : [],
  };
}
