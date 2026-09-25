import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "@/components/Header";
import SkyBackground from "@/components/SkyBackground";
import { useDomus } from "@/context/DomusContext";

export default function Layout() {
  const { loading } = useDomus();
  const loc = useLocation();
  const isTer = loc.pathname.startsWith("/terminus");
  const theme = isTer ? "theme-ter" : "theme-sol";
  useEffect(() => {
    document.documentElement.classList.toggle("theme-ter", isTer);
    document.documentElement.classList.toggle("theme-sol", !isTer);
  }, [isTer]);
  return (
    <div className={`relative min-h-screen ${theme}`} data-testid="app-layout">
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
