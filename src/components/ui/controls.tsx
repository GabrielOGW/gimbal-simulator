"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { DataSource } from "@/lib/equipment/types";
import { SOURCE_LABELS } from "@/lib/equipment/categories";
import { formatDay } from "@/lib/format";
import { Icon, type IconName } from "./Icon";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
  icon?: IconName;
};

export function Button({ variant = "outline", size = "md", icon, className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none select-none",
        size === "sm" ? "h-7 px-2 text-xs pointer-coarse:h-9 pointer-coarse:px-2.5" : "h-9 px-3 text-sm pointer-coarse:h-11",
        variant === "primary" && "bg-amber text-ink-950 hover:bg-[#ffc24d]",
        variant === "outline" && "border border-ink-600 text-ink-100 hover:border-ink-400 hover:bg-ink-800",
        variant === "ghost" && "text-ink-200 hover:bg-ink-800 hover:text-ink-100",
        variant === "danger" && "border border-stop/40 text-stop hover:bg-stop/10",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className, ...rest }: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 pointer-coarse:h-10 pointer-coarse:w-10",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

/**
 * Campo numérico com unidade explícita e passo rápido. Confirma no blur/Enter.
 * `value` já vem na unidade exibida; `digits` são as casas mostradas. Sair do
 * campo sem editar não regrava o valor (evita acumular arredondamento ao
 * converter unidades).
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  accent,
  compact,
  digits = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  accent?: string;
  compact?: boolean;
  digits?: number;
}) {
  const id = useId();
  const k = 10 ** digits;
  const shown = String(Math.round(value * k) / k);
  const [draft, setDraft] = useState(shown);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(shown);
  }, [shown]);

  const commit = (raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(n)) {
      setDraft(shown);
      return;
    }
    if (raw.trim() === shown) return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    onChange(clamped);
    setDraft(String(Math.round(clamped * k) / k));
  };
  const bump = (dir: 1 | -1) => commit(String(Math.round((value + dir * step) * k) / k));

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="num w-5 shrink-0 text-xs font-bold" style={{ color: accent }}>
        {label}
      </label>
      <div className="flex min-w-0 flex-1 items-center rounded-md border border-ink-600 bg-ink-950 focus-within:border-amber">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => bump(-1)} className="h-8 w-7 shrink-0 text-ink-300 hover:text-ink-100 pointer-coarse:h-10 pointer-coarse:w-10">
          −
        </button>
        <input
          id={id}
          inputMode="decimal"
          className={cx("num min-w-0 flex-1 bg-transparent text-center text-sm outline-none", compact ? "h-7" : "h-8", "pointer-coarse:h-10")}
          value={draft}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            focused.current = false;
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "ArrowUp") {
              e.preventDefault();
              bump(1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              bump(-1);
            }
          }}
        />
        <span className="num pr-1 text-[10px] text-ink-400">{unit}</span>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => bump(1)} className="h-8 w-7 shrink-0 text-ink-300 hover:text-ink-100 pointer-coarse:h-10 pointer-coarse:w-10">
          +
        </button>
      </div>
    </div>
  );
}

export function SourceBadge({ source, compact }: { source: DataSource; compact?: boolean }) {
  const styles = {
    official: "border-info/40 text-info",
    estimated: "border-amber/40 text-amber",
    user: "border-go/40 text-go",
  }[source.kind];
  const checked = source.checkedAt && `conferido em ${formatDay(source.checkedAt)}`;
  const title = [SOURCE_LABELS[source.kind], source.reference, checked, source.note].filter(Boolean).join(" — ");
  return (
    <span title={title} className={cx("inline-flex items-center rounded border px-1 text-[9px] font-semibold uppercase tracking-wider", styles)}>
      {compact ? SOURCE_LABELS[source.kind].slice(0, 3) : SOURCE_LABELS[source.kind]}
    </span>
  );
}

export type Tone = "go" | "amber" | "stop" | "muted" | "info";
export const toneText: Record<Tone, string> = {
  go: "text-go",
  amber: "text-amber",
  stop: "text-stop",
  muted: "text-ink-300",
  info: "text-info",
};

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    go: "bg-go/12 text-go border-go/30",
    amber: "bg-amber/12 text-amber border-amber/30",
    stop: "bg-stop/12 text-stop border-stop/30",
    muted: "bg-ink-800 text-ink-300 border-ink-600",
    info: "bg-info/12 text-info border-info/30",
  };
  return (
    <span className={cx("num inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", styles[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 pt-[var(--sa-top)] pl-[var(--sa-left)] pr-[var(--sa-right)] backdrop-blur-sm sm:items-center sm:p-4 sm:pl-[max(1rem,var(--sa-left))] sm:pr-[max(1rem,var(--sa-right))]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "panel flex max-h-[calc(100dvh-var(--sa-top)-0.5rem)] w-full flex-col overflow-hidden rounded-b-none shadow-2xl sm:max-h-[92dvh] sm:rounded-b-[10px]",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <h2 className="label !text-ink-100">{title}</h2>
          <IconButton icon="x" label="Fechar" onClick={onClose} />
        </div>
        {/* Embaixo, a folha encosta no home indicator: o conteúdo para antes dele */}
        <div className="scrollbar-thin overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+var(--sa-bottom))] sm:pb-4">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("panel p-3", className)}>
      <header className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
        <h2 className="label">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  unit,
  type = "text",
  required,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  unit?: string;
  type?: "text" | "number";
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="label">
        {label}
        {required && <span className="text-amber"> *</span>}
      </span>
      <div className="flex items-center rounded-md border border-ink-600 bg-ink-950 focus-within:border-amber">
        <input
          id={id}
          type={type}
          inputMode={type === "number" ? "decimal" : undefined}
          className={cx("h-9 min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none pointer-coarse:h-11", type === "number" && "num")}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
        />
        {unit && <span className="num pr-2.5 text-xs text-ink-400">{unit}</span>}
      </div>
    </label>
  );
}
