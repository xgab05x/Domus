import { useMemo } from "react";
import { useDomus } from "@/context/DomusContext";
import SkyCanvas from "@/components/SkyCanvas";

// Sky gradients: [top, middle, bottom] per solar phase and weather mood.
const GRAD = {
  dawn:   { clear: ["#c7d6ec", "#f0cbb6", "#f7dcb8"], clouds: ["#b9c4d6", "#d5bfb6", "#e6d3c2"], dim: ["#8d97a8", "#a89a98", "#b8ada4"] },
  day:    { clear: ["#79b6e6", "#b7dbf5", "#e9f4fb"], clouds: ["#9db8cf", "#c4d5e1", "#e4ecf1"], dim: ["#7c8a98", "#a0adb8", "#c6cfd6"] },
  sunset: { clear: ["#5f5b8f", "#d78b6f", "#f3c48f"], clouds: ["#63647f", "#a98a83", "#d3b7a1"], dim: ["#4c4c60", "#75686a", "#948786"] },
  night:  { clear: ["#04070f", "#0a1329", "#132241"], clouds: ["#05070d", "#0e1421", "#182131"], dim: ["#03050a", "#0a0e16", "#141922"] },
};
const CLOUD_TINT = {
  dawn: "#fbe6d6", day: "#ffffff", sunset: "#f2c9b0", night: "#2a3142",
};
const CLOUD_TINT_DIM = { dawn: "#8f96a3", day: "#a6b0bb", sunset: "#6f6c78", night: "#1a2030" };

const moodOf = (cond) => (cond === "rain" || cond === "storm" || cond === "fog" ? "dim" : cond === "clouds" || cond === "snow" ? "clouds" : "clear");

function makeClouds(count, seed) {
  let s = seed;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: count }, (_, i) => ({
    id: i, top: 2 + r() * 55, width: 260 + r() * 420, dur: 120 + r() * 160, delay: -r() * 200, opacity: 0.35 + r() * 0.45, blur: 4 + r() * 5,
  }));
}

function Cloud({ c, tint }) {
  return (
    <div
      className="cloud"
      style={{ top: `${c.top}%`, width: c.width, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s`, opacity: c.opacity, color: tint, "--blur": `${c.blur}px` }}
    >
      <svg viewBox="0 0 240 100" width="100%" fill="currentColor">
        <ellipse cx="62" cy="64" rx="58" ry="28" />
        <ellipse cx="118" cy="48" rx="64" ry="38" />
        <ellipse cx="178" cy="64" rx="54" ry="27" />
        <rect x="14" y="62" width="214" height="28" rx="14" />
      </svg>
    </div>
  );
}

export default function SkyBackground() {
  const { phase, settings, weather } = useDomus();
  const dynamic = settings?.dynamic_colors !== false;
  const p = dynamic ? phase.phase : "day";
  const cond = dynamic ? weather?.condition || "clear" : "clear";
  const mood = moodOf(cond);
  const [c0, c1, c2] = GRAD[p][mood];

  const cloudCount = mood === "dim" ? 10 : mood === "clouds" ? 8 : p === "night" ? 2 : 4;
  const clouds = useMemo(() => makeClouds(cloudCount, 42 + cloudCount), [cloudCount]);
  const tint = mood === "dim" ? CLOUD_TINT_DIM[p] : CLOUD_TINT[p];
  const cloudAlpha = p === "night" ? 0.55 : 1;

  const canvasMode = cond === "rain" ? "rain" : cond === "storm" ? "storm" : cond === "snow" ? "snow" : p === "night" && mood === "clear" ? "stars" : null;
  const showSun = mood === "clear" && p !== "night";
  const horizon = p === "dawn" || p === "sunset";
  const sunX = p === "dawn" ? 18 : p === "sunset" ? 78 : 72;

  return (
    <div className="sky" data-testid="sky-background" data-phase={p} data-weather={cond}>
      <div className="sky-grad" style={{ background: `linear-gradient(180deg, ${c0} 0%, ${c1} 58%, ${c2} 100%)` }} />
      {canvasMode === "stars" && <SkyCanvas mode="stars" />}
      {p === "night" && mood !== "dim" && <div className="moon" />}
      {showSun && (
        <div
          className="sun"
          style={horizon
            ? { width: 150, height: 150, left: `${sunX}%`, top: "58%", background: "radial-gradient(circle, #fff3d6 0%, #fbd39a 45%, rgba(251,190,120,0) 72%)", boxShadow: "0 0 120px 60px rgba(250,190,120,0.35), 0 0 260px 140px rgba(240,150,110,0.18)" }
            : { width: 240, height: 240, left: `${sunX}%`, top: "-6%", background: "radial-gradient(circle, rgba(255,250,235,0.95) 0%, rgba(255,240,200,0.45) 35%, rgba(255,235,190,0) 70%)", boxShadow: "0 0 180px 80px rgba(255,240,200,0.22)" }}
        />
      )}
      {clouds.map((c) => <Cloud key={c.id} c={{ ...c, opacity: c.opacity * cloudAlpha }} tint={tint} />)}
      {cond === "fog" && (<><div className="fog-layer" /><div className="fog-layer two" /></>)}
      {(canvasMode === "rain" || canvasMode === "storm" || canvasMode === "snow") && <SkyCanvas mode={canvasMode} />}
      {cond === "storm" && <div className="flash" />}
    </div>
  );
}
