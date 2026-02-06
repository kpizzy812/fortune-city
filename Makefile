# Fortune City — команды для разработки и деплоя
# Использование: make <команда>
#
# Локальная разработка:
#   make dev          — запустить всё локально
#   make dev-api      — только API
#   make dev-web      — только фронт
#
# Работа с сервером (SSH alias: kp, путь: /fortune):
#   make sync         — залить код на сервер (rsync)
#   make deploy       — полный деплой (sync + build + restart)
#   make deploy-quick — быстрый деплой (только перезапуск без пересборки)
#   make logs         — все логи
#   make logs-api     — логи API
#   make logs-web     — логи Web
#   make ssh          — зайти на сервер в /fortune
#   make status       — статус контейнеров
#   make db-push      — применить схему Prisma
#   make db-studio    — Prisma Studio (порт 5555)
#   make db-backup    — бэкап базы данных
#   make restart      — перезапуск всех контейнеров
#   make stop         — остановить всё
#   make setup        — первоначальная настройка сервера

SERVER = kp
REMOTE_DIR = /fortune
COMPOSE = docker compose -f docker-compose.prod.yml

# ============================================================
#  ЛОКАЛЬНАЯ РАЗРАБОТКА
# ============================================================

.PHONY: panel dev dev-api dev-web install build lint test

# Интерактивная панель управления
panel:
	@./panel.sh

dev:
	pnpm dev

dev-api:
	pnpm dev:api

dev-web:
	pnpm dev:web

install:
	pnpm install

build:
	pnpm build

lint:
	pnpm lint

test:
	cd apps/api && pnpm test

# ============================================================
#  СИНХРОНИЗАЦИЯ КОДА
# ============================================================

.PHONY: sync sync-dry

# Быстрая синхронизация кода на сервер
sync:
	@echo "⚡ Синхронизация кода на сервер..."
	rsync -avz --delete \
		--exclude='node_modules' \
		--exclude='.next' \
		--exclude='dist' \
		--exclude='.turbo' \
		--exclude='.git' \
		--exclude='.env' \
		--exclude='coverage' \
		--exclude='.DS_Store' \
		--exclude='postgres_data' \
		--exclude='redis_data' \
		. $(SERVER):$(REMOTE_DIR)/
	@echo "✅ Код синхронизирован"

# Показать что изменится (dry run)
sync-dry:
	rsync -avzn --delete \
		--exclude='node_modules' \
		--exclude='.next' \
		--exclude='dist' \
		--exclude='.turbo' \
		--exclude='.git' \
		--exclude='.env' \
		--exclude='coverage' \
		--exclude='.DS_Store' \
		--exclude='postgres_data' \
		--exclude='redis_data' \
		. $(SERVER):$(REMOTE_DIR)/

# ============================================================
#  ДЕПЛОЙ
# ============================================================

.PHONY: deploy deploy-quick deploy-api deploy-web

# Полный деплой: sync → build → restart → db push → seed
deploy: sync
	@echo "🔨 Сборка и запуск контейнеров..."
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) up -d --build"
	@echo "🔄 Применение схемы БД..."
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec api npx prisma db push --skip-generate"
	@echo "🌱 Запуск сидеров..."
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec api npx prisma db seed"
	@echo "✅ Деплой завершён"
	@make status-remote

# Быстрый деплой — пересобрать без кеша конкретный сервис
deploy-api: sync
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) up -d --build --no-deps api"
	@echo "✅ API пересобран"

deploy-web: sync
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) up -d --build --no-deps web"
	@echo "✅ Web пересобран"

# Перезапуск без пересборки
deploy-quick: sync
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) restart api web"
	@echo "✅ Перезапуск завершён"

# ============================================================
#  ЛОГИ
# ============================================================

.PHONY: logs logs-api logs-web logs-db logs-redis

logs:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) logs -f --tail=100"

logs-api:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) logs -f --tail=100 api"

logs-web:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) logs -f --tail=100 web"

logs-db:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) logs -f --tail=50 postgres"

logs-redis:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) logs -f --tail=50 redis"

# ============================================================
#  УПРАВЛЕНИЕ КОНТЕЙНЕРАМИ
# ============================================================

.PHONY: status status-remote restart stop start ssh shell-api shell-web

status:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) ps"

status-remote: status

restart:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) restart"
	@echo "✅ Все сервисы перезапущены"

stop:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) down"
	@echo "🛑 Все сервисы остановлены"

start:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) up -d"
	@echo "✅ Все сервисы запущены"

# SSH на сервер
ssh:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && exec \$$SHELL -l"

# Шелл внутрь контейнера
shell-api:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec api sh"

shell-web:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec web sh"

# ============================================================
#  БАЗА ДАННЫХ
# ============================================================

.PHONY: db-push db-seed db-studio db-backup db-restore db-psql

# Применить Prisma схему
db-push:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec api npx prisma db push"
	@echo "✅ Схема применена"

# Запустить сидеры (заполнить начальные данные)
db-seed:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec api npx prisma db seed"
	@echo "✅ Сидеры выполнены"

# Prisma Studio (через SSH tunnel, доступен на localhost:5555)
db-studio:
	@echo "🔌 Prisma Studio на http://localhost:5555"
	@echo "   Ctrl+C чтобы закрыть"
	ssh -L 5555:127.0.0.1:5555 $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec api npx prisma studio --port 5555"

# Бэкап базы
db-backup:
	@mkdir -p backups
	@echo "📦 Создание бэкапа..."
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec -T postgres pg_dump -U fortune fortune_city" > backups/fortune_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Бэкап сохранён в backups/"
	@ls -la backups/*.sql | tail -1

# Восстановление из бэкапа
db-restore:
	@if [ -z "$(FILE)" ]; then echo "Использование: make db-restore FILE=backups/fortune_xxx.sql"; exit 1; fi
	@echo "⚠️  Восстановление из $(FILE)..."
	cat $(FILE) | ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec -T postgres psql -U fortune fortune_city"
	@echo "✅ Восстановлено"

# Подключение к PostgreSQL напрямую
db-psql:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec postgres psql -U fortune fortune_city"

# ============================================================
#  REDIS
# ============================================================

.PHONY: redis-cli redis-flush

redis-cli:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec redis redis-cli"

redis-flush:
	ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) exec redis redis-cli FLUSHALL"
	@echo "✅ Redis очищен"

# ============================================================
#  NGINX & SSL
# ============================================================

.PHONY: nginx-setup nginx-reload ssl-setup

# Скопировать конфиг nginx на сервер и активировать
nginx-setup:
	scp nginx/fortune.conf $(SERVER):/etc/nginx/sites-available/fortune.syntratrade.com
	ssh $(SERVER) "ln -sf /etc/nginx/sites-available/fortune.syntratrade.com /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"
	@echo "✅ Nginx настроен"

nginx-reload:
	ssh $(SERVER) "nginx -t && systemctl reload nginx"

# Получить SSL сертификат через certbot
ssl-setup:
	ssh $(SERVER) "certbot --nginx -d fortune.syntratrade.com"
	@echo "✅ SSL сертификат установлен"

# ============================================================
#  ПЕРВОНАЧАЛЬНАЯ НАСТРОЙКА
# ============================================================

.PHONY: setup setup-env

# Полная настройка сервера с нуля
setup:
	@echo "📋 Первоначальная настройка сервера..."
	ssh $(SERVER) "mkdir -p $(REMOTE_DIR)"
	@make sync
	@echo ""
	@echo "📝 Скопируйте .env на сервер:"
	@echo "   scp .env $(SERVER):$(REMOTE_DIR)/.env"
	@echo "   Затем отредактируйте на сервере: ssh $(SERVER) nano $(REMOTE_DIR)/.env"
	@echo ""
	@echo "Далее выполните:"
	@echo "   1. make deploy       — собрать и запустить"
	@echo "   2. make nginx-setup  — настроить nginx (нужен root)"
	@echo "   3. make ssl-setup    — получить SSL сертификат"
	@echo ""

# Отправить .env на сервер
setup-env:
	scp .env $(SERVER):$(REMOTE_DIR)/.env
	@echo "✅ .env скопирован на сервер"

# ============================================================
#  МОНИТОРИНГ
# ============================================================

.PHONY: health disk top

# Проверка здоровья всех сервисов
health:
	@echo "=== Контейнеры ==="
	@ssh $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) ps"
	@echo ""
	@echo "=== API Health ==="
	@ssh $(SERVER) "curl -sf http://localhost:3001/health || echo 'API недоступен'"
	@echo ""
	@echo "=== Web ==="
	@ssh $(SERVER) "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000 || echo 'Web недоступен'"
	@echo ""

disk:
	ssh $(SERVER) "df -h / && echo '' && docker system df"

top:
	ssh -t $(SERVER) "cd $(REMOTE_DIR) && $(COMPOSE) top"

# ============================================================
#  ОЧИСТКА
# ============================================================

.PHONY: clean clean-docker

# Очистка неиспользуемых Docker ресурсов на сервере
clean-docker:
	ssh $(SERVER) "docker system prune -f && docker image prune -f"
	@echo "✅ Docker очищен"

# ============================================================
#  ПОМОЩЬ
# ============================================================

.PHONY: help

help:
	@echo "Fortune City — команды разработки"
	@echo ""
	@echo "  ЛОКАЛЬНО:"
	@echo "    make dev            Запуск в dev-режиме"
	@echo "    make build          Сборка проекта"
	@echo "    make lint           Линтер"
	@echo "    make test           Тесты API"
	@echo ""
	@echo "  ДЕПЛОЙ:"
	@echo "    make sync           Синхронизировать код"
	@echo "    make sync-dry       Показать изменения (dry run)"
	@echo "    make deploy         Полный деплой (sync+build+restart)"
	@echo "    make deploy-api     Пересобрать только API"
	@echo "    make deploy-web     Пересобрать только Web"
	@echo "    make deploy-quick   Перезапуск без пересборки"
	@echo ""
	@echo "  ЛОГИ:"
	@echo "    make logs           Все логи"
	@echo "    make logs-api       Логи API"
	@echo "    make logs-web       Логи Web"
	@echo "    make logs-db        Логи PostgreSQL"
	@echo ""
	@echo "  КОНТЕЙНЕРЫ:"
	@echo "    make status         Статус контейнеров"
	@echo "    make restart        Перезапустить всё"
	@echo "    make stop           Остановить всё"
	@echo "    make start          Запустить всё"
	@echo "    make ssh            SSH на сервер"
	@echo "    make shell-api      Шелл в API контейнер"
	@echo ""
	@echo "  БАЗА ДАННЫХ:"
	@echo "    make db-push        Применить Prisma схему"
	@echo "    make db-seed        Запустить сидеры"
	@echo "    make db-studio      Prisma Studio (localhost:5555)"
	@echo "    make db-psql        Подключиться к PostgreSQL"
	@echo "    make db-backup      Бэкап базы"
	@echo "    make db-restore FILE=x.sql  Восстановить"
	@echo ""
	@echo "  REDIS:"
	@echo "    make redis-cli      Redis CLI"
	@echo "    make redis-flush    Очистить Redis"
	@echo ""
	@echo "  НАСТРОЙКА:"
	@echo "    make setup          Первоначальная настройка"
	@echo "    make setup-env      Скопировать .env"
	@echo "    make nginx-setup    Настроить nginx"
	@echo "    make ssl-setup      Получить SSL"
	@echo ""
	@echo "  МОНИТОРИНГ:"
	@echo "    make health         Проверка здоровья"
	@echo "    make disk           Место на диске"
	@echo "    make top            Процессы контейнеров"
	@echo "    make clean-docker   Очистка Docker"
