#!/usr/bin/env bash
# Fortune City — Панель управления
# Запуск: ./panel.sh или make panel
set -euo pipefail

# ─── Цвета ───
R='\033[0;31m'   G='\033[0;32m'   Y='\033[0;33m'
B='\033[0;34m'   M='\033[0;35m'   C='\033[0;36m'
W='\033[1;37m'   D='\033[0;90m'   N='\033[0m'
BOLD='\033[1m'

SERVER="kp"
REMOTE_DIR="/fortune"
COMPOSE="docker compose -f docker-compose.prod.yml"

# ─── Утилиты ───
banner() {
  clear
  echo -e "${M}"
  echo '  ╔══════════════════════════════════════════╗'
  echo '  ║     🎰  FORTUNE CITY  —  ПАНЕЛЬ          ║'
  echo '  ║     fortune.syntratrade.com              ║'
  echo '  ╚══════════════════════════════════════════╝'
  echo -e "${N}"
}

header() { echo -e "\n${BOLD}${C}── $1 ──${N}\n"; }
ok()     { echo -e "${G}✓ $1${N}"; }
err()    { echo -e "${R}✗ $1${N}"; }
info()   { echo -e "${D}  $1${N}"; }
warn()   { echo -e "${Y}⚠ $1${N}"; }

press_enter() {
  echo ""
  echo -e "${D}Enter — назад в меню${N}"
  read -r
}

ssh_cmd() { ssh "$SERVER" "$@"; }
remote()  { ssh_cmd "cd $REMOTE_DIR && $*"; }

# ─── Команды ───

cmd_status() {
  header "Статус контейнеров"
  remote "$COMPOSE ps --format 'table {{.Name}}\t{{.Status}}\t{{.Ports}}'"
  press_enter
}

cmd_health() {
  header "Проверка здоровья"

  echo -e "${W}Контейнеры:${N}"
  remote "$COMPOSE ps --format 'table {{.Name}}\t{{.Status}}'" || true
  echo ""

  echo -ne "${W}API:  ${N}"
  if ssh_cmd "curl -sf http://localhost:3005/ -m 3" 2>/dev/null; then
    echo -e "  ${G}OK${N}"
  else
    echo -e "  ${R}НЕДОСТУПЕН${N}"
  fi

  echo -ne "${W}Web:  ${N}"
  local code
  code=$(ssh_cmd "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3006 -m 3" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    echo -e "HTTP $code  ${G}OK${N}"
  else
    echo -e "HTTP $code  ${R}НЕДОСТУПЕН${N}"
  fi

  echo -ne "${W}HTTPS:${N}"
  code=$(ssh_cmd "curl -sf -o /dev/null -w '%{http_code}' https://fortune.syntratrade.com -m 5" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    echo -e " HTTP $code  ${G}OK${N}"
  else
    echo -e " HTTP $code  ${R}ПРОБЛЕМА${N}"
  fi

  echo ""
  echo -e "${W}Диск:${N}"
  ssh_cmd "df -h / | tail -1" || true

  echo ""
  echo -e "${W}Docker:${N}"
  ssh_cmd "docker system df --format 'table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}'" || true

  press_enter
}

cmd_logs() {
  header "Логи"
  echo -e "  ${W}1${N}) Все логи"
  echo -e "  ${W}2${N}) API"
  echo -e "  ${W}3${N}) Web"
  echo -e "  ${W}4${N}) PostgreSQL"
  echo -e "  ${W}5${N}) Redis"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  local svc=""
  case "$choice" in
    1) svc="" ;;
    2) svc="api" ;;
    3) svc="web" ;;
    4) svc="postgres" ;;
    5) svc="redis" ;;
    *) return ;;
  esac
  echo -e "${D}Ctrl+C — выход из логов${N}"
  sleep 1
  ssh -t "$SERVER" "cd $REMOTE_DIR && $COMPOSE logs -f --tail=80 $svc"
}

cmd_deploy() {
  header "Деплой"
  echo -e "  ${W}1${N}) ${G}Полный деплой${N}    sync → build → restart → db push"
  echo -e "  ${W}2${N}) Только API       sync → build api"
  echo -e "  ${W}3${N}) Только Web       sync → build web"
  echo -e "  ${W}4${N}) Quick restart    sync → restart (без пересборки)"
  echo -e "  ${W}5${N}) Только sync      загрузить код без рестарта"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  case "$choice" in
    1) _deploy_full ;;
    2) _deploy_svc api ;;
    3) _deploy_svc web ;;
    4) _deploy_quick ;;
    5) _sync ;;
    *) return ;;
  esac
  press_enter
}

_sync() {
  echo -e "${Y}⚡ Синхронизация...${N}"
  rsync -avz --delete \
    --exclude='node_modules' --exclude='.next' --exclude='dist' \
    --exclude='.turbo' --exclude='.git' --exclude='.env' \
    --exclude='coverage' --exclude='.DS_Store' --exclude='backups' \
    . "$SERVER:$REMOTE_DIR/" | tail -3
  ok "Код синхронизирован"
}

_deploy_full() {
  _sync
  echo -e "${Y}🔨 Сборка контейнеров...${N}"
  remote "$COMPOSE up -d --build"
  echo -e "${Y}🔄 Применение схемы БД...${N}"
  remote "$COMPOSE exec -T api npx prisma db push --skip-generate" 2>/dev/null || \
    remote "$COMPOSE run --rm api npx prisma db push --skip-generate"
  echo -e "${Y}🌱 Запуск сидеров...${N}"
  remote "$COMPOSE exec -T api npx prisma db seed" 2>/dev/null || true
  ok "Полный деплой завершён"
  echo ""
  remote "$COMPOSE ps --format 'table {{.Name}}\t{{.Status}}'"
}

_deploy_svc() {
  local svc="$1"
  _sync
  echo -e "${Y}🔨 Пересборка $svc...${N}"
  remote "$COMPOSE up -d --build --no-deps $svc"
  ok "$svc пересобран"
}

_deploy_quick() {
  _sync
  echo -e "${Y}🔄 Перезапуск...${N}"
  remote "$COMPOSE restart api web"
  ok "Перезапуск завершён"
}

cmd_database() {
  header "База данных"
  echo -e "  ${W}1${N}) psql shell       подключиться к PostgreSQL"
  echo -e "  ${W}2${N}) db push          применить Prisma схему"
  echo -e "  ${W}3${N}) Prisma Studio    GUI (localhost:5555)"
  echo -e "  ${W}4${N}) Бэкап            скачать дамп базы"
  echo -e "  ${W}5${N}) Восстановить     загрузить дамп"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  case "$choice" in
    1)
      echo -e "${D}Ctrl+D — выход${N}"
      ssh -t "$SERVER" "cd $REMOTE_DIR && $COMPOSE exec postgres psql -U fortune fortune_city"
      ;;
    2)
      remote "$COMPOSE run --rm api npx prisma db push"
      ok "Схема применена"
      press_enter
      ;;
    3)
      echo -e "${C}Prisma Studio → http://localhost:5555${N}"
      echo -e "${D}Ctrl+C — выход${N}"
      sleep 1
      ssh -L 5555:127.0.0.1:5555 "$SERVER" "cd $REMOTE_DIR && $COMPOSE run --rm -p 5555:5555 api npx prisma studio --port 5555"
      ;;
    4)
      mkdir -p backups
      local file="backups/fortune_$(date +%Y%m%d_%H%M%S).sql"
      echo -e "${Y}📦 Создание бэкапа...${N}"
      remote "$COMPOSE exec -T postgres pg_dump -U fortune fortune_city" > "$file"
      ok "Бэкап: $file ($(du -h "$file" | cut -f1))"
      press_enter
      ;;
    5)
      echo -e "${W}Доступные бэкапы:${N}"
      ls -1t backups/*.sql 2>/dev/null || { err "Нет бэкапов в backups/"; press_enter; return; }
      echo ""
      read -rp "Файл: " file
      [[ -f "$file" ]] || { err "Файл не найден"; press_enter; return; }
      warn "Восстановление из $file"
      read -rp "Уверены? (y/N) " yn
      [[ "$yn" == "y" ]] || return
      cat "$file" | ssh "$SERVER" "cd $REMOTE_DIR && $COMPOSE exec -T postgres psql -U fortune fortune_city"
      ok "Восстановлено"
      press_enter
      ;;
    *) return ;;
  esac
}

cmd_redis() {
  header "Redis"
  echo -e "  ${W}1${N}) Redis CLI"
  echo -e "  ${W}2${N}) Очистить Redis (FLUSHALL)"
  echo -e "  ${W}3${N}) Статистика (INFO)"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  case "$choice" in
    1)
      echo -e "${D}Ctrl+D — выход${N}"
      ssh -t "$SERVER" "cd $REMOTE_DIR && $COMPOSE exec redis redis-cli"
      ;;
    2)
      warn "Это удалит ВСЕ данные из Redis"
      read -rp "Уверены? (y/N) " yn
      [[ "$yn" == "y" ]] || return
      remote "$COMPOSE exec -T redis redis-cli FLUSHALL"
      ok "Redis очищен"
      press_enter
      ;;
    3)
      remote "$COMPOSE exec -T redis redis-cli INFO stats" | head -20
      press_enter
      ;;
    *) return ;;
  esac
}

cmd_containers() {
  header "Управление контейнерами"
  echo -e "  ${W}1${N}) Перезапустить всё"
  echo -e "  ${W}2${N}) Перезапустить API"
  echo -e "  ${W}3${N}) Перезапустить Web"
  echo -e "  ${W}4${N}) Остановить всё"
  echo -e "  ${W}5${N}) Запустить всё"
  echo -e "  ${W}6${N}) Shell в API контейнер"
  echo -e "  ${W}7${N}) Shell в Web контейнер"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  case "$choice" in
    1) remote "$COMPOSE restart"; ok "Перезапущено" ;;
    2) remote "$COMPOSE restart api"; ok "API перезапущен" ;;
    3) remote "$COMPOSE restart web"; ok "Web перезапущен" ;;
    4)
      warn "Остановить все контейнеры?"
      read -rp "(y/N) " yn
      [[ "$yn" == "y" ]] || return
      remote "$COMPOSE down"; ok "Остановлено"
      ;;
    5) remote "$COMPOSE up -d"; ok "Запущено" ;;
    6)
      echo -e "${D}exit — выход${N}"
      ssh -t "$SERVER" "cd $REMOTE_DIR && $COMPOSE exec api sh"
      return
      ;;
    7)
      echo -e "${D}exit — выход${N}"
      ssh -t "$SERVER" "cd $REMOTE_DIR && $COMPOSE exec web sh"
      return
      ;;
    *) return ;;
  esac
  press_enter
}

cmd_ssh() {
  echo -e "${D}exit — вернуться в панель${N}"
  ssh -t "$SERVER" "cd $REMOTE_DIR && exec \$SHELL -l"
}

cmd_nginx() {
  header "Nginx"
  echo -e "  ${W}1${N}) Показать конфиг"
  echo -e "  ${W}2${N}) Перезагрузить nginx"
  echo -e "  ${W}3${N}) Обновить конфиг с локального"
  echo -e "  ${W}4${N}) Статус SSL сертификата"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  case "$choice" in
    1) ssh_cmd "cat /etc/nginx/sites-enabled/fortune.syntratrade.com"; press_enter ;;
    2) ssh_cmd "nginx -t && systemctl reload nginx"; ok "Nginx перезагружен"; press_enter ;;
    3)
      scp nginx/fortune.conf "$SERVER:/etc/nginx/sites-available/fortune.syntratrade.com"
      ssh_cmd "nginx -t && systemctl reload nginx"
      ok "Конфиг обновлён и nginx перезагружен"
      press_enter
      ;;
    4) ssh_cmd "certbot certificates 2>/dev/null | grep -A3 fortune"; press_enter ;;
    *) return ;;
  esac
}

cmd_cleanup() {
  header "Очистка"
  echo -e "${W}Docker ресурсы на сервере:${N}"
  ssh_cmd "docker system df" || true
  echo ""
  echo -e "  ${W}1${N}) Удалить неиспользуемые образы"
  echo -e "  ${W}2${N}) Полная очистка (images + volumes unused)"
  echo -e "  ${W}0${N}) Назад"
  echo ""
  read -rp "▸ " choice
  case "$choice" in
    1) ssh_cmd "docker image prune -f"; ok "Образы очищены" ;;
    2)
      warn "Удалить все неиспользуемые ресурсы?"
      read -rp "(y/N) " yn
      [[ "$yn" == "y" ]] || return
      ssh_cmd "docker system prune -f"
      ok "Очищено"
      ;;
    *) return ;;
  esac
  press_enter
}

# ─── Главное меню ───

main_menu() {
  while true; do
    banner
    echo -e "  ${G}ДЕПЛОЙ${N}"
    echo -e "    ${W}1${N})  Деплой            sync / build / restart"
    echo -e "    ${W}2${N})  Логи              tail -f логи сервисов"
    echo ""
    echo -e "  ${C}МОНИТОРИНГ${N}"
    echo -e "    ${W}3${N})  Статус            контейнеры и порты"
    echo -e "    ${W}4${N})  Здоровье          API / Web / HTTPS / диск"
    echo ""
    echo -e "  ${Y}ДАННЫЕ${N}"
    echo -e "    ${W}5${N})  База данных       psql / push / studio / backup"
    echo -e "    ${W}6${N})  Redis             cli / flush / info"
    echo ""
    echo -e "  ${M}СЕРВЕР${N}"
    echo -e "    ${W}7${N})  Контейнеры        restart / stop / shell"
    echo -e "    ${W}8${N})  Nginx             конфиг / reload / SSL"
    echo -e "    ${W}9${N})  SSH               зайти на сервер"
    echo -e "    ${W}0${N})  Очистка           docker prune"
    echo ""
    echo -e "    ${W}q${N})  Выход"
    echo ""
    read -rp "  ▸ " choice
    case "$choice" in
      1) cmd_deploy ;;
      2) cmd_logs ;;
      3) cmd_status ;;
      4) cmd_health ;;
      5) cmd_database ;;
      6) cmd_redis ;;
      7) cmd_containers ;;
      8) cmd_nginx ;;
      9) cmd_ssh ;;
      0) cmd_cleanup ;;
      q|Q) echo -e "\n${D}Bye${N}"; exit 0 ;;
      *) ;;
    esac
  done
}

main_menu
