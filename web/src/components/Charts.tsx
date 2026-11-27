// Small dependency-free SVG charts. Single series only (the title names it, no legend);
// tapping or hovering a mark shows its value in the readout line under the chart.
import { useState, type ReactNode } from 'react';
import { decimal, locale, t } from '../i18n.ts';

export interface Point {
  label: string;
  value: number;
  detail?: ReactNode;
}

const W = 320;

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function tick(v: number): string {
  if (v >= 10_000) return `${Math.round(v / 1000)}K`;
  return Number.isInteger(v) ? v.toLocaleString(locale()) : decimal(v.toFixed(1));
}

function ChartFrame({ title, sub, readout, children, table }: { title: string; sub?: string; readout: ReactNode; children: ReactNode; table: Point[] }) {
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <h3>{title}</h3>
      {sub && <div className="sub">{sub}</div>}
      {children}
      <div className="readout" aria-live="polite">
        {readout}
      </div>
      <details className="why">
        <summary>{t('Show as table', 'Toon als tabel')}</summary>
        <table className="small" style={{ width: '100%', marginTop: 6, borderCollapse: 'collapse' }}>
          <tbody>
            {table.map((p, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--rule)' }}>
                <td style={{ padding: '4px 0' }}>{p.label}</td>
                <td style={{ padding: '4px 0', textAlign: 'right' }}>{p.detail ?? tick(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function BarChart({ title, sub, data, unit = '', height = 150 }: { title: string; sub?: string; data: Point[]; unit?: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const left = 34;
  const bottom = 20;
  const top = 6;
  const plotW = W - left;
  const plotH = height - bottom - top;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(24, slot - 2);
  const labelEvery = Math.ceil(data.length / 6);
  const shown = active ?? data.length - 1;
  const cur = data[shown];

  return (
    <ChartFrame
      title={title}
      sub={sub}
      table={data}
      readout={
        cur ? (
          <>
            {cur.label}: <b>{cur.detail ?? `${tick(cur.value)}${unit}`}</b>
          </>
        ) : null
      }
    >
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title} onMouseLeave={() => setActive(null)}>
        <g className="grid">
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={left} x2={W} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} />
          ))}
        </g>
        {[0, 0.5, 1].map((f) => (
          <text key={f} className="axis" x={left - 6} y={top + plotH * (1 - f) + 4} textAnchor="end">
            {tick(max * f)}
          </text>
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = left + i * slot + (slot - barW) / 2;
          const y = top + plotH - h;
          const r = Math.min(4, h);
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`}
                  fill="var(--data)"
                  opacity={shown === i ? 1 : 0.55}
                />
              )}
              {i % labelEvery === (data.length - 1) % labelEvery && (
                <text className="axis" x={x + barW / 2} y={height - 4} textAnchor="middle">
                  {d.label}
                </text>
              )}
              <rect
                x={left + i * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(i)}
              />
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

export function LineChart({ title, sub, data, unit = '', height = 170 }: { title: string; sub?: string; data: Point[]; unit?: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const left = 38;
  const right = 10;
  const bottom = 20;
  const top = 10;
  const plotW = W - left - right;
  const plotH = height - bottom - top;
  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max(1, (rawMax - rawMin) * 0.15);
  const min = Math.max(0, Math.floor((rawMin - pad) / 5) * 5);
  const max = Math.ceil((rawMax + pad) / 5) * 5;
  const x = (i: number) => left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => top + plotH - ((v - min) / Math.max(1, max - min)) * plotH;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const shown = active ?? data.length - 1;
  const cur = data[shown];
  const slot = plotW / Math.max(1, data.length);

  return (
    <ChartFrame
      title={title}
      sub={sub}
      table={data}
      readout={
        cur ? (
          <>
            {cur.label}: <b>{cur.detail ?? `${tick(cur.value)}${unit}`}</b>
          </>
        ) : null
      }
    >
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title} onMouseLeave={() => setActive(null)}>
        <g className="grid">
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={left} x2={W - right} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} />
          ))}
        </g>
        {[0, 0.5, 1].map((f) => (
          <text key={f} className="axis" x={left - 6} y={top + plotH * (1 - f) + 4} textAnchor="end">
            {tick(min + (max - min) * f)}
          </text>
        ))}
        <path d={`${path} L${x(data.length - 1)},${top + plotH} L${x(0)},${top + plotH} Z`} fill="var(--data)" opacity={0.1} />
        <path d={path} fill="none" stroke="var(--data)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active !== null && <line x1={x(active)} x2={x(active)} y1={top} y2={top + plotH} stroke="var(--chalk-3)" strokeWidth={1} />}
        {data.map((d, i) =>
          i === shown || data.length <= 12 ? (
            <circle key={i} cx={x(i)} cy={y(d.value)} r={i === shown ? 5 : 4} fill="var(--data)" stroke="var(--deck)" strokeWidth={2} />
          ) : null,
        )}
        <text className="axis" x={left} y={height - 4} textAnchor="start">
          {data[0]?.label}
        </text>
        {data.length > 1 && (
          <text className="axis" x={W - right} y={height - 4} textAnchor="end">
            {data[data.length - 1].label}
          </text>
        )}
        {data.map((_, i) => (
          <rect
            key={i}
            x={x(i) - slot / 2}
            y={0}
            width={slot}
            height={height}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          />
        ))}
      </svg>
    </ChartFrame>
  );
}
