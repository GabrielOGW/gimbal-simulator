import type { ResolvedItem } from "./types";

export type SetupNotice = { id: string; level: "info" | "warning"; message: string };

/** Avisos práticos que não dependem do gimbal (montagens, itens duplicados etc.). */
export function setupNotices(items: readonly ResolvedItem[]): SetupNotice[] {
  const notices: SetupNotice[] = [];
  const cameras = items.filter((i) => i.equipment.category === "camera");
  const lenses = items.filter((i) => i.equipment.category === "lens");
  if (items.length && cameras.length === 0) {
    notices.push({ id: "no-camera", level: "info", message: "Nenhuma câmera no setup." });
  }
  if (cameras.length > 1) {
    notices.push({ id: "multi-camera", level: "warning", message: "Mais de uma câmera no setup." });
  }
  const camMount = cameras[0]?.equipment.metadata?.mount;
  for (const lens of lenses) {
    const lensMount = lens.equipment.metadata?.mount;
    if (typeof camMount === "string" && typeof lensMount === "string" && !lensMount.split("/").includes(camMount)) {
      notices.push({
        id: `mount-${lens.instanceId}`,
        level: "warning",
        message: `${lens.equipment.name} é ${lensMount} e a câmera é ${camMount}: será preciso adaptador — adicione o peso dele.`,
      });
    }
  }
  return notices;
}
