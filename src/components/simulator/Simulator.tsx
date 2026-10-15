"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Catalog } from "@/lib/equipment/catalog";
import type { Equipment, EquipmentCategory } from "@/lib/equipment/types";
import type { Gimbal } from "@/lib/gimbal/types";
import { analyzeSetup, type SetupAnalysis } from "@/lib/simulation/analyze";
import { setupNotices } from "@/lib/setup/compatibility";
import { resolveItems } from "@/lib/setup/factory";
import { exportSetup, importSetup } from "@/lib/setup/serialization";
import { decodeShareToken, encodeShareToken, SHARE_PARAM, tokenFromHash } from "@/lib/setup/share";
import { downloadJSON, loadJSON, saveJSON, STORAGE_KEYS } from "@/lib/storage/local";
import { CustomEquipmentForm } from "@/components/equipment/CustomEquipmentForm";
import { EquipmentPicker } from "@/components/equipment/EquipmentPicker";
import { ItemInspector } from "@/components/equipment/ItemInspector";
import { SetupList } from "@/components/equipment/SetupList";
import { AdjustmentsPanel } from "@/components/gimbal/AdjustmentsPanel";
import { BalancePanel } from "@/components/gimbal/BalancePanel";
import { CustomGimbalForm } from "@/components/gimbal/CustomGimbalForm";
import { PayloadMeter } from "@/components/gimbal/PayloadMeter";
import { PosePanel } from "@/components/gimbal/PosePanel";
import { Button, IconButton, Modal, Section, SourceBadge } from "@/components/ui/controls";
import { Icon } from "@/components/ui/Icon";
import { PresetsPanel } from "./PresetsPanel";
import { allGimbals, createReducer, equipmentIndex, initialState, type SimState } from "./state";
import { Viewport } from "./Viewport";

type ModalState =
  | { kind: "picker"; category: EquipmentCategory | null }
  | { kind: "custom"; initial?: Equipment; category?: EquipmentCategory | null; replaceInstance?: string }
  | { kind: "gimbal"; initial?: Gimbal }
  | { kind: "presets" }
  | { kind: "about" }
  | null;

type Toast = { tone: "info" | "warning" | "error"; lines: string[] } | null;

export function Simulator({ catalog }: { catalog: Catalog }) {
  const reducer = useMemo(() => createReducer(catalog), [catalog]);
  const [state, dispatch] = useReducer(reducer, catalog, initialState);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const hydrated = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Persistência local (carrega uma vez, salva com debounce). Um link
  // compartilhado (#s=...) tem prioridade sobre o setup salvo.
  useEffect(() => {
    const saved = loadJSON<Partial<SimState>>(STORAGE_KEYS.state);
    if (saved?.setup) dispatch({ type: "hydrate", state: saved });
    hydrated.current = true;
    const token = tokenFromHash(window.location.hash);
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    decodeShareToken(token)
      .then((text) => {
        const r = importSetup(text, new Set(equipmentIndex(catalog, saved?.customEquipment ?? []).keys()), new Set(allGimbals(catalog, saved?.customGimbals ?? []).map((g) => g.id)));
        if (!r.ok) return setToast({ tone: "error", lines: ["Link compartilhado inválido:", ...r.errors] });
        dispatch({ type: "load_setup", setup: r.setup, customEquipment: r.customEquipment, customGimbal: r.customGimbal });
        setToast({ tone: r.warnings.length ? "warning" : "info", lines: [`Setup compartilhado “${r.setup.name}” aberto.`, ...r.warnings] });
      })
      .catch(() => setToast({ tone: "error", lines: ["Link compartilhado corrompido ou incompleto."] }));
  }, [catalog]);
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      const { setup, customEquipment, customGimbals, settings, presets } = state;
      saveJSON(STORAGE_KEYS.state, { setup, customEquipment, customGimbals, settings, presets });
    }, 400);
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === "info" ? 3500 : 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const { setup, settings } = state;
  const byId = useMemo(() => equipmentIndex(catalog, state.customEquipment), [catalog, state.customEquipment]);
  const gimbals = useMemo(() => allGimbals(catalog, state.customGimbals), [catalog, state.customGimbals]);
  const gimbal = gimbals.find((g) => g.id === setup.gimbalId) ?? null;
  const { resolved, missing } = useMemo(() => resolveItems(setup.items, byId), [setup.items, byId]);
  const selected = resolved.find((i) => i.instanceId === state.selectedId) ?? null;
  const allEquipment = useMemo(() => [...state.customEquipment, ...catalog.equipment], [catalog.equipment, state.customEquipment]);

  const { analysis, error } = useMemo((): { analysis: SetupAnalysis | null; error: string | null } => {
    try {
      return { analysis: analyzeSetup(resolved, gimbal, setup.adjustments, setup.pose, settings), error: null };
    } catch (e) {
      return { analysis: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [resolved, gimbal, setup.adjustments, setup.pose, settings]);
  const notices = useMemo(() => setupNotices(resolved), [resolved]);

  // Atalhos: desfazer/refazer, remover item, limpar seleção. Ignorados ao digitar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && key === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      } else if (key === "delete" || key === "backspace") {
        e.preventDefault();
        dispatch({ type: "remove_selected" });
      } else if (key === "escape") {
        dispatch({ type: "select", instanceId: null });
      }
    };
    // Soltar o mouse encerra um gesto contínuo (arraste/slider) → próximo passo vira novo "desfazer"
    const onUp = () => dispatch({ type: "end_gesture" });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const onSelect = useCallback((id: string | null) => dispatch({ type: "select", instanceId: id }), []);
  const onMove = useCallback(
    (id: string, change: { position?: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number } }) =>
      dispatch({ type: "move", instanceId: id, ...change }),
    [],
  );

  const doExport = () => {
    const file = exportSetup(setup, byId, gimbal);
    const slug = setup.name.toLowerCase().normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "setup";
    downloadJSON(`${slug}.gimbal.json`, file);
    setToast({ tone: "info", lines: ["Setup exportado em JSON."] });
  };
  const doShare = async () => {
    try {
      const token = await encodeShareToken(exportSetup(setup, byId, gimbal));
      const url = `${window.location.origin}${window.location.pathname}#${SHARE_PARAM}=${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setToast({ tone: "info", lines: ["Link do setup copiado.", "Quem abrir verá este setup, incluindo equipamentos personalizados."] });
      } catch {
        window.prompt("Copie o link do setup:", url);
      }
    } catch {
      setToast({ tone: "error", lines: ["Este navegador não suporta a geração do link. Use Exportar."] });
    }
  };
  const doImport = async (f: File) => {
    const text = await f.text();
    const r = importSetup(text, new Set(byId.keys()), new Set(gimbals.map((g) => g.id)));
    if (!r.ok) return setToast({ tone: "error", lines: r.errors });
    dispatch({ type: "load_setup", setup: r.setup, customEquipment: r.customEquipment, customGimbal: r.customGimbal });
    setToast(r.warnings.length ? { tone: "warning", lines: [`“${r.setup.name}” importado com avisos:`, ...r.warnings] } : { tone: "info", lines: [`“${r.setup.name}” importado.`] });
  };

  const balanceSection = (
    <>
      <Section
        title="Gimbal"
        right={
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setModal({ kind: "gimbal" })}>
            Personalizado
          </Button>
        }
      >
        <select
          className="h-9 w-full rounded-md border border-ink-600 bg-ink-950 px-2 text-sm"
          value={setup.gimbalId ?? ""}
          onChange={(e) => dispatch({ type: "set_gimbal", gimbalId: e.target.value || null })}
          aria-label="Modelo do gimbal"
        >
          <option value="">— Selecione o gimbal —</option>
          <optgroup label="Catálogo">
            {catalog.gimbals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {(g.payload.maximum / 1000).toFixed(1)} kg
              </option>
            ))}
          </optgroup>
          {state.customGimbals.length > 0 && (
            <optgroup label="Personalizados">
              {state.customGimbals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {(g.payload.maximum / 1000).toFixed(1)} kg
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {gimbal && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-ink-400">
            <span className="flex items-center gap-1">
              Carga <SourceBadge source={gimbal.payloadSource} compact />
            </span>
            <span className="flex items-center gap-1">
              Geometria <SourceBadge source={gimbal.geometrySource} compact />
            </span>
            {gimbal.custom && (
              <button type="button" className="text-amber hover:underline" onClick={() => setModal({ kind: "gimbal", initial: gimbal })}>
                editar
              </button>
            )}
          </div>
        )}
      </Section>

      {gimbal && analysis?.payload && (
        <Section title="Payload">
          <PayloadMeter p={analysis.payload} />
        </Section>
      )}

      {gimbal && analysis?.balance && (
        <Section title="Balanceamento">
          <BalancePanel balance={analysis.balance} tolerance={settings.balanceTolerance} onApply={() => dispatch({ type: "apply_recommended" })} />
        </Section>
      )}

      {gimbal && analysis && analysis.clearance.length > 0 && (
        <Section title="Interferência física (estimada)">
          <ul className="space-y-1 text-[12px] text-amber">
            {analysis.clearance.map((c) => (
              <li key={c.id} className="flex gap-1.5">
                <Icon name="alert" size={14} className="mt-px shrink-0" /> {c.message}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!gimbal && (
        <div className="panel border-dashed p-4 text-center text-sm text-ink-300">Selecione um gimbal para ver capacidade e balanceamento.</div>
      )}
    </>
  );

  const adjustSection = gimbal && (
    <>
      <Section title="Ajustes mecânicos">
        <AdjustmentsPanel
          gimbal={gimbal}
          adjustments={setup.adjustments}
          balance={analysis?.balance ?? null}
          onChange={(key, value) => dispatch({ type: "set_adjustment", key, value })}
        />
      </Section>
      <Section title="Simular pose">
        <PosePanel
          gimbal={gimbal}
          pose={setup.pose}
          torque={analysis?.poseTorque ?? null}
          onChange={(axis, value) => dispatch({ type: "set_pose", axis, value })}
          onReset={() => dispatch({ type: "reset_pose" })}
        />
      </Section>
    </>
  );

  const settingsSection = (
    <Section title="Critérios">
      <div className="space-y-3 text-[12px]">
        <label className="block">
          <span className="flex justify-between">
            <span className="text-ink-200">Margem de segurança da carga</span>
            <span className="num">{Math.round(settings.safetyMargin * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={Math.round(settings.safetyMargin * 100)}
            onChange={(e) => dispatch({ type: "settings", settings: { safetyMargin: Number(e.target.value) / 100 } })}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className="flex justify-between">
            <span className="text-ink-200">Tolerância de balanceamento</span>
            <span className="num">{settings.balanceTolerance} mm</span>
          </span>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={settings.balanceTolerance}
            onChange={(e) => dispatch({ type: "settings", settings: { balanceTolerance: Number(e.target.value) } })}
            className="w-full"
          />
        </label>
      </div>
    </Section>
  );

  const disclaimer = (
    <div className="rounded-[10px] border border-ink-700 p-3 text-[11px] leading-relaxed text-ink-400">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink-200">
        <Icon name="info" size={14} /> Estimativa geométrica
      </p>
      Resultados calculados a partir de peso, dimensões e centro de massa informados — não são certificação de compatibilidade nem simulação
      física completa. Massa dos braços/motores do gimbal e efeitos dinâmicos não são considerados. Sempre faça o balanceamento real no
      equipamento.
      {analysis && (analysis.estimatedComCount > 0 || analysis.nonOfficialCount > 0) && (
        <span className="mt-1.5 block text-amber">
          Neste setup: {analysis.estimatedComCount} item(ns) com CM pelo centro geométrico, {analysis.nonOfficialCount} com dados não
          oficiais.
        </span>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {/* Cabeçalho */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-950 px-3 lg:px-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-6 w-6 items-center justify-center rounded border border-ink-500">
            <span className="h-2 w-2 rounded-full bg-tally" />
          </span>
          <span className="hidden text-[13px] font-black tracking-[0.2em] sm:inline">GIMBAL SIMULATOR</span>
        </div>
        <span className="hidden h-5 w-px bg-ink-700 sm:block" />
        <input
          value={setup.name}
          onChange={(e) => dispatch({ type: "rename", name: e.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm font-medium outline-none hover:bg-ink-850 focus:bg-ink-850 sm:max-w-sm"
          aria-label="Nome do setup"
        />
        <nav className="ml-auto flex items-center gap-0.5">
          <IconButton icon="undo" label="Desfazer (Ctrl+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: "undo" })} />
          <IconButton icon="redo" label="Refazer (Ctrl+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: "redo" })} />
          <span className="mx-1 hidden h-5 w-px bg-ink-700 sm:block" />
          <HeaderBtn icon="link" label="Compartilhar" onClick={() => void doShare()} />
          <HeaderBtn icon="folder" label="Presets" onClick={() => setModal({ kind: "presets" })} />
          <HeaderBtn icon="upload" label="Importar" onClick={() => fileInput.current?.click()} />
          <HeaderBtn icon="download" label="Exportar" onClick={doExport} />
          <HeaderBtn icon="new" label="Novo" onClick={() => dispatch({ type: "new_setup" })} />
          <IconButton icon="info" label="Sobre o modelo" onClick={() => setModal({ kind: "about" })} />
        </nav>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = "";
          }}
        />
      </header>

      {error && <div className="bg-stop/15 px-4 py-2 text-sm text-stop">Erro no cálculo: {error}. Revise os dados dos equipamentos.</div>}

      {/* Layout: mobile = 3D → balanceamento → equipamentos → detalhes; desktop = 3 colunas */}
      <main
        className="grid min-h-0 flex-1 gap-2 p-2 [grid-template-areas:'view'_'balance'_'equip'_'details'] lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)_auto] lg:[grid-template-areas:'equip_view_balance'_'details_view_balance']"
      >
        <div className="sticky top-0 z-20 h-[44dvh] [grid-area:view] lg:static lg:h-auto">
          <Viewport
            items={resolved}
            gimbal={gimbal}
            adjustments={setup.adjustments}
            pose={setup.pose}
            analysis={analysis}
            tolerance={settings.balanceTolerance}
            selectedId={state.selectedId}
            onSelect={onSelect}
            onMove={onMove}
          />
        </div>

        <aside className="scrollbar-thin space-y-2 [grid-area:balance] lg:min-h-0 lg:overflow-y-auto">
          {balanceSection}
          <div className="hidden space-y-2 lg:block">
            {adjustSection}
            {settingsSection}
            {disclaimer}
          </div>
        </aside>

        <aside className="scrollbar-thin space-y-2 [grid-area:equip] lg:min-h-0 lg:overflow-y-auto">
          <Section title="Equipamentos">
            <SetupList
              items={resolved}
              missing={missing}
              totalMass={analysis?.totalMass ?? 0}
              selectedId={state.selectedId}
              onSelect={onSelect}
              onAdd={(category) => setModal({ kind: "picker", category })}
              onRemove={(id) => dispatch({ type: "remove", instanceId: id })}
              onDuplicate={(id) => dispatch({ type: "duplicate", instanceId: id })}
            />
            <div className="mt-2 flex gap-1.5">
              <Button size="sm" variant="ghost" icon="center" onClick={() => dispatch({ type: "center" })} disabled={!resolved.length}>
                Centralizar setup
              </Button>
            </div>
            {notices.length > 0 && (
              <ul className="mt-2 space-y-1">
                {notices.map((n) => (
                  <li key={n.id} className={n.level === "warning" ? "text-[11px] text-amber" : "text-[11px] text-ink-400"}>
                    • {n.message}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>

        <aside className="space-y-2 [grid-area:details] lg:max-h-[46dvh] lg:min-h-0 lg:overflow-y-auto scrollbar-thin">
          <Section title="Detalhes">
            {selected ? (
              <ItemInspector
                item={selected}
                onMove={(change) => onMove(selected.instanceId, change)}
                onReset={() => dispatch({ type: "reset_item", instanceId: selected.instanceId })}
                onEdit={() => setModal({ kind: "custom", initial: selected.equipment, replaceInstance: selected.instanceId })}
                onRemove={() => dispatch({ type: "remove", instanceId: selected.instanceId })}
              />
            ) : (
              <p className="text-[12px] text-ink-400">Selecione um equipamento na lista ou na cena para editar posição e rotação.</p>
            )}
          </Section>
          <div className="space-y-2 lg:hidden">
            {adjustSection}
            {settingsSection}
            {disclaimer}
          </div>
        </aside>
      </main>

      {/* Modais */}
      <Modal open={modal?.kind === "picker"} onClose={() => setModal(null)} title="Adicionar equipamento" wide>
        {modal?.kind === "picker" && (
          <EquipmentPicker
            equipment={allEquipment}
            initialCategory={modal.category}
            onPick={(e) => {
              dispatch({ type: "add", equipment: e });
              setModal(null);
            }}
            onCreateCustom={(category) => setModal({ kind: "custom", category })}
          />
        )}
      </Modal>
      <Modal
        open={modal?.kind === "custom"}
        onClose={() => setModal(null)}
        title={modal?.kind === "custom" && modal.initial?.custom ? "Editar equipamento" : "Equipamento personalizado"}
      >
        {modal?.kind === "custom" && (
          <CustomEquipmentForm
            initial={modal.initial}
            defaultCategory={modal.category ?? undefined}
            onCancel={() => setModal(null)}
            onSave={(e) => {
              const wasCustom = modal.initial?.custom === true;
              dispatch({ type: "upsert_custom_equipment", equipment: e });
              if (!wasCustom) {
                // Cópia editável de um item já montado: mantém posição e rotação
                if (modal.replaceInstance) dispatch({ type: "replace_equipment", instanceId: modal.replaceInstance, equipment: e });
                else dispatch({ type: "add", equipment: e });
              }
              setModal(null);
              setToast({ tone: "info", lines: [wasCustom ? `“${e.name}” atualizado.` : modal.replaceInstance ? `“${e.name}” criado no lugar do original.` : `“${e.name}” cadastrado e adicionado.`] });
            }}
          />
        )}
      </Modal>
      <Modal open={modal?.kind === "gimbal"} onClose={() => setModal(null)} title="Gimbal personalizado">
        {modal?.kind === "gimbal" && (
          <CustomGimbalForm
            templates={catalog.gimbals}
            initial={modal.initial}
            onCancel={() => setModal(null)}
            onSave={(g) => {
              dispatch({ type: "upsert_custom_gimbal", gimbal: g });
              setModal(null);
            }}
          />
        )}
      </Modal>
      <Modal open={modal?.kind === "presets"} onClose={() => setModal(null)} title="Presets">
        {modal?.kind === "presets" && (
          <PresetsPanel
            currentName={setup.name}
            presets={state.presets}
            onSave={(name) => {
              dispatch({ type: "save_preset", name });
              setToast({ tone: "info", lines: [`Preset “${name}” salvo.`] });
            }}
            onLoad={(p) => {
              dispatch({ type: "load_setup", setup: { ...p, updatedAt: new Date().toISOString() } });
              setModal(null);
            }}
            onLoadBuiltin={(id) => {
              dispatch({ type: "load_builtin", presetId: id });
              setModal(null);
            }}
            onDelete={(id) => dispatch({ type: "delete_preset", id })}
          />
        )}
      </Modal>
      <Modal open={modal?.kind === "about"} onClose={() => setModal(null)} title="Como o cálculo funciona" wide>
        <AboutModel gimbalMasses={!!gimbal?.movingMasses} />
      </Modal>

      {toast && (
        <div
          role="status"
          className={
            "fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-md border px-3 py-2 text-[12px] shadow-xl backdrop-blur " +
            (toast.tone === "error"
              ? "border-stop/50 bg-ink-950/95 text-stop"
              : toast.tone === "warning"
                ? "border-amber/50 bg-ink-950/95 text-amber"
                : "border-ink-600 bg-ink-950/95 text-ink-100")
          }
          onClick={() => setToast(null)}
        >
          {toast.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeaderBtn({ icon, label, onClick }: { icon: "folder" | "upload" | "download" | "new" | "link"; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-ink-200 hover:bg-ink-800 hover:text-ink-100"
    >
      <Icon name={icon} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function AboutModel({ gimbalMasses }: { gimbalMasses: boolean }) {
  return (
    <div className="space-y-3 text-[13px] leading-relaxed text-ink-200">
      <p>
        <b>Referencial:</b> X = esquerda/direita, Y = trás/frente (a lente aponta para +Y), Z = baixo/cima. Origem no centro da base da câmera,
        sobre a placa. Massa em gramas, distâncias em milímetros.
      </p>
      <p>
        <b>Centro de massa:</b> média ponderada dos centros de massa dos itens, CM = Σ(mᵢ·pᵢ)/Σmᵢ. Sem CM informado, usamos o centro
        geométrico da caixa do item.
      </p>
      <p>
        <b>Balanceamento:</b> os eixos tilt (X) e roll (Y) se cruzam no pivô; o pan é vertical. A carga fica em (roll, placa, −altura) em
        relação ao pivô. Um eixo está balanceado quando o CM está sobre ele: tilt pede Y = 0 e Z = 0 (placa e altura), roll pede X = 0
        (braço horizontal), pan pede o CM sobre o eixo vertical (braço vertical). As recomendações seguem a ordem real: tilt → roll → pan,
        respeitando o curso de cada ajuste.
      </p>
      <p>
        <b>Massa do gimbal:</b> cada eixo equilibra também as partes do gimbal que giram com ele. O tilt leva a morsa e o braço em L; o roll
        soma o motor tilt e o braço horizontal; o pan soma ainda o motor roll e o braço vertical, que ficam atrás da carga. Por isso o pan
        pede ajuste mesmo com o tilt balanceado.{" "}
        <span className="text-amber">
          {gimbalMasses
            ? "Essas massas são estimadas: os fabricantes não as publicam."
            : "Este gimbal não tem massas cadastradas: o cálculo o trata como sem massa."}
        </span>
      </p>
      <p>
        <b>Torque:</b> m·g·d com o desvio atual — o pior caso estático. Na seção “Simular pose” calculamos o torque da gravidade com o
        gimbal girado, ignorando aceleração.
      </p>
      <p className="text-amber">
        <b>Limitações:</b> a massa das partes móveis do gimbal é estimada e tratada como pontos, e a inércia é ignorada; a geometria do gimbal e cursos de ajuste são
        estimados; dados de catálogo podem conter erros. Use como planejamento, não como garantia.
      </p>
    </div>
  );
}
