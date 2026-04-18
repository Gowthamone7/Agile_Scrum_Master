"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "@/next-shims/navigation";

type StandupEntry = {
  id?: string;
  userId?: string;
  yesterday?: string;
  today?: string;
  blockers?: string;
  rawInput?: string;
};

type DesktopInvokeEnvelope<T> = {
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

  const raw = (await desktopApi.invoke(channel, payload)) as DesktopInvokeEnvelope<unknown>;
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

function parseStandupText(raw: string): { yesterday: string; today: string; blockers: string } {
  const normalized = String(raw || "").replace(/\r/g, "");
  const yMatch = normalized.match(/(?:^|\n)\s*Yesterday\s*:\s*([\s\S]*?)(?=\n\s*Today\s*:|\n\s*Blockers\s*:|$)/i);
  const tMatch = normalized.match(/(?:^|\n)\s*Today\s*:\s*([\s\S]*?)(?=\n\s*Yesterday\s*:|\n\s*Blockers\s*:|$)/i);
  const bMatch = normalized.match(/(?:^|\n)\s*Blockers\s*:\s*([\s\S]*?)(?=\n\s*Yesterday\s*:|\n\s*Today\s*:|$)/i);

  const yesterday = (yMatch?.[1] || "").trim();
  const today = (tMatch?.[1] || "").trim();
  const blockers = (bMatch?.[1] || "").trim();

  if (yesterday || today || blockers) {
    return { yesterday, today, blockers };
  }

  return {
    yesterday: normalized.trim(),
    today: "",
    blockers: "",
  };
}

function composeStandupText(entry: StandupEntry): string {
  const y = String(entry.yesterday || "").trim();
  const t = String(entry.today || "").trim();
  const b = String(entry.blockers || "").trim();
  if (y || t || b) {
    return `Yesterday: ${y}\nToday: ${t}\nBlockers: ${b}`.trim();
  }
  return String(entry.rawInput || "").trim();
}

export default function StandupPage() {
  const searchParams = useSearchParams();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState("");
  const maxChars = 2000;
  const remaining = useMemo(() => maxChars - text.length, [text.length]);

  async function loadToday() {
    const resp = await invokeDesktop<StandupEntry[]>("standup:getToday");
    if (!resp.ok) return;
    const items = Array.isArray(resp.data) ? resp.data : [];
    if (!items.length) return;
    const first = items[0];
    if (first?.userId) setActiveUserId(String(first.userId));
    const prefill = composeStandupText(first || {});
    if (prefill) setText(prefill);
  }

  async function loadHistory(date: string) {
    const resp = await invokeDesktop<StandupEntry[]>("standup:getHistory", { date });
    if (!resp.ok) return;
    const items = Array.isArray(resp.data) ? resp.data : [];
    if (!items.length) return;
    const first = items[0];
    const prefill = composeStandupText(first || {});
    if (prefill) setText(prefill);
  }

  async function generateSummary(date: string) {
    const resp = await invokeDesktop<{ summary?: string; error?: string }>("standup:generateSummary", { date });
    if (!resp.ok) return;
    const summary = String(resp.data?.summary || "").trim();
    if (summary) {
      setSuccess("Summary generated and copied-ready.");
    }
  }

  useEffect(() => {
    void loadToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const date = searchParams.get("date") || "";
    const mode = searchParams.get("mode") || "";
    if (!date) return;
    void loadHistory(date);
    if (mode === "summary") {
      void generateSummary(date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function submitStandup() {
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const parsed = parseStandupText(text);
      const resp = await invokeDesktop<StandupEntry & { blockerTaskIds?: string[]; error?: string }>("standup:submit", {
        userId: activeUserId || "",
        yesterday: parsed.yesterday,
        today: parsed.today,
        blockers: parsed.blockers,
      });

      if (!resp.ok) throw new Error(String((resp.data as { error?: string } | null)?.error || "Failed to submit standup"));

      const blockers = Array.isArray(resp.data?.blockerTaskIds) ? resp.data.blockerTaskIds.length : 0;
      setSuccess(
        blockers
          ? `Standup submitted. ${blockers} blocker task${blockers > 1 ? "s" : ""} created automatically.`
          : "Standup submitted successfully."
      );
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit standup");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Daily Standup</h1>
        <p className="text-slate-600 dark:text-slate-300">Standalone UI shell (API wiring can be added when the backend endpoint exists).</p>

        <div className="mt-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            What did you do yesterday, what will you do today, blockers?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            maxLength={maxChars}
            className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
            placeholder="Yesterday: …\nToday: …\nBlockers: …"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{remaining} characters remaining</span>
            <button
              type="button"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
              onClick={() => void submitStandup()}
              disabled={submitting || !text.trim()}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>

          {error ? (
            <div className="mt-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-800 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-3 rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-3 py-2 text-xs text-green-800 dark:text-green-200">
              {success}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

