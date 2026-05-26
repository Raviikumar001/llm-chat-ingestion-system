'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import MetricsDashboard from '../../components/MetricsDashboard';
import { ArrowLeftIcon, BarChartIcon, OlliveMark } from '../../components/AppIcons';
import { getMetricsOverview, type MetricsOverviewResponse } from '../../lib/api';

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

export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState<MetricsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      setError(null);
      const overview = await getMetricsOverview();
      setMetrics(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load observability data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadMetrics();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [loadMetrics]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#08090c] text-zinc-100">
      <div className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-100">
              <OlliveMark className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <BarChartIcon className="h-4 w-4 text-zinc-400" />
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Observability
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Inference metrics and pipeline health
              </h1>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to chat
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[36px] border border-white/10 bg-linear-to-br from-white/[0.05] via-white/[0.03] to-transparent p-6 shadow-[0_30px_120px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Live overview
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Inference telemetry
              </h2>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Window</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {metrics ? `${metrics.windowHours}h` : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Updated</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {metrics ? formatRelativeTime(metrics.generatedAt) : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Refresh</p>
                <p className="mt-1 text-sm font-semibold text-white">15s</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Tracked</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {metrics ? `${metrics.totals.totalRequests} req` : '--'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8">
          {error && !metrics ? (
            <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/[0.08] p-6">
              <p className="text-sm font-medium text-rose-100">Unable to load observability data right now.</p>
              <p className="mt-2 text-sm leading-7 text-rose-200/70">
                Make sure the API and database are running, then try again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  void loadMetrics();
                }}
                className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15"
              >
                Retry dashboard
              </button>
            </div>
          ) : (
            <MetricsDashboard metrics={metrics} />
          )}
        </div>

        {isLoading && !metrics && (
          <p className="mt-4 text-sm text-zinc-500">Loading metrics...</p>
        )}
      </main>
    </div>
  );
}
