# Fortune City - Progress

**Последнее обновление:** 2026-01-10

## Архитектура платформ

| Платформа | Роль | Авторизация |
|-----------|------|-------------|
| **Web** | Основная | Telegram Login Widget |
| **Telegram Mini App** | Дополнение | initData validation |

---

## Phase 1: MVP Foundation

### Инфраструктура ✅
- [x] Монорепозиторий (pnpm workspaces + turbo)
- [x] NestJS 11 backend (apps/api) → localhost:3001
- [x] Next.js 16.1 + React 19.2 frontend (apps/web) → localhost:3000
- [x] Shared package с типами (packages/shared)
- [x] Prisma 6 схема БД (users, machines, transactions, fund_sources)
- [x] Docker Compose (postgres:5433 + redis:6379)
- [x] Типы: Machine, User, Transaction, MachineTier
- [x] Константы: MACHINE_TIERS, TAX_RATES, REINVEST_REDUCTION

### Telegram интеграция ✅
- [x] @telegram-apps/telegram-ui — UI компоненты в стиле Telegram
- [x] @vkruglikov/react-telegram-web-app — хуки (MainButton, BackButton и др.)
- [x] @tma.js/init-data-node — валидация initData на бэкенде
- [x] ~~@telegram-apps/sdk-react~~ — удалено (низкоуровневое)

### Core Game Loop
- [ ] Аутентификация через Telegram (Web + Mini App)
- [ ] Тиры 1-3 машин
- [ ] Покупка машин
- [ ] Real-time расчёт дохода
- [ ] Сбор монет (Coin Box)
- [ ] Истечение срока машин

### Экономика базовая
- [ ] Балансы FORTUNE/USDT
- [ ] Базовый UI в synthwave стиле
- [ ] История транзакций

---

## Phase 2: Полный функционал

### Механики
- [ ] Тиры 4-10
- [ ] Реинвест штраф
- [ ] Порядок выплат (прибыль → тело)
- [ ] Отслеживание источников средств
- [ ] Досрочный вывод с комиссией

### Апгрейды + Рефералы
- [ ] Апгрейды Coin Box (5 уровней)
- [ ] Auto Collect модуль
- [ ] 3-уровневая реферальная система
- [ ] Push-уведомления

### Wheel of Fortune
- [ ] UI колеса с анимациями
- [ ] Система призов
- [ ] Jackpot pool
- [ ] Буфы временные

---

## Phase 3: Депозиты

- [ ] TON USDT Jetton
- [ ] Solana USDT SPL
- [ ] BNB Chain USDT BEP-20
- [ ] Tron USDT TRC-20
- [ ] Withdrawal flow

---

## Phase 4: Launch

- [ ] Лидерборд
- [ ] Достижения
- [ ] Ежедневные задания
- [ ] Сезонная механика
- [ ] Production deploy

---

## Quick Commands

```bash
# Запустить БД
docker compose up -d

# Dev режим (оба)
pnpm dev

# Только API
pnpm dev:api

# Только Web
pnpm dev:web

# Prisma
pnpm db:generate  # генерация клиента
pnpm db:push      # применить схему
pnpm db:studio    # GUI для БД
```

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind, Zustand, Framer Motion |
| Backend | NestJS 11, Prisma 6, PostgreSQL, Redis |
| Realtime | Socket.io |
| Platform | Web (основная) + Telegram Mini App (доп.) |
| TG Integration | telegram-ui, react-telegram-web-app, tma.js/init-data-node |
