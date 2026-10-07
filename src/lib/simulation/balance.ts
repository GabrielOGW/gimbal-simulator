import type { AdjustmentKey, AxisName, Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { Range, Vec3 } from "@/types/geometry";
import { add, vec } from "./geometry";

/**
 * MODELO DE BALANCEAMENTO (estimativa geométrica estática)
 *
 * Referencial do gimbal ("pivot frame"): origem no cruzamento dos eixos
 * tilt (paralelo a X) e roll (paralelo a Y). O eixo pan é vertical (Z),
 * posicionado em y = −pan.
 *
 * A carga (câmera + acessórios) é montada com a origem do seu referencial
 * em  (roll, plate, −height)  no referencial do gimbal.
 *
 * Um eixo está balanceado quando o CM da carga está SOBRE ele:
 *  - Tilt (eixo X): CM com y = 0 e z = 0   → corrigido por `plate` (Y) e `height` (Z)
 *  - Roll (eixo Y): CM com x = 0           → corrigido por `roll` (X)
 *                   (o desvio em z também gera torque no roll; é corrigido no tilt)
 *  - Pan  (eixo Z): CM com x = 0 e y = −pan → corrigido por `pan` (Y)
 *                   (só gera torque quando o gimbal é inclinado/fora da vertical)
 *
 * Limitações conhecidas (exibidas na UI):
 *  - massa e inércia das partes móveis do próprio gimbal (motores, braços) são ignoradas;
 *  - eixos são considerados perfeitamente ortogonais e concorrentes;
 *  - o resultado depende da precisão de peso, dimensões e CM informados.
 */

export const GRAVITY = 9.80665;

export type AxisStatus = "ok" | "adjust" | "out_of_range" | "no_data";

export type Correction = {
  key: AdjustmentKey;
  /** Eixo cartesiano movido por esse ajuste */
  direction: "x" | "y" | "z";
  current: number;
  /** Valor ideal (pode estar fora do curso do gimbal) */
  ideal: number;
  /** Valor recomendado, limitado ao curso mecânico */
  recommended: number;
  /** recomendado − atual (mm) */
  delta: number;
  range: Range;
  withinRange: boolean;
};

export type AxisBalance = {
  axis: AxisName;
  status: AxisStatus;
  /** Distância (mm) do CM ao eixo nas direções que esse eixo corrige */
  residual: number;
  /** Componentes do desvio (mm) */
  offset: Partial<Vec3>;
  corrections: Correction[];
  /** Torque gravitacional máximo estimado com o desvio atual (N·m) */
  worstCaseTorque: number;
  /** Desvio residual se as correções recomendadas forem aplicadas (mm) */
  residualAfter: number;
};

export type BalanceResult = {
  /** CM da carga no referencial do gimbal (mm) */
  comPivot: Vec3;
  axes: Record<AxisName, AxisBalance>;
  recommendedAdjustments: GimbalAdjustments;
};

export const payloadOrigin = (adj: GimbalAdjustments): Vec3 => vec(adj.roll, adj.plate, -adj.height);

export const toPivotFrame = (pPayload: Vec3, adj: GimbalAdjustments): Vec3 =>
  add(pPayload, payloadOrigin(adj));

export const clamp = (v: number, r: Range) => Math.min(r.max, Math.max(r.min, v));

const round = (v: number, digits = 2) => {
  const k = 10 ** digits;
  const r = Math.round(v * k) / k;
  return Object.is(r, -0) ? 0 : r;
};

function correction(
  key: AdjustmentKey,
  direction: Correction["direction"],
  current: number,
  ideal: number,
  range: Range,
): Correction {
  const recommended = clamp(ideal, range);
  return {
    key,
    direction,
    current,
    ideal: round(ideal),
    recommended: round(recommended),
    delta: round(recommended - current),
    range,
    withinRange: ideal >= range.min - 1e-9 && ideal <= range.max + 1e-9,
  };
}

function statusFor(residual: number, tolerance: number, corrections: Correction[]): AxisStatus {
  if (residual <= tolerance) return "ok";
  return corrections.every((c) => c.withinRange) ? "adjust" : "out_of_range";
}

const torque = (massG: number, distMm: number) => (massG / 1000) * GRAVITY * (distMm / 1000);

/**
 * Avalia o balanceamento a partir do CM da carga (referencial da carga),
 * massa total (g), ajustes atuais e cursos do gimbal.
 *
 * As recomendações seguem a ordem real de balanceamento: tilt (altura, depois
 * frente/trás) → roll → pan. Cada etapa considera o resultado (limitado ao curso)
 * da anterior.
 */
export function evaluateBalance(
  comPayload: Vec3,
  totalMass: number,
  adj: GimbalAdjustments,
  gimbal: Pick<Gimbal, "adjustmentRanges">,
  tolerance: number,
): BalanceResult {
  if (!(tolerance >= 0)) throw new RangeError(`Tolerância inválida: ${tolerance}`);
  const ranges = gimbal.adjustmentRanges;
  const c = toPivotFrame(comPayload, adj);

  // --- Tilt ---------------------------------------------------------------
  const height = correction("height", "z", adj.height, comPayload.z, ranges.height);
  const plate = correction("plate", "y", adj.plate, -comPayload.y, ranges.plate);
  const tiltResidual = Math.hypot(c.y, c.z);
  const yAfterTilt = comPayload.y + plate.recommended;
  const zAfterTilt = comPayload.z - height.recommended;
  const tilt: AxisBalance = {
    axis: "tilt",
    status: statusFor(tiltResidual, tolerance, [height, plate]),
    residual: round(tiltResidual),
    offset: { y: round(c.y), z: round(c.z) },
    corrections: [height, plate],
    worstCaseTorque: torque(totalMass, tiltResidual),
    residualAfter: round(Math.hypot(yAfterTilt, zAfterTilt)),
  };

  // --- Roll ---------------------------------------------------------------
  const rollC = correction("roll", "x", adj.roll, -comPayload.x, ranges.roll);
  const rollResidual = Math.abs(c.x);
  const xAfterRoll = comPayload.x + rollC.recommended;
  const roll: AxisBalance = {
    axis: "roll",
    status: statusFor(rollResidual, tolerance, [rollC]),
    residual: round(rollResidual),
    offset: { x: round(c.x), z: round(c.z) },
    corrections: [rollC],
    worstCaseTorque: torque(totalMass, Math.hypot(c.x, c.z)),
    residualAfter: round(Math.abs(xAfterRoll)),
  };

  // --- Pan ----------------------------------------------------------------
  // Distância horizontal do CM ao eixo pan. O ajuste pan só atua em Y;
  // o desvio em X é herdado do roll.
  const panY = c.y + adj.pan;
  const panC = correction("pan", "y", adj.pan, -yAfterTilt, ranges.pan);
  const panResidual = Math.hypot(c.x, panY);
  const pan: AxisBalance = {
    axis: "pan",
    status: statusFor(panResidual, tolerance, [panC]),
    residual: round(panResidual),
    offset: { x: round(c.x), y: round(panY) },
    corrections: [panC],
    worstCaseTorque: torque(totalMass, panResidual),
    residualAfter: round(Math.hypot(xAfterRoll, yAfterTilt + panC.recommended)),
  };

  return {
    comPivot: { x: round(c.x), y: round(c.y), z: round(c.z) },
    axes: { tilt, roll, pan },
    recommendedAdjustments: {
      height: height.recommended,
      plate: plate.recommended,
      roll: rollC.recommended,
      pan: panC.recommended,
    },
  };
}
