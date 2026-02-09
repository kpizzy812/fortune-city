# Fortune City - Progress Tracker

## Current Task: v2 Economics — Пересмотр экономики тиров (COMPLETED)

**Started:** 2026-02-08
**Plan:** [docs/math.md](docs/math.md) v2

### Что сделано:
- [x] Пересмотр тиров: короткие циклы 3-14 дней (было 7-48)
- [x] Инвертированная ставка: 15%/день на T1 → 5%/день на T10 (было flat 5%)
- [x] Налог -5% за каждый тир: 50% → 5% (было ступенчатое 50/40/30/20/10)
- [x] Инкассатор: 10% от gross profit (было flat $5)
- [x] Обновлены Fame constants и Overclock prices
- [x] Обновлена Prisma schema (collectorHirePercent)
- [x] Обновлены backend сервисы (auto-collect, admin-settings)
- [x] Обновлён frontend (admin settings, api types)
- [x] Обновлены все тесты (564/566 pass, 2 pre-existing fails в withdrawals)
- [x] Build: shared ✅, API ✅, Web ✅

### Предыдущие задачи: Wheel of Fortune, Admin Panel (COMPLETED)

---

## Phase 1: Основа (COMPLETED)

### 1.1 Prisma модели
- [x] TierConfig - динамические тарифы
- [x] SystemSettings - расширение существующей модели
- [x] AuditLog - журнал действий админа
- [x] User.isBanned - поле для бана пользователей

### 1.2 Миграция и Seed
- [x] Создать миграцию (db push)
- [x] Seed скрипт для переноса MACHINE_TIERS в TierConfig
- [x] Seed для SystemSettings

### 1.3 Admin Auth (Backend)
- [x] AdminModule в apps/api/src/modules/admin/
- [x] admin-auth.controller.ts (POST /admin/auth/login)
- [x] admin-auth.service.ts (проверка ADMIN_USER/ADMIN_PASS)
- [x] admin.guard.ts (JWT guard для админских роутов)
- [x] .env: ADMIN_USER, ADMIN_PASS, ADMIN_JWT_SECRET

### 1.4 Admin Layout (Frontend)
- [x] apps/web/src/app/admin/layout.tsx
- [x] apps/web/src/app/admin/login/page.tsx
- [x] apps/web/src/stores/admin/admin-auth.store.ts
- [x] AdminSidebar, AdminHeader компоненты

### 1.5 Dashboard
- [x] apps/web/src/app/admin/dashboard/page.tsx
- [x] apps/api/src/modules/admin/admin-dashboard/ (controller + service)
- [x] Базовая статистика (пользователи, машины, объёмы)

**Build Status:** API и Web собираются успешно

---

## Phase 2: Управление тарифами (COMPLETED)

### 2.1 Backend CRUD
- [x] admin-tiers.controller.ts - CRUD endpoints для тиров
- [x] admin-tiers.service.ts - бизнес логика + аудит
- [x] DTOs для создания/редактирования (dto/tier.dto.ts)

### 2.2 Frontend UI
- [x] TiersTable.tsx - таблица с действиями
- [x] TierForm.tsx - форма создания/редактирования с калькулятором
- [x] Visibility/Availability toggles в таблице
- [x] /admin/tiers - страница списка
- [x] /admin/tiers/new - создание нового тира
- [x] /admin/tiers/[tier] - редактирование тира
- [x] admin-tiers.store.ts - Zustand store

### 2.3 Integration
- [x] TierCacheService - кэширование тиров в памяти с cron-обновлением
- [x] MachinesService читает из БД через TierCacheService
- [x] Инвалидация кэша при изменениях через админку
- [x] Fallback на константы если БД пуста

**Build Status:** API и Web собираются успешно

---

## Phase 3: Настройки экономики (COMPLETED)

### 3.1 Backend
- [x] admin-settings.controller.ts - GET/PUT endpoints
- [x] admin-settings.service.ts - CRUD + аудит + reset
- [x] dto/settings.dto.ts - валидация всех полей
- [x] Подключение к admin.module.ts

### 3.2 Frontend UI
- [x] /admin/settings - страница настроек экономики
- [x] Карточки по категориям (General, Deposits, Commissions, Tax, Referral, Gamble, CoinBox)
- [x] JSON редактор для комплексных полей с валидацией
- [x] Кнопки Save Changes и Reset to Defaults
- [x] admin-settings.store.ts - Zustand store

### 3.3 Integration
- [x] SettingsService с кэшированием (из Phase 1)
- [x] API методы в lib/api.ts
- [x] Инвалидация кэша при изменениях

**Build Status:** API и Web собираются успешно

---

## Phase 4: Управление пользователями (COMPLETED)

### 4.1 Backend
- [x] admin-users.controller.ts - GET list, GET by id, GET referral-tree, POST ban, POST unban
- [x] admin-users.service.ts - фильтрация, пагинация, бан/анбан, реферальное дерево
- [x] dto/user.dto.ts - UsersFilterDto, BanUserDto, response types
- [x] Подключение к admin.module.ts
- [x] AuditLog интеграция

### 4.2 Frontend UI
- [x] /admin/users - страница управления пользователями
- [x] UsersTable.tsx - таблица с поиском, фильтрами, пагинацией, сортировкой
- [x] UserDetailModal.tsx - детальный просмотр с балансами, статистикой, бан/анбан
- [x] ReferralTree.tsx - визуализация реферального дерева (3 уровня)
- [x] admin-users.store.ts - Zustand store

### 4.3 Features
- [x] Поиск по username, firstName, telegramId, referralCode
- [x] Фильтр по статусу бана (All/Active/Banned)
- [x] Сортировка по дате, балансу, тиру
- [x] Пагинация с настраиваемым лимитом
- [x] Детальная статистика пользователя (депозиты, выводы, машины, рефералы)
- [x] Бан/анбан с причиной и аудит логом
- [x] Реферальное дерево 3 уровня с contribution tracking

**Build Status:** API и Web собираются успешно

---

## Phase 5: Финансы и аудит (COMPLETED)

### 5.1 Backend
- [x] admin-withdrawals.controller.ts - GET list, GET by id, POST approve, POST complete, POST reject
- [x] admin-withdrawals.service.ts - фильтрация, статистика, approve/complete/reject workflow
- [x] dto/withdrawal.dto.ts - WithdrawalsFilterDto, action DTOs, response types
- [x] admin-deposits.controller.ts - GET list, GET by id, POST manual-credit, POST retry
- [x] admin-deposits.service.ts - фильтрация, статистика, manual credit, retry processing
- [x] dto/deposit.dto.ts - DepositsFilterDto, action DTOs, response types
- [x] admin-audit.controller.ts - GET logs, GET stats
- [x] admin-audit.service.ts - фильтрация, статистика по action types
- [x] dto/audit.dto.ts - AuditFilterDto, response types
- [x] Подключение к admin.module.ts

### 5.2 Frontend UI
- [x] /admin/withdrawals - страница управления выводами
- [x] WithdrawalsTable.tsx - таблица с поиском, фильтрами, статистикой
- [x] WithdrawalDetailModal.tsx - детальный просмотр, approve/complete/reject actions
- [x] /admin/deposits - страница управления депозитами
- [x] DepositsTable.tsx - таблица с поиском, фильтрами, статистикой
- [x] DepositDetailModal.tsx - детальный просмотр, manual credit, retry
- [x] /admin/audit - страница аудит лога
- [x] AuditTable.tsx - таблица с фильтрами, статистикой по типам

### 5.3 Zustand Stores
- [x] admin-withdrawals.store.ts
- [x] admin-deposits.store.ts
- [x] admin-audit.store.ts

### 5.4 Dashboard Charts
- [x] Расширенная статистика (today/week metrics, fortune balance, tax collected)
- [x] Area chart: Deposits vs Withdrawals
- [x] Bar chart: New Users per day
- [x] Line chart: Tax Revenue
- [x] Pie chart: Machine Tier Distribution
- [x] Bar chart: New Machines per day
- [x] Selectable time range (7/14/30/60/90 days)

**Build Status:** API и Web собираются успешно

---

## Phase 6: Тестирование (COMPLETED)

### 6.1 Unit Tests
- [x] admin-auth.service.spec.ts - 15 тестов (login, JWT validation, timing-safe comparison)
- [x] admin-jwt.guard.spec.ts - 12 тестов (token extraction, validation, error handling)
- [x] admin-withdrawals.service.spec.ts - 28 тестов (approve, reject, complete, stats, filters)
- [x] admin-deposits.service.spec.ts - 22 тестов (manual credit, retry, stats, filters)
- [x] admin-users.service.spec.ts - 20 тестов (ban/unban, stats, filters, referral tree)

### 6.2 Coverage
- **Total:** 97 тестов, все проходят
- Критичные операции покрыты: авторизация, финансы, безопасность

**Build Status:** API и Web собираются успешно, все тесты проходят

---

## Phase 7: Исправления критичных механик (COMPLETED)

### 7.1 reinvestRound - автоматическое вычисление
- [x] Убран параметр reinvestRound из PurchaseMachineDto (клиент больше не передаёт)
- [x] reinvestRound теперь вычисляется автоматически на бэкенде:
  - Считается количество завершённых машин того же тира у пользователя
  - reinvestRound = completedMachinesCount + 1
- [x] Сброс reinvestRound при апгрейде на более высокий тир:
  - Если tier > user.maxTierReached → reinvestRound = 1 (сброс)
- [x] Исправлен баг с отслеживанием fresh deposits (использовался approx вместо user.totalFreshDeposits)

### 7.2 Тесты
- [x] Обновлены тесты в purchase.service.spec.ts
- [x] Добавлены тесты для автоматического вычисления reinvestRound
- [x] Добавлены тесты для сброса при апгрейде тира

### 7.3 Frontend UI для reinvest penalty
- [x] Расширен canAffordTier API с полями:
  - `isUpgrade` - первая покупка нового тира
  - `nextReinvestRound` - какой раз покупается этот тир
  - `currentProfitReduction` / `nextProfitReduction` - % урезания прибыли
- [x] PurchaseModal - показывает:
  - Фактический profit с учётом урезания
  - Предупреждение о penalty при повторной покупке тира
  - Подсказка об апгрейде для полной прибыли
  - Бонус при покупке нового тира (no penalty)
- [x] TierCarousel - badge рядом с Profit:
  - Показывает реальный profit с учётом penalty
  - Badge "NEW" (зелёный) для нового тира
  - Badge "x2", "x3" (оранжевый) для повторных покупок с penalty
  - Процент урезания (-5%, -10%, etc.)

**Security:** Закрыта дыра в экономике - ранее клиент мог передавать reinvestRound: 1 и обходить механику урезания прибыли

**Build Status:** API и Web собираются успешно, 187 тестов проходят

---

## Phase 8: Колесо Фортуны (IN PROGRESS)

**Документация:** [docs/concept.md](docs/concept.md) — секция "КОЛЕСО ФОРТУНЫ"

### Концепция
Геймифицированная механика для:
- Вовлечения игроков (азарт)
- Дефляции токенов (burn)
- Снижения давления на кассу выплат

### Математика
| Параметр | Значение |
|----------|----------|
| Ставка | $1 (фиксированная) |
| House Edge | ~43% |
| EV игрока | ~57% |
| Burn rate | 80% от проигрышей |
| Jackpot pool | 20% от проигрышей |
| Jackpot cap | $1000 |

### Сектора колеса
| Сектор | Шанс | Выигрыш |
|--------|------|---------|
| 5x | 1% | $5 |
| 2x | 5% | $2 |
| 1.5x | 8% | $1.50 |
| Free Spin (1x) | 12% | $1 |
| 0.5x | 18% | $0.50 |
| 0.2x | 22% | $0.20 |
| Empty | 33% | $0 |
| Jackpot | 1% | Pool |

### Мульти-спин
Для китов: вместо N кликов — один мульти-спин.
- Опции: 1x / 5x / 10x / 25x / 50x
- Каждый спин — независимый розыгрыш
- Показывается суммарный результат

### 8.1 Backend (COMPLETED)
- [x] Prisma модели:
  - WheelSpin (id, userId, betAmount, spinCount, totalBet, totalPayout, netResult, spinResults, jackpotWon, jackpotAmount, burnAmount, poolAmount, freeSpinsUsed)
  - WheelJackpot (id, currentPool, poolCap, totalContributed, totalPaidOut, totalBurned, timesWon, lastWinnerId, lastWonAmount, lastWonAt)
  - SystemSettings: wheelBetAmount, wheelMultipliers, wheelFreeSpinsBase, wheelFreeSpinsPerRef, wheelJackpotCap, wheelBurnRate, wheelPoolRate, wheelSectors
- [x] WheelModule в apps/api/src/modules/wheel/
- [x] wheel.service.ts:
  - spin(userId, multiplier) — мульти-спин с атомарной транзакцией
  - spinOnce() — одиночный спин с взвешенным рандомом
  - secureRandom() — crypto.randomBytes для RNG
  - getState(userId) — текущее состояние колеса
  - getHistory(userId) — история спинов
  - getJackpotInfo() — публичная информация о джекпоте
  - resetDailyFreeSpins() — для крона
- [x] wheel.controller.ts:
  - POST /wheel/spin — крутить (с JwtAuthGuard)
  - GET /wheel/state — текущий jackpot pool, free spins
  - GET /wheel/history — история спинов пользователя
  - GET /wheel/jackpot — публичный эндпоинт джекпота
- [x] DTOs: SpinDto, SpinResult, SpinResponseDto, WheelStateDto, SpinHistoryDto
- [x] Интеграция с SettingsService (все параметры конфигурируемы)
- [x] Криптографически безопасный RNG (crypto.randomBytes)

### 8.2 Frontend (COMPLETED)
- [x] /wheel — страница колеса
- [x] FortuneWheel.tsx — SVG колесо с анимацией вращения (framer-motion)
- [x] SpinControls.tsx — кнопка SPIN + переключатель мультиплера (x1→x5→x10→x25→x50 циклично)
- [x] JackpotDisplay.tsx — текущий пул с анимацией роста и sparkles
- [x] SpinHistory.tsx — последние результаты спинов
- [x] SpinResultModal.tsx — модалка с результатами (confetti для джекпота/больших выигрышей)
- [x] wheel.store.ts — Zustand store для состояния колеса
- [x] API типы и методы в lib/api.ts
- [x] Типы в types/index.ts
- [x] Навигация: убран "coming soon" флаг с колеса

### 8.3 Анимации (COMPLETED)
- [x] Вращение колеса (framer-motion с custom easing)
- [x] Остановка на целевом секторе
- [x] Confetti при джекпоте и больших выигрышах
- [x] Анимация изменения джекпота
- [x] Анимированный переключатель мультиплера

### 8.4 WebSocket и уведомления (COMPLETED)
- [x] WheelGateway (socket.io):
  - jackpot:won — кто-то выиграл джекпот (глобальное уведомление)
  - jackpot:updated — пул обновился
- [x] WheelNotificationService (Telegram):
  - Уведомление в канал при джекпоте
  - Личное сообщение победителю (если есть telegramId)
- [x] useWheelSocket.tsx — хук для подключения к WebSocket
  - Тосты с кнопкой "Spin Now!" при джекпоте другого игрока
  - Обновление jackpotPool в store в реальном времени
- [x] Локализация уведомлений (EN/RU)

### 8.5 Тесты
- [ ] wheel.service.spec.ts
- [ ] Тесты на распределение шансов (статистический тест)
- [ ] Тесты на джекпот механику
- [ ] Edge cases (недостаточно средств, лимиты)

**Build Status:** API и Web собираются успешно

---

## Phase 9: Упрощение Coin Box и Collector (COMPLETED)

### Изменения в дизайне
Переработана экономика хранилища и автосбора:
- **Coin Box**: Убраны уровни апгрейда, фиксированная ёмкость 12 часов для всех машин
- **Auto Collect → Collector**: Переименовано в "Инкассатор" с новой ценовой моделью

### 9.1 Backend
- [x] packages/shared: COIN_BOX_CAPACITY_HOURS = 12 (вместо COIN_BOX_LEVELS)
- [x] packages/shared: COLLECTOR_HIRE_COST = 5, COLLECTOR_SALARY_PERCENT = 5
- [x] MachinesService: create() использует фикс 12ч, удалены getCoinBoxInfo/upgradeCoinBox
- [x] MachinesController: удалены endpoints coinbox-info и upgrade-coinbox
- [x] AutoCollectService: новая модель hireCost + salaryPercent
- [x] Prisma: добавлены транзакции collector_hire и collector_salary
- [x] DTO: обновлены AutoCollectInfo типы

### 9.2 Frontend
- [x] Удалён CoinBoxUpgradeModal.tsx
- [x] MachineCard: убрана кнопка апгрейда coin box
- [x] MachineGrid: убраны пропсы coinBoxInfos и onUpgradeCoinBox
- [x] page.tsx: очистка от CoinBox-логики
- [x] AutoCollectModal: полностью переписан с новым лором "Нанять инкассатора"
- [x] stores/machines.store.ts: удалены coinBoxInfos, upgradeCoinBox, fetchCoinBoxInfo
- [x] types/index.ts: обновлены типы AutoCollectInfo

### 9.3 Локализация
- [x] Добавлена секция "collector" в ru.json и en.json
- [x] Обновлены ключи machines.hireCollector, machines.collectorActive
- [x] Полные переводы для модалки инкассатора

### Ценовая модель инкассатора
| Параметр | Значение |
|----------|----------|
| Плата за найм | $5 (единоразово) |
| Зарплата | 5% от каждого сбора |
| Срок контракта | До окончания цикла машины |

### Лор
Инкассатор — надёжный работник казино, который автоматически собирает вашу прибыль. Работает круглосуточно, но берёт скромную комиссию с каждого сбора.

**Build Status:** API и Web собираются успешно

---

## Phase 10: Web3 Authentication (Solana Wallet) (COMPLETED)

**Started:** 2026-01-18
**Концепция:** Авторизация через Solana кошельки (Phantom, Backpack, etc.) как третий метод входа наряду с Telegram и Email

### Архитектура
```
Frontend → window.solana.connect() → Supabase Web3 Auth → Backend JWT
```

### 10.1 Backend (COMPLETED)
- [x] Prisma schema: добавлено поле `web3Address String? @unique`
- [x] UsersService:
  - findByWeb3Address(address)
  - createUserWithWeb3(web3Address, referrerCode?)
  - findOrCreateFromWeb3()
  - linkWeb3ToUser(userId, web3Address)
- [x] AuthService:
  - authWithWeb3Token(supabaseToken, referralCode?) — вход через кошелёк
  - linkWeb3(userId, supabaseToken) — привязка кошелька к аккаунту
  - formatUserResponse() — добавлено поле web3Address
- [x] AuthController:
  - POST /auth/web3 — авторизация через Web3
  - POST /auth/link-web3 — привязка кошелька к текущему аккаунту
  - GET /auth/me — возвращает web3Address
- [x] DTO: обновлён AuthResponseDto с web3Address

### 10.2 Frontend (COMPLETED)
- [x] types/window.d.ts — TypeScript типы для Solana Wallet API (window.solana)
- [x] SolanaLoginButton.tsx — компонент входа с:
  - Проверка наличия кошелька
  - Подключение через window.solana.connect()
  - Аутентификация через Supabase Web3
  - Инструкция по установке кошелька если не найден
- [x] auth.store.ts:
  - signInWithWeb3() — вход через Solana кошелёк
  - linkWeb3() — привязка кошелька
- [x] lib/api.ts:
  - authWithWeb3(accessToken, referralCode?)
  - linkWeb3(token, supabaseAccessToken)
  - UserData interface обновлён
- [x] page.tsx — добавлен SolanaLoginButton на страницу входа
- [x] cash/page.tsx — авто-коннект кошелька с onlyIfTrusted: true
  - Автоматически подключается если user?.web3Address существует
  - Без popup если кошелёк ранее одобрял приложение

### 10.3 Локализация (COMPLETED)
- [x] en.json и ru.json: секция "auth"
  - signInWithWallet, connectWallet, connecting
  - walletNotFound, installWallet

### 10.4 Environment Variables (COMPLETED)
- [x] Унифицированы .env файлы — единый корневой .env для всех сервисов
- [x] Созданы symlinks: apps/api/.env → ../../.env, apps/web/.env → ../../.env
- [x] Добавлены Supabase переменные в корневой .env:
  - SUPABASE_URL, SUPABASE_ANON_KEY (для бэкенда)
  - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (для фронтенда)
- [x] Создан .env.example в корне с шаблоном всех переменных
- [x] Backups: apps/api/.env.backup, apps/web/.env.backup

### Особенности
- **Multi-provider auth**: Telegram, Email, Solana Wallet — все методы равноправны
- **Account linking**: Можно привязать несколько методов входа к одному аккаунту
- **Referral compatibility**: Реферальная система работает и с Web3 входом
- **Auto-connect UX**: Тихое переподключение кошелька на странице cash без popup
- **Security**: Supabase валидирует подписи EIP-4361, backend выдаёт собственный JWT

**Build Status:** API и Web собираются успешно

---

## Phase 11: Other Crypto Deposits (BEP20/TON) (IN PROGRESS - Backend COMPLETED)

**Started:** 2026-01-19
**Концепция:** Ручные депозиты через BEP20 (USDT/BNB) и TON (USDT/TON) с одобрением админа

### Архитектура
```
User → Other Crypto Modal → Backend (pending) → Admin Panel → Approve/Reject → Credit Balance + Referral Bonuses
```

### 11.1 Backend (COMPLETED)
- [x] Prisma schema: добавлены поля для other crypto в модель Deposit
  - otherCryptoNetwork, otherCryptoToken, claimedAmount
  - adminNotes, processedBy, processedAt, rejectionReason
  - Добавлен DepositStatus.rejected
- [x] Constants: other-crypto.ts с конфигурацией BEP20/TON
- [x] DTOs: InitiateOtherCryptoDepositDto, ApproveOtherCryptoDepositDto, RejectOtherCryptoDepositDto
- [x] DepositsService:
  - getOtherCryptoInstructions(network) — получить инструкции и адрес
  - initiateOtherCryptoDeposit(userId, dto) — создать pending депозит
- [x] AdminDepositsService:
  - approveOtherCryptoDeposit() — одобрить с actual amount, конверсия в USD, реферальные бонусы
  - rejectOtherCryptoDeposit() — отклонить с причиной
  - processReferralBonuses() — начисление бонусов 3 уровня (5%, 3%, 1%)
- [x] PriceOracleService: getPrice(ticker) для BNB/TON через CoinGecko API
- [x] Controllers:
  - DepositsController: GET /deposits/other-crypto/instructions/:network, POST /deposits/other-crypto
  - AdminDepositsController: POST /admin/deposits/:id/approve-other-crypto, POST /admin/deposits/:id/reject-other-crypto
- [x] Environment Variables:
  - OTHER_CRYPTO_BEP20_ADDRESS
  - OTHER_CRYPTO_TON_ADDRESS
  - COINGECKO_API_KEY (optional)

### 11.2 Frontend (NOT STARTED)
- [ ] Types: OtherCryptoNetwork, OtherCryptoToken, interfaces
- [ ] API Client: методы в depositsApi и adminDepositsApi
- [ ] Stores: deposits.store.ts, admin-deposits.store.ts
- [ ] OtherCryptoModal.tsx — 4-step wizard (network → token → instructions → confirm)
- [ ] Cash page: кнопка "Other Networks" внизу страницы пополнения
- [ ] Admin DepositDetailModal: UI для approve/reject other crypto депозитов
- [ ] DepositsTable: отображение network/token для other_crypto депозитов
- [ ] Localization: ru.json, en.json

### 11.3 Testing (NOT STARTED)
- [ ] Backend тесты: approveOtherCryptoDeposit, rejectOtherCryptoDeposit
- [ ] E2E flow: create → approve → check balance + referral bonuses

### Особенности
- **Ручная обработка**: Админ проверяет блокчейн вручную через block explorer
- **Конверсия курсов**: USDT 1:1, BNB/TON через CoinGecko API с кэшированием (5 мин TTL)
- **Реферальные бонусы**: Автоматически начисляются при approve (3 уровня)
- **WebSocket уведомления**: Пользователь получает уведомление при approve/reject
- **Audit Log**: Все действия админа логируются

**Build Status:** API собирается успешно, Frontend не начат

---

## Phase 12: Notification System (COMPLETED)

**Goal:** Реализовать полную систему уведомлений с Telegram ботом и in-app notifications

### 12.1 Backend (COMPLETED)
- [x] Prisma schema:
  - User: telegramChatId, telegramNotificationsEnabled, telegramBotConnectedAt
  - Notification model: 12 типов уведомлений (deposits, withdrawals, machines, wheel, referrals)
  - NotificationType enum
- [x] TelegramBotModule:
  - telegram-bot.service.ts — обработка webhook, команды (/start, /help, /notifications, /disconnect)
  - Deep linking: /start connect_USER_ID для подключения бота
  - telegram-bot.controller.ts — POST /telegram-bot/webhook
  - Rate limiting: 25 сообщений, затем пауза 1с
- [x] NotificationsModule:
  - notifications.service.ts — унифицированная отправка (in-app + Telegram)
  - notifications.gateway.ts — WebSocket namespace /notifications
  - notifications.controller.ts — REST API (GET /notifications, POST /notifications/:id/read, POST /notifications/read-all)
  - Multi-channel delivery с error tracking
- [x] Интеграция триггеров:
  - DepositProcessorService: deposit_credited, deposit_rejected
  - AdminWithdrawalsService: withdrawal_approved, withdrawal_completed, withdrawal_rejected
- [x] WebSocket Events:
  - notification:new — новое уведомление
  - notification:read — пометка прочитанным
  - notification:all_read — все прочитаны

### 12.2 Frontend (COMPLETED)
- [x] Types: Notification, NotificationType, GetNotificationsResponse
- [x] API Client (lib/api.ts):
  - getNotifications(token, filters)
  - getUnreadCount(token)
  - markNotificationAsRead(token, notificationId)
  - markAllNotificationsAsRead(token)
- [x] notifications.store.ts (Zustand):
  - fetchNotifications, markAsRead, markAllAsRead
  - addNotification (WebSocket), updateNotificationReadStatus
- [x] useNotificationsSocket.tsx:
  - Подключение к /notifications namespace
  - Обработка events, toast notifications с иконками
  - Интеграция в AuthenticatedLayout
- [x] NotificationBell.tsx:
  - Иконка колокольчика с badge (unread count)
  - Dropdown toggle для NotificationCenter
  - Интеграция в SidebarNavigation
- [x] NotificationCenter.tsx:
  - Dropdown с последними 10 уведомлениями
  - Клик для пометки прочитанным
  - Кнопка "Mark all as read"
  - Relative timestamps (date-fns)
- [x] TelegramConnectionBanner.tsx:
  - Компактный баннер для подключения Telegram бота
  - Deep link кнопка с user.id
  - Dismissable с localStorage
  - Официальный Telegram логотип SVG
  - Отображается в dashboard (не в sidebar для mobile)

### 12.3 Architecture (COMPLETED)
- [x] Deep Linking Flow:
  1. User логинится через Telegram Login Widget → получает telegramId
  2. Banner в dashboard показывает "Connect Telegram Bot"
  3. Deep link: https://t.me/BOT_USERNAME?start=connect_USER_ID
  4. User кликает → отправляет /start connect_USER_ID боту
  5. Bot извлекает USER_ID, обновляет User.telegramChatId
  6. Теперь bot может отправлять сообщения через telegramChatId
- [x] Notification Delivery:
  - In-app: WebSocket gateway → instant UI updates
  - Telegram: Bot API → messages to telegramChatId
  - Error tracking: sentToTelegramAt, telegramError fields
- [x] Module Dependencies:
  - DepositsModule imports NotificationsModule
  - AdminModule imports NotificationsModule

### Особенности
- **Билингва**: Сообщения на EN/RU
- **12 типов уведомлений**: deposits, withdrawals, machines (expired/coin box), referrals, wheel jackpots
- **Multi-channel**: In-app (WebSocket) + Telegram Bot
- **Read status sync**: Синхронизация между клиентами через WebSocket
- **Rate limiting**: Telegram Bot API ограничения (25 msg burst, 1s pause)
- **Deep linking**: Безопасное подключение бота к аккаунту пользователя

**Build Status:** API и Web собираются успешно

---

---

## UI/UX Improvements

### Mobile Optimization - Cash Page (COMPLETED)

**Date:** 2026-01-19
**Goal:** Радикальная оптимизация страницы /cash для мобильных экранов - все ключевые действия без скролла

#### Изменения:
- [x] Компактный хедер с балансом (уменьшены padding и font size)
- [x] Кнопка Wallet Provider перемещена вправо от баланса после подключения
- [x] Сворачиваемый выбор валюты с кнопкой "Изменить" после выбора
- [x] Горизонтальная раскладка QR кода (QR слева, адрес и кнопка справа)
- [x] Информационные блоки перемещены под кнопки вывода (CTA первым, пояснения вторыми):
  - Wallet Connect Withdrawal: Info block под кнопкой
  - Manual Address Withdrawal: Info block под кнопкой
- [x] Упрощены технические описания (более user-friendly формулировки)
- [x] Добавлена локализация "change" / "Изменить"

#### Технические детали:
- Responsive классы: `text-xs md:text-sm`, `p-3 md:p-4`, `w-20 sm:w-28 md:w-32`
- State management: `isCurrencySelected` для collapsible currency selector
- QR layout: `flex gap-3 items-start` для horizontal расположения
- Высота header: сокращена с ~80px до ~50px

**Build Status:** API и Web собираются успешно
**Commit:** e9cc7da

---

## Phase 13: Docker Production & Deployment Scripts (COMPLETED)

**Date:** 2026-02-07
**Goal:** Полная контейнеризация и удобные скрипты для деплоя на сервер

### Сервер
- SSH alias: `kp` (доступ по ключу)
- Project root: `/fortune`
- Домен: `fortune.syntratrade.com`
- Docker уже установлен на сервере

### 13.1 Docker (COMPLETED)
- [x] `apps/api/Dockerfile` — multi-stage build (deps → build-shared → build → runner)
- [x] `apps/web/Dockerfile` — multi-stage build с Next.js standalone output
- [x] `docker-compose.prod.yml` — 4 сервиса: postgres, redis, api, web
- [x] `.dockerignore` — исключения для билда
- [x] `next.config.ts` — добавлен `output: 'standalone'` для production

### 13.2 Nginx & SSL (COMPLETED)
- [x] `nginx/fortune.conf` — reverse proxy с WebSocket support
- [x] API: `/api/*` → `localhost:3001`
- [x] WebSocket: `/socket.io/` → `localhost:3001`
- [x] Frontend: `/` → `localhost:3000`
- [x] SSL через certbot (Let's Encrypt)

### 13.3 Makefile (COMPLETED)
Единая точка входа — все команды через `make`:
- `make sync` — rsync кода на сервер
- `make deploy` — полный деплой (sync + build + restart + db push)
- `make deploy-api` / `make deploy-web` — деплой одного сервиса
- `make logs` / `make logs-api` / `make logs-web` — просмотр логов
- `make status` / `make health` — мониторинг
- `make db-push` / `make db-psql` / `make db-studio` / `make db-backup` — БД
- `make redis-cli` / `make redis-flush` — Redis
- `make ssh` / `make shell-api` — доступ к серверу/контейнерам
- `make nginx-setup` / `make ssl-setup` — настройка nginx и SSL
- `make setup` — первоначальная настройка
- `make help` — справка

### 13.4 Прочее (COMPLETED)
- [x] `scripts/server-setup.sh` — скрипт проверки сервера
- [x] CORS обновлён: добавлен `https://fortune.syntratrade.com`
- [x] `.gitignore`: добавлена папка `backups/`

**Build Status:** API и Web собираются успешно

---

## Phase 14: Conversion Optimization (COMPLETED)

**Date:** 2026-02-07
**Goal:** 5 фич для снижения барьеров и повышения конверсии новичков

### 14.1 Смягчение налога (COMPLETED)
- [x] "Налог 50%" → "Сбор города 50%" с прогрессией к снижению
- [x] Tooltip с шкалой снижения: Ур.3→40%, Ур.5→30%, Ур.7→20%, Ур.10→10%
- [x] Мелким шрифтом "→ {target}% на ур. {targetTier}" под процентом
- [x] Обновлены ключи i18n в ru.json и en.json

### 14.2 Buy Crypto Guide (COMPLETED)
- [x] Кнопка "Купить SOL / USDT" на странице кассы
- [x] BuyCryptoGuideModal с 4 шагами: Phantom, BestChange/Bybit, Transfer, Deposit
- [x] TMA-совместимость: openTelegramLink/openLink

### 14.3 Activity Feed (COMPLETED)
- [x] Backend: ActivityModule (GET /activity/feed, публичный)
  - Собирает из Transaction, Withdrawal, WheelSpin
  - Маскировка username: "An***ey"
  - Seed данные при < 15 реальных записей
- [x] Frontend: ActivityFeed.tsx — marquee бегущая строка, 3 сек цикл
- [x] AnimatePresence fade-анимации

### 14.4 Recent Wins under Wheel (COMPLETED)
- [x] Backend: GET /wheel/recent-wins (публичный)
  - WheelSpin где netResult>0, маскировка, seed данные
- [x] Frontend: RecentWins.tsx — компактный список с золотыми джекпотами
- [x] Интеграция между SpinControls и SpinHistory

### 14.5 Referral Improvements (COMPLETED)
#### 5a: Share Buttons
- [x] Gradient рамка для карточки ссылки
- [x] 3 кнопки: Telegram Share, Twitter/X, Copy
- [x] TMA-совместимость

#### 5b: Milestone Bonuses (Full Backend + Frontend)
- [x] Prisma: ReferralMilestone модель + taxDiscount поле на User
- [x] ReferralMilestonesService: checkProgress, claimMilestone
- [x] Endpoints: GET /referrals/milestones, POST /referrals/milestones/:id/claim
- [x] MachinesService.createFreeMachine() для выдачи бесплатных машин
- [x] taxDiscount учитывается при расчёте налога на вывод
- [x] MilestoneCard.tsx — прогресс-бар, иконки, кнопка claim
- [x] Интеграция в refs page

#### Milestone бонусы:
| Порог | Награда |
|-------|---------|
| 5 активных рефов | Бесплатный Rusty Lever (tier 1) |
| 15 активных рефов | -5% к сбору города навсегда |
| 50 активных рефов | Бесплатный Lucky Cherry (tier 2) |
| 500 активных рефов | VIP статус |

**Build Status:** API и Web собираются успешно

---

## Phase 15: Fame System (IN PROGRESS)

**Started:** 2026-02-07
**Документация:** [docs/fame-system.md](docs/fame-system.md)

### Концепция
Fame (⚡) — мета-валюта, не торгуется, не выводится. Используется для разблокировки тиров и прогресса.

### 15.1 Backend (COMPLETED)
- [x] Prisma: fame, totalFameEarned, loginStreak, lastLoginDate, maxTierUnlocked на User
- [x] Prisma: FameTransaction модель (source, amount, balanceAfter)
- [x] FameModule: balance, history, daily-login, unlock-tier endpoints
- [x] FameService: начисление fame за machine_passive, manual_collect, daily_login, machine_purchase, tier_unlock
- [x] getActiveReferralCount() в ReferralsService для подсчёта активных рефов

### 15.2 Frontend (IN PROGRESS)
- [x] FameBadge, DailyLoginBanner, UnlockTierModal компоненты
- [x] Fame store (Zustand)
- [x] Fame API методы и типы
- [x] FameBadge в MobileHeader
- [ ] Интеграция DailyLoginBanner в layout
- [ ] Интеграция UnlockTierModal в TierCarousel
- [ ] SidebarNavigation обновления

### 15.3 Ежедневные фриспины от рефералов (COMPLETED)
- [x] Cron (`0 0 0 * * *`, полночь UTC) для ежедневного сброса фриспинов
- [x] Формула: `base(1) + activeReferrals × perRef(5)`
- [x] Фриспины сгорают ежедневно (не накапливаются)
- [x] GET /referrals/stats обогащён `freeSpinsInfo` (base, perActiveRef, total, current)
- [x] Карточка "Daily Free Spins" на странице рефералов
- [x] Переводы ru/en

**Build Status:** API и Web собираются успешно

---

## Phase 15: Fame System (Phase 1)

### Описание
Fame (⚡) — расходуемый ресурс прогрессии. Зарабатывается за активность (пассивный доход от машин, ручной сбор, daily login, покупка машин), тратится на unlock тиров. Заменяет авто-unlock тиров при экспирации машины.

### Изменения

**Schema (Prisma):**
- User: +fame, totalFameEarned, loginStreak, lastLoginDate
- Machine: +fameGenerated, lastFameCalculatedAt
- Новая модель FameTransaction + enum FameSource
- SystemSettings: +famePerHourByTier, famePerManualCollect, fameDailyLogin, fameStreakBonus, fameStreakCap, famePurchaseByTier, fameUpgradeMultiplier, fameUnlockCostByTier

**Shared (packages/shared):**
- constants/fame.ts — все константы Fame и хелперы

**Backend:**
- FameModule (fame.service, fame.controller, dto) — earn/spend/balance/history/daily-login/unlock-tier
- MachinesService: collectCoins с isAutoCollect, passive Fame, manual collect Fame
- AutoCollectService: isAutoCollect=true → нет Fame за ручной сбор
- PurchaseService: Fame за покупку (x2 при upgrade)
- AuthService: Fame-поля в /auth/me
- Убран авто-unlock maxTierUnlocked при экспирации машины

**Frontend:**
- Types: FameSource, FameBalance, FameTransaction, FameHistory, DailyLoginResult, UnlockTierResult
- API: getFameBalance, getFameHistory, claimDailyLogin, unlockTier
- Store: fame.store.ts (Zustand)
- Компоненты:
  - FameBadge — ⚡{fame} в header (MobileHeader, SidebarNavigation, page.tsx)
  - DailyLoginBanner — баннер daily login на dashboard
  - UnlockTierModal — модал unlock тира за Fame
- TierCarousel: залоченные тиры показывают стоимость в ⚡, кнопка открывает UnlockTierModal
- Локализация: fame namespace в ru.json/en.json

**Build Status:** API и Web собираются успешно

---

## Phase 15.4: Fame Payment for AutoCollect + Overclock Boost (COMPLETED)

**Date:** 2026-02-08
**Plan:** [replicated-twirling-hummingbird.md](.claude/plans/replicated-twirling-hummingbird.md)

### Концепция
Две новые траты Fame: оплата инкассатора за Fame (альтернатива $5) и покупка Overclock буста (множитель x1.2/x1.5/x2.0 для следующего сбора).

### 15.4.1 AutoCollect — Fame Payment (COMPLETED)
- [x] Schema: FameSource.collector_hire, SystemSettings.collectorHireCostFame
- [x] Shared: COLLECTOR_HIRE_COST_FAME = 700
- [x] AutoCollectService: dual payment (fortune/fame), FameService integration
- [x] Controller: paymentMethod в body POST /machines/:id/purchase-auto-collect
- [x] AutoCollectModal: компактный dual payment (Fortune | Fame) side-by-side
- [x] API, Store, Types обновлены

### 15.4.2 Overclock Boost (COMPLETED)
- [x] Schema: Machine.overclockMultiplier (Decimal 3,1), TransactionType.overclock_purchase, FameSource.overclock_purchase
- [x] Shared: OVERCLOCK_LEVELS, OVERCLOCK_PRICES (10 тиров × 3 уровня × 2 валюты)
- [x] OverclockService: getOverclockInfo, purchaseOverclock (dual payment)
- [x] MachinesService.collectCoins(): overclock multiplier applied + reset
- [x] RiskyCollectService.riskyCollect(): overclock applied before gamble + reset
- [x] Controller: GET /machines/:id/overclock-info, POST /machines/:id/overclock
- [x] OverclockModal: 3 level cards + expandable payment section
- [x] MachineCard: overclock badge (x1.5 etc.) + Boost button
- [x] CasinoFloor: overclock indicator on machine image
- [x] page.tsx: handlers, modal state, integration
- [x] i18n: overclock section в en.json и ru.json

### Overclock Levels
| Level | Bonus | $ Price (% of purchasePrice) | Fame Price (by tier) |
|-------|-------|------------------------------|---------------------|
| x1.2 | +20% | 0.5% | 50-500⚡ |
| x1.5 | +50% | 1.5% | 150-1500⚡ |
| x2.0 | +100% | 4.0% | 400-4000⚡ |

### Edge Cases Handled
- Overclock + expired → blocked
- Overclock stacking → blocked (multiplier > 0 check)
- Overclock + auto-collect → works (applied + reset in collectCoins)
- Overclock + risky collect → works (boost applied before gamble)
- Race conditions → $transaction + WHERE checks

**Build Status:** API и Web собираются успешно

---

## Phase 16: Treasury Vault — Withdrawal PDA (COMPLETED)

**Date:** 2026-02-08
**Plan:** [stateful-chasing-dragonfly.md](.claude/plans/stateful-chasing-dragonfly.md)

### Концепция
Прямой вывод средств через кошелёк пользователя: юзер подключает Solana-кошелёк и забирает USDT напрямую из vault, подписав транзакцию. Прозрачнее и безопаснее — средства идут из on-chain vault прямо в ATA юзера.

### Flow
```
1. Backend (authority) → create_withdrawal(user, amount, expiry) → on-chain PDA создан
2. User (wallet connect) → claim_withdrawal() → USDT из vault → user ATA, PDA закрыт
3. Если юзер не claim-ит → authority → cancel_withdrawal() → PDA закрыт (после expiry)
```

### 16.1 Smart Contract (COMPLETED)
- [x] WithdrawalRequest state (PDA seeds: `[b"withdrawal", vault, user]`)
- [x] Новые ошибки: WithdrawalExpired, WithdrawalNotExpired
- [x] Новые events: WithdrawalCreatedEvent, WithdrawalClaimedEvent, WithdrawalCancelledEvent
- [x] Инструкция `create_withdrawal` — authority создаёт PDA с user, amount, expiry
- [x] Инструкция `claim_withdrawal` — user подписывает, USDT → user ATA, PDA закрыт
- [x] Инструкция `cancel_withdrawal` — authority отменяет только истекшие PDA
- [x] Обновлены lib.rs и mod.rs
- [x] Anchor build: 287 KB

### 16.2 Tests (COMPLETED)
- [x] 10 новых тест-кейсов для withdrawal PDA
- [x] **18/18 тестов пройдено** (localnet, после удаления pause)

### 16.3 Backend Integration (COMPLETED)
- [x] IDL обновлён (`apps/api/src/modules/treasury/idl/treasury_vault.ts`)
- [x] TreasuryService: createWithdrawalRequest, cancelWithdrawalRequest, getWithdrawalRequest, getClaimInfo
- [x] TreasuryController: GET /treasury/claim-info, GET /treasury/withdrawal-request/:userPubkey
- [x] Treasury DTOs: ClaimInfoResponseDto, WithdrawalRequestResponseDto
- [x] WithdrawalsService: переписан prepareAtomicWithdrawal (вместо partially-signed tx → on-chain PDA)
- [x] WithdrawalsService: cancelAtomicWithdrawal защищён от double-spend (проверка expiry PDA)
- [x] WithdrawalsService: cleanupExpiredWithdrawals cron (каждые 5 мин)
- [x] Withdrawal DTOs: обновлён PreparedAtomicWithdrawalResponse (claimInfo + expiresAt)
- [x] `pnpm --filter api build` — компиляция без ошибок

### 16.4 Security Audit (COMPLETED)
- [x] SECURITY_AUDIT.md — переписан в публичный формат (прозрачность, anti-scam, user sovereignty)
- [x] SECURITY_AUDIT_RU.md — русская версия

### Защита от double-spend
- Cancel только после expiry PDA (юзер не может cancel + claim одновременно)
- Cleanup cron для истекших PDA с rollback баланса
- `close = authority` на PDA ставит CLOSED_ACCOUNT_DISCRIMINATOR (нет revival)

### 16.5 Удаление set_paused (COMPLETED)
- [x] Удалён set_paused из контракта (state, errors, events, instructions, lib.rs)
- [x] Удалён set_paused.rs
- [x] Обновлены тесты (убраны 8 pause тестов)
- [x] Обновлён IDL на бэкенде (инструкция, ошибка, event, field)
- [x] Обновлён бэкенд (TreasuryService, DTOs — убрано поле paused)
- [x] Обновлены security audit docs (EN + RU)
- [x] Контракт: 6 инструкций, 18/18 тестов, API build OK

### 16.6 Devnet Deploy & Testing (TODO)
- [ ] Deploy контракта на devnet
- [ ] E2E тесты на devnet: initialize → deposit → create_withdrawal → claim → cancel
- [ ] Проверить binary size после удаления pause

### 16.7 Frontend Claim Integration (COMPLETED)
- [x] Обновлён `PreparedAtomicWithdrawalData` тип — `claimInfo` вместо `serializedTransaction`
- [x] Добавлена `buildClaimWithdrawalInstruction()` — строит claim_withdrawal TX на фронте
- [x] Обновлён `handleAtomicWithdrawal` — user подписывает claim через `sendTransaction`
- [x] Discriminator из IDL: `[118, 206, 173, 38, 239, 165, 65, 30]`
- [x] Accounts: user(signer), authority, vault, withdrawal_request, usdt_mint, vault_token_account, user_token_account, token_program, associated_token_program, system_program
- [x] Web lint OK, web build OK, API build OK

### 16.8 Admin Balance Monitoring (TODO)
- [ ] Endpoint `GET /admin/deposits/addresses` — список HD-адресов с балансами (SOL, USDT, FORTUNE)
- [ ] Endpoint `GET /admin/deposits/hot-wallet-balance` — баланс hot wallet
- [ ] UI таблица в админке — адрес, юзер, балансы, lastSweptAt, статус
- [ ] Алерт при застрявших средствах (баланс > порога && lastSweptAt > 30 мин)

**Build Status:** API + Web собираются успешно

---

## Phase 17: Pre-Launch Marketing System (COMPLETED)

**Date:** 2026-02-08
**Документация:** [docs/prelaunch.md](docs/prelaunch.md)

### Концепция
14-дневный предстарт перед официальным запуском. 5 механик:
1. **OG Status** — бейдж + золотое кольцо аватарки для ранних юзеров
2. **Тиры 1-3 открыты** — maxGlobalTier=3 в SystemSettings (zero code, уже работает)
3. **Frozen Machines** — купленные автоматы заморожены до запуска (не генерируют доход)
4. **Daily Fame Streak** — ежедневные логины накапливают Fame (уже работает)
5. **Free Spins → Bonus Fortune** — выигрыши колеса идут в bonusFortune (дисконт на покупки)

### 17.1 Schema (COMPLETED)
- [x] User: bonusFortune Decimal @default(0), isOG Boolean @default(false)
- [x] SystemSettings: isPrelaunch Boolean @default(false), prelaunchEndsAt DateTime?
- [x] MachineStatus: +frozen

### 17.2 Backend (COMPLETED)
- [x] SettingsService: isPrelaunch(), getPrelaunchEndsAt()
- [x] WithdrawalsService: блокировка вывода при prelaunch
- [x] MachinesService: create/createFreeMachine → status='frozen' при prelaunch
- [x] WheelService: spin payouts → bonusFortune при prelaunch (cost из fortuneBalance)
- [x] PurchaseService: баланс = bonusFortune + fortuneBalance + referralBalance
  - Приоритет списания: bonusFortune → fortuneBalance → referralBalance
  - canAffordTier: +bonusFortune в ответ
  - Проверка дубликатов: frozen тоже считается (status IN active, frozen)
- [x] UsersService: isOG=true при регистрации во время prelaunch (все 3 метода)
- [x] AuthController /me: +bonusFortune, isOG, isPrelaunch, prelaunchEndsAt
- [x] Admin: POST /admin/settings/end-prelaunch
  - isPrelaunch=false, maxGlobalTier=1
  - Все frozen → active (пересчёт startedAt/expiresAt/lastCalculatedAt)
- [x] DTO: UpdateAllSettingsDto + SettingsResponse обновлены

### 17.3 Frontend (COMPLETED)
- [x] Types: UserData +bonusFortune/isOG/isPrelaunch/prelaunchEndsAt, MachineStatus +'frozen', CanAffordResponse +bonusFortune
- [x] SidebarNavigation: OG gold ring + bonusFortune balance display
- [x] MobileHeader: OG gold ring + bonusFortune display
- [x] ProfileModal: OG gold gradient avatar + OG badge
- [x] MachineCard: frozen status (ice-blue border, frozen badge, disabled collect/boost)
- [x] Cash page: prelaunch lock banner + disabled withdraw buttons
- [x] PurchaseModal: bonusFortune в breakdown
- [x] i18n: frozen, frozenHint, frozenDescription, withdrawalsLocked, withdrawalsLockedDesc, launchDate, bonus, bonusFortune, bonusBalance (en + ru)

### Ключевые решения
- Реферальные бонусы НЕ замораживаются (работают нормально)
- bonusFortune НЕ выводится (только на покупки)
- bonusFortune НЕ является свежим депозитом (без реф. бонусов при покупке)
- При end-prelaunch: frozen → active с пересчётом таймеров

**Build Status:** API и Web собираются успешно

---

## Notes

- Используем существующие паттерны из auth, machines, economy модулей
- JwtAuthGuard как референс для AdminGuard
- Zustand stores как референс для admin stores

