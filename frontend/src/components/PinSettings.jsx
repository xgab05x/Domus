import { useState } from "react";
import { KeyRound, Lock, ShieldOff, Cctv, Save } from "lucide-react";
import { toast } from "sonner";
import { useDomus } from "@/context/DomusContext";
import { PinAPI } from "@/lib/api";

// Settings tab: household PIN (disarm + sensitive actions).
export default function PinSettings() {
  const { settings, updateSettings } = useDomus();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (patch) => { await updateSettings(patch); toast.success("Impostazioni salvate"); };

  const changePin = async () => {
    if (!/^\d{4,6}$/.test(next)) return toast.error("Il nuovo PIN deve avere 4-6 cifre");
    if (next !== confirm) return toast.error("I due PIN non coincidono");
    setBusy(true);
    try {
      await PinAPI.change(current, next);
      toast.success("PIN aggiornato");
      setCurrent(""); setNext(""); setConfirm("");
      await updateSettings({ pin_enabled: settings?.pin_enabled !== false });
    } catch (err) { toast.error(err?.response?.data?.detail || "Modifica PIN non riuscita"); }
    setBusy(false);
  };

  return (
    <div className="space-y-6" data-testid="pin-settings">
      <div className="glass-inner rounded-3xl p-4">
        <div className="flex items-start gap-3">
          <div className="icon-btn icon-on w-11 h-11 shrink-0"><Lock size={20} /></div>
          <div className="min-w-0">
            <div className="font-semibold text-sm">PIN di sicurezza {settings?.pin_set ? "impostato" : "non impostato"}</div>
            <p className="text-xs text-muted mt-0.5">Protegge le azioni critiche sui tablet condivisi. Blocco automatico per 60 secondi dopo 5 tentativi errati. PIN iniziale: <span className="font-mono">1234</span> — cambialo qui sotto.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Toggle icon={<KeyRound size={15} />} label="Protezione PIN attiva" hint="Disattivandola nessuna azione richiede il PIN" on={settings?.pin_enabled !== false} onClick={() => save({ pin_enabled: !(settings?.pin_enabled !== false) })} testid="pin-toggle-enabled" />
        <Toggle icon={<ShieldOff size={15} />} label="PIN per disarmare l'allarme" hint="Armare resta libero, disarmare richiede il PIN" on={settings?.pin_protect_disarm !== false} onClick={() => save({ pin_protect_disarm: !(settings?.pin_protect_disarm !== false) })} testid="pin-toggle-disarm" />
        <Toggle icon={<Cctv size={15} />} label="PIN per azioni sensibili" hint="Apri porta del citofono, privacy telecamera, sirena" on={settings?.pin_protect_sensitive !== false} onClick={() => save({ pin_protect_sensitive: !(settings?.pin_protect_sensitive !== false) })} testid="pin-toggle-sensitive" />
      </div>

      <div>
        <div className="label mb-2">Cambia PIN</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <input className="field font-mono" type="password" inputMode="numeric" maxLength={6} placeholder="PIN attuale" value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} data-testid="pin-current" />
          <input className="field font-mono" type="password" inputMode="numeric" maxLength={6} placeholder="Nuovo PIN" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} data-testid="pin-new" />
          <input className="field font-mono" type="password" inputMode="numeric" maxLength={6} placeholder="Conferma" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} data-testid="pin-confirm-new" />
        </div>
        <button onClick={changePin} disabled={busy} className="btn-acc mt-3 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50" data-testid="pin-save"><Save size={14} /> Salva nuovo PIN</button>
      </div>
    </div>
  );
}

function Toggle({ icon, label, hint, on, onClick, testid }) {
  return (
    <button onClick={onClick} className="w-full glass-inner rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-left press" data-testid={testid} aria-pressed={on}>
      <span className="min-w-0"><span className="text-sm flex items-center gap-2">{icon} {label}</span>{hint && <span className="block text-[11px] text-muted mt-0.5">{hint}</span>}</span>
      <span className={`toggle shrink-0 ${on ? "on" : ""}`} />
    </button>
  );
}
