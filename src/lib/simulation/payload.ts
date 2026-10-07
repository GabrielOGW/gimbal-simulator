export type PayloadStatus =
  | "empty"
  | "below_minimum"
  | "ok"
  | "above_margin"
  | "over_capacity";

export type PayloadEvaluation = {
  status: PayloadStatus;
  /** Massa total do setup (g) */
  total: number;
  /** Carga mínima/máxima nominal do gimbal (g) */
  minimum: number;
  maximum: number;
  /** Margem aplicada (0–0.9) */
  safetyMargin: number;
  /** Capacidade efetiva = máximo × (1 − margem) (g) */
  effectiveCapacity: number;
  /** total / máximo nominal */
  ratio: number;
  /** Excesso sobre a capacidade nominal (g), 0 se dentro */
  excess: number;
  /** Excesso sobre a capacidade efetiva (g), 0 se dentro */
  marginExcess: number;
  /** Folga até a capacidade efetiva (g), 0 se acima */
  headroom: number;
};

export function assertValidMargin(margin: number) {
  if (!Number.isFinite(margin) || margin < 0 || margin >= 0.9) {
    throw new RangeError(`Margem de segurança inválida: ${margin} (use 0 ≤ margem < 0.9)`);
  }
}

export function evaluatePayload(
  total: number,
  capacity: { minimum: number; maximum: number },
  safetyMargin: number,
): PayloadEvaluation {
  if (!Number.isFinite(total) || total < 0) throw new RangeError(`Massa total inválida: ${total}`);
  if (!(capacity.maximum > 0) || capacity.minimum < 0 || capacity.minimum > capacity.maximum) {
    throw new RangeError("Faixa de carga do gimbal inválida");
  }
  assertValidMargin(safetyMargin);

  const effectiveCapacity = capacity.maximum * (1 - safetyMargin);
  const excess = Math.max(0, total - capacity.maximum);
  const marginExcess = Math.max(0, total - effectiveCapacity);

  let status: PayloadStatus;
  if (total === 0) status = "empty";
  else if (total > capacity.maximum) status = "over_capacity";
  else if (total > effectiveCapacity) status = "above_margin";
  else if (total < capacity.minimum) status = "below_minimum";
  else status = "ok";

  return {
    status,
    total,
    minimum: capacity.minimum,
    maximum: capacity.maximum,
    safetyMargin,
    effectiveCapacity,
    ratio: total / capacity.maximum,
    excess,
    marginExcess,
    headroom: Math.max(0, effectiveCapacity - total),
  };
}
