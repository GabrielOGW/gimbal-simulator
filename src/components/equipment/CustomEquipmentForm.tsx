"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/equipment/categories";
import { EQUIPMENT_CATEGORIES, type Equipment, type EquipmentCategory } from "@/lib/equipment/types";
import { validateEquipment } from "@/lib/equipment/validation";
import { newId } from "@/lib/setup/factory";
import { Button, TextField } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { useUnits } from "@/components/ui/units";
import { fromDisplayLength, fromDisplayMass, lengthFieldText, massFieldText, readField } from "@/lib/units";

export function CustomEquipmentForm({
  initial,
  defaultCategory,
  onSave,
  onCancel,
}: {
  /** Equipamento a editar, ou base para duplicar (catálogo → personalizado) */
  initial?: Equipment;
  defaultCategory?: EquipmentCategory;
  onSave: (e: Equipment) => void;
  onCancel: () => void;
}) {
  const editing = initial?.custom === true;
  const u = useUnits();
  // Texto inicial de cada campo na unidade escolhida; `read` devolve g/mm sem
  // arredondar o que o usuário não editou.
  const initialText = {
    weight: initial ? massFieldText(initial.weight, u) : "",
    width: initial ? lengthFieldText(initial.dimensions.width, u) : "",
    height: initial ? lengthFieldText(initial.dimensions.height, u) : "",
    depth: initial ? lengthFieldText(initial.dimensions.depth, u) : "",
    cx: lengthFieldText(initial?.centerOfMass?.x ?? 0, u),
    cy: lengthFieldText(initial?.centerOfMass?.y ?? 0, u),
    cz: lengthFieldText(initial?.centerOfMass?.z ?? 0, u),
  };
  const len = (text: string, init: string, mm: number | undefined) => readField(text, init, mm, (v) => fromDisplayLength(v, u));
  const [name, setName] = useState(initial ? (editing ? initial.name : `${initial.name} (meu)`) : "");
  const [category, setCategory] = useState<EquipmentCategory>(initial?.category ?? defaultCategory ?? "accessory");
  const [weight, setWeight] = useState(initialText.weight);
  const [width, setWidth] = useState(initialText.width);
  const [height, setHeight] = useState(initialText.height);
  const [depth, setDepth] = useState(initialText.depth);
  const [knowsCom, setKnowsCom] = useState(initial?.centerOfMass !== undefined);
  const [cx, setCx] = useState(initialText.cx);
  const [cy, setCy] = useState(initialText.cy);
  const [cz, setCz] = useState(initialText.cz);
  const [reference, setReference] = useState(editing ? initial?.source.reference ?? "" : "");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const save = () => {
    const e: Equipment = {
      id: editing ? initial!.id : newId("user"),
      name: name.trim(),
      brand: initial?.brand,
      category,
      weight: readField(weight, initialText.weight, initial?.weight, (v) => fromDisplayMass(v, u)),
      dimensions: {
        width: len(width, initialText.width, initial?.dimensions.width),
        height: len(height, initialText.height, initial?.dimensions.height),
        depth: len(depth, initialText.depth, initial?.dimensions.depth),
      },
      source: { kind: "user", ...(reference.trim() ? { reference: reference.trim() } : {}) },
      custom: true,
      ...(knowsCom ? { centerOfMass: { x: len(cx, initialText.cx, initial?.centerOfMass?.x ?? 0), y: len(cy, initialText.cy, initial?.centerOfMass?.y ?? 0), z: len(cz, initialText.cz, initial?.centerOfMass?.z ?? 0) }, centerOfMassSource: { kind: "user" as const } } : {}),
      ...(initial?.mountingPoints && !editing ? { mountingPoints: initial.mountingPoints } : {}),
      ...(initial?.metadata ? { metadata: initial.metadata } : {}),
    };
    const r = validateEquipment(e);
    setWarnings(r.warnings);
    if (!r.ok) return setErrors(r.errors);
    setErrors([]);
    onSave(r.value);
  };

  return (
    <div className="space-y-3">
      <TextField label="Nome" value={name} onChange={setName} placeholder="Ex.: Monitor 7” da produtora" required autoFocus />
      <label className="flex flex-col gap-1">
        <span className="label">Categoria</span>
        <select
          className="h-9 rounded-md border border-ink-600 bg-ink-950 px-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
        >
          {EQUIPMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Peso" type="number" unit={u.mass} value={weight} onChange={setWeight} required />
      <div className="grid grid-cols-3 gap-2">
        <TextField label="Largura (X)" type="number" unit={u.length} value={width} onChange={setWidth} required />
        <TextField label="Altura (Z)" type="number" unit={u.length} value={height} onChange={setHeight} required />
        <TextField label="Profund. (Y)" type="number" unit={u.length} value={depth} onChange={setDepth} required />
      </div>
      <p className="text-[11px] leading-snug text-ink-400">
        Profundidade = medida no sentido da lente (frente/trás). Para lentes, informe o diâmetro em largura e altura e o comprimento em profundidade.
      </p>

      <div className="rounded-md border border-ink-700 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={knowsCom} onChange={(e) => setKnowsCom(e.target.checked)} className="accent-amber" />
          Sei o centro de massa
        </label>
        {knowsCom ? (
          <>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <TextField label="X" type="number" unit={u.length} value={cx} onChange={setCx} />
              <TextField label="Y" type="number" unit={u.length} value={cy} onChange={setCy} />
              <TextField label="Z" type="number" unit={u.length} value={cz} onChange={setCz} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-400">
              Deslocamento em relação ao centro geométrico da caixa. Ex.: lente mais pesada perto da baioneta → Y negativo.
            </p>
          </>
        ) : (
          <p className="mt-2 flex gap-1.5 text-[11px] leading-snug text-amber">
            <Icon name="alert" size={14} className="mt-px shrink-0" />
            Centro de massa não informado. Utilizando o centro geométrico como estimativa.
          </p>
        )}
      </div>

      <TextField label="Fonte / observação" value={reference} onChange={setReference} placeholder="Ex.: pesado na balança do rental, 03/2026" />

      {errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-stop">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="space-y-0.5 text-xs text-amber">
          {warnings.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" icon="save" onClick={save}>
          {editing ? "Salvar alterações" : "Salvar e adicionar"}
        </Button>
      </div>
    </div>
  );
}
