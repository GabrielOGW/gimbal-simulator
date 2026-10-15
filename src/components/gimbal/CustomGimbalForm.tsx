"use client";

import { useState } from "react";
import type { Gimbal } from "@/lib/gimbal/types";
import { validateGimbal } from "@/lib/equipment/validation";
import { newId } from "@/lib/setup/factory";
import { Button, TextField } from "@/components/ui/controls";
import { useUnits } from "@/components/ui/units";
import { fromDisplayLength, fromDisplayMass, lengthFieldText, massFieldText, readField, type DisplayUnits } from "@/lib/units";

type Fields = { max: string; min: string; plate: string; hMin: string; hMax: string; roll: string; pan: string };
/** Valores do gimbal em g/mm, na mesma forma dos campos. */
const values = (g: Gimbal) => ({
  max: g.payload.maximum,
  min: g.payload.minimum,
  plate: g.adjustmentRanges.plate.max,
  hMin: g.adjustmentRanges.height.min,
  hMax: g.adjustmentRanges.height.max,
  roll: g.adjustmentRanges.roll.max,
  pan: g.adjustmentRanges.pan.max,
});
const texts = (g: Gimbal, u: DisplayUnits): Fields => {
  const v = values(g);
  return {
    max: massFieldText(v.max, u),
    min: massFieldText(v.min, u),
    plate: lengthFieldText(v.plate, u),
    hMin: lengthFieldText(v.hMin, u),
    hMax: lengthFieldText(v.hMax, u),
    roll: lengthFieldText(v.roll, u),
    pan: lengthFieldText(v.pan, u),
  };
};

export function CustomGimbalForm({ templates, initial, onSave, onCancel }: { templates: Gimbal[]; initial?: Gimbal; onSave: (g: Gimbal) => void; onCancel: () => void }) {
  const [templateId, setTemplateId] = useState(initial?.id ?? templates[0]?.id ?? "");
  const base = initial ?? templates.find((t) => t.id === templateId) ?? templates[0]!;
  const [name, setName] = useState(initial?.name ?? "");
  const u = useUnits();
  const [fields, setFields] = useState<Fields>(() => texts(base, u));
  const set = (k: keyof Fields) => (v: string) => setFields((f) => ({ ...f, [k]: v }));
  const [errors, setErrors] = useState<string[]>([]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setFields(texts(t, u));
  };

  const save = () => {
    // Campo não editado devolve o valor original (sem arredondar pela conversão).
    const orig = texts(base, u);
    const ov = values(base);
    const mass = (k: "max" | "min") => readField(fields[k], orig[k], ov[k], (v) => fromDisplayMass(v, u));
    const len = (k: "plate" | "hMin" | "hMax" | "roll" | "pan") => readField(fields[k], orig[k], ov[k], (v) => fromDisplayLength(v, u));
    const g: Gimbal = {
      ...base,
      id: initial?.id ?? newId("user-gimbal"),
      name: name.trim(),
      brand: "Personalizado",
      payload: { minimum: mass("min"), maximum: mass("max") },
      payloadSource: { kind: "user" },
      adjustmentRanges: {
        plate: { min: -len("plate"), max: len("plate") },
        height: { min: len("hMin"), max: len("hMax") },
        roll: { min: -len("roll"), max: len("roll") },
        pan: { min: -len("pan"), max: len("pan") },
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
        <TextField label="Carga mínima" type="number" unit={u.mass} value={fields.min} onChange={set("min")} />
        <TextField label="Carga máxima" type="number" unit={u.mass} value={fields.max} onChange={set("max")} required />
      </div>
      <p className="label pt-1">Curso dos ajustes</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Placa ±" type="number" unit={u.length} value={fields.plate} onChange={set("plate")} />
        <TextField label="Roll ±" type="number" unit={u.length} value={fields.roll} onChange={set("roll")} />
        <TextField label="Altura mín." type="number" unit={u.length} value={fields.hMin} onChange={set("hMin")} />
        <TextField label="Altura máx." type="number" unit={u.length} value={fields.hMax} onChange={set("hMax")} />
        <TextField label="Pan ±" type="number" unit={u.length} value={fields.pan} onChange={set("pan")} />
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
