import type { DataSourceKind, EquipmentCategory } from "./types";

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  camera: "Câmera",
  lens: "Lente",
  battery: "Bateria",
  cage: "Cage",
  monitor: "Monitor",
  transmitter: "Transmissor",
  follow_focus: "Follow focus",
  matte_box: "Matte box",
  filter: "Filtro",
  microphone: "Microfone",
  handle: "Alça",
  plate: "Placa",
  accessory: "Acessório",
  other: "Outro",
};

/** Abreviação curta usada em chips e na cena 3D */
export const CATEGORY_CODES: Record<EquipmentCategory, string> = {
  camera: "CAM",
  lens: "LNS",
  battery: "BAT",
  cage: "CGE",
  monitor: "MON",
  transmitter: "TX",
  follow_focus: "FF",
  matte_box: "MB",
  filter: "FLT",
  microphone: "MIC",
  handle: "HDL",
  plate: "PLT",
  accessory: "ACC",
  other: "OTR",
};

export const SOURCE_LABELS: Record<DataSourceKind, string> = {
  official: "Fabricante",
  estimated: "Estimado",
  user: "Usuário",
};
