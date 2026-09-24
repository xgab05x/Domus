import { useDomus } from "@/context/DomusContext";

const GRADIENTS = {
  dawn: {
    light: "linear-gradient(135deg, #fde68a 0%, #fecaca 40%, #bae6fd 100%)",
    dark: "linear-gradient(135deg, #1e1b4b 0%, #7c2d12 45%, #0c4a6e 100%)",
  },
  day: {
    light: "linear-gradient(135deg, #e0f2fe 0%, #fef9c3 45%, #dbeafe 100%)",
    dark: "linear-gradient(135deg, #020617 0%, #0f172a 40%, #0c4a6e 100%)",
  },
  sunset: {
    light: "linear-gradient(135deg, #fed7aa 0%, #fca5a5 40%, #c4b5fd 100%)",
    dark: "linear-gradient(135deg, #0f172a 0%, #7c2d12 45%, #3b0764 100%)",
  },
  night: {
    light: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #0c4a6e 100%)",
    dark: "linear-gradient(135deg, #000000 0%, #020617 45%, #1e1b4b 100%)",
  },
};

const BLOBS = {
  dawn: ["#fbbf24", "#fb7185", "#60a5fa"],
  day: ["#fbbf24", "#38bdf8", "#a78bfa"],
  sunset: ["#f97316", "#ec4899", "#8b5cf6"],
  night: ["#312e81", "#7c3aed", "#0ea5e9"],
};

export default function SolarBackground() {
  const { phase, effectiveTheme, settings } = useDomus();
  const usePhase = settings?.dynamic_colors !== false;
  const activePhase = usePhase ? phase.phase : "day";
  const grad = GRADIENTS[activePhase][effectiveTheme];
  const blobs = BLOBS[activePhase];

  return (
    <div className="solar-bg grain" data-testid="solar-background" data-phase={activePhase}>
      <div style={{ background: grad }} />
      <div
        className="blob"
        style={{ width: 520, height: 520, background: blobs[0], top: "-10%", left: "-8%", animationDelay: "0s" }}
      />
      <div
        className="blob"
        style={{ width: 480, height: 480, background: blobs[1], top: "40%", right: "-10%", animationDelay: "4s" }}
      />
      <div
        className="blob"
        style={{ width: 420, height: 420, background: blobs[2], bottom: "-12%", left: "30%", animationDelay: "8s" }}
      />
    </div>
  );
}
