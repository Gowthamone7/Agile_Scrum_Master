const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");
const CHANNELS = require("./ipc/channels");
const IPCResponse = require("./utils/ipc-response");

app.setName("Agile Scrum Master Desktop");
if (process.platform === "win32") {
  app.setAppUserModelId("com.agilescrummaster.desktop");
}

// Backend base URL (adjust as needed for your environment)
const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://localhost:3000";

function createWindow() {
  const win = new BrowserWindow({
    title: "Agile Scrum Master Desktop",
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const startUrl = process.env.ELECTRON_START_URL;
  const rendererIndexPath = path.join(__dirname, "..", "frontend", "dist", "index.html");

  if (startUrl) {
    win.loadURL(startUrl);
    return;
  }

  if (!fs.existsSync(rendererIndexPath)) {
    win.loadURL(
      "data:text/html;charset=UTF-8," +
        encodeURIComponent("<h2>Renderer build not found</h2><p>Run: npm run build:frontend</p>")
    );
    return;
  }

  win.loadFile(rendererIndexPath);
}

// Helper to make HTTP requests from main process
async function fetchFromBackend(path, options = {}) {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, options);
    const text = await response.text().catch(() => "");
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return IPCResponse.success({ ok: response.ok, status: response.status, data });
  } catch (error) {
    return IPCResponse.error("FETCH_ERROR", error.message, error.stack);
  }
}

// Jira Integration Handlers
ipcMain.handle(CHANNELS.INTEGRATIONS.GET_JIRA_STATUS, async () => {
  return await fetchFromBackend("/api/integrations/jira/status");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.GET_JIRA_PROJECTS, async () => {
  return await fetchFromBackend("/api/integrations/jira/projects");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.GET_JIRA_SYNC_STATUS, async () => {
  return await fetchFromBackend("/api/integrations/jira/sync-status");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.GET_JIRA_WEBHOOK_LOGS, async () => {
  return await fetchFromBackend("/api/integrations/jira/webhook-logs");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.CONNECT_JIRA, async (event, payload) => {
  return await fetchFromBackend("/api/integrations/jira/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
});

ipcMain.handle(CHANNELS.INTEGRATIONS.RETRY_JIRA_WEBHOOK, async (event, { eventId }) => {
  return await fetchFromBackend(`/api/integrations/jira/webhook-logs/${encodeURIComponent(eventId)}/retry`, {
    method: "POST"
  });
});

ipcMain.handle(CHANNELS.INTEGRATIONS.TEST_JIRA_WEBHOOK, async (event, payload) => {
  return await fetchFromBackend("/api/webhooks/jira/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
});

ipcMain.handle(CHANNELS.INTEGRATIONS.SYNC_JIRA_NOW, async (event, payload) => {
  return await fetchFromBackend("/api/integrations/jira/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
});

ipcMain.handle(CHANNELS.INTEGRATIONS.UPDATE_JIRA_SYNC_SCHEDULE, async (event, payload) => {
  return await fetchFromBackend("/api/integrations/jira/sync-schedule", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
});

// GitHub Integration Handlers
ipcMain.handle(CHANNELS.INTEGRATIONS.GET_GITHUB_STATUS, async () => {
  return await fetchFromBackend("/api/integrations/github/status");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.GET_GITHUB_WEBHOOK_STATUS, async () => {
  return await fetchFromBackend("/api/integrations/github/webhook-status");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.GET_GITHUB_WEBHOOK_DELIVERIES, async () => {
  return await fetchFromBackend("/api/integrations/github/webhook-deliveries");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.REDELIVER_GITHUB_WEBHOOK, async (event, { deliveryId }) => {
  return await fetchFromBackend(`/api/integrations/github/webhooks/redeliver/${encodeURIComponent(deliveryId)}`, {
    method: "POST"
  });
});

// Generic Integration Config Handlers
ipcMain.handle(CHANNELS.INTEGRATIONS.GET_CONFIG, async (event, { type }) => {
  return await fetchFromBackend(`/api/integrations/${type}/config`);
});

ipcMain.handle(CHANNELS.INTEGRATIONS.UPDATE_CONFIG, async (event, { type, config }) => {
  return await fetchFromBackend(`/api/integrations/${type}/config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
});

ipcMain.handle(CHANNELS.INTEGRATIONS.REGENERATE_WEBHOOK_SECRET, async (event, { type }) => {
  return await fetchFromBackend(`/api/integrations/${type}/webhook-secret/regenerate`, {
    method: "POST"
  });
});

ipcMain.handle(CHANNELS.INTEGRATIONS.GET_PROJECT_MAPPINGS, async () => {
  return await fetchFromBackend("/api/integrations/jira/project-mappings");
});

ipcMain.handle(CHANNELS.INTEGRATIONS.SAVE_PROJECT_MAPPING, async (event, { jiraProjectId, internalProjectId }) => {
  return await fetchFromBackend("/api/integrations/jira/project-mappings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jiraProjectId, internalProjectId })
  });
});

// Organization Handlers
ipcMain.handle(CHANNELS.ORG.GET_SETTINGS, async () => {
  return await fetchFromBackend("/api/org");
});

ipcMain.handle(CHANNELS.ORG.UPDATE, async (event, payload) => {
  return await fetchFromBackend("/api/org/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
});

ipcMain.handle(CHANNELS.ORG.UPLOAD_LOGO, async (event, payload) => {
  return await fetchFromBackend("/api/org/logo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
});

ipcMain.handle(CHANNELS.ORG.TRANSFER_OWNERSHIP, async (event, payload) => {
  return await fetchFromBackend("/api/org/transfer-ownership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
});

ipcMain.handle(CHANNELS.ORG.DELETE, async (event, payload) => {
  return await fetchFromBackend("/api/org", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
});

ipcMain.handle(CHANNELS.ORG.GET_DB_STATUS, async () => {
  return await fetchFromBackend("/api/org/db-status");
});

ipcMain.handle(CHANNELS.ORG.PROVISION_DB, async (event, payload) => {
  return await fetchFromBackend("/api/org/provision-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
});

// Preferences Handlers
ipcMain.handle(CHANNELS.PREFERENCES.GET, async () => {
  const [orgResp, meResp] = await Promise.all([
    fetchFromBackend("/api/org"),
    fetchFromBackend("/api/auth/me")
  ]);

  const orgOk = Boolean(orgResp && orgResp.ok && orgResp.data && orgResp.data.ok);
  const meOk = Boolean(meResp && meResp.ok && meResp.data && meResp.data.ok);

  if (!orgOk && !meOk) {
    return IPCResponse.error("PREFERENCES_LOAD_FAILED", "Failed to load preferences", null);
  }

  const orgData = orgResp && orgResp.data ? orgResp.data.data : null;
  const meData = meResp && meResp.data ? meResp.data.data : null;

  return IPCResponse.success({
    org: orgData && orgData.org ? orgData.org : null,
    user: meData && meData.user ? meData.user : null,
    notifications: {
      sprintAlerts: true,
      digestEmail: true,
      assignmentAlerts: true
    },
    theme: "system",
    language: "en"
  });
});

ipcMain.handle(CHANNELS.PREFERENCES.UPDATE, async (event, payload) => {
  const body = {
    name: payload && payload.name ? payload.name : undefined,
    timezone: payload && payload.timezone ? payload.timezone : undefined,
    notification_settings: payload && payload.notifications ? payload.notifications : undefined,
    language: payload && payload.language ? payload.language : undefined,
    theme: payload && payload.theme ? payload.theme : undefined
  };

  return await fetchFromBackend("/api/org/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
});

ipcMain.handle(CHANNELS.PREFERENCES.GET_AUTO_TASK_RULES, async () => {
  return await fetchFromBackend("/api/integrations/github/auto-task-rules");
});

ipcMain.handle(CHANNELS.PREFERENCES.SAVE_AUTO_TASK_RULES, async (event, payload) => {
  return await fetchFromBackend("/api/integrations/github/auto-task-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload && payload.rules ? payload.rules : {})
  });
});

// Profile Handlers
ipcMain.handle(CHANNELS.PROFILE.GET, async () => {
  const profileResp = await fetchFromBackend("/api/profile");
  if (profileResp && profileResp.ok && profileResp.data && profileResp.data.ok) {
    return profileResp;
  }

  const meResp = await fetchFromBackend("/api/auth/me");
  if (!(meResp && meResp.ok && meResp.data && meResp.data.ok)) {
    return IPCResponse.error("PROFILE_LOAD_FAILED", "Failed to load profile", null);
  }

  const meData = meResp.data && meResp.data.data ? meResp.data.data : null;
  const memberships = Array.isArray(meData && meData.memberships) ? meData.memberships : [];
  const activeOrgId = meData && meData.activeOrgId ? String(meData.activeOrgId) : "";
  const activeMembership = memberships.find((m) => String((m && m.org && m.org.id) || "") === activeOrgId) || memberships[0] || null;

  return IPCResponse.success({
    ok: true,
    status: 200,
    data: {
      displayName: meData && meData.user && meData.user.fullName ? meData.user.fullName : "",
      title: "",
      bio: "",
      phone: "",
      timezone: "",
      email: meData && meData.user && meData.user.email ? meData.user.email : "",
      orgName: activeMembership && activeMembership.org ? (activeMembership.org.name || activeMembership.org.slug || "No organization") : "No organization",
      connectedProviders: []
    }
  });
});

ipcMain.handle(CHANNELS.PROFILE.UPDATE, async (event, payload) => {
  return await fetchFromBackend("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      displayName: payload && payload.displayName ? payload.displayName : undefined,
      title: payload && payload.title ? payload.title : undefined,
      bio: payload && payload.bio ? payload.bio : undefined,
      phone: payload && payload.phone ? payload.phone : undefined
    })
  });
});

ipcMain.handle(CHANNELS.PROFILE.UPLOAD_AVATAR, async (event, payload) => {
  return await fetchFromBackend("/api/profile/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image: payload && payload.base64Image ? payload.base64Image : "" })
  });
});

ipcMain.handle(CHANNELS.PROFILE.CHANGE_EMAIL, async (event, payload) => {
  return await fetchFromBackend("/api/profile/change-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      newEmail: payload && payload.newEmail ? payload.newEmail : "",
      password: payload && payload.password ? payload.password : ""
    })
  });
});

ipcMain.handle(CHANNELS.PROFILE.GET_SESSIONS, async () => {
  const profileSessionsResp = await fetchFromBackend("/api/profile/sessions");
  if (profileSessionsResp && profileSessionsResp.ok && profileSessionsResp.data && profileSessionsResp.data.ok) {
    return profileSessionsResp;
  }
  return await fetchFromBackend("/api/auth/sessions");
});

ipcMain.handle(CHANNELS.PROFILE.REVOKE_SESSION, async (event, payload) => {
  return await fetchFromBackend(`/api/profile/sessions/${encodeURIComponent(String(payload && payload.sessionId ? payload.sessionId : ""))}/revoke`, {
    method: "POST"
  });
});

ipcMain.handle(CHANNELS.PROFILE.TOGGLE_2FA, async (event, payload) => {
  return await fetchFromBackend("/api/profile/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: Boolean(payload && payload.enabled) })
  });
});

// Teams Handlers
ipcMain.handle(CHANNELS.TEAMS.GET_ALL, async () => {
  return await fetchFromBackend("/api/teams");
});

ipcMain.handle(CHANNELS.TEAMS.CREATE, async (event, payload) => {
  return await fetchFromBackend("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload && payload.name ? payload.name : "",
      description: payload && payload.description ? payload.description : undefined,
      leadId: payload && payload.leadId ? payload.leadId : undefined
    })
  });
});

ipcMain.handle(CHANNELS.TEAMS.UPDATE, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload && payload.changes ? payload.changes : {})
  });
});

ipcMain.handle(CHANNELS.TEAMS.DELETE, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}`, {
    method: "DELETE"
  });
});

ipcMain.handle(CHANNELS.TEAMS.ADD_MEMBER, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId: payload && payload.userId ? payload.userId : "",
      role: payload && payload.role ? payload.role : "developer"
    })
  });
});

ipcMain.handle(CHANNELS.TEAMS.REMOVE_MEMBER, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/members/${encodeURIComponent(String(payload && payload.userId ? payload.userId : ""))}`, {
    method: "DELETE"
  });
});

ipcMain.handle(CHANNELS.TEAMS.GET_ME, async () => {
  return await fetchFromBackend("/api/auth/me");
});

ipcMain.handle(CHANNELS.TEAMS.GET_ORG_MEMBERS, async () => {
  return await fetchFromBackend("/api/org/members?page=1&limit=200");
});

ipcMain.handle(CHANNELS.TEAMS.GET_MEMBERS, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/members`);
});

ipcMain.handle(CHANNELS.TEAMS.GET_JOIN_REQUESTS, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/join-requests`);
});

ipcMain.handle(CHANNELS.TEAMS.CREATE_JOIN_REQUEST, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/join-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: payload && payload.note ? payload.note : undefined })
  });
});

ipcMain.handle(CHANNELS.TEAMS.REVIEW_JOIN_REQUEST, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/join-requests/${encodeURIComponent(String(payload && payload.requestId ? payload.requestId : ""))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: payload && payload.status ? payload.status : "rejected" })
  });
});

ipcMain.handle(CHANNELS.TEAMS.GET_SCORES, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/scores`);
});

ipcMain.handle(CHANNELS.TEAMS.UPDATE_SCORE, async (event, payload) => {
  return await fetchFromBackend(`/api/teams/${encodeURIComponent(String(payload && payload.teamId ? payload.teamId : ""))}/scores/${encodeURIComponent(String(payload && payload.memberId ? payload.memberId : ""))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      score: payload && typeof payload.score === "number" ? payload.score : 0,
      metric: payload && payload.metric ? payload.metric : "performance"
    })
  });
});

// Skill Gap Handlers
ipcMain.handle(CHANNELS.SKILL_GAP.GET_MATRIX, async () => {
  return await fetchFromBackend("/api/skill-gap/matrix");
});

ipcMain.handle(CHANNELS.SKILL_GAP.UPDATE_SKILL_LEVEL, async (event, payload) => {
  return await fetchFromBackend("/api/skill-gap/skill-level", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId: payload && payload.memberId ? payload.memberId : "",
      skillId: payload && payload.skillId ? payload.skillId : "",
      level: payload && typeof payload.level === "number" ? payload.level : 0
    })
  });
});

ipcMain.handle(CHANNELS.SKILL_GAP.GET_REQUIRED_SKILLS, async (event, payload) => {
  const sprintId = payload && payload.sprintId ? String(payload.sprintId) : "";
  const query = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : "";
  return await fetchFromBackend(`/api/skill-gap/required-skills${query}`);
});

ipcMain.handle(CHANNELS.SKILL_GAP.ASSIGN_TRAINING, async (event, payload) => {
  return await fetchFromBackend("/api/skill-gap/assign-training", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId: payload && payload.memberId ? payload.memberId : "",
      skillId: payload && payload.skillId ? payload.skillId : "",
      resourceUrl: payload && payload.resourceUrl ? payload.resourceUrl : ""
    })
  });
});

// Sprint Handlers
ipcMain.handle(CHANNELS.SPRINT.GET_BY_ID, async (event, payload) => {
  const sprintId = payload && payload.sprintId ? String(payload.sprintId) : "";
  return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}`);
});

ipcMain.handle(CHANNELS.SPRINT.GET_CURRENT, async () => {
  const currentResp = await fetchFromBackend("/api/sprints/current");
  if (currentResp && currentResp.ok && currentResp.data && currentResp.data.ok) {
    return currentResp;
  }

  const activeResp = await fetchFromBackend("/api/sprints?status=active");
  if (!(activeResp && activeResp.ok && activeResp.data && activeResp.data.ok)) {
    return currentResp;
  }

  const payload = activeResp.data && activeResp.data.data ? activeResp.data.data : null;
  const items = payload && Array.isArray(payload.items) ? payload.items : [];
  return IPCResponse.success({
    ok: true,
    status: 200,
    data: items.length ? items[0] : null
  });
});

ipcMain.handle(CHANNELS.SPRINT.GET_TASKS, async (event, payload) => {
  const sprintId = payload && payload.sprintId ? String(payload.sprintId) : "";
  return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}/tasks`);
});

ipcMain.handle(CHANNELS.SPRINT.UPDATE, async (event, payload) => {
  const sprintId = payload && payload.sprintId ? String(payload.sprintId) : "";
  const changes = payload && payload.changes && typeof payload.changes === "object" ? payload.changes : {};
  return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
});

ipcMain.handle(CHANNELS.SPRINT.UPDATE_STATUS, async (event, payload) => {
  const sprintId = payload && payload.sprintId ? String(payload.sprintId) : "";
  const status = payload && payload.status ? String(payload.status) : "";

  if (status === "active" || status === "started") {
    return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}/start`, { method: "PATCH" });
  }
  if (status === "completed" || status === "complete") {
    return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}/complete`, { method: "PATCH" });
  }
  if (status === "cancelled" || status === "canceled") {
    return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}/cancel`, { method: "PATCH" });
  }

  return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
});

ipcMain.handle(CHANNELS.SPRINT.GET_EVENTS, async (event, payload) => {
  const sprintId = payload && payload.sprintId ? String(payload.sprintId) : "";
  return await fetchFromBackend(`/api/sprints/${encodeURIComponent(sprintId)}/events`);
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
