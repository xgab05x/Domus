import { useState } from "react";
import { Megaphone, MessageSquare, Send, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { MediaAPI } from "@/lib/api";
import { iconFor } from "@/lib/icons";

const QUICK = ["La cena è pronta!", "Qualcuno è alla porta.", "Ricordati di chiudere il gas.", "Buonanotte a tutti."];

// Broadcast TTS to speakers and text notifications to screens (Android TV, Fire TV, Echo Show, Nest Hub).
export default function AnnouncePanel({ players }) {
  const { ha, refresh } = useDomus();
  const speakers = players.filter((p) => p.available !== false);
  const screens = players.filter((p) => p.state?.screen || p.state?.device_class === "tv");
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("Domus");
  const [targets, setTargets] = useState(() => new Set(speakers.map((p) => p.id)));
  const [screenTargets, setScreenTargets] = useState(() => new Set(screens.map((p) => p.id)));
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggle = (set, setter, id) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };
  const sendTts = async () => {
    if (!msg.trim()) return toast.error("Scrivi un messaggio");
    if (targets.size === 0) return toast.error("Scegli almeno un altoparlante");
    setBusy(true);
    try { const r = await MediaAPI.tts(msg.trim(), Array.from(targets), announce); toast.success(`${r.demo ? "Annuncio simulato (demo)" : "Annuncio inviato"} a ${r.sent.length} dispositivi`); if (r.errors?.length) toast.warning(`${r.errors.length} errori`); await refresh(); }
    finally { setBusy(false); }
  };
  const sendNotify = async () => {
    if (!msg.trim()) return toast.error("Scrivi un messaggio");
    if (screenTargets.size === 0) return toast.error("Scegli almeno uno schermo");
    setBusy(true);
    try { const r = await MediaAPI.notify(title, msg.trim(), Array.from(screenTargets)); toast.success(`${r.demo ? "Notifica simulata (demo)" : "Notifica inviata"} a ${r.sent.length} schermi`); await refresh(); }
    finally { setBusy(false); }
  };

  return (
    <div className="glass rounded-[28px] p-6 space-y-5" data-testid="announce-panel">
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <input className="field flex-1 min-w-[220px]" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Scrivi il messaggio da far pronunciare o mostrare…" data-testid="announce-message" />
        </div>
        <div className="flex gap-1.5 flex-wrap">{QUICK.map((q) => <button key={q} onClick={() => setMsg(q)} className="chip !py-1 !text-[11px]" data-testid={`announce-quick-${q.length}`}>{q}</button>)}</div>
        {!ha?.connected && <p className="text-[11px] text-muted mt-2">Modalità demo: gli annunci vengono registrati ma non riprodotti. Con Home Assistant collegato usano Alexa Media / TTS / notify.</p>}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-inner rounded-3xl p-4 space-y-3" data-testid="announce-tts">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-sm"><Megaphone size={15} className="text-acc" /> Annuncio vocale</div>
            <button onClick={() => setAnnounce((v) => !v)} className={`chip !py-1 !text-[11px] ${announce ? "chip-active" : ""}`} data-testid="announce-mode">{announce ? "Con suono di avviso" : "Solo voce"}</button>
          </div>
          <TargetList items={speakers} set={targets} onToggle={(id) => toggle(targets, setTargets, id)} onAll={() => setTargets(new Set(speakers.map((p) => p.id)))} onNone={() => setTargets(new Set())} prefix="tts" />
          <button onClick={sendTts} disabled={busy} className="w-full btn-acc px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50" data-testid="announce-send-tts"><Send size={14} /> Pronuncia su {targets.size} dispositivi</button>
        </div>
        <div className="glass-inner rounded-3xl p-4 space-y-3" data-testid="announce-notify">
          <div className="flex items-center gap-2 font-semibold text-sm"><MessageSquare size={15} className="text-acc" /> Notifica su schermo</div>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo" data-testid="announce-title" />
          <TargetList items={screens} set={screenTargets} onToggle={(id) => toggle(screenTargets, setScreenTargets, id)} onAll={() => setScreenTargets(new Set(screens.map((p) => p.id)))} onNone={() => setScreenTargets(new Set())} prefix="notify" />
          <button onClick={sendNotify} disabled={busy} className="w-full btn-acc px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50" data-testid="announce-send-notify"><Send size={14} /> Mostra su {screenTargets.size} schermi</button>
        </div>
      </div>
    </div>
  );
}

function TargetList({ items, set, onToggle, onAll, onNone, prefix }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5"><div className="label">Destinatari</div><div className="flex gap-1"><button onClick={onAll} className="text-[10px] text-acc font-semibold" data-testid={`${prefix}-all`}>tutti</button><span className="text-[10px] text-muted">·</span><button onClick={onNone} className="text-[10px] text-muted font-semibold" data-testid={`${prefix}-none`}>nessuno</button></div></div>
      <div className="flex gap-1.5 flex-wrap">
        {items.map((p) => { const I = iconFor(p.icon); const on = set.has(p.id); return (
          <button key={p.id} onClick={() => onToggle(p.id)} className={`chip !py-1 ${on ? "chip-active" : ""}`} data-testid={`${prefix}-target-${p.id}`} aria-pressed={on}>{on ? <CheckSquare size={12} /> : <Square size={12} />} <I size={12} /> {p.name}</button>
        ); })}
        {items.length === 0 && <span className="text-xs text-muted">Nessun dispositivo disponibile.</span>}
      </div>
    </div>
  );
}
