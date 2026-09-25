import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Delete, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { PinAPI } from "@/lib/api";
import { useEscape } from "@/hooks/useEscape";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

// Numeric keypad that verifies the household PIN before a protected action runs.
export default function PinDialog({ open, reason, onConfirm, onCancel }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEscape(open, onCancel);
  useEffect(() => { if (open) { setPin(""); setError(""); } }, [open]);

  const submit = async (value) => {
    if (value.length < 4 || busy) return;
    setBusy(true); setError("");
    try {
      await PinAPI.verify(value);
      setBusy(false);
      onConfirm(value);
    } catch (err) {
      const status = err?.response?.status;
      setError(status === 429 ? err.response.data?.detail || "Troppi tentativi: attendi" : "PIN errato");
      setPin(""); setBusy(false);
    }
  };

  const press = (k) => {
    setError("");
    if (k === "del") return setPin((p) => p.slice(0, -1));
    setPin((p) => {
      const next = (p + k).slice(0, 6);
      if (next.length === 4) submit(next);
      return next;
    });
  };

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="pin-dialog">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-md" onClick={onCancel} />
      <div className="relative glass-strong rounded-[32px] w-full max-w-[330px] p-6 pop-in">
        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <div className="icon-btn icon-on w-12 h-12 pulse-ring"><Lock size={22} /></div>
          <div className="label text-acc">PIN di sicurezza</div>
          <h3 className="font-display text-lg font-semibold leading-tight">{reason || "Conferma con il PIN"}</h3>
          <p className="text-xs text-muted">Inserisci il PIN a 4-6 cifre per continuare.</p>
        </div>

        <div className="flex items-center justify-center gap-2.5 mb-4" data-testid="pin-dots">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${i < pin.length ? "bg-[rgb(var(--acc-strong))] scale-110" : "bg-slate-400/35"}`} />
          ))}
        </div>
        {error && <div className="text-center text-xs font-semibold text-rose-600 dark:text-rose-300 mb-3 shake" data-testid="pin-error">{error}</div>}

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k, i) => (k === "" ? <span key={`gap-${i}`} /> : (
            <button key={k} onClick={() => press(k)} disabled={busy} data-testid={`pin-key-${k}`}
              className="h-14 rounded-2xl glass-inner font-display text-xl font-semibold flex items-center justify-center press hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-50">
              {k === "del" ? <Delete size={18} /> : k}
            </button>
          )))}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="chip flex-1 justify-center !py-2.5" data-testid="pin-cancel">Annulla</button>
          <button onClick={() => submit(pin)} disabled={pin.length < 4 || busy} className="btn-acc flex-1 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="pin-confirm">
            {busy ? <KeyRound size={14} className="animate-spin" /> : <ShieldCheck size={15} />} Conferma
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
