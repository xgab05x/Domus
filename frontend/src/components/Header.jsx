import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Sun, Shield, Settings as SettingsIcon, Sunrise, Sunset, Moon, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning, Bell, AlertTriangle, Info, CheckCheck, Trash2 } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { PHASE_LABEL, formatHour } from "@/lib/solar";
import SettingsDialog from "@/components/SettingsDialog";
import { BrandLogo, DomusMark } from "@/components/BrandMedia";

const phaseIcon = { dawn: Sunrise, day: CloudSun, sunset: Sunset, night: Moon };
const weatherIcon = { clear: Sun, clouds: Cloud, rain: CloudRain, snow: CloudSnow, fog: CloudFog, storm: CloudLightning };
const WEATHER_LABEL = { clear: "Sereno", clouds: "Nuvoloso", rain: "Pioggia", snow: "Neve", fog: "Nebbia", storm: "Temporale" };

export default function Header() {
  const { phase, settings, weather, notifications, markNotificationsRead, clearNotifications, ha } = useDomus();
  const [open, setOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [bell, setBell] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const isSol = !loc.pathname.startsWith("/terminus");
  const PhaseIcon = phaseIcon[phase.phase] || Sun;
  const WIcon = weatherIcon[weather?.condition] || Sun;
  const unread = notifications.filter((n) => !n.read).length;
  const openSettings = (tab = "general") => { setSettingsTab(tab); setOpen(true); };

  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 pt-4">
        <div className="glass-strong rounded-full flex items-center justify-between gap-3 pl-3 pr-2 py-1.5">
          <div className="flex items-center gap-3 pl-1 shrink-0" data-testid="brand">
            <BrandLogo name={isSol ? "sol" : "terminus"} size={38} className="drop-shadow" fallback={<DomusMark size={34} />} testid="brand-logo-header" />
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-base font-semibold">Domus</div>
              <div className="label">{settings?.home_name || "Casa"}</div>
            </div>
            <button onClick={() => openSettings("ha")} className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${ha?.connected ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-slate-600 dark:text-slate-300"}`} data-testid="ha-mode-pill" title={ha?.connected ? `Home Assistant ${ha.version}` : "Modalità demo · clicca per collegare Home Assistant"}>
              <span className={`w-1.5 h-1.5 rounded-full ${ha?.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} /> {ha?.connected ? "HA live" : "Demo"}
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full glass-inner" data-testid="section-switcher">
            <button data-testid="switcher-sol-invictus" onClick={() => nav("/sol-invictus")} className={`chip !py-1.5 ${isSol ? "chip-active" : "!bg-transparent !border-transparent"}`}>
              <BrandLogo name="sol" size={20} fallback={<Sun size={15} />} /> <span className="hidden sm:inline">{settings?.sol_label || "Sol Invictus"}</span><span className="sm:hidden">{(settings?.sol_label || "Sol").split(" ")[0]}</span>
            </button>
            <button data-testid="switcher-terminus" onClick={() => nav("/terminus")} className={`chip !py-1.5 ${!isSol ? "chip-active" : "!bg-transparent !border-transparent"}`}>
              <BrandLogo name="terminus" size={20} fallback={<Shield size={15} />} /> {settings?.terminus_label || "Terminus"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full glass-inner" data-testid="solar-phase-widget">
              <div className="flex items-center gap-1.5">
                <PhaseIcon size={15} className="text-acc" />
                <div className="text-xs leading-tight">
                  <div className="font-semibold" data-testid="solar-phase-label">{PHASE_LABEL[phase.phase]}</div>
                  <div className="text-[10px] text-muted font-mono">↑{formatHour(phase.sunriseHour)} · ↓{formatHour(phase.sunsetHour)}</div>
                </div>
              </div>
              {weather && (
                <div className="flex items-center gap-1.5 pl-3 border-l border-white/40 dark:border-white/10" data-testid="weather-widget">
                  <WIcon size={15} className="text-acc" />
                  <div className="text-xs leading-tight">
                    <div className="font-semibold">{WEATHER_LABEL[weather.condition] || weather.condition}</div>
                    <div className="text-[10px] text-muted font-mono">{weather.temperature != null ? `${Math.round(weather.temperature)}°C` : "—"}{weather.overridden ? " · manuale" : ""}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button data-testid="open-notifications-btn" onClick={() => setBell((v) => !v)} className="btn-ghost w-10 h-10 rounded-full flex items-center justify-center relative" aria-label="Notifiche">
                <Bell size={17} />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="notifications-unread">{unread}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 top-12 w-80 glass-strong rounded-2xl p-2 z-50 fade-in" data-testid="notifications-panel" onMouseLeave={() => setBell(false)}>
                  <div className="flex items-center justify-between px-2 py-1">
                    <div className="label">Notifiche</div>
                    <div className="flex gap-1">
                      <button onClick={markNotificationsRead} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center" title="Segna tutte lette" data-testid="notifications-read-all"><CheckCheck size={13} /></button>
                      <button onClick={clearNotifications} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center" title="Pulisci" data-testid="notifications-clear"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {notifications.slice(0, 20).map((n) => (
                      <div key={n.id} className={`rounded-xl px-2.5 py-2 text-xs flex gap-2 ${n.read ? "opacity-60" : "glass-inner"}`} data-testid={`notification-${n.id}`}>
                        {n.level === "warning" || n.level === "error" ? <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" /> : <Info size={13} className="text-acc shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0"><div className="font-semibold truncate">{n.title}</div>{n.message && <div className="text-muted">{n.message}</div>}</div>
                        <div className="text-[10px] font-mono text-muted shrink-0">{new Date(n.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    ))}
                    {notifications.length === 0 && <div className="text-xs text-muted text-center py-6">Nessuna notifica.</div>}
                  </div>
                </div>
              )}
            </div>
            <button data-testid="open-settings-btn" onClick={() => openSettings("general")} className="btn-ghost w-10 h-10 rounded-full flex items-center justify-center" aria-label="Impostazioni">
              <SettingsIcon size={17} />
            </button>
          </div>
        </div>
      </div>
      <SettingsDialog open={open} onOpenChange={setOpen} initialTab={settingsTab} />
    </header>
  );
}
