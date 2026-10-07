"use client";

import { useState } from "react";
import type { Gimbal } from "@/lib/gimbal/types";
import { validateGimbal } from "@/lib/equipment/validation";
import { newId } from "@/lib/setup/factory";
import { Button, TextField } from "@/components/ui/controls";

const n = (s: string) => Number(s.replace(",", "."));

export function CustomGimbalForm({ templates, initial, onSave, onCancel }: { templates: Gimbal[]; initial?: Gimbal; onSave: (g: Gimbal) => void; onCancel: () => void }) {
  const [templateId, setTemplateId] = useState(initial?.id ?? templates[0]?.id ?? "");
  const base = initial ?? templates.find((t) => t.id === templateId) ?? templates[0]!;
  const [name, setName] = useState(initial?.name ?? "");
  const [max, setMax] = useState(String(base.payload.maximum));
  const [min, setMin] = useState(String(base.payload.minimum));
  const [plate, setPlate] = useState(String(base.adjustmentRanges.plate.max));
  const [hMin, setHMin] = useState(String(base.adjustmentRanges.height.min));
  const [hMax, setHMax] = useState(String(base.adjustmentRanges.height.max));
  const [roll, setRoll] = useState(String(base.adjustmentRanges.roll.max));
  const [pan, setPan] = useState(String(base.adjustmentRanges.pan.max));
  const [errors, setErrors] = useState<string[]>([]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setMax(String(t.payload.maximum));
    setMin(String(t.payload.minimum));
    setPlate(String(t.adjustmentRanges.plate.max));
    setHMin(String(t.adjustmentRanges.height.min));
    setHMax(String(t.adjustmentRanges.height.max));
    setRoll(String(t.adjustmentRanges.roll.max));
    setPan(String(t.adjustmentRanges.pan.max));
  };

  const save = () => {
    const g: Gimbal = {
      ...base,
      id: initial?.id ?? newId("user-gimbal"),
      name: name.trim(),
      brand: "Personalizado",
      payload: { minimum: n(min), maximum: n(max) },
      payloadSource: { kind: "user" },
      adjustmentRanges: {
        plate: { min: -n(plate), max: n(plate) },
        height: { min: n(hMin), max: n(hMax) },
        roll: { min: -n(roll), max: n(roll) },
        pan: { min: -n(pan), max: n(pan) },
      },
      geometrySource: { kind: "estimated", note: `Geometria copiada de ${base.name}` },
      custom: true,
    };
    const r = validateGimbal(g);
    if (!r.ok) return setErrors(r.errors);
    onSave(r.value);
  };

  return (
    <div className="space-y-3">
      <TextField label="Nome" value={name} onChange={setName} placeholder="Ex.: Meu gimbal" required autoFocus />
      {!initial && (
        <label className="flex flex-col gap-1">
          <span className="label">Basear geometria em</span>
          <select className="h-9 rounded-md border border-ink-600 bg-ink-950 px-2 text-sm" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Carga mínima" type="number" unit="g" value={min} onChange={setMin} />
        <TextField label="Carga máxima" type="number" unit="g" value={max} onChange={setMax} required />
      </div>
      <p className="label pt-1">Curso dos ajustes</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Placa ±" type="number" unit="mm" value={plate} onChange={setPlate} />
        <TextField label="Roll ±" type="number" unit="mm" value={roll} onChange={setRoll} />
        <TextField label="Altura mín." type="number" unit="mm" value={hMin} onChange={setHMin} />
        <TextField label="Altura máx." type="number" unit="mm" value={hMax} onChange={setHMax} />
        <TextField label="Pan ±" type="number" unit="mm" value={pan} onChange={setPan} />
      </div>
      {errors.length > 0 && <ul className="space-y-0.5 text-xs text-stop">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" icon="save" onClick={save}>
          Salvar gimbal
        </Button>
      </div>
    </div>
  );
}
