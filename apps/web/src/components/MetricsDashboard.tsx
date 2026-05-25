'use client';

import type { MetricsOverviewResponse } from '../lib/api';

function formatMetric(value: number | null, suffix = '') {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return `${value}${suffix}`;
}

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

function StatCard({
  label,
  value,
  subvalue,
  accentClass,
}: {
  label: string;
  value: string;
  subvalue: string;
  accentClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${accentClass}`} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-3 text-sm text-zinc-500">{subvalue}</p>
    </div>
  );
}

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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <p className="text-sm text-zinc-400">{value}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.max(3, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}

export default function MetricsDashboard({
  metrics,
}: {
  metrics: MetricsOverviewResponse | null;
}) {
  if (!metrics) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-[28px] border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="h-[26rem] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
          <div className="h-[26rem] animate-pulse rounded-[32px] border border-white/10 bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  const totalRequests = Math.max(metrics.totals.totalRequests, 1);
  const providerPeak = Math.max(...metrics.providers.map((provider) => provider.totalRequests), 1);
  const completedPercent = (metrics.totals.completedRequests / totalRequests) * 100;
  const cancelledPercent = (metrics.totals.cancelledRequests / totalRequests) * 100;
  const failedPercent = (metrics.totals.failedRequests / totalRequests) * 100;
  const timedOutPercent = (metrics.totals.timedOutRequests / totalRequests) * 100;
  const requestsLastHourPercent = (metrics.totals.requestsLastHour / totalRequests) * 100;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Latency"
          value={formatMetric(metrics.totals.avgLatencyMs, ' ms')}
          subvalue={`P95 ${formatMetric(metrics.totals.p95LatencyMs, ' ms')}`}
          accentClass="bg-linear-to-r from-sky-500 to-cyan-400"
        />
        <StatCard
          label="Throughput"
          value={`${metrics.totals.requestsLastHour}`}
          subvalue="last hour"
          accentClass="bg-linear-to-r from-emerald-500 to-lime-400"
        />
        <StatCard
          label="Errors"
          value={formatMetric(metrics.totals.errorRate, '%')}
          subvalue={`${metrics.totals.failedRequests + metrics.totals.timedOutRequests} impacted requests`}
          accentClass="bg-linear-to-r from-rose-500 to-fuchsia-500"
        />
        <StatCard
          label="Requests"
          value={`${metrics.totals.totalRequests}`}
          subvalue={`${metrics.totals.completedRequests} completed`}
          accentClass="bg-linear-to-r from-violet-500 to-indigo-400"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Request health</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                Updated {formatRelativeTime(metrics.generatedAt)}
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
              {metrics.windowHours}h window
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <RatioBar
                  label="Completed"
                  value={`${metrics.totals.completedRequests}`}
                  percent={completedPercent}
                  tone="bg-emerald-400"
                />
                <RatioBar
                  label="Cancelled"
                  value={`${metrics.totals.cancelledRequests}`}
                  percent={cancelledPercent}
                  tone="bg-amber-400"
                />
                <RatioBar
                  label="Failed"
                  value={`${metrics.totals.failedRequests}`}
                  percent={failedPercent}
                  tone="bg-rose-400"
                />
                <RatioBar
                  label="Timed out"
                  value={`${metrics.totals.timedOutRequests}`}
                  percent={timedOutPercent}
                  tone="bg-fuchsia-400"
                />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Recent traffic</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
                    {metrics.totals.requestsLastHour}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">last hour</p>
              </div>
              <div className="mt-6 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-5 rounded-full bg-linear-to-r from-sky-400 via-cyan-400 to-emerald-400"
                  style={{ width: `${Math.max(6, Math.min(100, requestsLastHourPercent))}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>Current activity</span>
                <span>{totalRequests} total in window</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Provider split</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">requests vs latency</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {metrics.providers.map((provider) => (
              <div
                key={provider.provider}
                className="rounded-[26px] border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold capitalize text-white">{provider.provider}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {provider.totalRequests} req • {formatMetric(provider.avgLatencyMs, ' ms')}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
                    {formatMetric(provider.errorRate, '%')} errors
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-3.5 rounded-full bg-linear-to-r from-violet-500 to-sky-400"
                    style={{ width: `${Math.max(10, (provider.totalRequests / providerPeak) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Recent errors</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
              failed or timed out requests
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-400">
            {metrics.recentErrors.length} items
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {metrics.recentErrors.length === 0 ? (
            <div className="col-span-full flex min-h-40 items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-zinc-500">
              No recent failures
            </div>
          ) : (
            metrics.recentErrors.map((item) => (
              <div
                key={item.requestId}
                className="rounded-[28px] border border-rose-500/15 bg-rose-500/[0.06] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-white">{item.provider}</p>
                    <p className="mt-1 text-xs text-zinc-400">{item.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.18em] text-rose-200/80">
                      {item.errorCode ?? 'runtime'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{formatRelativeTime(item.createdAt)}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-zinc-200">
                  {item.errorMessage || 'Unknown error'}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
