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
 * Com `gimbal.movingMasses`, cada eixo equilibra também as partes do gimbal
 * que giram com ele (ver evaluateBalance).
 *
 * Limitações conhecidas (exibidas na UI):
 *  - massas das partes móveis do gimbal são estimadas e tratadas como pontos; inércia é ignorada;
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
  /** true quando o cálculo incluiu as massas (estimadas) das partes móveis do gimbal */
  includesGimbalMasses: boolean;
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

/** Corpo pontual no referencial do pivô. */
export type Body = { mass: number; at: Vec3 };

/**
 * Posição atual (referencial do pivô) de cada conjunto móvel do gimbal,
 * segundo as regras de `GimbalMovingMasses`. null quando o gimbal não tem massas.
 */
export function gimbalBodies(
  gimbal: Pick<Gimbal, "movingMasses">,
  adj: GimbalAdjustments,
): Record<AxisName, Body> | null {
  const m = gimbal.movingMasses;
  if (!m) return null;
  return {
    tilt: { mass: m.tilt.mass, at: add(m.tilt.com, vec(adj.roll, 0, -adj.height)) },
    roll: { mass: m.roll.mass, at: add(m.roll.com, vec(adj.roll, 0, 0)) },
    pan: { mass: m.pan.mass, at: m.pan.com },
  };
}

const ZERO_BODY: Body = { mass: 0, at: vec(0, 0, 0) };

/**
 * Avalia o balanceamento a partir do CM da carga (referencial da carga),
 * massa total (g), ajustes atuais e cursos do gimbal.
 *
 * Cada eixo equilibra tudo o que gira com ele:
 *   tilt = carga + conjunto tilt
 *   roll = carga + conjunto tilt + conjunto roll
 *   pan  = carga + conjuntos tilt, roll e pan (tudo acima do motor pan)
 * Sem `movingMasses`, os conjuntos têm massa zero e o resultado é o do
 * modelo antigo (gimbal sem massa).
 *
 * As recomendações seguem a ordem real de balanceamento: tilt (altura, depois
 * frente/trás) → roll → pan. Cada etapa considera o resultado (limitado ao curso)
 * da anterior.
 */
export function evaluateBalance(
  comPayload: Vec3,
  totalMass: number,
  adj: GimbalAdjustments,
  gimbal: Pick<Gimbal, "adjustmentRanges"> & Partial<Pick<Gimbal, "movingMasses">>,
  tolerance: number,
): BalanceResult {
  if (!(tolerance >= 0)) throw new RangeError(`Tolerância inválida: ${tolerance}`);
  if (!(totalMass > 0)) throw new RangeError(`Massa da carga inválida: ${totalMass}`);
  const ranges = gimbal.adjustmentRanges;
  const M = totalMass;
  const c = toPivotFrame(comPayload, adj);
  const bodies = gimbalBodies(gimbal, adj);
  const T = bodies?.tilt ?? ZERO_BODY;
  const R = bodies?.roll ?? ZERO_BODY;
  const P = bodies?.pan ?? ZERO_BODY;
  const tc = gimbal.movingMasses?.tilt.com ?? ZERO_BODY.at;
  const rc = gimbal.movingMasses?.roll.com ?? ZERO_BODY.at;

  // --- Tilt: carga + conjunto tilt ----------------------------------------
  // Y: M·(CM.y + placa) + mT·t.y = 0           → placa* = −(CM.y + mT·t.y/M)
  // Z: M·(CM.z − altura) + mT·(t.z − altura) = 0 → altura* = (M·CM.z + mT·t.z)/(M + mT)
  const mTilt = M + T.mass;
  const tiltY = (M * c.y + T.mass * T.at.y) / mTilt;
  const tiltZ = (M * c.z + T.mass * T.at.z) / mTilt;
  const height = correction("height", "z", adj.height, (M * comPayload.z + T.mass * tc.z) / mTilt, ranges.height);
  const plate = correction("plate", "y", adj.plate, -(comPayload.y + (T.mass * tc.y) / M), ranges.plate);
  const tiltResidual = Math.hypot(tiltY, tiltZ);
  const yAfterTilt = (M * (comPayload.y + plate.recommended) + T.mass * tc.y) / mTilt;
  const zAfterTilt = (M * (comPayload.z - height.recommended) + T.mass * (tc.z - height.recommended)) / mTilt;
  const tilt: AxisBalance = {
    axis: "tilt",
    status: statusFor(tiltResidual, tolerance, [height, plate]),
    residual: round(tiltResidual),
    offset: { y: round(tiltY), z: round(tiltZ) },
    corrections: [height, plate],
    worstCaseTorque: torque(mTilt, tiltResidual),
    residualAfter: round(Math.hypot(yAfterTilt, zAfterTilt)),
  };

  // --- Roll: carga + conjuntos tilt e roll ---------------------------------
  // O ajuste roll desloca os três em X: roll* = −(M·CM.x + mT·t.x + mR·r.x)/(M + mT + mR)
  const mRoll = mTilt + R.mass;
  const rollX = (M * c.x + T.mass * T.at.x + R.mass * R.at.x) / mRoll;
  const rollZ = (M * c.z + T.mass * T.at.z + R.mass * R.at.z) / mRoll;
  const rollC = correction("roll", "x", adj.roll, -(M * comPayload.x + T.mass * tc.x + R.mass * rc.x) / mRoll, ranges.roll);
  const rollResidual = Math.abs(rollX);
  const xAfterRoll = rollX - adj.roll + rollC.recommended;
  const roll: AxisBalance = {
    axis: "roll",
    status: statusFor(rollResidual, tolerance, [rollC]),
    residual: round(rollResidual),
    offset: { x: round(rollX), z: round(rollZ) },
    corrections: [rollC],
    worstCaseTorque: torque(mRoll, Math.hypot(rollX, rollZ)),
    residualAfter: round(Math.abs(xAfterRoll)),
  };

  // --- Pan: tudo acima do motor pan ---------------------------------------
  // Distância horizontal do CM ao eixo pan (em y = −pan). O ajuste pan só atua
  // em Y; o desvio em X é herdado do roll. Com o tilt balanceado, o que sobra
  // em Y vem dos conjuntos roll e pan (atrás da carga) — é isso que o pan compensa.
  const mPan = mRoll + P.mass;
  const panX = (mRoll * rollX + P.mass * P.at.x) / mPan;
  const panY = (mTilt * tiltY + R.mass * R.at.y + P.mass * P.at.y) / mPan + adj.pan;
  const yAfterTiltAll = (mTilt * yAfterTilt + R.mass * R.at.y + P.mass * P.at.y) / mPan;
  const panC = correction("pan", "y", adj.pan, -yAfterTiltAll, ranges.pan);
  const panResidual = Math.hypot(panX, panY);
  const xAfterRollAll = (mRoll * xAfterRoll + P.mass * P.at.x) / mPan;
  const pan: AxisBalance = {
    axis: "pan",
    status: statusFor(panResidual, tolerance, [panC]),
    residual: round(panResidual),
    offset: { x: round(panX), y: round(panY) },
    corrections: [panC],
    worstCaseTorque: torque(mPan, panResidual),
    residualAfter: round(Math.hypot(xAfterRollAll, yAfterTiltAll + panC.recommended)),
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
    includesGimbalMasses: bodies !== null,
  };
}
