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
