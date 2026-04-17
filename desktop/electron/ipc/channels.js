/**
 * IPC Channel Constants
 * Centralized namespace for all IPC communication between renderer and main process
 */

const CHANNELS = {
  // App metadata and health
  APP: {
    GET_VERSION: "app:getVersion",
    GET_BUILD_INFO: "app:getBuildInfo",
    GET_PLATFORM: "app:getPlatform",
    HEALTH_CHECK: "app:healthCheck"
  },

  // Authentication and session
  AUTH: {
    SAVE_SESSION: "auth:saveSession",
    GET_SESSION: "auth:getSession",
    CLEAR_SESSION: "auth:clearSession",
    CHECK_SESSION: "auth:checkSession",
    VALIDATE_TOKEN: "auth:validateToken"
  },

  // Local app data and settings
  STORAGE: {
    GET: "storage:get",
    SET: "storage:set",
    DELETE: "storage:delete",
    CLEAR: "storage:clear",
    GET_ALL: "storage:getAll"
  },

  // Desktop notifications
  NOTIFICATIONS: {
    SHOW: "notifications:show",
    HIDE: "notifications:hide",
    REQUEST_PERMISSION: "notifications:requestPermission",
    PLAY_SOUND: "notifications:playSound"
  },

  // System level capabilities
  SYSTEM: {
    OPEN_EXTERNAL: "system:openExternal",
    OPEN_PATH: "system:openPath",
    GET_PATH: "system:getPath",
    CLIPBOARD_READ: "system:clipboardRead",
    CLIPBOARD_WRITE: "system:clipboardWrite"
  },

  // Auto-update controls
  UPDATES: {
    CHECK: "updates:check",
    DOWNLOAD: "updates:download",
    INSTALL: "updates:install",
    SKIP_UPDATE: "updates:skipUpdate",
    RESTART: "updates:restart"
  },

  // Offline queue and sync
  SYNC: {
    GET_STATUS: "sync:getStatus",
    GET_QUEUE: "sync:getQueue",
    CLEAR_QUEUE: "sync:clearQueue",
    RETRY_QUEUE: "sync:retryQueue",
    PAUSE_SYNC: "sync:pauseSync",
    RESUME_SYNC: "sync:resumeSync"
  },

  // Integration management (Jira, GitHub, Slack)
  INTEGRATIONS: {
    // Jira
    GET_JIRA_STATUS: "integrations:getJiraStatus",
    GET_JIRA_PROJECTS: "integrations:getJiraProjects",
    GET_JIRA_SYNC_STATUS: "integrations:getJiraSyncStatus",
    GET_JIRA_WEBHOOK_LOGS: "integrations:getJiraWebhookLogs",
    CONNECT_JIRA: "integrations:connectJira",
    RETRY_JIRA_WEBHOOK: "integrations:retryJiraWebhook",
    TEST_JIRA_WEBHOOK: "integrations:testJiraWebhook",
    SYNC_JIRA_NOW: "integrations:syncJiraNow",
    UPDATE_JIRA_SYNC_SCHEDULE: "integrations:updateJiraSyncSchedule",

    // GitHub
    GET_GITHUB_STATUS: "integrations:getGithubStatus",
    GET_GITHUB_WEBHOOK_STATUS: "integrations:getGithubWebhookStatus",
    GET_GITHUB_WEBHOOK_DELIVERIES: "integrations:getGithubWebhookDeliveries",
    REDELIVER_GITHUB_WEBHOOK: "integrations:redeliverGithubWebhook",

    // Generic config
    GET_CONFIG: "integrations:getConfig",
    UPDATE_CONFIG: "integrations:updateConfig",
    REGENERATE_WEBHOOK_SECRET: "integrations:regenerateWebhookSecret",
    GET_PROJECT_MAPPINGS: "integrations:getJiraProjectMappings",
    SAVE_PROJECT_MAPPING: "integrations:saveJiraMapping"
  },

  // Events (one-way from main to renderer)
  EVENTS: {
    UPDATE_STATUS: "updates:status",
    SYNC_PROGRESS: "sync:progress",
    SYNC_CONFLICT: "sync:conflict",
    CONNECTIVITY: "system:connectivity",
    SESSION_EXPIRED: "auth:sessionExpired",
    LOG_EVENT: "app:logEvent"
  }
};

module.exports = CHANNELS;
