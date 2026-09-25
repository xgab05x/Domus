import { useCallback, useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar } from "recharts";
import { Pencil, AlertTriangle, Gauge, Layers } from "lucide-react";
import { HistoryAPI } from "@/lib/api";
import { SOFT_COLORS } from "@/lib/icons";

export const METRICS = {
  power_w: { label: "Assorbimento", unit: "W", key: "p", color: "#c0975a", fmt: (v) => Number(v).toFixed(0) },
  current_a: { label: "Corrente", unit: "A", key: "a", color: "#6fa3b5", fmt: (v) => Number(v).toFixed(2) },
  voltage_v: { label: "Tensione", unit: "V", key: "v", color: "#8b7bb0", fmt: (v) => Number(v).toFixed(1) },
  energy: { label: "Energia", unit: "Wh", key: "e", color: "#6f9a6a", fmt: (v) => Number(v).toFixed(0) },
};
export const RANGE_LABEL = { "1h": "ultima ora", "6h": "ultime 6 ore", "24h": "ultime 24 ore" };
export const CHART_TYPE_LABEL = { line: "Linea nel tempo", donut: "Anello", radial: "Radiale", bars: "Barre" };
const SIZE_CLS = { sm: "md:col-span-1", md: "md:col-span-2", lg: "md:col-span-2 xl:col-span-4" };
const TICK = { fontSize: 10, fill: "#8a94a6" };

const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const fmtEnergy = (wh) => (wh >= 1000 ? `${(wh / 1000).toFixed(2)} kWh` : `${Math.round(wh)} Wh`);

function Tip({ active, payload, label, unit, fmt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      {label && <div className="text-muted mb-0.5">{label}</div>}
      {payload.map((p, i) => <div key={i} className="font-mono font-semibold">{p.name && typeof p.name === "string" && !/^[pvae]$/.test(p.name) ? `${p.name}: ` : ""}{fmt ? fmt(p.value) : p.value} {unit}</div>)}
    </div>
  );
}

export default function EnergyChartCard({ chart, onEdit }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(async () => {
    try { setData(await HistoryAPI.get(chart.source_kind, chart.source_id, chart.range)); setErr(null); }
    catch { setErr("Sorgente non disponibile"); }
  }, [chart.source_kind, chart.source_id, chart.range]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const metrics = (chart.metrics?.length ? chart.metrics : ["power_w"]).filter((m) => METRICS[m]);
  const offline = data?.members?.filter((m) => !m.available).length || 0;

  return (
    <div className={`glass rounded-[28px] p-5 bubble ${SIZE_CLS[chart.size] || SIZE_CLS.md}`} data-testid={`chart-card-${chart.id}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="icon-btn icon-on w-10 h-10 shrink-0">{chart.source_kind === "meter" ? <Layers size={17} /> : <Gauge size={17} />}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{chart.title}</div>
          <div className="label mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{data?.name || "…"}</span><span>·</span><span>{RANGE_LABEL[chart.range] || chart.range}</span>
            {offline > 0 && <span className="badge !bg-amber-500/20 !text-amber-800 dark:!text-amber-200 inline-flex items-center gap-1"><AlertTriangle size={9} /> {offline} offline</span>}
          </div>
        </div>
        <button onClick={onEdit} className="btn-ghost w-7 h-7 rounded-full flex items-center justify-center text-muted" data-testid={`chart-edit-${chart.id}`} aria-label="Modifica grafico"><Pencil size={12} /></button>
      </div>

      {data && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3" data-testid={`chart-live-${chart.id}`}>
          {metrics.map((mk) => {
            const m = METRICS[mk];
            const v = mk === "energy" ? data.live.energy_wh : data.live[mk];
            return (
              <div key={mk} className="flex items-baseline gap-1">
                <span className="font-display text-xl font-semibold" style={{ color: m.color }}>{v == null ? "--" : mk === "energy" ? fmtEnergy(v) : m.fmt(v)}</span>
                {mk !== "energy" && <span className="text-xs text-muted">{m.unit}</span>}
                <span className="text-[10px] text-muted ml-1">{m.label.toLowerCase()}</span>
              </div>
            );
          })}
        </div>
      )}

      {err && <div className="text-sm text-muted py-6 text-center">{err}</div>}
      {!data && !err && <div className="text-sm text-muted py-6 text-center">Caricamento…</div>}
      {data && chart.chart_type === "line" && <LineBody chart={chart} data={data} metrics={metrics} />}
      {data && chart.chart_type !== "line" && <ShareBody chart={chart} data={data} />}
    </div>
  );
}

function LineBody({ chart, data, metrics }) {
  const pts = data.points.map((p) => ({ ...p, time: fmtTime(p.t) }));
  if (!pts.length) return <div className="text-xs text-muted text-center py-6">Nessun dato storico ancora.</div>;
  const h = metrics.length > 1 ? 105 : 210;
  return (
    <div className="space-y-2">
      {metrics.map((mk) => {
        const m = METRICS[mk];
        const gid = `g-${chart.id}-${mk}`;
        return (
          <div key={mk} data-testid={`chart-series-${chart.id}-${mk}`}>
            {metrics.length > 1 && <div className="flex justify-between text-[10px] text-muted mb-0.5"><span>{m.label}</span><span className="font-mono">{m.unit}</span></div>}
            <ResponsiveContainer width="100%" height={h}>
              <AreaChart data={pts} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={m.color} stopOpacity={0.4} /><stop offset="100%" stopColor={m.color} stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,150,0.15)" vertical={false} />
                <XAxis dataKey="time" tick={TICK} tickLine={false} axisLine={false} minTickGap={42} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} domain={mk === "voltage_v" ? ["dataMin - 2", "dataMax + 2"] : [0, "auto"]} />
                <Tooltip content={<Tip unit={m.unit} fmt={m.fmt} />} />
                <Area type="monotone" dataKey={m.key} name={m.label} stroke={m.color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

function ShareBody({ chart, data }) {
  const energyBasis = chart.share_basis === "energy";
  const items = data.members.map((m, i) => ({ ...m, value: energyBasis ? m.energy_wh : m.power_w, share: energyBasis ? m.share_energy : m.share_power, color: SOFT_COLORS[i % SOFT_COLORS.length] }));
  const total = items.reduce((a, b) => a + b.value, 0);
  const totalLabel = energyBasis ? fmtEnergy(total) : `${Math.round(total)} W`;
  if (!items.length) return <div className="text-xs text-muted text-center py-6">Questo grafico richiede un misuratore virtuale con almeno un membro.</div>;

  const legend = (
    <ul className="flex-1 w-full space-y-1.5 min-w-0" data-testid={`chart-legend-${chart.id}`}>
      {items.map((it) => (
        <li key={it.id} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: it.color }} />
          <span className="font-semibold w-11 shrink-0">{it.share}%</span>
          <span className="flex-1 truncate">{it.name}</span>
          <span className="font-mono text-muted shrink-0">{Math.round(it.power_w)} W{energyBasis ? ` · ${fmtEnergy(it.energy_wh)}` : ""}</span>
          {!it.available && <AlertTriangle size={12} className="text-amber-600 shrink-0" />}
        </li>
      ))}
    </ul>
  );

  if (chart.chart_type === "bars") {
    return (
      <div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={items} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,130,150,0.15)" vertical={false} />
            <XAxis dataKey="name" tick={TICK} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} />
            <Tooltip content={<Tip unit={energyBasis ? "Wh" : "W"} fmt={(v) => Number(v).toFixed(0)} />} cursor={{ fill: "rgba(120,130,150,0.08)" }} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive={false}>{items.map((it) => <Cell key={it.id} fill={it.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2">{legend}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-[190px] h-[190px] shrink-0" data-testid={`chart-${chart.chart_type}-${chart.id}`}>
        <ResponsiveContainer width="100%" height="100%">
          {chart.chart_type === "donut" ? (
            <PieChart>
              <Pie data={items} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2} stroke="none" isAnimationActive={false}>
                {items.map((it) => <Cell key={it.id} fill={it.color} />)}
              </Pie>
              <Tooltip content={<Tip unit={energyBasis ? "Wh" : "W"} fmt={(v) => Number(v).toFixed(0)} />} />
            </PieChart>
          ) : (
            <RadialBarChart data={items} innerRadius="28%" outerRadius="100%" startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="share" background={{ fill: "rgba(120,130,150,0.12)" }} cornerRadius={8} isAnimationActive={false}>
                {items.map((it) => <Cell key={it.id} fill={it.color} />)}
              </RadialBar>
              <Tooltip content={<Tip unit="%" fmt={(v) => Number(v).toFixed(1)} />} />
            </RadialBarChart>
          )}
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-display text-xl font-semibold leading-none">{totalLabel}</div>
          <div className="text-[10px] text-muted mt-1">{energyBasis ? "energia" : "totale"}</div>
        </div>
      </div>
      {legend}
    </div>
  );
}
