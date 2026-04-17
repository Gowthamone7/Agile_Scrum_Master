"use client";

import Link from "@/next-shims/link";
import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

type Org = {
  id: string;
  name: string;
  slug: string;
  timezone?: string | null;
  logoUrl?: string | null;
  status?: string | null;
  trialEndsAt?: string | null;
  dbProvisioned?: boolean | null;
};

type CurrentOrgResp = {
  org?: Org;
  plan?: { slug: string; name: string } | null;
  subscription?: Record<string, unknown> | null;
  memberCount?: number;
  error?: string;
};

type DbStatusResp = {
  provider?: string;
  connectionMode?: string;
  status?: string;
  provisioned?: boolean;
  connected?: boolean;
  projectId?: string | null;
  connectionStringMasked?: string | null;
  error?: string;
};

type DesktopInvokeResponse<T> = {
  ok: boolean;
  data?: T | null;
  error?: {
    code?: string;
    message?: string;
    detail?: string | null;
  } | null;
};

type DesktopHttpLikeResponse<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

function hasDesktopApi(): boolean {
  return typeof window !== "undefined" && typeof (window as { desktopApi?: { invoke?: unknown } }).desktopApi?.invoke === "function";
}

function isCurrentOrgResp(data: unknown): data is CurrentOrgResp {
  return Boolean(data && typeof data === "object" && "org" in (data as Record<string, unknown>));
}

function extractError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  if ("error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string" && err) return err;
    if (err && typeof err === "object" && "message" in err) {
      const msg = (err as { message?: unknown }).message;
      return typeof msg === "string" && msg ? msg : null;
    }
    return null;
  }
  return null;
}

async function invokeDesktop<T>(channel: string, payload?: unknown): Promise<DesktopHttpLikeResponse<T>> {
  if (!hasDesktopApi()) {
    return {
      ok: false,
      status: 500,
      data: null,
    };
  }

  const raw = (await (window as { desktopApi: { invoke: (ch: string, args?: unknown) => Promise<unknown> } }).desktopApi.invoke(
    channel,
    payload,
  )) as DesktopInvokeResponse<unknown>;

  if (!raw || typeof raw !== "object") {
    return { ok: false, status: 500, data: null };
  }

  if (!raw.ok) {
    const errMsg = raw.error?.message;
    return {
      ok: false,
      status: 500,
      data: errMsg ? ({ error: errMsg } as T) : null,
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

export default function OrgSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [org, setOrg] = useState<Org | null>(null);
  const [plan, setPlan] = useState<CurrentOrgResp["plan"]>(null);
  const [dbStatus, setDbStatus] = useState<DbStatusResp | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [logoUrl, setLogoUrl] = useState("");
  const [notificationJson, setNotificationJson] = useState("{}\n");
  const [dbSetupMode, setDbSetupMode] = useState<"manual" | "auto">("manual");
  const [tenantDbConnectionString, setTenantDbConnectionString] = useState("");

  const planSlug = String(plan?.slug || "").trim().toLowerCase();
  const supportsAutoProvision = planSlug === "pro" || planSlug === "enterprise";
  const effectiveDbSetupMode: "manual" | "auto" = supportsAutoProvision ? dbSetupMode : "manual";
  const isDbProvisioned = Boolean(dbStatus?.provisioned) || Boolean(dbStatus?.connected);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const [orgResp, dbResp] = await Promise.all([
      invokeDesktop<CurrentOrgResp | Org>("org:getSettings"),
      invokeDesktop<DbStatusResp>("org:getDbStatus"),
    ]);

    if (!orgResp.ok) {
      setOrg(null);
      setPlan(null);
      setMemberCount(null);
      setDbStatus(dbResp.ok ? dbResp.data : null);
      setError(extractError(orgResp.data) || `Failed to load org (${orgResp.status})`);
      setLoading(false);
      return;
    }

    const nextOrg = isCurrentOrgResp(orgResp.data) ? orgResp.data.org ?? null : (orgResp.data as Org | null);
    setOrg(nextOrg);
    setPlan(isCurrentOrgResp(orgResp.data) ? orgResp.data.plan ?? null : null);
    setMemberCount(
      isCurrentOrgResp(orgResp.data) && typeof orgResp.data.memberCount === "number" ? orgResp.data.memberCount : null,
    );
    setDbStatus(dbResp.ok ? dbResp.data : null);

    setName(nextOrg?.name || "");
    setTimezone(nextOrg?.timezone || "UTC");
    setLogoUrl(nextOrg?.logoUrl || "");
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    let notification_settings: unknown = undefined;
    try {
      notification_settings = notificationJson.trim() ? JSON.parse(notificationJson) : undefined;
    } catch {
      setSaving(false);
      setError("Notification settings must be valid JSON");
      return;
    }

    let resolvedLogoUrl = logoUrl.trim() || undefined;
    if (resolvedLogoUrl && resolvedLogoUrl.startsWith("data:image/")) {
      const uploadResp = await invokeDesktop<{ logoUrl?: string }>("org:uploadLogo", {
        base64Image: resolvedLogoUrl,
      });
      if (!uploadResp.ok || !uploadResp.data?.logoUrl) {
        setSaving(false);
        setError(extractError(uploadResp.data) || `Logo upload failed (${uploadResp.status})`);
        return;
      }
      resolvedLogoUrl = uploadResp.data.logoUrl;
      setLogoUrl(resolvedLogoUrl);
    }

    const resp = await invokeDesktop<unknown>("org:update", {
      name: name.trim() || undefined,
      description: undefined,
      industry: undefined,
      size: undefined,
      preferences: {
        timezone: timezone.trim() || undefined,
        logoUrl: resolvedLogoUrl,
        notificationSettings: notification_settings,
      },
      timezone: timezone.trim() || undefined,
      logo_url: resolvedLogoUrl,
      notification_settings,
    });

    setSaving(false);
    if (!resp.ok) {
      setError(extractError(resp.data) || `Save failed (${resp.status})`);
      return;
    }

    setSuccess("Saved");
    await load();
  }

  async function provisionDatabase(e: React.FormEvent) {
    e.preventDefault();
    setProvisioning(true);
    setError(null);
    setSuccess(null);

    const connection = tenantDbConnectionString.trim();
    if (!supportsAutoProvision && !connection) {
      setProvisioning(false);
      setError("Free plan requires a tenant DB connection string.");
      return;
    }

    if (effectiveDbSetupMode === "manual" && !connection) {
      setProvisioning(false);
      setError("Tenant DB connection string is required for manual setup.");
      return;
    }

    const payload = supportsAutoProvision
      ? effectiveDbSetupMode === "manual"
        ? { tenantDbConnectionString: connection }
        : { autoProvision: true }
      : { tenantDbConnectionString: connection };

    const resp = await invokeDesktop<unknown>("org:provisionDb", payload);

    setProvisioning(false);
    if (!resp.ok) {
      setError(extractError(resp.data) || `Database setup failed (${resp.status})`);
      return;
    }

    setSuccess("Database setup completed.");
    setTenantDbConnectionString("");
    await load();
  }

  async function transferOwnership(newOwnerId: string): Promise<boolean> {
    const resp = await invokeDesktop<{ success?: boolean }>("org:transferOwnership", { newOwnerId });
    if (!resp.ok || !resp.data?.success) {
      setError(extractError(resp.data) || `Transfer ownership failed (${resp.status})`);
      return false;
    }
    return true;
  }

  async function deleteOrganization(confirmName: string): Promise<boolean> {
    if (!org?.name || confirmName.trim() !== org.name) {
      setError("Organization name confirmation does not match.");
      return false;
    }
    const resp = await invokeDesktop<{ success?: boolean }>("org:delete", { confirmName: confirmName.trim() });
    if (!resp.ok || !resp.data?.success) {
      setError(extractError(resp.data) || `Delete organization failed (${resp.status})`);
      return false;
    }
    return true;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Organization</h1>
            <p className="text-slate-600 dark:text-slate-300">Update org profile and preferences.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <Link
              href="/settings"
              className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800"
            >
              Back to Settings
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mb-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="text-slate-600 dark:text-slate-300">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Plan</div>
                <div className="mt-2 text-slate-900 dark:text-white font-bold">{plan?.name || "—"}</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{plan?.slug || ""}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Members</div>
                <div className="mt-2 text-slate-900 dark:text-white font-bold">{memberCount ?? "—"}</div>
                <Link href="/settings/team" className="mt-2 inline-block text-sm font-semibold text-slate-900 dark:text-slate-200 underline underline-offset-4">
                  Manage team
                </Link>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Database</div>
                <div className="mt-2 text-slate-900 dark:text-white font-bold">{dbStatus?.status || "—"}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Provider: {dbStatus?.provider || "—"} · Mode: {dbStatus?.connectionMode || "—"} · Connected: {dbStatus?.connected ? "yes" : "no"}
                </div>
                {dbStatus?.connectionStringMasked ? (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 break-all">
                    Connection: {dbStatus.connectionStringMasked}
                  </div>
                ) : null}
                {dbStatus?.provider === "neon" && !dbStatus?.connectionStringMasked ? (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Neon auto-provisioning will attach a tenant connection once setup is complete.
                  </div>
                ) : null}
              </div>
            </div>

            {!isDbProvisioned ? (
              <form
                onSubmit={provisionDatabase}
                className="mb-6 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
              >
                <div className="text-lg font-semibold text-slate-900 dark:text-white">Complete Database Setup</div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Your organization is created but tenant DB is not provisioned yet. Finish setup to enable all org actions.
                </div>

                {supportsAutoProvision ? (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Database Setup</div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="dbSetupMode"
                          value="manual"
                          checked={effectiveDbSetupMode === "manual"}
                          onChange={() => setDbSetupMode("manual")}
                        />
                        I have a connection string
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="radio"
                          name="dbSetupMode"
                          value="auto"
                          checked={effectiveDbSetupMode === "auto"}
                          onChange={() => setDbSetupMode("auto")}
                        />
                        Create one automatically (Neon)
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                    Free plan requires an explicit tenant DB connection string.
                  </div>
                )}

                {!supportsAutoProvision || effectiveDbSetupMode === "manual" ? (
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      Tenant DB Connection String
                    </label>
                    <textarea
                      value={tenantDbConnectionString}
                      onChange={(e) => setTenantDbConnectionString(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                      placeholder="postgresql://user:pass@host/db?sslmode=require"
                    />
                  </div>
                ) : null}

                <div className="mt-6 flex gap-2">
                  <button
                    type="submit"
                    disabled={provisioning}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {provisioning ? "Setting up…" : "Complete setup"}
                  </button>
                </div>
              </form>
            ) : null}

            <form onSubmit={saveSettings} className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Profile</div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                    placeholder="Acme Inc"
                  />
                </label>
                <label>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Slug</div>
                  <input
                    value={org?.slug || ""}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none"
                  />
                </label>
                <label>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Timezone</div>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                    placeholder="UTC"
                  />
                </label>
                <label>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Logo URL</div>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none"
                    placeholder="https://..."
                  />
                </label>
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Notification settings (JSON)</div>
                <textarea
                  value={notificationJson}
                  onChange={(e) => setNotificationJson(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none font-mono"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
                </button>
                <Link
                  href="/settings/integrations"
                  className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Manage integrations
                </Link>
              </div>
            </form>

          </>
        )}
      </div>
    </div>
  );
}

