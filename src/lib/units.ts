/**
 * Unidades de exibição. O domínio é sempre g e mm; isto aqui só converte na
 * borda da interface (mostrar e ler o que o usuário digitou). Arquivos
 * exportados e links compartilhados nunca passam por aqui.
 */

export type MassUnit = "g" | "lb";
export type LengthUnit = "mm" | "in";
export type DisplayUnits = { mass: MassUnit; length: LengthUnit };

export const METRIC: DisplayUnits = { mass: "g", length: "mm" };

export const G_PER_LB = 453.59237;
export const G_PER_OZ = G_PER_LB / 16;
export const MM_PER_IN = 25.4;
/** 1 N·m = 8,850745… lb·in */
export const LBIN_PER_NM = 1 / (0.0254 * 0.45359237 * 9.80665);

export const isDisplayUnits = (v: unknown): v is DisplayUnits =>
  typeof v === "object" &&
  v !== null &&
  ((v as DisplayUnits).mass === "g" || (v as DisplayUnits).mass === "lb") &&
  ((v as DisplayUnits).length === "mm" || (v as DisplayUnits).length === "in");

/** Casas decimais nos campos: 1 mm / 1 g; 0,01 in / 0,01 lb. */
export const lengthDigits = (u: DisplayUnits) => (u.length === "in" ? 2 : 1);
export const massDigits = (u: DisplayUnits) => (u.mass === "lb" ? 2 : 0);
/** Passo dos botões −/+ e das setas: 1 mm ≈ 0,05 in. */
export const lengthStep = (u: DisplayUnits) => (u.length === "in" ? 0.05 : 1);

export const toDisplayLength = (mm: number, u: DisplayUnits) => (u.length === "in" ? mm / MM_PER_IN : mm);
export const fromDisplayLength = (v: number, u: DisplayUnits) => (u.length === "in" ? v * MM_PER_IN : v);
export const toDisplayMass = (g: number, u: DisplayUnits) => (u.mass === "lb" ? g / G_PER_LB : g);
export const fromDisplayMass = (v: number, u: DisplayUnits) => (u.mass === "lb" ? v * G_PER_LB : v);

const roundTo = (v: number, digits: number) => {
  const k = 10 ** digits;
  const r = Math.round(v * k) / k;
  return Object.is(r, -0) ? 0 : r;
};

/** Texto para preencher um campo de distância (sem unidade, ponto decimal). */
export const lengthFieldText = (mm: number, u: DisplayUnits) => String(roundTo(toDisplayLength(mm, u), lengthDigits(u)));
export const massFieldText = (g: number, u: DisplayUnits) => String(roundTo(toDisplayMass(g, u), massDigits(u)));

/**
 * Lê um campo de formulário de volta para g/mm. Se o texto não mudou desde
 * que o campo foi preenchido, devolve o valor original: abrir e salvar sem
 * editar não pode arredondar o dado (ex.: 129,7 mm → 5,11 in → 129,79 mm).
 */
export function readField(text: string, initialText: string, initialValue: number | undefined, from: (v: number) => number): number {
  if (initialValue !== undefined && text.trim() === initialText.trim()) return initialValue;
  const s = text.trim().replace(",", ".");
  return s === "" ? NaN : from(Number(s));
}
