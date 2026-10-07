/** Formatação para exibição. Unidades internas: g e mm. */

export const formatMass = (g: number, opts: { forceKg?: boolean } = {}): string =>
  opts.forceKg || Math.abs(g) >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;

export const formatMm = (mm: number, digits = 0): string => `${mm.toFixed(digits)} mm`;

/** Valor com sinal explícito: +32 mm, −18 mm, 0 mm */
export const formatSignedMm = (mm: number, digits = 0): string => {
  const r = Number(mm.toFixed(digits));
  if (r === 0) return `0 mm`;
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(digits)} mm`;
};

export const formatTorque = (nm: number): string => `${nm.toFixed(3)} N·m`;

export const formatPercent = (ratio: number, digits = 1): string => `${(ratio * 100).toFixed(digits)}%`;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};
