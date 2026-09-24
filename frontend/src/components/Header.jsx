import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Sun, Shield, Settings as SettingsIcon, Sunrise, Sunset, Moon, CloudSun } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { PHASE_LABEL, formatHour } from "@/lib/solar";
import { useState } from "react";
import SettingsDialog from "@/components/SettingsDialog";

const phaseIcon = {
  dawn: Sunrise,
  day: CloudSun,
  sunset: Sunset,
  night: Moon,
};

export default function Header() {
  const { phase, settings } = useDomus();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const isSol = loc.pathname.startsWith("/sol-invictus");
  const PhaseIcon = phaseIcon[phase.phase] || Sun;

  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 pt-4">
        <div className="glass-strong rounded-full flex items-center justify-between gap-4 pl-3 pr-2 py-2">
          {/* Brand */}
          <div className="flex items-center gap-3 pl-2 shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-cyan-500 shadow-md" />
            <div className="hidden sm:block">
              <div className="font-display text-lg font-bold leading-none">Domus</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{settings?.home_name || "Casa"}</div>
            </div>
          </div>

          {/* Switcher */}
          <div
            className="relative flex items-center bg-slate-100/60 dark:bg-slate-800/60 rounded-full p-1"
            data-testid="section-switcher"
          >
            <button
              data-testid="switcher-sol-invictus"
              onClick={() => nav("/sol-invictus")}
              className={`relative z-10 flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                isSol
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sun size={16} />
              <span>Sol Invictus</span>
            </button>
            <button
              data-testid="switcher-terminus"
              onClick={() => nav("/terminus")}
              className={`relative z-10 flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                !isSol
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Shield size={16} />
              <span>Terminus</span>
            </button>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2">
            <div
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10"
              data-testid="solar-phase-widget"
            >
              <PhaseIcon size={16} className="text-amber-500" />
              <div className="text-xs leading-tight">
                <div className="font-semibold" data-testid="solar-phase-label">{PHASE_LABEL[phase.phase]}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  ↑{formatHour(phase.sunriseHour)} · ↓{formatHour(phase.sunsetHour)}
                </div>
              </div>
            </div>
            <button
              data-testid="open-settings-btn"
              onClick={() => setOpen(true)}
              className="w-10 h-10 rounded-full bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700 border border-white/40 dark:border-white/10 flex items-center justify-center transition-colors"
              aria-label="Impostazioni"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </div>
      </div>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
