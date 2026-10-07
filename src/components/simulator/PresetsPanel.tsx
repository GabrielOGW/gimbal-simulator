"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { BUILTIN_PRESETS } from "@/lib/setup/presets";
import type { Setup } from "@/lib/setup/types";
import { Button, IconButton, TextField } from "@/components/ui/controls";

export function PresetsPanel({
  currentName,
  presets,
  onSave,
  onLoad,
  onLoadBuiltin,
  onDelete,
}: {
  currentName: string;
  presets: Setup[];
  onSave: (name: string) => void;
  onLoad: (p: Setup) => void;
  onLoadBuiltin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(currentName);
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <TextField label="Salvar setup atual como" value={name} onChange={setName} />
        <Button variant="primary" icon="save" className="w-full" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          Salvar preset
        </Button>
        <p className="text-[11px] text-ink-400">Salvo neste navegador: equipamentos, posições, gimbal e ajustes. Use Exportar para levar para outro dispositivo.</p>
      </div>

      <div>
        <h3 className="label mb-2">Meus presets</h3>
        {presets.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhum preset salvo ainda.</p>
        ) : (
          <ul className="space-y-1">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-2.5 py-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onLoad(p)}>
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="num block text-[10px] text-ink-400">
                    {p.items.length} itens · criado {formatDate(p.createdAt)} · atualizado {formatDate(p.updatedAt)}
                  </span>
                </button>
                <IconButton icon="trash" label={`Excluir ${p.name}`} className="hover:text-stop" onClick={() => onDelete(p.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="label mb-2">Exemplos</h3>
        <ul className="space-y-1">
          {BUILTIN_PRESETS.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full rounded-md border border-ink-700 px-2.5 py-2 text-left text-sm hover:border-ink-500 hover:bg-ink-850"
                onClick={() => onLoadBuiltin(p.id)}
              >
                {p.name}
                <span className="num block text-[10px] text-ink-400">{p.equipment.length} itens</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
