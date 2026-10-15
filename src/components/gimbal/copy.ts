import type { AdjustmentKey, AxisName } from "@/lib/gimbal/types";
import type { ClearanceIssue } from "@/lib/simulation/clearance";
import { formatMm } from "@/lib/format";
import { METRIC, type DisplayUnits } from "@/lib/units";

export const AXIS_LABEL: Record<AxisName, string> = { tilt: "Tilt", roll: "Roll", pan: "Pan" };
export const AXIS_HINT: Record<AxisName, string> = {
  tilt: "Gira em torno de X · equilibra frente/trás (Y) e cima/baixo (Z)",
  roll: "Gira em torno de Y · equilibra esquerda/direita (X)",
  pan: "Gira em torno de Z · importa com o gimbal inclinado",
};

export const ADJ_LABEL: Record<AdjustmentKey, string> = {
  plate: "Placa (frente/trás)",
  height: "Altura do tilt (vertical)",
  roll: "Braço horizontal (roll)",
  pan: "Braço vertical (pan)",
};
export const ADJ_AXIS: Record<AdjustmentKey, "x" | "y" | "z"> = { plate: "y", height: "z", roll: "x", pan: "y" };

/** Frase prática para a correção recomendada. */
export function correctionText(key: AdjustmentKey, delta: number, u: DisplayUnits = METRIC): string {
  const d = formatMm(Math.abs(delta), 0, u);
  switch (key) {
    case "plate":
      return delta > 0 ? `Avançar a câmera ${d} na placa` : `Recuar a câmera ${d} na placa`;
    case "height":
      return delta > 0 ? `Baixar a carga ${d} (CM acima do eixo)` : `Subir a carga ${d} (CM abaixo do eixo)`;
    case "roll":
      return delta > 0 ? `Deslizar o braço ${d} para a direita` : `Deslizar o braço ${d} para a esquerda`;
    case "pan":
      return delta > 0 ? `Avançar o braço vertical ${d}` : `Recuar o braço vertical ${d}`;
  }
}

/** Aviso de interferência na unidade escolhida. */
export function clearanceText(c: ClearanceIssue, u: DisplayUnits = METRIC): string {
  const d = formatMm(c.overlap, 0, u);
  return c.id === "width" ? `A carga avança ${d} sobre o braço do tilt (lado esquerdo).` : `A traseira da carga invade ${d} o espaço do motor roll.`;
}
