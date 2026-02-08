# Fortune City - Progress

**Последнее обновление:** 2026-01-18
**Текущий этап:** Phase 3.5 — Withdrawals ✅ ГОТОВО (Atomic via Wallet Connect + Instant via Manual Address)

## ⚠️ Изменения в дизайн-документации (2026-01-18)

**Механика хранилища и автосбора переработана:**

| Было | Стало |
|------|-------|
| Прокачка Coin Box 5 уровней (2ч→48ч) | Фиксированный кап **12 часов** |
| Стоимость: 5%→35% от депозита | Бесплатно |
| Auto Collect: 15% от депозита | Инкассатор: **$5 найм + 5% от сборов** |

**Требуется рефакторинг:** Backend/Frontend реализация Coin Box upgrades и Auto Collect нужно адаптировать под новую механику.

---

## Архитектура платформ

| Платформа | Роль | Авторизация |
|-----------|------|-------------|
| **Web** | Основная | Telegram Login Widget |
| **Telegram Mini App** | Дополнение | initData validation |

---

## Phase 1: MVP Foundation ✅

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

### Core Game Loop ✅
- [x] Аутентификация через Telegram (Web + Mini App) ✅
  - AuthModule: initData validation + Login Widget hash verification
  - JWT стратегия с guards
  - UsersModule: findOrCreate по telegram_id
  - Frontend: API client, Zustand store, TelegramProvider
  - 10 unit tests (все проходят)
- [x] MachinesModule CRUD ✅
  - MachinesService: create, findById, findByUserId, getActiveMachines
  - Real-time income calculation (ratePerSecond)
  - Coin Box с capacity limits и collectCoins
  - Reinvest rounds с profit reduction
  - Auto-expire check для машин
  - imageUrl для каждого тира (10 машин)
  - 18 unit tests (все проходят)
  - REST endpoints:
    - GET /machines/tiers - все тиры
    - GET /machines - машины пользователя
    - GET /machines/:id/income - текущий доход
    - POST /machines - создать машину
    - POST /machines/:id/collect - собрать монеты
- [x] EconomyModule (покупка машин) ✅
  - TransactionsService: CRUD транзакций
  - FundSourceService: отслеживание источников средств
  - PurchaseService: покупка с проверкой баланса
  - Атомарные транзакции (баланс → машина → transaction → fund_source)
  - Проверка доступности тира (maxTierReached + 1)
  - 12 unit tests (все проходят)
  - REST endpoints:
    - POST /economy/purchase - купить машину
    - GET /economy/can-afford/:tier - проверить возможность покупки
    - GET /economy/transactions - история транзакций
    - GET /economy/transactions/stats - статистика
    - GET /economy/purchase-history - история покупок
- [x] MachineLifecycleModule (cron для истечения машин) ✅
  - @nestjs/schedule — cron каждые 5 минут
  - Автоматическая пометка машин как expired
  - collectCoins обновлён:
    - Активные машины: collect только при полном coinBox
    - Expired машины: collect доступен сразу (остаток)
    - coinBox → fortuneBalance (атомарная транзакция)
    - Создание transaction записи
  - 4 новых теста (всего 49 тестов, все проходят)

### Экономика базовая ✅
- [x] Единый баланс $FORTUNE (USDT конвертируется при deposit/withdrawal) ✅
- [x] История транзакций ✅
- [x] Перенос дохода на баланс при collectCoins ✅
- [x] Базовый UI в synthwave стиле ✅

### Frontend UI ✅
- [x] CSS Variables (synthwave palette: #ff2d95, #00d4ff, #ffd700)
- [x] UI компоненты (Button, Modal, ProgressBar)
- [x] Types (TierInfo, Machine, MachineIncome, CanAffordResponse)
- [x] API client расширен (getTiers, getMachines, collectCoins, purchaseMachine)
- [x] machines.store.ts (Zustand) — state management
- [x] useInterval hook для real-time интерполяции дохода
- [x] Компоненты машин:
  - IncomeCounter — анимированный счётчик дохода
  - MachineCard — карточка с прогрессом и кнопкой сбора
  - MachineGrid — grid машин с empty state
- [x] Компоненты магазина:
  - TierCard — карточка тира с ценой и yield
  - TierGrid — список всех 10 тиров
  - PurchaseModal — модалка подтверждения покупки
- [x] BottomNavigation (Hall, Shop, Wheel, Refs, Cash)
- [x] Страницы:
  - `/` — Dashboard с машинами и real-time доходом
  - `/shop` — Магазин с покупкой машин

---

## Phase 2: Полный функционал (В ПРОЦЕССЕ)

### Механики
- [x] Тиры 1-10 (все сконфигурированы) ✅
- [x] Реинвест штраф (REINVEST_REDUCTION) ✅
- [x] Отслеживание источников средств (FundSourceService) ✅
- [x] Порядок выплат (прибыль → тело) ✅
  - calculateIncome() теперь разделяет profit и principal
  - collectCoins() и riskyCollect() отслеживают profitPaidOut/principalPaidOut
  - Прибыль выплачивается первой (с налогом), потом тело (без налога)
  - **21 новый comprehensive unit тест** (3 для calculateIncome, 2 для collectCoins, 7 для sellMachineEarly, 9 для calculateEarlySellCommission)
  - Всего 42 теста в machines.service.spec.ts, все проходят ✅
- [x] Досрочная продажа машин с комиссией ✅
  - Новый endpoint POST /machines/:id/sell-early
  - Комиссия зависит от прогресса к breakeven (20-100%)
  - calculateEarlySellCommission() в shared/constants/tiers.ts
  - После BE (100% прогресса) тело невыводное
  - Покрытие тестами: все 6 тиров комиссии + edge cases
- [x] Fortune's Gamble (Risky Collect) ✅
  - Endpoint POST /machines/:id/collect-risky
  - 2x multiplier при победе, 0.5x при проигрыше
  - 4 уровня апгрейда (win chance: 13.33% → 18.67%)
  - Отслеживание profit/principal при risky collect
  - RiskyCollectService с тестами

### Апгрейды + Рефералы
- [x] Апгрейды Coin Box (5 уровней) ✅
  - Backend: upgradeCoinBox() и getCoinBoxInfo() методы в MachinesService
  - Endpoints: POST /machines/:id/upgrade-coinbox, GET /machines/:id/coinbox-info
  - Frontend: CoinBoxUpgradeModal компонент, actions в store
  - Уровни capacity: 2h → 6h → 12h → 24h → 48h
  - Стоимость: 5% → 10% → 20% → 35% от цены машины
  - Атомарные транзакции для списания баланса и обновления capacity
- [x] Auto Collect модуль ✅
  - Backend:
    - AutoCollectService: purchase, getInfo, shouldAutoCollect, executeAutoCollect
    - Endpoints: POST /machines/:id/purchase-auto-collect, GET /machines/:id/auto-collect-info
    - Cron job: проверка и автосбор каждые 30 секунд (handleAutoCollect в MachineLifecycleService)
    - Стоимость: 15% от цены машины, сгорает вместе с машиной
    - Prisma схема: autoCollectEnabled, autoCollectPurchasedAt
    - 17 unit тестов (все проходят)
  - Frontend:
    - AutoCollectModal компонент с полным UI для покупки модуля
    - Badge "⚡ Auto" в MachineCard когда модуль активен
    - Кнопка "Enable Auto Collect" в нижней части карточки
    - API методы: getAutoCollectInfo, purchaseAutoCollect
    - Store integration: autoCollectInfos state, purchaseAutoCollect/fetchAutoCollectInfo actions
    - Dashboard интеграция с modal state management
    - Все изменения прошли lint и build ✅
- [x] 3-уровневая реферальная система ✅
  - Backend:
    - ReferralsModule: service, controller (полный CRUD)
    - processReferralBonus() - 3 уровня: 5%, 3%, 1% от fresh_usdt
    - referralBalance - отдельный баланс для реферальных бонусов
    - Требуется активная машина для вывода referralBalance
    - Интеграция в PurchaseService (бонус при покупке машины)
    - referralBalance можно использовать для покупок
    - nanoid(8) для генерации реферальных кодов
    - Endpoints: GET /referrals/stats, GET /referrals/list, POST /referrals/withdraw, POST /referrals/set-referrer
    - 22 unit теста (все проходят)
  - Интеграция в авторизацию:
    - referralCode в DTO авторизации (initData + loginWidget)
    - UsersService связывает нового пользователя с реферером
    - referralBalance/referralCode в ответе /me
    - Обновлены тесты auth, purchase, machine-lifecycle
  - Frontend:
    - Страница /refs с полным UI
    - referrals.store.ts (Zustand)
    - Статистика, список рефералов, кнопка вывода
    - Копирование реферальной ссылки
    - captureReferralCode() - захват ?ref= из URL в localStorage
    - Автоматическая передача referralCode при авторизации
- [x] Fortune Rate (курс $FORTUNE токена) ✅
  - Backend:
    - FortuneRateModule: service, controller
    - PumpPortal WebSocket клиент (wss://pumpportal.fun/api/data)
    - Подписка на trades по mint address токена
    - Расчёт цены: priceInSol = vSolInBondingCurve / vTokensInBondingCurve
    - CoinGecko API для SOL/USD курса
    - Кэширование с TTL 60 секунд
    - Fallback rate: 1 USD = 10 FORTUNE
    - Endpoint: GET /fortune-rate
  - Frontend:
    - fortune-rate.store.ts (Zustand)
    - Интеграция в page.tsx, shop/page.tsx, SidebarNavigation
    - Автоматическое обновление курса каждые 30 секунд
    - Заменён хардкод (* 10) на реальный курс от API
- [x] User-level Fund Source Tracking ✅
  - Назначение: корректное налогообложение при Cash Out (вывод в USDT)
  - User модель: добавлены поля totalFreshDeposits и totalProfitCollected
  - FundSourceService методы:
    - recordProfitCollection() - при сборе монет (profit часть)
    - recordFreshDeposit() - при депозите USDT → FORTUNE
    - propagateMachineFundSourceToBalance() - при продаже машины
    - recordWithdrawal() - при выводе (сначала fresh, потом profit)
  - Интеграция:
    - collectCoins: profit часть записывается в totalProfitCollected
    - AuctionService: при продаже fund_source propagates обратно в баланс
    - PawnshopService: аналогично, с учётом profit из coinBox
  - Логика налогообложения:
    - Fresh deposits (USDT → FORTUNE) = 0% налог при выводе
    - Profit collected = применяется currentTaxRate (зависит от maxTierReached)
- [ ] Push-уведомления

### Wheel of Fortune
- [ ] UI колеса с анимациями
- [ ] Система призов
- [ ] Jackpot pool
- [ ] Буфы временные

---

## Phase 3: Депозиты (Solana) — ✅ ГОТОВО

**Архитектура:** см. [DEPOSITS_ARCHITECTURE.md](./DEPOSITS_ARCHITECTURE.md)

### Backend ✅
- [x] DepositsModule (controller, service, DTOs)
- [x] AddressGeneratorService (HD Wallet derivation via ed25519-hd-key)
- [x] HeliusWebhookService (регистрация адресов, валидация, webhook callback)
- [x] DepositProcessorService (конвертация в USD, зачисление, referral bonuses)
- [x] SweepService (cron каждые 15 мин, автосбор на hot wallet + gas distribution)
- [x] PriceOracleService (CoinGecko SOL/USD + Fortune Rate)
- [x] SolanaRpcService (SOL/SPL transfers, balance checks)
- [x] Prisma schema:
  - Deposit model (method, currency, status, amounts, tx info)
  - WalletConnection model (wallet connect support)
  - DepositAddress updates (derivationIndex, webhookId, lastSweptAt)

### Гибридный подход ✅
- [x] **Wallet Connect**: прямые депозиты с подключённого кошелька (Phantom, Solflare и др.)
- [x] **Deposit Address**: уникальный адрес для депозитов с бирж/других кошельков

### Поддерживаемые валюты ✅
- [x] SOL (native) → USD (via CoinGecko)
- [x] USDT SPL (Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB) → USD (1:1)
- [x] FORTUNE SPL (FORTUNE_MINT_ADDRESS из env) → USD (via PriceOracle)

### Frontend ✅
- [x] SolanaWalletProvider (Wallet Standard + auto-detect)
- [x] deposits.store.ts (Zustand state management)
- [x] Страница /cash с двумя вкладками:
  - Wallet Connect: подключение кошелька, выбор валюты, ввод суммы, депозит
  - Deposit Address: QR-код, копирование адреса, инструкции
- [x] История последних депозитов
- [x] Курсы валют в реальном времени
- [x] API endpoints в api.ts:
  - connectWallet, getConnectedWallet
  - initiateDeposit, confirmDeposit
  - getDepositAddress, getDeposits, getDepositRates

### Endpoints
- POST /deposits/wallet-connect — подключение кошелька
- GET /deposits/wallet — получение подключённого кошелька
- POST /deposits/initiate — инициировать депозит (wallet connect)
- POST /deposits/confirm — подтвердить депозит (после tx)
- GET /deposits/address — получить deposit address + QR
- GET /deposits — история депозитов
- GET /deposits/rates — текущие курсы
- POST /webhooks/helius — Helius webhook callback

### Withdrawal (Phase 3.5) — ✅ ГОТОВО
- [x] Withdrawal flow (вывод в USDT SPL на Solana)
- **Документация:** см. [WITHDRAWAL_IMPLEMENTATION.md](./WITHDRAWAL_IMPLEMENTATION.md)

**Реализованы два метода вывода:**

1. **Atomic Withdrawal (Wallet Connect)**
   - Пользователь подключает кошелёк
   - Одна атомарная транзакция: user → SOL fee → master + hot wallet → USDT → user
   - Backend частично подписывает транзакцию, user доподписывает и отправляет
   - Либо оба transfer происходят, либо оба отменяются

2. **Instant Withdrawal (Manual Address)**
   - Пользователь вводит адрес кошелька
   - Hot wallet сразу отправляет USDT
   - Простой flow без подключения кошелька

**Чеклист:**
- [x] Prisma schema (Withdrawal model + enums)
- [x] WithdrawalsModule (service, controller, DTOs)
- [x] Логика налогообложения (Fresh vs Profit через FundSourceService)
- [x] Frontend (withdrawals.store.ts, cash/page.tsx с вкладками Withdraw)
- [ ] Локализация (TODO)
- [x] Unit тесты (22 теста для WithdrawalsService)

**Endpoints:**
- GET /withdrawals/preview?amount=X — предпросмотр с расчётом налога
- POST /withdrawals/prepare-atomic — подготовить atomic транзакцию
- POST /withdrawals/confirm-atomic — подтвердить после подписи user
- POST /withdrawals/cancel/:id — отменить pending withdrawal
- POST /withdrawals/instant — instant вывод на указанный адрес
- GET /withdrawals — история выводов
- GET /withdrawals/:id — детали вывода

---

## Phase 3.7: Economy v3 Redesign — В ПРОЦЕССЕ

**Дизайн-документ:** [economy-v3-redesign.md](./economy-v3-redesign.md)

### Ключевые изменения
- [ ] **Auto-unlock тиров** по totalFameEarned (не тратить fame на unlock)
- [ ] **Удалить Overclock** — убыточен для казны (создаёт доп. yield)
- [ ] **Удалить Extend Life** — убыточен для казны (создаёт доп. yield)
- [ ] **Tier Unlock Purchase** — мгновенный доступ к тиру за 10% цены (чистый доход)
- [ ] **Speed Up** — ускорение цикла машины, yield тот же (чистый доход)
- [ ] **Fame prices ×2.5** для collector (FAME_PER_HOUR × 12.5)

### Код
- [ ] shared/constants/fame.ts — удалить overclock/extend/unlock costs, добавить speed up + tier unlock fee
- [ ] shared/constants/tiers.ts — cleanup
- [ ] apps/api fame.service — auto-unlock logic при earnFame()
- [ ] apps/api — TierUnlockPurchaseService
- [ ] apps/api — SpeedUpService
- [ ] Prisma schema — speedUpDays, удалить overclockMultiplier
- [ ] Frontend — убрать overclock/extend UI, добавить speed up + unlock purchase

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

## Frontend Structure (New)

```
apps/web/src/
├── app/
│   ├── page.tsx          # Dashboard с машинами
│   ├── shop/page.tsx     # Магазин тиров
│   ├── refs/page.tsx     # Реферальная страница
│   ├── cash/
│   │   ├── layout.tsx    # SolanaWalletProvider wrapper
│   │   └── page.tsx      # Депозиты (Wallet Connect + QR)
│   └── layout.tsx        # Layout с BottomNavigation
├── components/
│   ├── ui/               # Button, Modal, ProgressBar
│   ├── machines/         # IncomeCounter, MachineCard, MachineGrid
│   ├── shop/             # TierCard, TierGrid, PurchaseModal
│   └── layout/           # BottomNavigation, AuthenticatedLayout
├── providers/
│   ├── TelegramProvider.tsx      # Telegram WebApp integration
│   └── SolanaWalletProvider.tsx  # Solana wallet adapter
├── stores/
│   ├── auth.store.ts         # Auth state (Zustand)
│   ├── machines.store.ts     # Machines state (Zustand)
│   ├── referrals.store.ts    # Referrals state (Zustand)
│   ├── fortune-rate.store.ts # Fortune rate state (Zustand)
│   ├── deposits.store.ts     # Deposits state (Zustand)
│   └── withdrawals.store.ts  # Withdrawals state (Zustand)
├── hooks/
│   └── useInterval.ts    # Real-time income interpolation
└── types/
    └── index.ts          # Frontend types
```
