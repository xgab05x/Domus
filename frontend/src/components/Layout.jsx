import { Outlet } from "react-router-dom";
import Header from "@/components/Header";
import SolarBackground from "@/components/SolarBackground";
import { useDomus } from "@/context/DomusContext";

export default function Layout() {
  const { loading } = useDomus();
  return (
    <div className="relative min-h-screen">
      <SolarBackground />
      <Header />
      <main className="relative z-10 px-4 sm:px-8 lg:px-12 pt-24 pb-16 max-w-[1600px] mx-auto">
        {loading ? (
          <div className="glass rounded-3xl p-10 text-center" data-testid="loading">
            Caricamento Domus...
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
