import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import SkyBackground from "@/components/SkyBackground";
import { useDomus } from "@/context/DomusContext";

// hex → "r g b" per le variabili CSS dell'accento
const triplet = (hex, fallback) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return fallback;
  return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
};
const shade = (rgb, factor) => rgb.split(" ").map((v) => Math.max(0, Math.min(255, Math.round(Number(v) * factor)))).join(" ");

export default function Layout() {
  const { loading, settings, effectiveTheme } = useDomus();
  const loc = useLocation();
  const isTer = loc.pathname.startsWith("/terminus");
  const theme = isTer ? "theme-ter" : "theme-sol";
  useEffect(() => {
    document.documentElement.classList.toggle("theme-ter", isTer);
    document.documentElement.classList.toggle("theme-sol", !isTer);
  }, [isTer]);
  useEffect(() => {
    const base = triplet(isTer ? settings?.accent_ter : settings?.accent_sol, isTer ? "104 135 168" : "176 142 84");
    const root = document.documentElement.style;
    root.setProperty("--acc", base);
    root.setProperty("--acc-strong", shade(base, 0.85));
    root.setProperty("--acc-fg", shade(base, effectiveTheme === "dark" ? 1.35 : 0.55));
  }, [isTer, settings?.accent_sol, settings?.accent_ter, effectiveTheme]);
  return (
    <div className="relative min-h-screen" data-theme={theme} data-testid="app-layout">
      <SkyBackground />
      <Header />
      <main className="relative z-10 px-4 sm:px-8 lg:px-12 pt-24 pb-16 max-w-[1600px] mx-auto">
        {loading ? (
          <div className="glass rounded-[28px] p-10 text-center text-muted" data-testid="loading">Caricamento Domus…</div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
