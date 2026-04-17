#!/usr/bin/env sh
set -eu

REPO_URL="${PROMPT_STUDIO_REPO:-https://github.com/zhangbeibei19920522-boop/prompt-studio.git}"
BRANCH="${PROMPT_STUDIO_BRANCH:-master}"
INSTALL_DIR="${PROMPT_STUDIO_DIR:-$HOME/prompt-studio}"
MODE="${1:-install}"
if [ "$MODE" = "--update" ]; then
  MODE="update"
fi

log() {
  printf "\n%s\n" "$1"
}

fail() {
  printf "\nPrompt Studio %s 失败：%s\n" "$MODE" "$1" >&2
  exit 1
}

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少 $1。请先安装 Node.js >= 18、Git 和 npm 后重试。"
  fi
}

check_node_version() {
  if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)" >/dev/null 2>&1; then
    fail "Node.js 版本需要 >= 18。当前版本：$(node -v 2>/dev/null || printf '未知')"
  fi
}

run() {
  log "> $*"
  "$@"
}

install_or_update_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "检测到已安装，开始更新代码。"
    cd "$INSTALL_DIR"
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      fail "检测到本地代码有修改。为避免覆盖内容，请先处理 git status 里的改动。data/ 数据不会被更新命令删除。"
    fi
    run git pull --ff-only origin "$BRANCH"
    return
  fi

  if [ -e "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null || true)" ]; then
    fail "$INSTALL_DIR 已存在但不是 Git 安装目录。请设置 PROMPT_STUDIO_DIR 到一个空目录后重试。"
  fi

  log "开始安装 Prompt Studio 到 $INSTALL_DIR"
  run git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
}

need_command git
need_command node
need_command npm
check_node_version

install_or_update_repo
run npm install
run node bin/cli.js build

log "Prompt Studio 已就绪。"
log "启动命令：cd \"$INSTALL_DIR\" && node bin/cli.js"
log "更新命令：cd \"$INSTALL_DIR\" && node bin/cli.js update"
