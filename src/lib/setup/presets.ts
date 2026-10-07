import presetData from "@/data/presets/presets.json";

/** Presets de demonstração (somente ids — posições são geradas pelo posicionamento automático). */
export type BuiltinPreset = { id: string; name: string; gimbal: string; equipment: string[] };

export const BUILTIN_PRESETS: BuiltinPreset[] = presetData;
