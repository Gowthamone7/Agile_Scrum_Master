"use client";

import { useParams } from "@/next-shims/navigation";
import { useEffect, useMemo, useState } from "react";

type Task = Record<string, unknown>;
type TaskComment = Record<string, unknown>;

type TaskResp = { task?: Task; error?: string } | (Task & { error?: never });

type CommentsResp = { items: TaskComment[] };

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

function safe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function fmtDate(value: unknown): string {
  const raw = safe(value);
  if (!raw) return "-";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleString();
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "done") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (s === "blocked") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200";
  if (s === "in_progress") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200";
  if (s === "in_review") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200";
}

function priorityTone(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "high") return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  if (p === "medium") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
}

function normalizeTask(data: TaskResp | null): Task | null {
  if (!data) return null;
  if (typeof data === "object" && data && "task" in data) {
    const maybe = (data as { task?: Task }).task;
    return maybe ?? null;
  }
  return data;
}

function extractError(data: TaskResp | null): string | null {
  if (!data || typeof data !== "object") return null;
  if ("error" in data) {
    const err = (data as { error?: unknown }).error;
    return typeof err === "string" && err ? err : null;
  }
  return null;
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

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = params?.taskId;
  const hasId = useMemo(() => typeof taskId === "string" && taskId.length > 0, [taskId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<CommentsResp | null>(null);

  const assignee = useMemo(() => {
    if (!task || typeof task.assignee !== "object" || !task.assignee) return null;
    const raw = task.assignee as Record<string, unknown>;
    return { id: safe(raw.id), name: safe(raw.name), avatarUrl: safe(raw.avatarUrl) };
  }, [task]);

  const techTags = useMemo(() => {
    if (!task || !Array.isArray(task.techTags)) return [];
    return task.techTags.map((x) => safe(x)).filter(Boolean);
  }, [task]);

  const subtasks = useMemo(() => {
    if (!task || !Array.isArray(task.subtasks)) return [];
    return task.subtasks as Record<string, unknown>[];
  }, [task]);

  const commentItems = useMemo(() => {
    if (!comments || !Array.isArray(comments.items)) return [];
    return comments.items;
  }, [comments]);

  useEffect(() => {
    if (!hasId) return;

    (async () => {
      setLoading(true);
      setError(null);

      const tResp = await invokeDesktop<TaskResp>("tasks:getById", { taskId });

      if (!tResp.ok) {
        setTask(null);
        setComments(null);
        setError(extractError(tResp.data) || `Failed to load task (${tResp.status})`);
        setLoading(false);
        return;
      }

      const nextTask = normalizeTask(tResp.data);
      setTask(nextTask);

      const rawComments = nextTask && typeof nextTask === "object" && Array.isArray((nextTask as Record<string, unknown>).comments)
        ? ((nextTask as Record<string, unknown>).comments as TaskComment[])
        : [];
      setComments({ items: rawComments });
      setLoading(false);
    })();
  }, [hasId, taskId]);

  return (
    <div className="min-h-screen bg-white dark:bg-black px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Task</h1>
        <p className="text-slate-600 dark:text-slate-300">ID: {taskId}</p>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 text-slate-600 dark:text-slate-300">Loading…</div>
        ) : !task ? (
          <div className="mt-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
            Task not found.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{safe(task.title) || "Untitled Task"}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(safe(task.status) || "todo")}`}>
                  {safe(task.status) || "todo"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityTone(safe(task.priority) || "low")}`}>
                  {safe(task.priority) || "low"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Project ID</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{safe(task.projectId) || "-"}</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Sprint ID</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{safe(task.sprintId) || "-"}</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Story Points</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{safe(task.storyPoints) || "0"}</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Assigned Developer</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{assignee?.name || "Unassigned"}</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Created</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(task.createdAt)}</div>
                </div>
                <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Updated</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{fmtDate(task.updatedAt)}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Description</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {safe(task.description) || "No description provided."}
                </p>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Acceptance Criteria</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {safe(task.acceptanceCriteria) || "No acceptance criteria."}
                </p>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tech Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {techTags.length ? (
                    techTags.map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200">
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">No tags</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Subtasks</div>
              <div className="mt-3 space-y-2">
                {subtasks.length ? (
                  subtasks.map((sub) => (
                    <div key={safe(sub.id)} className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{safe(sub.title) || "Untitled subtask"}</div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(safe(sub.status) || "todo")}`}>
                          {safe(sub.status) || "todo"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No subtasks yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Comments</div>
              <div className="mt-3 space-y-2">
                {commentItems.length ? (
                  commentItems.map((comment) => {
                    const author =
                      comment.author && typeof comment.author === "object"
                        ? (comment.author as Record<string, unknown>)
                        : null;
                    return (
                      <div key={safe(comment.id)} className="rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {safe(author?.fullName || author?.name) || "Unknown"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{fmtDate(comment.createdAt)}</div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{safe(comment.content) || "(empty)"}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">No comments yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
