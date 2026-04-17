"use client";

import { useEffect, useState } from "react";
import Link from "@/next-shims/link";
import { User, Save } from "lucide-react";

type ProfileDraft = {
  displayName: string;
  title: string;
  phone: string;
  timezone: string;
  bio: string;
};

type UserProfile = {
  displayName?: string;
  title?: string;
  phone?: string;
  timezone?: string;
  bio?: string;
  email?: string;
  orgName?: string;
};

type Session = {
  id: string;
  createdAt?: string;
  ipAddress?: string;
  userAgent?: string;
  current?: boolean;
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

function hasDesktopApi(): boolean {
  return typeof window !== "undefined" && typeof (window as { desktopApi?: { invoke?: unknown } }).desktopApi?.invoke === "function";
}

function extractError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if (!("error" in data)) return null;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err) return err;
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === "string" && msg ? msg : null;
  }
  return null;
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

  const wrapped = raw.data;
  if (wrapped && typeof wrapped === "object" && "ok" in (wrapped as Record<string, unknown>) && "status" in (wrapped as Record<string, unknown>)) {
    const normalized = wrapped as { ok: boolean; status: number; data: T | null };
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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<{ email: string; fullName: string; orgName: string } | null>(null);
  const [, setSessions] = useState<Session[]>([]);
  const [draft, setDraft] = useState<ProfileDraft>({
    displayName: "",
    title: "",
    phone: "",
    timezone: "",
    bio: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);

      const [profileResp, sessionsResp] = await Promise.all([
        invokeDesktop<UserProfile>("profile:get"),
        invokeDesktop<Session[]>("profile:getSessions"),
      ]);

      if (cancelled) return;

      if (!profileResp.ok) {
        setError(extractError(profileResp.data) || `Failed to load profile (${profileResp.status})`);
        setLoading(false);
        return;
      }

      const profile = profileResp.data;
      setAccount({
        email: String(profile?.email || ""),
        fullName: String(profile?.displayName || ""),
        orgName: String(profile?.orgName || "No organization"),
      });

      setDraft({
        displayName: String(profile?.displayName || ""),
        title: String(profile?.title || ""),
        phone: String(profile?.phone || ""),
        timezone: String(profile?.timezone || ""),
        bio: String(profile?.bio || ""),
      });

      if (sessionsResp.ok) {
        setSessions(Array.isArray(sessionsResp.data) ? sessionsResp.data : []);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setError(null);

    const resp = await invokeDesktop<UserProfile>("profile:update", {
      displayName: draft.displayName,
      title: draft.title,
      bio: draft.bio,
      phone: draft.phone,
    });

    if (!resp.ok) {
      setError(extractError(resp.data) || `Failed to save profile (${resp.status})`);
      return;
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <User className="w-8 h-8" />
            Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-300">Manage your account details and personal preferences</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-slate-200 dark:border-zinc-800 p-6 mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Account</h2>
          {loading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading profile...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600 dark:text-slate-400">Email</p>
                <p className="text-slate-900 dark:text-white font-medium">{account?.email || "-"}</p>
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">Organization</p>
                <p className="text-slate-900 dark:text-white font-medium">{account?.orgName || "-"}</p>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-slate-200 dark:border-zinc-800 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Need to upgrade your workspace plan?</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/settings/billing?plan=pro"
                className="inline-flex items-center rounded-lg bg-slate-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-black"
              >
                Upgrade to Pro
              </Link>
              <Link
                href="/settings/billing?plan=enterprise"
                className="inline-flex items-center rounded-lg border border-slate-300 dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white"
              >
                Upgrade to Enterprise
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-slate-200 dark:border-zinc-800 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Personal Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Display name</label>
              <input
                className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800"
                value={draft.displayName}
                onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title</label>
              <input
                className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Scrum Master"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Phone</label>
              <input
                className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800"
                value={draft.phone}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+1 000 000 0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Timezone</label>
              <input
                className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800"
                value={draft.timezone}
                onChange={(e) => setDraft((prev) => ({ ...prev, timezone: e.target.value }))}
                placeholder="Asia/Kolkata"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bio</label>
              <textarea
                className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800"
                rows={4}
                value={draft.bio}
                onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Add your profile details..."
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={saveProfile}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-semibold py-2 px-4 rounded-lg transition inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Profile
            </button>
            {saved ? <p className="text-sm text-green-700 dark:text-green-300">Saved</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

