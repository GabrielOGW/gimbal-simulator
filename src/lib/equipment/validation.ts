import type { Gimbal } from "@/lib/gimbal/types";
import { EQUIPMENT_CATEGORIES, type DataSource, type Equipment } from "./types";

export type ValidationResult<T> =
  | { ok: true; value: T; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isPos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown) => isObj(v) && isNum(v.x) && isNum(v.y) && isNum(v.z);
const isIsoDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isSource = (v: unknown): v is DataSource =>
  isObj(v) &&
  (v.kind === "official" || v.kind === "estimated" || v.kind === "user") &&
  (v.checkedAt === undefined || isIsoDay(v.checkedAt));

/** Valida dados de equipamento vindos de JSON, formulário ou importação. */
export function validateEquipment(input: unknown): ValidationResult<Equipment> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["Equipamento deve ser um objeto"], warnings };

  if (typeof input.id !== "string" || !input.id.trim()) errors.push("id obrigatório");
  if (typeof input.name !== "string" || !input.name.trim()) errors.push("Nome obrigatório");
  if (!EQUIPMENT_CATEGORIES.includes(input.category as never)) errors.push(`Categoria inválida: ${String(input.category)}`);
  if (!isPos(input.weight)) errors.push("Peso deve ser um número maior que zero (g)");

  const d = input.dimensions;
  if (!isObj(d) || !isPos(d.width) || !isPos(d.height) || !isPos(d.depth)) {
    errors.push("Largura, altura e profundidade devem ser maiores que zero (mm)");
  }
  if (!isSource(input.source)) errors.push("Fonte do dado inválida (source.kind ou source.checkedAt)");

  if (input.centerOfMass !== undefined) {
    if (!isVec(input.centerOfMass)) {
      errors.push("Centro de massa deve ter x, y e z numéricos (mm)");
    } else if (isObj(d) && isPos(d.width) && isPos(d.height) && isPos(d.depth)) {
      const c = input.centerOfMass as { x: number; y: number; z: number };
      if (Math.abs(c.x) > d.width / 2 || Math.abs(c.y) > d.depth / 2 || Math.abs(c.z) > d.height / 2) {
        warnings.push("Centro de massa fora da caixa envolvente — confira os valores");
      }
    }
  }
  if (input.mountingPoints !== undefined) {
    const mps = input.mountingPoints;
    if (!Array.isArray(mps) || !mps.every((m) => isObj(m) && typeof m.id === "string" && isVec(m.position))) {
      errors.push("Pontos de montagem inválidos");
    }
  }
  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, value: input as unknown as Equipment, warnings };
}

const isRange = (v: unknown) => isObj(v) && isNum(v.min) && isNum(v.max) && (v.min as number) <= (v.max as number);

export function validateGimbal(input: unknown): ValidationResult<Gimbal> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["Gimbal deve ser um objeto"], warnings };
  if (typeof input.id !== "string" || !input.id.trim()) errors.push("id obrigatório");
  if (typeof input.name !== "string" || !input.name.trim()) errors.push("Nome obrigatório");
  const p = input.payload;
  if (!isObj(p) || !isPos(p.maximum) || !isNum(p.minimum) || (p.minimum as number) < 0 || (p.minimum as number) > (p.maximum as number)) {
    errors.push("Carga mínima/máxima inválida (g)");
  }
  const ar = input.adjustmentRanges;
  if (!isObj(ar) || !["plate", "height", "roll", "pan"].every((k) => isRange(ar[k]))) {
    errors.push("Cursos de ajuste inválidos");
  }
  const g = input.geometry;
  if (!isObj(g) || !isPos(g.tiltArmInnerX) || !isPos(g.rearClearance) || !isPos(g.plateLength)) {
    errors.push("Geometria inválida");
  }
  const axes = input.axes;
  if (!isObj(axes) || !["pan", "tilt", "roll"].every((k) => isObj(axes[k]))) errors.push("Eixos inválidos");
  if (!isSource(input.payloadSource) || !isSource(input.geometrySource)) errors.push("Fonte dos dados inválida");
  const mm = input.movingMasses;
  if (mm !== undefined) {
    const set = (v: unknown) => isObj(v) && isNum(v.mass) && (v.mass as number) >= 0 && isVec(v.com);
    if (!isObj(mm) || !set(mm.tilt) || !set(mm.roll) || !set(mm.pan) || !isSource(mm.source)) {
      errors.push("Massas móveis inválidas: tilt, roll e pan precisam de massa ≥ 0 (g), CM (mm) e fonte");
    } else if (isPos(input.weight)) {
      const sum = (["tilt", "roll", "pan"] as const).reduce((a, k) => a + ((mm[k] as { mass: number }).mass), 0);
      if (sum > (input.weight as number)) warnings.push("Massas móveis somam mais que o peso do gimbal — confira os valores");
    }
  }
  if (errors.length) return { ok: false, errors, warnings };
  return { ok: true, value: input as unknown as Gimbal, warnings };
}
