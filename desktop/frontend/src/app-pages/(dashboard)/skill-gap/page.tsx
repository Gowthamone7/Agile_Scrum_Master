"use client";

import { useEffect, useState } from "react";

type Developer = { id: string; fullName?: string; name?: string };
type Skill = { id: string; name: string; category?: string };
type SkillLevel = number;
type SkillGapMatrix = { members: Developer[]; skills: Skill[]; matrix: SkillLevel[][] };
type RequiredSkill = { skillId: string; name?: string; priority?: number; count?: number };

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
  if (!raw?.ok) {
    return {
      ok: false,
      status: 500,
      data: null,
    };
  }

  const wrapped = raw.data;
  if (wrapped && typeof wrapped === "object" && "ok" in (wrapped as Record<string, unknown>) && "status" in (wrapped as Record<string, unknown>)) {
    const normalized = wrapped as { ok: boolean; status: number; data: T | null };
    return {
      ok: Boolean(normalized.ok),
      status: Number(normalized.status) || 200,
      data: (normalized.data ?? null) as T | null,
    };
  }

  return { ok: true, status: 200, data: (raw.data as T) ?? null };
}

export default function SkillGapPage() {
  const [, setMatrix] = useState<SkillGapMatrix | null>(null);
  const [, setRequiredSkills] = useState<RequiredSkill[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [matrixResp, requiredResp] = await Promise.all([
        invokeDesktop<SkillGapMatrix>("skillGap:getMatrix"),
        invokeDesktop<RequiredSkill[]>("skillGap:getRequiredSkills", { sprintId: null }),
      ]);

      if (cancelled) return;
      if (matrixResp.ok) setMatrix(matrixResp.data);
      if (requiredResp.ok) setRequiredSkills(Array.isArray(requiredResp.data) ? requiredResp.data : []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function updateSkillLevel(memberId: string, skillId: string, level: number) {
    await invokeDesktop<SkillLevel[]>("skillGap:updateSkillLevel", { memberId, skillId, level });
  }

  async function assignTraining(memberId: string, skillId: string, resourceUrl: string) {
    await invokeDesktop<{ success: boolean }>("skillGap:assignTraining", { memberId, skillId, resourceUrl });
  }

  void updateSkillLevel;
  void assignTraining;

  return (
    <div className="min-h-screen bg-white dark:bg-black px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Skill Gap Analyzer</h1>
        <p className="text-slate-600 dark:text-slate-300">
          UI scaffold. Backend endpoints for skill-gap reporting aren’t present in the gateway yet.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-slate-700 dark:text-slate-200">
          Once the backend endpoint exists, this page can display:
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Missing skills aggregated from failed assignments</li>
            <li>Impact level + suggested hire/train action</li>
            <li>Weekly report generation</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

