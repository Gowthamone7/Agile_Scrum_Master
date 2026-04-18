"use client";

import { useEffect, useMemo, useState } from "react";

type DlqItem = {
  id: string;
  source: string;
  event_type: string;
  payload: unknown;
  processed: boolean;
  processed_at: string | null;
  processing_error: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  dlq: boolean;
  created_at: string;
};

type DlqResponse = {
  total: number;
  items: DlqItem[];
};

type Webhook = {
  id?: string;
  source?: string;
  url?: string;
};

type Delivery = {
  id?: string;
  event_type?: string;
  eventType?: string;
  payload?: unknown;
  requestBody?: unknown;
  responseBody?: unknown;
  success?: boolean;
  responseCode?: number;
  statusCode?: number;
  processed?: boolean;
  processedAt?: string | null;
  lastTriggered?: string | null;
  createdAt?: string;
  created_at?: string;
  retry_count?: number;
  retryCount?: number;
  max_retries?: number;
  maxRetries?: number;
  next_retry_at?: string | null;
  nextRetryAt?: string | null;
  error?: string | null;
  processing_error?: string | null;
};

type DesktopEnvelope<T> = {
  ok: boolean;
  data?: T | null;
  error?: {
    code?: string;
    message?: string;
    detail?: string | null;
  } | null;
};

type DesktopResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

function fmt(v: string | null | undefined): string {
  if (!v) return "-";
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return String(v);
  return new Date(t).toLocaleString();
}

function payloadPreview(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    if (!s) return "{}";
    return s.length > 220 ? `${s.slice(0, 220)}...` : s;
  } catch {
    return "{payload}";
  }
}

function payloadPretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function extractError(data: unknown): string {
  if (!data || typeof data !== "object") return "Request failed";
  const rec = data as Record<string, unknown>;
  const err = typeof rec.error === "string" ? rec.error : "Request failed";
  const detail = typeof rec.detail === "string" ? rec.detail : "";
  return detail ? `${err}: ${detail}` : err;
}

function hasDesktopApi(): boolean {
  return typeof window !== "undefined" && typeof (window as { desktopApi?: { invoke?: unknown } }).desktopApi?.invoke === "function";
}

async function invokeDesktop<T>(channel: string, payload?: unknown): Promise<DesktopResult<T>> {
  const desktopApi = (window as unknown as {
    desktopApi?: { invoke?: (ch: string, args?: unknown) => Promise<unknown> };
  }).desktopApi;

  if (!hasDesktopApi() || !desktopApi?.invoke) {
    return { ok: false, status: 500, data: null };
  }

  const raw = (await desktopApi.invoke(channel, payload)) as DesktopEnvelope<unknown>;
  if (!raw || typeof raw !== "object") {
    return { ok: false, status: 500, data: null };
  }

  if (!raw.ok) {
    return {
      ok: false,
      status: 500,
      data: (raw.error?.message ? ({ error: raw.error.message } as T) : null),
    };
  }

  const envelope = raw.data;
  if (envelope && typeof envelope === "object" && "ok" in (envelope as Record<string, unknown>) && "status" in (envelope as Record<string, unknown>)) {
    const normalized = envelope as { ok: boolean; status: number; data: T | null };
    return {
      ok: Boolean(normalized.ok),
      status: Number(normalized.status) || 200,
      data: (normalized.data ?? null) as T | null,
    };
  }

  return {
    ok: true,
    status: 200,
    data: (raw.data as T) ?? null,
  };
}

function asItemsArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

function toIsoDate(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return new Date(0).toISOString();
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return new Date(0).toISOString();
  return new Date(ts).toISOString();
}

function toDlqItem(webhook: Webhook, delivery: Delivery, fallbackIndex: number): DlqItem {
  const processed = typeof delivery.processed === "boolean"
    ? delivery.processed
    : typeof delivery.success === "boolean"
      ? delivery.success
      : Number(delivery.responseCode ?? delivery.statusCode ?? 0) >= 200 && Number(delivery.responseCode ?? delivery.statusCode ?? 0) < 400;

  const created = toIsoDate(delivery.created_at || delivery.createdAt || delivery.lastTriggered);
  const processedAt = typeof delivery.processedAt === "string"
    ? delivery.processedAt
    : typeof delivery.lastTriggered === "string"
      ? delivery.lastTriggered
      : null;

  return {
    id: String(delivery.id || `${webhook.id || "webhook"}-${fallbackIndex}`),
    source: String(webhook.source || webhook.url || "webhook"),
    event_type: String(delivery.event_type || delivery.eventType || "unknown"),
    payload: delivery.payload ?? delivery.requestBody ?? {},
    processed,
    processed_at: processedAt,
    processing_error: String(delivery.processing_error || delivery.error || "") || null,
    retry_count: Number(delivery.retry_count ?? delivery.retryCount ?? 0),
    max_retries: Number(delivery.max_retries ?? delivery.maxRetries ?? 5),
    next_retry_at: String(delivery.next_retry_at || delivery.nextRetryAt || "") || null,
    dlq: !processed,
    created_at: created,
  };
}

function withinDateRange(createdAt: string, fromDate: string, toDate: string): boolean {
  const ts = new Date(createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  if (fromDate) {
    const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
    if (Number.isFinite(fromTs) && ts < fromTs) return false;
  }
  if (toDate) {
    const toTs = new Date(`${toDate}T23:59:59`).getTime();
    if (Number.isFinite(toTs) && ts > toTs) return false;
  }
  return true;
}

export function WebhookDLQPanel() {
  const [items, setItems] = useState<DlqItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const uniqueEventTypes = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) set.add(String(i.event_type || ""));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [items]);

  async function load() {
    setLoading(true);
    setError(null);

    const hooksResp = await invokeDesktop<Webhook[] | { items?: Webhook[]; error?: string }>("webhooks:getAll");
    if (!hooksResp.ok) {
      setLoading(false);
      setError(extractError(hooksResp.data));
      return;
    }

    const webhooks = asItemsArray<Webhook>(hooksResp.data);
    const logs = await Promise.all(
      webhooks.map(async (webhook) => {
        const webhookId = String(webhook.id || "");
        if (!webhookId) return [] as DlqItem[];
        const logResp = await invokeDesktop<Delivery[] | { items?: Delivery[]; error?: string }>("webhooks:getDeliveryLog", { webhookId });
        if (!logResp.ok) return [] as DlqItem[];
        const deliveries = asItemsArray<Delivery>(logResp.data);
        return deliveries.map((delivery, index) => toDlqItem(webhook, delivery, index));
      })
    );

    const flattened = logs.flat();
    const filtered = flattened
      .filter((item) => item.dlq || Boolean(item.processing_error))
      .filter((item) => (sourceFilter ? String(item.source || "").toLowerCase().includes(sourceFilter.toLowerCase()) : true))
      .filter((item) => (eventTypeFilter ? String(item.event_type || "") === eventTypeFilter : true))
      .filter((item) => withinDateRange(item.created_at, fromDate, toDate))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 200);

    setItems(filtered);
    setTotal(filtered.length);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, eventTypeFilter, fromDate, toDate]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilter, eventTypeFilter, fromDate, toDate]);

  async function retryOne(eventId: string) {
    setRetryingId(eventId);
    setError(null);

    const resp = await invokeDesktop<{ success?: boolean; error?: string }>("webhooks:retryDelivery", { deliveryId: eventId });
    setRetryingId(null);

    if (!resp.ok) {
      setError(extractError(resp.data));
      return;
    }

    await load();
  }

  async function retryAll() {
    setRetryingAll(true);
    setError(null);

    const targets = items.map((it) => String(it.id)).filter(Boolean);
    const results = await Promise.allSettled(
      targets.map((deliveryId) => invokeDesktop<{ success?: boolean; error?: string }>("webhooks:retryDelivery", { deliveryId }))
    );
    setRetryingAll(false);

    const failed = results.some((result) => {
      if (result.status !== "fulfilled") return true;
      return !result.value.ok;
    });

    if (failed) {
      setError("Some retries failed");
      return;
    }

    await load();
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Webhook Dead Letter Queue</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300">Failed webhook events that hit max retries.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-200">
            DLQ: {total}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => void retryAll()}
            className="rounded-md bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            disabled={retryingAll || !items.length}
          >
            {retryingAll ? "Retrying..." : "Retry All"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
        >
          <option value="">All sources</option>
          <option value="jira">jira</option>
          <option value="github">github</option>
        </select>

        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
        >
          <option value="">All event types</option>
          {uniqueEventTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-white"
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 dark:bg-zinc-950/50 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="text-left px-3 py-2">Source</th>
              <th className="text-left px-3 py-2">Event Type</th>
              <th className="text-left px-3 py-2">Error</th>
              <th className="text-left px-3 py-2">Retry</th>
              <th className="text-left px-3 py-2">Last Attempt</th>
              <th className="text-left px-3 py-2">Payload Preview</th>
              <th className="text-left px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const expanded = expandedId === it.id;
              return (
                <>
                  <tr key={it.id} className="border-t border-slate-100 dark:border-zinc-800">
                    <td className="px-3 py-2 text-slate-900 dark:text-white">{it.source}</td>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-200 font-mono">{it.event_type}</td>
                    <td className="px-3 py-2 text-red-700 dark:text-red-300 max-w-[260px] truncate">{it.processing_error || "-"}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {it.retry_count}/{it.max_retries}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{fmt(it.processed_at)}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200 max-w-[300px] truncate">{payloadPreview(it.payload)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === it.id ? null : it.id))}
                          className="rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-slate-900 dark:text-white"
                        >
                          {expanded ? "Hide" : "View"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void retryOne(it.id)}
                          disabled={retryingId === it.id}
                          className="rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black px-2 py-1 text-[11px] font-semibold disabled:opacity-60"
                        >
                          {retryingId === it.id ? "Retrying..." : "Retry"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/30">
                      <td colSpan={7} className="px-3 py-3">
                        <pre className="rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-[11px] text-slate-900 dark:text-white overflow-auto max-h-80">
                          {payloadPretty(it.payload)}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
            {!loading && !items.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-600 dark:text-slate-300">
                  No DLQ events found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
