import type { AxisStatus } from "@/lib/simulation/balance";
import type { EquipmentCategory } from "@/lib/equipment/types";

export const AXIS_COLORS = { x: "#ff5d5d", y: "#5fd38d", z: "#5aa8ff" } as const;
export const STATUS_COLORS: Record<AxisStatus, string> = {
  ok: "#35d07f",
  adjust: "#ffb020",
  out_of_range: "#ff4d5e",
  no_data: "#8b919d",
};
export const SELECT_COLOR = "#ffb020";

export const CATEGORY_COLORS: Record<EquipmentCategory, string> = {
  camera: "#3a3e46",
  lens: "#2a2d33",
  battery: "#434952",
  cage: "#8b919d",
  monitor: "#353a42",
  transmitter: "#444a53",
  follow_focus: "#555b64",
  matte_box: "#30343a",
  filter: "#2e4256",
  microphone: "#4a4f57",
  handle: "#535963",
  plate: "#4a505a",
  accessory: "#555b66",
  other: "#555b66",
};

export const GIMBAL_COLOR = "#26292f";
export const GIMBAL_ARM_COLOR = "#3d424b";
