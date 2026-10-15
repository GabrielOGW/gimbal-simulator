import type { Dimensions, Vec3 } from "@/types/geometry";

export const EQUIPMENT_CATEGORIES = [
  "camera",
  "lens",
  "battery",
  "cage",
  "monitor",
  "transmitter",
  "follow_focus",
  "matte_box",
  "filter",
  "microphone",
  "handle",
  "plate",
  "accessory",
  "other",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

/**
 * Origem do dado. A UI sempre exibe essa distinção:
 * - official: transcrito de especificação do fabricante (ainda pode conter erro de transcrição)
 * - estimated: valor aproximado/inferido (ex.: centro de massa, dimensões de acessório)
 * - user: informado pelo usuário
 */
export type DataSourceKind = "official" | "estimated" | "user";

export type DataSource = {
  kind: DataSourceKind;
  /** Onde o dado foi obtido. Em `official`, é a URL da ficha do fabricante. */
  reference?: string;
  /** Data (ISO, AAAA-MM-DD) em que o valor foi conferido na fonte. Obrigatória em `official` no catálogo. */
  checkedAt?: string;
  note?: string;
};

export type MountingPointType =
  | "base" // rosca 1/4"-20 / 3/8"-16 inferior
  | "lens_mount"
  | "lens_rear"
  | "lens_front"
  | "cold_shoe"
  | "other";

export type MountingPoint = {
  id: string;
  label: string;
  type: MountingPointType;
  /** Posição no referencial local do equipamento, relativa ao centro geométrico (mm). */
  position: Vec3;
};

export type Equipment = {
  id: string;
  name: string;
  brand?: string;
  category: EquipmentCategory;
  /** Massa em gramas */
  weight: number;
  /** Dimensões da caixa envolvente em mm */
  dimensions: Dimensions;
  /**
   * Deslocamento do centro de massa em relação ao centro geométrico, no
   * referencial local (mm). Ausente = usa o centro geométrico como estimativa.
   */
  centerOfMass?: Vec3;
  mountingPoints?: MountingPoint[];
  /** Fonte do peso/dimensões */
  source: DataSource;
  /** Fonte do centro de massa, quando informado */
  centerOfMassSource?: DataSource;
  /** true quando o item foi cadastrado pelo usuário */
  custom?: boolean;
  metadata?: Record<string, unknown>;
};
