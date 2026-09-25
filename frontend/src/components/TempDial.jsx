import { useRef, useState } from "react";
import { clamp } from "@/lib/color";

const START = 135;
const SWEEP = 270;
const polar = (cx, cy, r, deg) => { const a = (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

export const MODE_COLOR = { heat: "#cf8a6a", cool: "#6aa6cf" };

export default function TempDial({ value = 21, current, min = 10, max = 30, step = 0.5, onChange, size = 200, mode = "heat", disabled = false, active = false, testid = "temp-dial" }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const cx = size / 2, cy = size / 2, r = size / 2 - 14;
  const frac = clamp((value - min) / (max - min), 0, 1);
  const aVal = START + frac * SWEEP;
  const color = MODE_COLOR[mode] || MODE_COLOR.heat;
  const [kx, ky] = polar(cx, cy, r, aVal);
  const curFrac = current != null ? clamp((current - min) / (max - min), 0, 1) : null;
  const [tx, ty] = curFrac != null ? polar(cx, cy, r, START + curFrac * SWEEP) : [0, 0];

  const pick = (e) => {
    if (disabled || !onChange) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - rect.left - cx, dy = e.clientY - rect.top - cy;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    let a = (ang - START + 360) % 360;
    if (a > SWEEP) a = a < SWEEP + (360 - SWEEP) / 2 ? SWEEP : 0;
    const v = Math.round((min + (a / SWEEP) * (max - min)) / step) * step;
    onChange(clamp(v, min, max));
  };

  return (
    <div className="relative select-none touch-none shrink-0" style={{ width: size, height: size }} data-testid={testid}>
      <svg
        ref={ref} width={size} height={size} className={disabled ? "opacity-60" : "cursor-pointer"}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); pick(e); }}
        onPointerMove={(e) => drag && pick(e)}
        onPointerUp={(e) => { setDrag(false); e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => setDrag(false)}
      >
        <path d={arc(cx, cy, r, START, START + SWEEP)} stroke="rgba(120,130,150,0.22)" strokeWidth={size * 0.05} fill="none" strokeLinecap="round" />
        {frac > 0.002 && <path d={arc(cx, cy, r, START, aVal)} stroke={color} strokeWidth={size * 0.05} fill="none" strokeLinecap="round" opacity={active ? 1 : 0.5} />}
        {curFrac != null && <circle cx={tx} cy={ty} r={size * 0.02} fill="#fff" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />}
        <circle cx={kx} cy={ky} r={size * 0.055} fill="#fff" stroke={color} strokeWidth="2" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="font-display font-semibold leading-none" style={{ fontSize: size * 0.2 }} data-testid={`${testid}-current`}>
          {current != null ? Number(current).toFixed(1) : "--"}<span className="text-muted" style={{ fontSize: size * 0.1 }}>°</span>
        </div>
        <div className="text-muted mt-1.5" style={{ fontSize: Math.max(10, size * 0.065) }}>
          target <b className="font-mono" style={{ color }} data-testid={`${testid}-target`}>{Number(value).toFixed(1)}°</b>
        </div>
      </div>
    </div>
  );
}
