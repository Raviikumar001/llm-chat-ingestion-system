'use client';

import { useMemo, useState } from 'react';
import type { MetricsOverviewResponse, TimeSeriesPoint } from '../lib/api';

// Format helper for numbers/nulls
function formatMetric(value: number | null, suffix = '') {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }
  return `${value}${suffix}`;
}

// Format relative time text
function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

// Sparkline Chart for Stat Cards
function SparklineChart({
  data,
  colorClass = 'stroke-sky-400',
  fillId,
  fillColor = 'rgb(56, 189, 248)',
}: {
  data: number[];
  colorClass?: string;
  fillId: string;
  fillColor?: string;
}) {
  if (!data || data.length < 2) return null;
  
  const width = 120;
  const height = 36;
  const padding = 2;
  
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;
  
  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible opacity-80">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" className={colorClass} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Stat Card component
function StatCard({
  label,
  value,
  subvalue,
  accentClass,
  trendData,
  sparklineColorClass,
  sparklineFillColor,
  sparklineId,
}: {
  label: string;
  value: string;
  subvalue: string;
  accentClass: string;
  trendData: number[];
  sparklineColorClass: string;
  sparklineFillColor: string;
  sparklineId: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${accentClass}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="mt-2 shrink-0">
          <SparklineChart
            data={trendData}
            colorClass={sparklineColorClass}
            fillId={sparklineId}
            fillColor={sparklineFillColor}
          />
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-500">{subvalue}</p>
    </div>
  );
}

// Ratio Bar for health statistics
function RatioBar({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: string;
  percent: number;
  tone: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <p className="font-medium text-zinc-300">{label}</p>
        <p className="text-zinc-500 font-mono">{value} ({percent.toFixed(0)}%)</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone}`}
          style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

type ChartTab = 'volume' | 'latency' | 'tokens';

// Interactive SVG Timeseries Chart
function TelemetryTimeSeriesChart({
  data,
  tab,
}: {
  data: TimeSeriesPoint[];
  tab: ChartTab;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const width = 1000;
  const height = 280;
  const paddingLeft = 60;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const N = data.length;

  // Max value calculator for chart scale
  const maxY = useMemo(() => {
    if (N === 0) return 1;
    let max = 0;
    if (tab === 'volume') {
      max = Math.max(...data.map(d => d.totalRequests));
    } else if (tab === 'latency') {
      max = Math.max(...data.map(d => Math.max(d.avgLatencyMs || 0, d.p95LatencyMs || 0)));
    } else if (tab === 'tokens') {
      max = Math.max(...data.map(d => Math.max(d.totalInputTokens, d.totalOutputTokens)));
    }
    return max > 0 ? max * 1.15 : 1; // add 15% head room
  }, [data, tab, N]);

  // Tick generator
  const yTicks = useMemo(() => {
    return [0, maxY * 0.25, maxY * 0.5, maxY * 0.75, maxY];
  }, [maxY]);

  // Format labels
  const formatYValue = (val: number) => {
    if (tab === 'latency') return `${Math.round(val)}ms`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return `${Math.round(val)}`;
  };

  const formatHour = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  const getFullDateLabel = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return '';
    }
  };

  // Convert points to SVG coordinates
  const getCoordinates = (valGetter: (pt: TimeSeriesPoint) => number) => {
    return data.map((d, i) => {
      const x = paddingLeft + (i / Math.max(1, N - 1)) * chartWidth;
      const y = height - paddingBottom - (maxY > 0 ? (valGetter(d) / maxY) * chartHeight : 0);
      return { x, y };
    });
  };

  // Generate path string from coordinates
  const getLinePath = (coords: { x: number; y: number }[]) => {
    if (coords.length < 2) return '';
    return coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const getAreaPath = (coords: { x: number; y: number }[]) => {
    if (coords.length < 2) return '';
    const line = getLinePath(coords);
    return `${line} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;
  };

  // Hover Handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (N < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    // Scale mouse position to viewport viewBox coordinates
    const svgX = (mouseX / rect.width) * width;
    const chartX = svgX - paddingLeft;
    const percent = Math.max(0, Math.min(1, chartX / chartWidth));
    const index = Math.round(percent * (N - 1));
    setActiveIndex(index);
  };

  const handleMouseLeave = () => {
    setActiveIndex(null);
  };

  // SVG rendering calculations per tab
  const tabContent = useMemo(() => {
    if (N < 2) return null;

    if (tab === 'volume') {
      const compCoords = getCoordinates(d => d.completedRequests);
      const totalCoords = getCoordinates(d => d.totalRequests);
      const errCoords = getCoordinates(d => d.failedRequests + d.timedOutRequests);
      
      return (
        <>
          <defs>
            <linearGradient id="volumeCompGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={getAreaPath(compCoords)} fill="url(#volumeCompGrad)" />
          <path d={getLinePath(compCoords)} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
          <path d={getLinePath(totalCoords)} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
          {Math.max(...data.map(d => d.failedRequests + d.timedOutRequests)) > 0 && (
            <path d={getLinePath(errCoords)} fill="none" stroke="#f43f5e" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </>
      );
    }

    if (tab === 'latency') {
      const avgCoords = getCoordinates(d => d.avgLatencyMs || 0);
      const p95Coords = getCoordinates(d => d.p95LatencyMs || 0);

      return (
        <>
          <defs>
            <linearGradient id="latencyAvgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="latencyP95Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={getAreaPath(p95Coords)} fill="url(#latencyP95Grad)" />
          <path d={getLinePath(p95Coords)} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
          <path d={getAreaPath(avgCoords)} fill="url(#latencyAvgGrad)" />
          <path d={getLinePath(avgCoords)} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }

    if (tab === 'tokens') {
      const inputCoords = getCoordinates(d => d.totalInputTokens);
      const outputCoords = getCoordinates(d => d.totalOutputTokens);

      return (
        <>
          <defs>
            <linearGradient id="tokensInputGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="tokensOutputGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={getAreaPath(inputCoords)} fill="url(#tokensInputGrad)" />
          <path d={getLinePath(inputCoords)} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
          <path d={getAreaPath(outputCoords)} fill="url(#tokensOutputGrad)" opacity="0.8" />
          <path d={getLinePath(outputCoords)} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }

    return null;
  }, [tab, data, maxY, N]);

  // Tooltip details overlay
  const renderTooltip = () => {
    if (activeIndex == null || !data[activeIndex]) return null;
    const item = data[activeIndex];
    const leftX = paddingLeft + (activeIndex / Math.max(1, N - 1)) * chartWidth;
    const isRightHalf = activeIndex > N / 2;

    return (
      <div
        className="absolute top-12 z-20 w-52 rounded-2xl border border-white/10 bg-[#0d0e14]/95 p-3.5 shadow-2xl backdrop-blur-md pointer-events-none transition-all duration-100"
        style={{
          left: `${(leftX / width) * 100}%`,
          transform: isRightHalf ? 'translateX(-106%)' : 'translateX(6%)',
        }}
      >
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          {getFullDateLabel(item.time)}
        </p>

        {tab === 'volume' && (
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span>Completed</span>
              <span className="font-semibold text-emerald-400 font-mono">{item.completedRequests}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Errors</span>
              <span className="font-semibold text-rose-400 font-mono">
                {item.failedRequests + item.timedOutRequests}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Cancelled</span>
              <span className="font-semibold text-amber-400 font-mono">{item.cancelledRequests}</span>
            </div>
            <div className="h-px bg-white/5 my-1.5" />
            <div className="flex items-center justify-between text-white font-medium">
              <span>Total Volume</span>
              <span className="font-bold font-mono">{item.totalRequests} req</span>
            </div>
          </div>
        )}

        {tab === 'latency' && (
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span>Avg Latency</span>
              <span className="font-semibold text-cyan-400 font-mono">
                {item.avgLatencyMs ? `${item.avgLatencyMs} ms` : '--'}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>P95 Latency</span>
              <span className="font-semibold text-violet-400 font-mono">
                {item.p95LatencyMs ? `${item.p95LatencyMs} ms` : '--'}
              </span>
            </div>
          </div>
        )}

        {tab === 'tokens' && (
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span>Input Tokens</span>
              <span className="font-semibold text-sky-400 font-mono">
                {item.totalInputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span>Output Tokens</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {item.totalOutputTokens.toLocaleString()}
              </span>
            </div>
            <div className="h-px bg-white/5 my-1.5" />
            <div className="flex items-center justify-between text-white font-medium">
              <span>Total Tokens</span>
              <span className="font-bold font-mono">
                {(item.totalInputTokens + item.totalOutputTokens).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Generate visual markers on hover
  const renderDots = () => {
    if (activeIndex == null || !data[activeIndex] || N < 2) return null;
    const pt = data[activeIndex];
    const x = paddingLeft + (activeIndex / (N - 1)) * chartWidth;

    const drawCircle = (val: number, color: string) => {
      const y = height - paddingBottom - (maxY > 0 ? (val / maxY) * chartHeight : 0);
      return <circle cx={x} cy={y} r="5" fill={color} stroke="#08090c" strokeWidth="2.5" />;
    };

    if (tab === 'volume') {
      return (
        <>
          {drawCircle(pt.completedRequests, '#10b981')}
          {pt.failedRequests + pt.timedOutRequests > 0 && drawCircle(pt.failedRequests + pt.timedOutRequests, '#f43f5e')}
        </>
      );
    }
    if (tab === 'latency') {
      return (
        <>
          {pt.p95LatencyMs != null && drawCircle(pt.p95LatencyMs, '#8b5cf6')}
          {pt.avgLatencyMs != null && drawCircle(pt.avgLatencyMs, '#06b6d4')}
        </>
      );
    }
    if (tab === 'tokens') {
      return (
        <>
          {drawCircle(pt.totalInputTokens, '#38bdf8')}
          {drawCircle(pt.totalOutputTokens, '#34d399')}
        </>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick, index) => {
          const y = height - paddingBottom - (maxY > 0 ? (tick / maxY) * chartHeight : 0);
          return (
            <g key={index} className="opacity-20">
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#fff"
                strokeWidth="1"
                strokeDasharray={index === 0 ? 'none' : '3 3'}
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-zinc-400 text-[10px] font-mono font-semibold"
              >
                {formatYValue(tick)}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels */}
        {N >= 2 &&
          [0, Math.floor(N * 0.25), Math.floor(N * 0.5), Math.floor(N * 0.75), N - 1].map((index) => {
            const item = data[index];
            if (!item) return null;
            const x = paddingLeft + (index / (N - 1)) * chartWidth;
            return (
              <text
                key={index}
                x={x}
                y={height - paddingBottom + 20}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px] font-mono opacity-80"
              >
                {formatHour(item.time)}
              </text>
            );
          })}

        {/* Main Chart Paths */}
        {tabContent}

        {/* Hover Line Indicator */}
        {activeIndex !== null && N >= 2 && (
          <line
            x1={paddingLeft + (activeIndex / (N - 1)) * chartWidth}
            y1={paddingTop}
            x2={paddingLeft + (activeIndex / (N - 1)) * chartWidth}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {/* Hover Dots */}
        {renderDots()}
      </svg>

      {/* Hover Tooltip Overlay */}
      {renderTooltip()}
    </div>
  );
}

export default function MetricsDashboard({
  metrics,
}: {
  metrics: MetricsOverviewResponse | null;
}) {
  const [activeTab, setActiveTab] = useState<ChartTab>('volume');

  // Precompute trend datasets for the 4 stat cards
  const trendData = useMemo(() => {
    if (!metrics || !metrics.timeSeries || metrics.timeSeries.length === 0) {
      return { latency: [], throughput: [], errors: [], requests: [], inputTokens: [], outputTokens: [] };
    }
    const series = metrics.timeSeries;
    return {
      latency: series.map(s => s.avgLatencyMs ?? 0),
      throughput: series.map(s => s.completedRequests),
      errors: series.map(s => s.failedRequests + s.timedOutRequests),
      requests: series.map(s => s.totalRequests),
      inputTokens: series.map(s => s.totalInputTokens),
      outputTokens: series.map(s => s.totalOutputTokens),
    };
  }, [metrics]);

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.03]"
            />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="h-[26rem] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.03]" />
          <div className="h-[26rem] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  const totalRequests = Math.max(metrics.totals.totalRequests, 1);
  const completedPercent = (metrics.totals.completedRequests / totalRequests) * 100;
  const cancelledPercent = (metrics.totals.cancelledRequests / totalRequests) * 100;
  const failedPercent = (metrics.totals.failedRequests / totalRequests) * 100;
  const timedOutPercent = (metrics.totals.timedOutRequests / totalRequests) * 100;

  // Find the fastest provider
  const fastestProvider = metrics.providers.reduce((acc, p) => {
    if (!p.avgLatencyMs) return acc;
    if (!acc.avgLatencyMs) return p;
    return p.avgLatencyMs < acc.avgLatencyMs ? p : acc;
  }, metrics.providers[0]);

  return (
    <div className="space-y-6">
      {/* Stat Cards Section */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Latency"
          value={formatMetric(metrics.totals.avgLatencyMs, ' ms')}
          subvalue={`P95 ${formatMetric(metrics.totals.p95LatencyMs, ' ms')}`}
          accentClass="bg-linear-to-r from-sky-500 to-cyan-400"
          trendData={trendData.latency}
          sparklineColorClass="stroke-sky-400"
          sparklineFillColor="rgb(56, 189, 248)"
          sparklineId="sparkLatency"
        />
        <StatCard
          label="Throughput"
          value={`${metrics.totals.requestsLastHour}`}
          subvalue="completed (last hour)"
          accentClass="bg-linear-to-r from-emerald-500 to-lime-400"
          trendData={trendData.throughput}
          sparklineColorClass="stroke-emerald-400"
          sparklineFillColor="rgb(52, 211, 153)"
          sparklineId="sparkThroughput"
        />
        <StatCard
          label="Errors"
          value={formatMetric(metrics.totals.errorRate, '%')}
          subvalue={`${metrics.totals.failedRequests + metrics.totals.timedOutRequests} failures / timeouts`}
          accentClass="bg-linear-to-r from-rose-500 to-fuchsia-500"
          trendData={trendData.errors}
          sparklineColorClass="stroke-rose-400"
          sparklineFillColor="rgb(244, 63, 94)"
          sparklineId="sparkErrors"
        />
        <StatCard
          label="Requests"
          value={`${metrics.totals.totalRequests}`}
          subvalue={`${metrics.totals.completedRequests} successfully processed`}
          accentClass="bg-linear-to-r from-violet-500 to-indigo-400"
          trendData={trendData.requests}
          sparklineColorClass="stroke-violet-400"
          sparklineFillColor="rgb(139, 92, 246)"
          sparklineId="sparkRequests"
        />
        <StatCard
          label="Input Tokens"
          value={metrics.totals.totalInputTokens.toLocaleString()}
          subvalue={`${metrics.totals.totalTokens.toLocaleString()} total tokens`}
          accentClass="bg-linear-to-r from-sky-500 to-blue-400"
          trendData={trendData.inputTokens}
          sparklineColorClass="stroke-sky-400"
          sparklineFillColor="rgb(56, 189, 248)"
          sparklineId="sparkInputTokens"
        />
        <StatCard
          label="Output Tokens"
          value={metrics.totals.totalOutputTokens.toLocaleString()}
          subvalue={`${metrics.totals.totalTokens.toLocaleString()} total tokens`}
          accentClass="bg-linear-to-r from-emerald-500 to-teal-400"
          trendData={trendData.outputTokens}
          sparklineColorClass="stroke-emerald-400"
          sparklineFillColor="rgb(52, 211, 153)"
          sparklineId="sparkOutputTokens"
        />
      </div>

      {/* Main Charts & Health Segment */}
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Interactive Telemetry Chart */}
        <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.18)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <p className="text-sm font-semibold text-white">Performance Telemetry</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Inference performance over 24 hours
              </p>
            </div>
            
            {/* Tabs Selector */}
            <div className="inline-flex rounded-xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('volume')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wider transition ${
                  activeTab === 'volume'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                VOLUME
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('latency')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wider transition ${
                  activeTab === 'latency'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                LATENCY
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tokens')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wider transition ${
                  activeTab === 'tokens'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                TOKENS
              </button>
            </div>
          </div>

          <div className="mt-6">
            <TelemetryTimeSeriesChart data={metrics.timeSeries} tab={activeTab} />
          </div>
        </section>

        {/* Request Health Breakdown */}
        <section className="flex flex-col justify-between rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.18)] backdrop-blur">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Request Health</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Current distribution
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-mono uppercase text-zinc-400">
                {metrics.windowHours}h window
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-5 space-y-4">
              <RatioBar
                label="Completed"
                value={`${metrics.totals.completedRequests}`}
                percent={completedPercent}
                tone="bg-linear-to-r from-emerald-500 to-teal-400"
              />
              <RatioBar
                label="Cancelled"
                value={`${metrics.totals.cancelledRequests}`}
                percent={cancelledPercent}
                tone="bg-linear-to-r from-amber-500 to-yellow-400"
              />
              <RatioBar
                label="Failed"
                value={`${metrics.totals.failedRequests}`}
                percent={failedPercent}
                tone="bg-linear-to-r from-rose-500 to-red-400"
              />
              <RatioBar
                label="Timed out"
                value={`${metrics.totals.timedOutRequests}`}
                percent={timedOutPercent}
                tone="bg-linear-to-r from-fuchsia-500 to-pink-400"
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/5 bg-black/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-200">Recent Ingestion Traffic</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-400">
                  {metrics.totals.requestsLastHour}
                </p>
              </div>
              <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">last hour</p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>Updated {formatRelativeTime(metrics.generatedAt)}</span>
              <span>{totalRequests} total requests</span>
            </div>
          </div>
        </section>
      </div>

      {/* Provider split cards side by side */}
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.18)] backdrop-blur">
        <div>
          <p className="text-sm font-semibold text-white">LLM Gateway Providers</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
            Compare latency, usage, and errors by model host
          </p>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {metrics.providers.map((p) => {
            const isFastest = p.provider === fastestProvider?.provider;
            const volumeShare = (p.totalRequests / totalRequests) * 100;
            const hasErrors = p.errorRate > 0;

            return (
              <div
                key={p.provider}
                className="relative overflow-hidden rounded-[26px] border border-white/5 bg-black/15 p-5 transition hover:border-white/10"
              >
                {isFastest && (
                  <div className="absolute right-0 top-0 rounded-bl-xl bg-cyan-500/10 border-l border-b border-cyan-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                    Fastest
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.provider === 'cerebras' ? 'bg-violet-400' : 'bg-cyan-400'}`} />
                  <h3 className="text-lg font-semibold capitalize text-white">
                    {p.provider}
                  </h3>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/5 py-4 my-4">
                  <div>
                    <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Volume</p>
                    <p className="mt-1 text-lg font-semibold text-white font-mono">{p.totalRequests} req</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Avg Speed</p>
                    <p className="mt-1 text-lg font-semibold text-white font-mono">
                      {formatMetric(p.avgLatencyMs, ' ms')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Reliability</p>
                    <p className={`mt-1 text-lg font-semibold font-mono ${hasErrors ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {p.errorRate === 0 ? '100% OK' : `${(100 - p.errorRate).toFixed(1)}%`}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs">
                    <div>
                      <p className="font-mono uppercase tracking-wider text-zinc-500">Input</p>
                      <p className="mt-1 font-semibold text-sky-300">{p.totalInputTokens.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-mono uppercase tracking-wider text-zinc-500">Output</p>
                      <p className="mt-1 font-semibold text-emerald-300">{p.totalOutputTokens.toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Share progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Query Share</span>
                      <span className="font-mono text-zinc-300">{volumeShare.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${p.provider === 'cerebras' ? 'bg-violet-500' : 'bg-cyan-500'}`}
                        style={{ width: `${volumeShare}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Errors Section */}
      <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.18)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Recent Failures</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
              Failed or timed out requests in window
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-400 font-mono">
            {metrics.recentErrors.length} events
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {metrics.recentErrors.length === 0 ? (
            <div className="col-span-full flex min-h-32 items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-zinc-500">
              No failures tracked in this time period
            </div>
          ) : (
            metrics.recentErrors.map((item) => (
              <div
                key={item.requestId}
                className="relative overflow-hidden rounded-[24px] border border-rose-500/10 bg-rose-500/[0.03] p-5 hover:bg-rose-500/[0.05] transition duration-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-500/10 pb-3 mb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                      {item.errorCode ?? 'FAILED'}
                    </span>
                    <p className="mt-1.5 text-sm font-semibold capitalize text-white">
                      {item.provider} • <span className="text-zinc-400 text-xs">{item.model}</span>
                    </p>
                  </div>
                  <div className="text-right text-[10px] text-zinc-500 font-mono">
                    <p>{formatRelativeTime(item.createdAt)}</p>
                    <p className="mt-0.5 text-zinc-600 truncate max-w-28">{item.requestId.slice(0, 8)}...</p>
                  </div>
                </div>

                <p className="text-xs leading-5 text-zinc-300 font-mono bg-black/30 p-3 rounded-xl border border-white/5">
                  {item.errorMessage || 'No error message payload provided.'}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
