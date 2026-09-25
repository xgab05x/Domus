import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Sun, Shield, Settings as SettingsIcon, Sunrise, Sunset, Moon, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog, CloudLightning } from "lucide-react";
import { useDomus } from "@/context/DomusContext";
import { PHASE_LABEL, formatHour } from "@/lib/solar";
import SettingsDialog from "@/components/SettingsDialog";
import { BrandLogo, DomusMark } from "@/components/BrandMedia";

const phaseIcon = { dawn: Sunrise, day: CloudSun, sunset: Sunset, night: Moon };
const weatherIcon = { clear: Sun, clouds: Cloud, rain: CloudRain, snow: CloudSnow, fog: CloudFog, storm: CloudLightning };
const WEATHER_LABEL = { clear: "Sereno", clouds: "Nuvoloso", rain: "Pioggia", snow: "Neve", fog: "Nebbia", storm: "Temporale" };

export default function Header() {
  const { phase, settings, weather } = useDomus();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const isSol = !loc.pathname.startsWith("/terminus");
  const PhaseIcon = phaseIcon[phase.phase] || Sun;
  const WIcon = weatherIcon[weather?.condition] || Sun;

  return (
    <header className="fixed top-0 inset-x-0 z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 pt-4">
        <div className="glass-strong rounded-full flex items-center justify-between gap-3 pl-3 pr-2 py-1.5">
          <div className="flex items-center gap-3 pl-1 shrink-0" data-testid="brand">
            <BrandLogo name="domus" size={34} fallback={<DomusMark size={34} />} testid="brand-logo-domus" />
            <div className="hidden sm:block leading-tight">
              <div className="font-display text-base font-semibold">Domus</div>
              <div className="label">{settings?.home_name || "Casa"}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full glass-inner" data-testid="section-switcher">
            <button data-testid="switcher-sol-invictus" onClick={() => nav("/sol-invictus")} className={`chip !py-2 ${isSol ? "chip-active" : "!bg-transparent !border-transparent"}`}>
              <Sun size={15} /> <span className="hidden sm:inline">Sol Invictus</span><span className="sm:hidden">Sol</span>
            </button>
            <button data-testid="switcher-terminus" onClick={() => nav("/terminus")} className={`chip !py-2 ${!isSol ? "chip-active" : "!bg-transparent !border-transparent"}`}>
              <Shield size={15} /> Terminus
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
            <button data-testid="open-settings-btn" onClick={() => setOpen(true)} className="btn-ghost w-10 h-10 rounded-full flex items-center justify-center" aria-label="Impostazioni">
              <SettingsIcon size={17} />
            </button>
          </div>
        </div>
      </div>
      <SettingsDialog open={open} onOpenChange={setOpen} />
    </header>
  );
}
