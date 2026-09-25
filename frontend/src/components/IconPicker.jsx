import { useMemo, useState } from "react";
import { Search, Shapes } from "lucide-react";
import Modal from "@/components/Modal";
import { ICON_CATEGORIES, iconFor } from "@/lib/icons";

export default function IconPicker({ open, onClose, value, onChange, title = "Scegli un'icona" }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const list = useMemo(() => {
    const cats = cat === "all" ? ICON_CATEGORIES : ICON_CATEGORIES.filter((c) => c.key === cat);
    const needle = q.trim().toLowerCase();
    return cats.map((c) => ({ ...c, names: Object.keys(c.icons).filter((n) => !needle || n.includes(needle) || c.label.toLowerCase().includes(needle)) })).filter((c) => c.names.length);
  }, [q, cat]);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle="Cerca per nome o sfoglia per categoria" icon={<Shapes size={18} />} testid="icon-picker" width="max-w-3xl">
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="field !pl-9" placeholder="Cerca icona… (es. stufa, presa, lampada)" value={q} onChange={(e) => setQ(e.target.value)} data-testid="icon-search" autoFocus />
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap mb-5">
        <button onClick={() => setCat("all")} className={`chip !py-1 ${cat === "all" ? "chip-active" : ""}`} data-testid="icon-cat-all">Tutte</button>
        {ICON_CATEGORIES.map((c) => <button key={c.key} onClick={() => setCat(c.key)} className={`chip !py-1 ${cat === c.key ? "chip-active" : ""}`} data-testid={`icon-cat-${c.key}`}>{c.label}</button>)}
      </div>
      <div className="space-y-5">
        {list.map((c) => (
          <div key={c.key}>
            <div className="label mb-2">{c.label}</div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
              {c.names.map((n) => {
                const I = iconFor(n);
                return (
                  <button key={n} title={n} onClick={() => { onChange(n); onClose(); }} className={`icon-btn w-10 h-10 ${value === n ? "icon-on ring-2 ring-[rgb(var(--acc)/0.6)]" : "icon-off hover:bg-white/60 dark:hover:bg-white/10"}`} data-testid={`icon-option-${n}`}>
                    <I size={17} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-sm text-muted text-center py-8">Nessuna icona trovata.</div>}
      </div>
    </Modal>
  );
}

export function IconButton({ value, onClick, size = 40, testid = "icon-picker-btn" }) {
  const I = iconFor(value);
  return (
    <button type="button" onClick={onClick} className="icon-btn icon-on shrink-0" style={{ width: size, height: size }} data-testid={testid} title="Cambia icona">
      <I size={size * 0.45} />
    </button>
  );
}
