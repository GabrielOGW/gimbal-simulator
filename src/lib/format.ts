/** Formatação para exibição. Unidades internas: g e mm; `units` só muda o que aparece na tela. */
import { G_PER_LB, G_PER_OZ, LBIN_PER_NM, METRIC, MM_PER_IN, type DisplayUnits } from "./units";

/** g/kg, ou lb/oz em unidades imperiais (abaixo de 1 lb mostra oz). `forceKg` força kg ou lb. */
export const formatMass = (g: number, opts: { forceKg?: boolean } = {}, u: DisplayUnits = METRIC): string => {
  if (u.mass === "lb") {
    return opts.forceKg || Math.abs(g) >= G_PER_LB ? `${(g / G_PER_LB).toFixed(2)} lb` : `${(g / G_PER_OZ).toFixed(1)} oz`;
  }
  return opts.forceKg || Math.abs(g) >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;
};

/** Distância. `digits` vale para mm; polegadas sempre com 2 casas (0,01 in ≈ 0,25 mm). */
export const formatMm = (mm: number, digits = 0, u: DisplayUnits = METRIC): string =>
  u.length === "in" ? `${(mm / MM_PER_IN).toFixed(2)} in` : `${mm.toFixed(digits)} mm`;

/** Valor com sinal explícito: +32 mm, −18 mm, 0 mm (ou +1.26 in…) */
export const formatSignedMm = (mm: number, digits = 0, u: DisplayUnits = METRIC): string => {
  const inches = u.length === "in";
  const d = inches ? 2 : digits;
  const r = Number((inches ? mm / MM_PER_IN : mm).toFixed(d));
  const unit = inches ? "in" : "mm";
  if (r === 0) return `0 ${unit}`;
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(d)} ${unit}`;
};

/** Dimensões L × A × P de uma caixa. */
export const formatDims = (d: { width: number; height: number; depth: number }, u: DisplayUnits = METRIC): string => {
  const f = (mm: number) => (u.length === "in" ? (mm / MM_PER_IN).toFixed(2) : String(mm));
  return `${f(d.width)} × ${f(d.height)} × ${f(d.depth)} ${u.length}`;
};

/** Vetor "x, y, z unidade" (mm com `digits` casas; polegadas com 2). */
export const formatVec = (v: { x: number; y: number; z: number }, digits = 0, u: DisplayUnits = METRIC): string => {
  const f = (mm: number) => (u.length === "in" ? (mm / MM_PER_IN).toFixed(2) : mm.toFixed(digits));
  return `${f(v.x)}, ${f(v.y)}, ${f(v.z)} ${u.length}`;
};

/** Posição compacta "X12 Y−3 Z40 mm" (polegadas com 1 casa, cabe na lista). */
export const formatXYZ = (v: { x: number; y: number; z: number }, u: DisplayUnits = METRIC): string => {
  const f = (mm: number) => (u.length === "in" ? (mm / MM_PER_IN).toFixed(1) : mm.toFixed(0));
  return `X${f(v.x)} Y${f(v.y)} Z${f(v.z)} ${u.length}`;
};

/** Torque sempre em N·m; em unidades imperiais acrescenta lb·in. */
export const formatTorque = (nm: number, u: DisplayUnits = METRIC): string =>
  u.mass === "lb" || u.length === "in" ? `${nm.toFixed(3)} N·m (${(nm * LBIN_PER_NM).toFixed(2)} lb·in)` : `${nm.toFixed(3)} N·m`;

export const formatPercent = (ratio: number, digits = 1): string => `${(ratio * 100).toFixed(digits)}%`;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/** Data sem hora (AAAA-MM-DD) → 14/10/2026. Lida como UTC para não voltar um dia em fusos negativos. */
export const formatDay = (isoDay: string): string => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};
