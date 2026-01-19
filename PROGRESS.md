# Fortune City - Progress Tracker

## Current Task: Колесо Фортуны (Wheel of Fortune)

**Started:** 2026-01-18
**Plan:** Phase 8 в этом документе + [docs/concept.md](docs/concept.md)

### Предыдущая задача: Admin Panel (COMPLETED)

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

## Notes

- Используем существующие паттерны из auth, machines, economy модулей
- JwtAuthGuard как референс для AdminGuard
- Zustand stores как референс для admin stores

## Credentials (Development)

```
Admin Login: /admin/login
Username: admin
Password: FortuneCity2024!
```
