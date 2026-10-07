import type { Gimbal, GimbalAdjustments } from "@/lib/gimbal/types";
import type { Bounds } from "./geometry";

export type ClearanceIssue = {
  id: "width" | "rear";
  /** Quanto (mm) ultrapassa o espaço estimado */
  overlap: number;
  message: string;
};

/**
 * Checagem grosseira de interferência física entre a carga e o gimbal,
 * usando caixas envolventes e geometria estimada. Não considera o
 * percurso de rotação completo dos eixos.
 *
 * @param payloadBounds caixa envolvente da carga no referencial da carga
 */
export function checkClearance(
  payloadBounds: Bounds | null,
  adj: GimbalAdjustments,
  gimbal: Pick<Gimbal, "geometry">,
): ClearanceIssue[] {
  if (!payloadBounds) return [];
  const g = gimbal.geometry;
  const issues: ClearanceIssue[] = [];

  // Braço do tilt fica à esquerda (−X) e se move junto com o ajuste de roll.
  const leftOverlap = -payloadBounds.min.x - g.tiltArmInnerX;
  if (leftOverlap > 0) {
    issues.push({
      id: "width",
      overlap: leftOverlap,
      message: `A carga avança ${leftOverlap.toFixed(0)} mm sobre o braço do tilt (lado esquerdo).`,
    });
  }

  // Motor roll fica atrás do eixo tilt; a carga desliza com o ajuste `plate`.
  const rearMost = payloadBounds.min.y + adj.plate;
  const rearOverlap = -rearMost - g.rearClearance;
  if (rearOverlap > 0) {
    issues.push({
      id: "rear",
      overlap: rearOverlap,
      message: `A traseira da carga invade ${rearOverlap.toFixed(0)} mm o espaço do motor roll.`,
    });
  }

  return issues;
}
