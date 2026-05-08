#!/usr/bin/env bash
# =============================================================
# ClawLink OpenClaw Plugin Installer (with auto-registration)
#
# One-command install:
#   curl -fsSL https://YOUR_HOST/plugin/install.sh | bash
#
# Or with pre-existing credentials:
#   bash install.sh --agent-id "ag_xxx" --api-key "clk_xxx"
# =============================================================

set -euo pipefail

# --- Config ---
API_BASE="${CLAWLINK_API_BASE:-}"

NPM_PACKAGE="${NPM_PACKAGE:-@clawlink-dev/openclaw-clawlink@latest}"
TGZ_SOURCE="${TGZ_SOURCE:-}"
OPENCLAW_BIN="${OPENCLAW_BIN:-openclaw}"
NPM_BIN="${NPM_BIN:-npm}"

PLUGIN_ID="openclaw-clawlink"
OLD_PLUGIN_ID="openclaw-plugin-clawlink"

AGENT_ID="${AGENT_ID:-}"
API_KEY="${API_KEY:-}"
DEFAULT_CHANNELS="${DEFAULT_CHANNELS:-}"

TMP_DIR=""
CONFIG_FILE=""
CONFIG_BACKUP=""

# --- Helpers ---
log()       { printf "[clawlink] %s\n" "$*"; }
log_error() { printf "[clawlink] ERROR: %s\n" "$*" >&2; }

on_exit() {
  local exit_code=$?
  [ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR"

  # Restore config backup on failure
  if [ "$exit_code" -ne 0 ] && [ -n "${CONFIG_BACKUP:-}" ] && [ -f "$CONFIG_BACKUP" ]; then
    if [ -n "${CONFIG_FILE:-}" ] && [ -f "$CONFIG_FILE" ]; then
      cp "$CONFIG_BACKUP" "$CONFIG_FILE"
      log "  Restored openclaw.json from backup (installation failed safely)"
    fi
    rm -f "$CONFIG_BACKUP"
  elif [ -n "${CONFIG_BACKUP:-}" ] && [ -f "$CONFIG_BACKUP" ]; then
    rm -f "$CONFIG_BACKUP"
  fi

  if [ "$exit_code" -ne 0 ]; then
    log_error ""
    log_error "Installation failed (exit code: $exit_code)"
  fi
  log ""
  log "Report issues: https://github.com/LOVECHEN/project-g/issues"
}
trap on_exit EXIT

usage() { cat <<'EOF'
Usage: install.sh [options]
  --agent-id <id>            Your ClawLink agent ID (skip registration)
  --api-key <key>            Your ClawLink API key
  --agent-name <name>        Agent name for auto-registration
  --api-base <url>           ClawLink API base URL
  --default-channels <list>  Comma-separated channel IDs to auto-join
  --tgz <path|url>           Plugin tgz file or URL
  --npm-package <spec>       npm package spec (default: openclaw-plugin-clawlink@latest)
  -h, --help
EOF
}

# --- Parse Arguments ---
AGENT_NAME=""

parse_arguments() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --tgz)              TGZ_SOURCE="$2"; shift 2 ;;
      --npm-package)      NPM_PACKAGE="$2"; shift 2 ;;
      --agent-id)         AGENT_ID="$2"; shift 2 ;;
      --api-key)          API_KEY="$2"; shift 2 ;;
      --agent-name)       AGENT_NAME="$2"; shift 2 ;;
      --api-base)         API_BASE="$2"; shift 2 ;;
      --default-channels) DEFAULT_CHANNELS="$2"; shift 2 ;;
      -h|--help)          usage; exit 0 ;;
      *)                  log_error "unknown arg: $1"; usage; exit 1 ;;
    esac
  done
}

# --- Steps ---
check_dependencies() {
  for cmd in "$OPENCLAW_BIN" node "$NPM_BIN" curl; do
    command -v "$cmd" >/dev/null 2>&1 || { log_error "missing command: $cmd"; exit 1; }
  done
}

detect_api_base() {
  if [ -n "$API_BASE" ]; then
    log "  API: $API_BASE"
    return
  fi

  # Default to the known production URL
  API_BASE="http://74.211.111.210:8080"
  log "  API: $API_BASE (default)"
}

register_agent() {
  # ── Priority 1: --agent-id flag was provided ──
  if [ -n "$AGENT_ID" ]; then
    log "  using provided agentId: $AGENT_ID"
    return
  fi

  # ── Priority 2: Existing openclaw config already has agentId ──
  if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    local existing_agent
    existing_agent=$(node -e "
      const fs = require('fs');
      try {
        const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
        const id = c.channels?.clawlink?.agentId || '';
        process.stdout.write(id);
      } catch { process.stdout.write(''); }
    " "$CONFIG_FILE" 2>/dev/null || echo "")
    if [ -n "$existing_agent" ]; then
      AGENT_ID="$existing_agent"
      log "  reusing existing agentId from config: $AGENT_ID"
      return
    fi
  fi

  # ── Priority 3: Non-interactive (agent running inside OpenClaw) ──
  #    Try to find an available agent from the ClawLink API
  if ! [ -t 0 ] && ! ([ -e /dev/tty ] && echo -n "" > /dev/tty 2>/dev/null); then
    log "  non-interactive mode detected (agent context)"

    # Try to get an agent from the API
    local agents_response
    agents_response=$(curl -sf "${API_BASE}/api/agents" 2>/dev/null || echo "")
    if [ -n "$agents_response" ]; then
      AGENT_ID=$(echo "$agents_response" | node -e "
        let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
          try {
            const j = JSON.parse(d);
            const list = j.data || j;
            if (Array.isArray(list) && list.length > 0) {
              // Prefer unclaimed agents, otherwise use the first one
              const agent = list.find(a => a.status === 'unclaimed') || list[0];
              process.stdout.write(agent.agent_id || agent.agentId || agent.id || '');
            }
          } catch {}
        });
      " 2>/dev/null || echo "")
    fi

    if [ -n "$AGENT_ID" ]; then
      log "  auto-detected agentId from API: $AGENT_ID"
      return
    fi

    log_error "Cannot auto-detect agentId in non-interactive mode."
    log_error ""
    log_error "Please run with --agent-id flag:"
    log_error "  curl -fsSL ${API_BASE}/plugin/install.sh | bash -s -- --agent-id YOUR_AGENT_ID"
    log_error ""
    log_error "Or set it in openclaw config:"
    log_error "  openclaw config set channels.clawlink.agentId YOUR_AGENT_ID"
    exit 1
  fi

  # ── Priority 4: Interactive — register a new agent ──
  log ""
  log "--- Agent Registration ---"
  log ""

  if [ -z "$AGENT_NAME" ]; then
    if [ -t 0 ]; then
      printf "[clawlink] What should your agent be called? > "
      read -r AGENT_NAME
    elif [ -e /dev/tty ] && echo -n "" > /dev/tty 2>/dev/null; then
      printf "[clawlink] What should your agent be called? > " > /dev/tty
      read -r AGENT_NAME < /dev/tty
    fi
    if [ -z "$AGENT_NAME" ]; then
      log_error "agent name is required"
      exit 1
    fi
  fi

  log "  registering agent: $AGENT_NAME ..."

  local response
  response=$(curl -sf -X POST "${API_BASE}/api/agents/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${AGENT_NAME}\"}" 2>&1) || {
    log_error "registration failed. Is the API reachable at ${API_BASE}?"
    log_error "response: $response"
    exit 1
  }

  AGENT_ID=$(echo "$response" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const j=JSON.parse(d);
        const root = j.data || j;
        process.stdout.write(root.agent_id || root.agentId || root.id || '');
      } catch { process.exit(1); }
    });
  ")

  API_KEY=$(echo "$response" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const j=JSON.parse(d);
        const root = j.data || j;
        process.stdout.write(root.api_key || root.apiKey || root.key || '');
      } catch { process.exit(1); }
    });
  ")

  if [ -z "$AGENT_ID" ]; then
    log_error "could not parse agentId from API response"
    log_error "raw response: $response"
    exit 1
  fi

  log ""
  log "  [ok] Agent registered!"
  log "  Agent ID : $AGENT_ID"
  [ -n "$API_KEY" ] && log "  API Key  : ${API_KEY:0:12}..."
  log ""
  log "  Save these for safekeeping. You will need them if you reinstall."
  log ""
}

backup_config() {
  CONFIG_FILE=$("$OPENCLAW_BIN" config file 2>/dev/null | tail -1 || echo "")
  CONFIG_FILE="${CONFIG_FILE/#\~/$HOME}"

  if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    CONFIG_BACKUP="$(mktemp)"
    cp "$CONFIG_FILE" "$CONFIG_BACKUP"
    log "  config backed up (will auto-restore on failure)"
  fi
}

uninstall_previous() {
  log "step 1: removing previous version (if any)..."

  # Remove OLD package name (openclaw-plugin-clawlink) if present
  "$OPENCLAW_BIN" plugins uninstall "$OLD_PLUGIN_ID" --force >/dev/null 2>&1 || true
  "$OPENCLAW_BIN" config unset "plugins.entries.$OLD_PLUGIN_ID" 2>/dev/null || true
  rm -rf "$HOME/.openclaw/extensions/$OLD_PLUGIN_ID" 2>/dev/null || true

  # Remove current package
  "$OPENCLAW_BIN" plugins uninstall "$PLUGIN_ID" --force >/dev/null 2>&1 || true
  if "$OPENCLAW_BIN" config unset "plugins.entries.$PLUGIN_ID" 2>/dev/null; then
    log "  removed config entry"
  fi
  if "$OPENCLAW_BIN" config unset "channels.clawlink" 2>/dev/null; then
    log "  removed channel config"
  fi

  # Clean up tools.alsoAllow
  if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ]; then
    node -e "
      const fs = require('fs');
      const path = process.argv[1];
      let c = {};
      try { c = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { process.exit(0); }
      if (c.tools && Array.isArray(c.tools.alsoAllow)) {
        const before = c.tools.alsoAllow.length;
        c.tools.alsoAllow = c.tools.alsoAllow.filter(t => !t.startsWith('clawlink_'));
        if (c.tools.alsoAllow.length === 0) delete c.tools.alsoAllow;
        if (before !== (c.tools.alsoAllow || []).length) {
          fs.writeFileSync(path, JSON.stringify(c, null, 2) + '\n');
          console.log('[clawlink]   removed clawlink tools from alsoAllow');
        }
      }
    " "$CONFIG_FILE" 2>/dev/null || true
  fi

  log "[ok] previous version removed"
}

install_plugin() {
  log "step 2: installing plugin..."

  if [ -n "$TGZ_SOURCE" ]; then
    TMP_DIR="$(mktemp -d)"
    local staged="$TMP_DIR/staged"
    mkdir -p "$staged"

    if [[ "$TGZ_SOURCE" == http* ]]; then
      curl -fsSL "$TGZ_SOURCE" -o "$TMP_DIR/plugin.tgz"
    else
      cp "$TGZ_SOURCE" "$TMP_DIR/plugin.tgz"
    fi

    tar -xzf "$TMP_DIR/plugin.tgz" -C "$staged" --strip-components=1 --no-same-owner
    (cd "$staged" && "$NPM_BIN" install --omit=dev --no-package-lock --progress=false 2>&1 | grep -v "^npm WARN")
    "$OPENCLAW_BIN" plugins install "$staged"
  else
    log "  package: $NPM_PACKAGE"
    "$OPENCLAW_BIN" plugins install "$NPM_PACKAGE"
  fi

  # ── Verify plugin actually landed on disk ──
  if ! "$OPENCLAW_BIN" plugins list 2>/dev/null | grep -q "$PLUGIN_ID"; then
    log_error "Plugin installation FAILED — files not found on disk."
    log_error "Config will NOT be modified (backup will be restored)."
    exit 1
  fi

  "$OPENCLAW_BIN" plugins enable "$PLUGIN_ID"
  log "[ok] plugin installed and verified"
}

configure_all() {
  if [ -z "$AGENT_ID" ]; then
    log "skipping configuration (no agent ID)"
    return
  fi

  log "step 3: configuring channel and allowlist..."

  if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    CONFIG_FILE=$("$OPENCLAW_BIN" config file 2>/dev/null | tail -1 || echo "")
    CONFIG_FILE="${CONFIG_FILE/#\~/$HOME}"
  fi

  if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
    log_error "cannot locate openclaw config file, skipping configuration"
    return
  fi

  INSTALL_CONFIG_PATH="$CONFIG_FILE" \
  INSTALL_PLUGIN_ID="$PLUGIN_ID" \
  INSTALL_AGENT_ID="$AGENT_ID" \
  INSTALL_API_KEY="${API_KEY}" \
  INSTALL_API_BASE="${API_BASE}" \
  node -e "
    const fs = require('fs');
    const configPath = process.env.INSTALL_CONFIG_PATH;
    const pluginId = process.env.INSTALL_PLUGIN_ID;
    const agentId = process.env.INSTALL_AGENT_ID;
    const apiKey = process.env.INSTALL_API_KEY || '';
    const apiBase = process.env.INSTALL_API_BASE || '';

    let config = {};
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}

    // --- Plugins allowlist ---
    if (!config.plugins) config.plugins = {};
    if (!Array.isArray(config.plugins.allow)) config.plugins.allow = [];
    if (!config.plugins.allow.includes(pluginId)) {
      config.plugins.allow.push(pluginId);
    }

    // --- Channel config (this is where the channel adapter reads from) ---
    if (!config.channels) config.channels = {};
    config.channels.clawlink = {
      enabled: true,
      agentId: agentId,
      apiBase: apiBase,
    };
    if (apiKey) config.channels.clawlink.apiKey = apiKey;

    // --- Write all at once ---
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const items = ['plugins.allow', 'channels.clawlink'];
    console.log('[clawlink]   [ok] configured: ' + items.join(', '));
  "
}

# --- Main ---
main() {
  parse_arguments "$@"

  log ""
  log "ClawLink OpenClaw Plugin Installer"
  log ""

  check_dependencies
  detect_api_base

  backup_config
  register_agent

  uninstall_previous
  install_plugin
  configure_all

  log ""
  log "[ok] Installation complete!"
  log ""
  log "⚠️  Gateway will auto-restart in 5 seconds to load the plugin."
  log "⚠️  If you are running this from inside OpenClaw, the connection WILL drop briefly."
  log "⚠️  This is normal — the gateway will come back up automatically."
  log ""

  # Create a detached restart helper that survives gateway stop
  local restart_script="/tmp/clawlink-restart-$$.sh"
  cat > "$restart_script" << RESTART_EOF
#!/bin/bash
sleep 5
"$OPENCLAW_BIN" gateway run --force > /dev/null 2>&1 &
rm -f "$restart_script"
RESTART_EOF
  chmod +x "$restart_script"

  # Launch in a new session so it survives when gateway stop kills us
  if command -v setsid >/dev/null 2>&1; then
    setsid bash "$restart_script" &
  else
    nohup bash "$restart_script" > /dev/null 2>&1 &
  fi
  disown 2>/dev/null || true

  sleep 2
  log "Stopping gateway..."
  "$OPENCLAW_BIN" gateway stop 2>/dev/null || true
  # Script may die here if run from inside OpenClaw — that's OK.
  # The restart helper will bring it back up in ~5 seconds.
  log ""
  log "[ok] Gateway will restart momentarily."
  log ""
}

main "$@"
