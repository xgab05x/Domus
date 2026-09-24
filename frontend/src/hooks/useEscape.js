import { useEffect } from "react";

export function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}
