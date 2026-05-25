import { sql } from 'drizzle-orm';
import { db } from '../db';

interface MetricsOverview {
  generatedAt: string;
  windowHours: number;
  totals: {
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    cancelledRequests: number;
    timedOutRequests: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    requestsLastHour: number;
    errorRate: number;
  };
  providers: Array<{
    provider: string;
    totalRequests: number;
    avgLatencyMs: number | null;
    errorRate: number;
  }>;
  recentErrors: Array<{
    requestId: string;
    provider: string;
    model: string;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

export async function getMetricsOverview(windowHours = 24): Promise<MetricsOverview> {
  const [totalsResult, providersResult, recentErrorsResult] = await Promise.all([
    db.execute(sql`
      with scoped as (
        select *
        from inference_logs
        where created_at >= now() - (${windowHours} * interval '1 hour')
      ),
      terminal as (
        select *
        from scoped
        where status in ('completed', 'failed', 'cancelled', 'timed_out')
      )
      select
        count(*)::int as total_requests,
        count(*) filter (where status = 'completed')::int as completed_requests,
        count(*) filter (where status = 'failed')::int as failed_requests,
        count(*) filter (where status = 'cancelled')::int as cancelled_requests,
        count(*) filter (where status = 'timed_out')::int as timed_out_requests,
        round(avg(latency_ms) filter (where latency_ms is not null))::int as avg_latency_ms,
        percentile_cont(0.95) within group (order by latency_ms)
          filter (where latency_ms is not null) as p95_latency_ms,
        (
          select count(*)::int
          from inference_logs
          where created_at >= now() - interval '1 hour'
        ) as requests_last_hour,
        coalesce(
          round(
            (
              count(*) filter (where status in ('failed', 'timed_out'))::numeric
              / nullif(count(*) filter (where status in ('completed', 'failed', 'timed_out')), 0)
            ) * 100,
            1
          ),
          0
        ) as error_rate
      from terminal
    `),
    db.execute(sql`
      with terminal as (
        select *
        from inference_logs
        where created_at >= now() - (${windowHours} * interval '1 hour')
          and status in ('completed', 'failed', 'cancelled', 'timed_out')
      )
      select
        provider,
        count(*)::int as total_requests,
        round(avg(latency_ms) filter (where latency_ms is not null))::int as avg_latency_ms,
        coalesce(
          round(
            (
              count(*) filter (where status in ('failed', 'timed_out'))::numeric
              / nullif(count(*) filter (where status in ('completed', 'failed', 'timed_out')), 0)
            ) * 100,
            1
          ),
          0
        ) as error_rate
      from terminal
      group by provider
      order by total_requests desc, provider asc
    `),
    db.execute(sql`
      select
        request_id,
        provider,
        model,
        error_code,
        error_message,
        created_at
      from inference_logs
      where created_at >= now() - (${windowHours} * interval '1 hour')
        and status in ('failed', 'timed_out')
      order by created_at desc
      limit 5
    `),
  ]);

  const totalRows = Array.from(totalsResult) as Array<Record<string, unknown>>;
  const providerRows = Array.from(providersResult) as Array<Record<string, unknown>>;
  const recentErrorRows = Array.from(recentErrorsResult) as Array<Record<string, unknown>>;
  const totalsRow = (totalRows[0] ?? {}) as Record<string, unknown>;

  return {
    generatedAt: new Date().toISOString(),
    windowHours,
    totals: {
      totalRequests: Number(totalsRow.total_requests ?? 0),
      completedRequests: Number(totalsRow.completed_requests ?? 0),
      failedRequests: Number(totalsRow.failed_requests ?? 0),
      cancelledRequests: Number(totalsRow.cancelled_requests ?? 0),
      timedOutRequests: Number(totalsRow.timed_out_requests ?? 0),
      avgLatencyMs: totalsRow.avg_latency_ms == null ? null : Number(totalsRow.avg_latency_ms),
      p95LatencyMs: totalsRow.p95_latency_ms == null ? null : Number(totalsRow.p95_latency_ms),
      requestsLastHour: Number(totalsRow.requests_last_hour ?? 0),
      errorRate: Number(totalsRow.error_rate ?? 0),
    },
    providers: providerRows.map((record) => {
      return {
        provider: String(record.provider),
        totalRequests: Number(record.total_requests ?? 0),
        avgLatencyMs: record.avg_latency_ms == null ? null : Number(record.avg_latency_ms),
        errorRate: Number(record.error_rate ?? 0),
      };
    }),
    recentErrors: recentErrorRows.map((record) => {
      return {
        requestId: String(record.request_id),
        provider: String(record.provider),
        model: String(record.model),
        errorCode: record.error_code == null ? null : String(record.error_code),
        errorMessage: record.error_message == null ? null : String(record.error_message),
        createdAt: new Date(String(record.created_at)).toISOString(),
      };
    }),
  };
}
