#!/usr/bin/env bash
# Fortune City — первоначальная настройка сервера
# Запуск: ssh kp 'bash -s' < scripts/server-setup.sh
set -euo pipefail

REMOTE_DIR="/fortune"
DOMAIN="fortune.syntratrade.com"

echo "=== Fortune City: Настройка сервера ==="

# 1. Создать директорию проекта
echo "📁 Создание $REMOTE_DIR..."
mkdir -p "$REMOTE_DIR"

# 2. Проверить Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и повторите."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose v2 не найден."
    exit 1
fi

echo "✅ Docker $(docker --version | cut -d' ' -f3)"
echo "✅ $(docker compose version)"

# 3. Проверить nginx
if command -v nginx &> /dev/null; then
    echo "✅ Nginx $(nginx -v 2>&1 | cut -d'/' -f2)"
else
    echo "⚠️  Nginx не найден. Установите: apt install nginx"
fi

# 4. Проверить certbot
if command -v certbot &> /dev/null; then
    echo "✅ Certbot установлен"
else
    echo "⚠️  Certbot не найден. Установите: apt install certbot python3-certbot-nginx"
fi

echo ""
echo "=== Следующие шаги ==="
echo ""
echo "1. С локальной машины:"
echo "   make sync              # загрузить код"
echo "   scp .env kp:$REMOTE_DIR/.env  # скопировать переменные окружения"
echo ""
echo "2. Отредактировать .env на сервере:"
echo "   ssh kp nano $REMOTE_DIR/.env"
echo "   # Изменить DATABASE_URL, пароли, ключи для production"
echo ""
echo "3. DNS: Создать A-запись"
echo "   $DOMAIN → IP этого сервера"
echo ""
echo "4. С локальной машины:"
echo "   make deploy            # собрать и запустить контейнеры"
echo "   make nginx-setup       # настроить nginx (нужен root)"
echo "   make ssl-setup         # получить SSL сертификат"
echo ""
echo "5. Проверить:"
echo "   make health"
echo "   curl https://$DOMAIN"
echo ""
echo "✅ Настройка завершена"
