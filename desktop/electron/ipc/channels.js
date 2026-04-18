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

  // Organization settings and management
  ORG: {
    GET_SETTINGS: "org:getSettings",
    UPDATE: "org:update",
    UPLOAD_LOGO: "org:uploadLogo",
    TRANSFER_OWNERSHIP: "org:transferOwnership",
    DELETE: "org:delete",
    GET_DB_STATUS: "org:getDbStatus",
    PROVISION_DB: "org:provisionDb"
  },

  // User preferences
  PREFERENCES: {
    GET: "preferences:get",
    UPDATE: "preferences:update",
    GET_AUTO_TASK_RULES: "preferences:getAutoTaskRules",
    SAVE_AUTO_TASK_RULES: "preferences:saveAutoTaskRules"
  },

  // User profile and account security
  PROFILE: {
    GET: "profile:get",
    UPDATE: "profile:update",
    UPLOAD_AVATAR: "profile:uploadAvatar",
    CHANGE_EMAIL: "profile:changeEmail",
    GET_SESSIONS: "profile:getSessions",
    REVOKE_SESSION: "profile:revokeSession",
    TOGGLE_2FA: "profile:toggle2FA"
  },

  // Team management
  TEAMS: {
    GET_ALL: "teams:getAll",
    CREATE: "teams:create",
    UPDATE: "teams:update",
    DELETE: "teams:delete",
    ADD_MEMBER: "teams:addMember",
    REMOVE_MEMBER: "teams:removeMember",
    GET_ME: "teams:getMe",
    GET_ORG_MEMBERS: "teams:getOrgMembers",
    GET_MEMBERS: "teams:getMembers",
    GET_JOIN_REQUESTS: "teams:getJoinRequests",
    CREATE_JOIN_REQUEST: "teams:createJoinRequest",
    REVIEW_JOIN_REQUEST: "teams:reviewJoinRequest",
    GET_SCORES: "teams:getScores",
    UPDATE_SCORE: "teams:updateScore"
  },

  // Skill gap analysis
  SKILL_GAP: {
    GET_MATRIX: "skillGap:getMatrix",
    UPDATE_SKILL_LEVEL: "skillGap:updateSkillLevel",
    GET_REQUIRED_SKILLS: "skillGap:getRequiredSkills",
    ASSIGN_TRAINING: "skillGap:assignTraining"
  },

  // Sprint overview
  SPRINT: {
    GET_BY_ID: "sprint:getById",
    GET_CURRENT: "sprint:getCurrent",
    GET_TASKS: "sprint:getTasks",
    UPDATE: "sprint:update",
    UPDATE_STATUS: "sprint:updateStatus",
    GET_EVENTS: "sprint:getEvents"
  },

  // Sprints listing and creation
  SPRINTS: {
    GET_ALL: "sprints:getAll",
    CREATE: "sprints:create",
    GET_BY_ID: "sprints:getById",
    GET_TASKS: "sprints:getTasks",
    UPDATE: "sprints:update",
    DELETE: "sprints:delete",
    GET_SUMMARY: "sprints:getSummary",
    GET_CONTRIBUTIONS: "sprints:getContributions"
  },

  // Sprint planning
  SPRINT_PLAN: {
    GET_BACKLOG: "sprintPlan:getBacklog",
    GET_TEAM_CAPACITY: "sprintPlan:getTeamCapacity",
    SAVE_PLAN: "sprintPlan:savePlan",
    AI_SUGGEST: "sprintPlan:aiSuggest",
    GET_PROJECTS: "sprintPlan:getProjects",
    CREATE_PROJECT: "sprintPlan:createProject",
    GET_PLANNING_SPRINTS: "sprintPlan:getPlanningSprints",
    CREATE_SPRINT: "sprintPlan:createSprint",
    ARCHIVE_SPRINT: "sprintPlan:archiveSprint",
    DELETE_SPRINT: "sprintPlan:deleteSprint"
  },

  // Daily standup
  STANDUP: {
    GET_TODAY: "standup:getToday",
    SUBMIT: "standup:submit",
    GET_HISTORY: "standup:getHistory",
    GENERATE_SUMMARY: "standup:generateSummary"
  },

  // Tasks
  TASKS: {
    GET_ALL: "tasks:getAll",
    CREATE: "tasks:create",
    BULK_UPDATE: "tasks:bulkUpdate",
    BULK_DELETE: "tasks:bulkDelete",
    GET_BY_ID: "tasks:getById",
    ADD_SUBTASK: "tasks:addSubtask"
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
