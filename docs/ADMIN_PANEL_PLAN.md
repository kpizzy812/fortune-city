# План: Админ-панель Fortune City

## Обзор
Полнофункциональная админ-панель для управления платформой Fortune City с конфигурацией всех параметров системы.

## Требования
- **Аутентификация:** user/pass из .env (без 2FA, без email)
- **Расположение:** `/admin/*` роуты в apps/web
- **Конфигурация:** Полный контроль над всеми переменными системы

---

## Ключевые функции

### 1. Управление пользователями
- Список с поиском/фильтрами
- Просмотр детальной информации (баланс, машины, транзакции)
- **Бан/анбан** пользователей
- Редактирование данных (баланс, налоговая ставка)
- **Просмотр реферальной сети** (дерево рефералов, 3 уровня)

### 2. Управление тарифами (НОВОЕ)
- **Добавление кастомных тарифов** (tier 11, 12, ...)
- **Редактирование существующих** (цена, доходность, срок)
- **Скрытие/отображение** тарифов (isVisible)
- **Доступность без прогрессии** (isPubliclyAvailable)
- Порядок отображения (sortOrder)

### 3. Глобальные настройки экономики
- **minDepositAmount** - минимальный депозит по валютам
- **minWithdrawalAmount** - минимальный вывод
- **walletConnectFee** - комиссия за вывод через Wallet Connect (SOL)
- **globalTaxRates** - налоговые ставки по тирам
- **referralRates** - реферальные % по уровням
- **reinvestReduction** - штрафы за реинвест
- **pawnshopCommission** - комиссия ломбарда
- **auctionCommissions** - комиссии аукциона по wear%
- **gambleMultipliers** - множители Fortune's Gamble
- **coinBoxLevels** - уровни Coin Box
- **autoCollectCostPercent** - стоимость Auto Collect

### 4. Системная конфигурация
- **Solana адреса** (hot wallet, payout wallet)
- **API ключи** (Helius, Telegram Bot Token)
- **RPC URL**
- **Fortune Mint Address**
- Отображение текущих значений из .env

### 5. Финансы
- Список депозитов (статус, ручное зачисление)
- Список выводов (approve/reject)
- История транзакций

### 6. Статистика
- Dashboard с основными метриками
- Графики (пользователи, объёмы, машины)
- Экспорт данных

---

## Архитектура

### Backend (NestJS)

#### Новые/расширенные модели Prisma

```prisma
// ============== TIER CONFIG (НОВОЕ) ==============
// Заменяет захардкоженный MACHINE_TIERS

model TierConfig {
  id              String   @id @default(cuid())
  tier            Int      @unique
  name            String                          // "RUSTY LEVER"
  emoji           String                          // "🟤"
  price           Decimal  @db.Decimal(20, 2)     // 10
  lifespanDays    Int      @map("lifespan_days")  // 7
  yieldPercent    Int      @map("yield_percent")  // 135
  imageUrl        String?  @map("image_url")

  // Новые поля для админки
  isVisible       Boolean  @default(true)         // Показывать в магазине
  isPubliclyAvailable Boolean @default(false)     // Доступен без прогрессии
  sortOrder       Int      @default(0)            // Порядок отображения

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("tier_configs")
}

// ============== SYSTEM SETTINGS (РАСШИРЕННОЕ) ==============

model SystemSettings {
  id              String @id @default("default")

  // Доступность тиров
  maxGlobalTier   Int    @default(1)              // Макс тир для покупки без прогрессии

  // Минимальные суммы (JSON для разных валют)
  minDepositAmounts   Json @default("{\"SOL\":0.01,\"USDT_SOL\":1,\"FORTUNE\":10}")
  minWithdrawalAmount Decimal @default(5) @db.Decimal(20, 2)

  // Комиссии
  walletConnectFeeSol Decimal @default(0.003) @db.Decimal(10, 6)  // SOL fee
  pawnshopCommission  Decimal @default(0.10) @db.Decimal(5, 4)    // 10%

  // Налоги (JSON: {tierNumber: rate})
  taxRatesByTier      Json @default("{\"1\":0.5,\"2\":0.5,\"3\":0.4,\"4\":0.4,\"5\":0.3,\"6\":0.3,\"7\":0.2,\"8\":0.2,\"9\":0.2,\"10\":0.1}")

  // Рефералы (JSON: {level: rate})
  referralRates       Json @default("{\"1\":0.05,\"2\":0.03,\"3\":0.01}")

  // Реинвест штрафы (JSON: {round: rate})
  reinvestReduction   Json @default("{\"1\":0,\"2\":0.05,\"3\":0.10,\"4\":0.15,\"5\":0.23,\"6\":0.33,\"7\":0.45,\"8\":0.58,\"9\":0.70,\"10\":0.80,\"11\":0.85}")

  // Аукцион комиссии (JSON: {wearPercent: commission})
  auctionCommissions  Json @default("{\"20\":0.10,\"40\":0.20,\"60\":0.35,\"80\":0.55,\"100\":0.75}")

  // Early sell комиссии (JSON: {progressPercent: commission})
  earlySellCommissions Json @default("{\"20\":0.20,\"40\":0.35,\"60\":0.55,\"80\":0.75,\"100\":0.90}")

  // Fortune's Gamble
  gambleWinMultiplier  Decimal @default(2.0) @db.Decimal(5, 2)
  gambleLoseMultiplier Decimal @default(0.5) @db.Decimal(5, 2)
  gambleLevels         Json @default("[{\"level\":0,\"winChance\":0.1333,\"costPercent\":0},{\"level\":1,\"winChance\":0.1533,\"costPercent\":3},{\"level\":2,\"winChance\":0.1733,\"costPercent\":6},{\"level\":3,\"winChance\":0.1867,\"costPercent\":10}]")

  // Coin Box
  coinBoxLevels        Json @default("[{\"level\":1,\"capacityHours\":2,\"costPercent\":0},{\"level\":2,\"capacityHours\":6,\"costPercent\":5},{\"level\":3,\"capacityHours\":12,\"costPercent\":10},{\"level\":4,\"capacityHours\":24,\"costPercent\":20},{\"level\":5,\"capacityHours\":48,\"costPercent\":35}]")

  // Auto Collect
  autoCollectCostPercent Int @default(15)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("system_settings")
}

// ============== USER (ДОПОЛНЕНИЕ) ==============
// Добавить поле для бана

model User {
  // ... существующие поля ...

  isBanned        Boolean  @default(false)
  bannedAt        DateTime?
  bannedReason    String?

  // ...
}

// ============== AUDIT LOG ==============

model AuditLog {
  id          String   @id @default(cuid())
  adminAction String   @map("admin_action")    // "user_banned", "settings_updated", etc
  resource    String                           // "user", "tier", "settings"
  resourceId  String?  @map("resource_id")
  oldValue    Json?    @map("old_value")
  newValue    Json?    @map("new_value")
  ipAddress   String?  @map("ip_address")
  createdAt   DateTime @default(now())

  @@index([adminAction])
  @@index([createdAt])
  @@map("audit_logs")
}
```

#### Структура модулей

```
apps/api/src/modules/admin/
├── admin.module.ts
├── admin-auth/
│   ├── admin-auth.controller.ts     # POST /admin/auth/login
│   ├── admin-auth.service.ts        # Простая проверка ADMIN_USER/ADMIN_PASS из .env
│   └── guards/admin.guard.ts        # JWT guard
├── admin-users/
│   ├── admin-users.controller.ts    # GET/POST /admin/users/*
│   ├── admin-users.service.ts
│   └── dto/
│       ├── ban-user.dto.ts
│       └── update-user.dto.ts
├── admin-tiers/
│   ├── admin-tiers.controller.ts    # CRUD /admin/tiers/*
│   └── admin-tiers.service.ts
├── admin-settings/
│   ├── admin-settings.controller.ts # GET/PUT /admin/settings/*
│   └── admin-settings.service.ts
├── admin-deposits/
│   └── ...
├── admin-withdrawals/
│   └── ...
├── admin-analytics/
│   └── ...
└── admin-audit/
    └── ...
```

#### API Endpoints

**Аутентификация (простая):**
```
POST /admin/auth/login
Body: { username: string, password: string }
Response: { accessToken: string }
// Проверяет против ADMIN_USER и ADMIN_PASS из .env
```

**Пользователи:**
```
GET  /admin/users                    # Список с фильтрами
GET  /admin/users/:id                # Детали + машины + транзакции
GET  /admin/users/:id/referrals      # Реферальная сеть (дерево 3 уровня)
POST /admin/users/:id/ban            # Забанить
POST /admin/users/:id/unban          # Разбанить
PUT  /admin/users/:id                # Обновить данные (баланс, etc)
```

**Тарифы:**
```
GET    /admin/tiers                  # Все тиры (включая скрытые)
GET    /admin/tiers/:tier            # Один тир
POST   /admin/tiers                  # Создать новый тир
PUT    /admin/tiers/:tier            # Обновить тир
DELETE /admin/tiers/:tier            # Удалить (soft delete)
PUT    /admin/tiers/:tier/visibility # Показать/скрыть
PUT    /admin/tiers/:tier/availability # Сделать публичным/приватным
```

**Настройки:**
```
GET  /admin/settings                 # Все настройки
PUT  /admin/settings                 # Обновить настройки
GET  /admin/settings/env             # Показать .env переменные (readonly)
```

**Выводы:**
```
GET  /admin/withdrawals              # Список
POST /admin/withdrawals/:id/approve  # Одобрить
POST /admin/withdrawals/:id/reject   # Отклонить
```

---

### Frontend (Next.js)

#### Структура роутов

```
apps/web/src/app/admin/
├── layout.tsx                       # Отдельный layout
├── page.tsx                         # → /admin/dashboard
├── login/page.tsx                   # Форма входа
├── dashboard/page.tsx               # Обзорный дашборд
├── users/
│   ├── page.tsx                     # Список пользователей
│   └── [id]/
│       ├── page.tsx                 # Детали пользователя
│       └── referrals/page.tsx       # Реферальная сеть
├── tiers/
│   ├── page.tsx                     # Список тарифов
│   ├── new/page.tsx                 # Создать тариф
│   └── [tier]/page.tsx              # Редактировать тариф
├── settings/
│   ├── page.tsx                     # Общие настройки
│   ├── economy/page.tsx             # Экономика (налоги, комиссии)
│   ├── deposits/page.tsx            # Настройки депозитов
│   ├── withdrawals/page.tsx         # Настройки выводов
│   └── system/page.tsx              # Системные (.env readonly)
├── withdrawals/page.tsx             # Управление выводами
├── deposits/page.tsx                # Управление депозитами
└── audit/page.tsx                   # Журнал действий
```

#### Компоненты

```
apps/web/src/components/admin/
├── layout/
│   ├── AdminLayout.tsx
│   ├── AdminSidebar.tsx
│   └── AdminHeader.tsx
├── users/
│   ├── UsersTable.tsx
│   ├── UserDetails.tsx
│   ├── BanUserModal.tsx
│   ├── EditBalanceModal.tsx
│   └── ReferralTree.tsx             # Визуализация сети рефералов
├── tiers/
│   ├── TiersTable.tsx
│   ├── TierForm.tsx                 # Создание/редактирование
│   └── TierVisibilityToggle.tsx
├── settings/
│   ├── EconomySettingsForm.tsx
│   ├── DepositSettingsForm.tsx
│   ├── WithdrawalSettingsForm.tsx
│   └── SystemEnvDisplay.tsx         # Readonly отображение .env
├── withdrawals/
│   ├── WithdrawalsTable.tsx
│   └── ApproveRejectModal.tsx
└── common/
    ├── DataTable.tsx
    ├── StatCard.tsx
    └── JsonEditor.tsx               # Для редактирования JSON полей
```

#### Stores (Zustand)

```
apps/web/src/stores/admin/
├── admin-auth.store.ts
├── admin-users.store.ts
├── admin-tiers.store.ts
├── admin-settings.store.ts
├── admin-withdrawals.store.ts
└── admin-deposits.store.ts
```

---

## Переменные окружения (новые)

```env
# Admin Panel
ADMIN_USER=admin
ADMIN_PASS=supersecretpassword123
ADMIN_JWT_SECRET=admin_jwt_secret_key
```

---

## Миграция данных

При первом запуске нужно:
1. Мигрировать MACHINE_TIERS из константы в таблицу TierConfig
2. Мигрировать все константы в SystemSettings
3. Сервисы должны читать из БД вместо констант

**Seed скрипт:**
```typescript
// prisma/seed-admin.ts
async function seedTiers() {
  const existingTiers = await prisma.tierConfig.count();
  if (existingTiers > 0) return;

  await prisma.tierConfig.createMany({
    data: MACHINE_TIERS.map(t => ({
      tier: t.tier,
      name: t.name,
      emoji: t.emoji,
      price: t.price,
      lifespanDays: t.lifespanDays,
      yieldPercent: t.yieldPercent,
      imageUrl: t.imageUrl,
      isVisible: true,
      isPubliclyAvailable: t.tier === 1, // Только 1 тир изначально доступен
      sortOrder: t.tier,
    })),
  });
}
```

---

## План имплементации

### Phase 1: Основа
1. Добавить Prisma модели (TierConfig, расширить SystemSettings, AuditLog)
2. Создать миграцию и seed скрипт
3. Простая аутентификация админа (user/pass из .env)
4. AdminLayout + login page
5. Базовый dashboard

### Phase 2: Управление тарифами
1. CRUD для TierConfig
2. UI для создания/редактирования тарифов
3. Visibility и availability toggles
4. Обновить MachinesService читать из БД

### Phase 3: Настройки экономики
1. UI для всех настроек SystemSettings
2. JSON редактор для комплексных полей
3. Обновить сервисы читать настройки из БД
4. Кэширование настроек в Redis

### Phase 4: Управление пользователями
1. Список с фильтрами и поиском
2. Детальный просмотр пользователя
3. Бан/анбан функционал
4. Визуализация реферальной сети (дерево)

### Phase 5: Финансы и аудит
1. Управление выводами (approve/reject)
2. Управление депозитами
3. Audit log для всех действий
4. Dashboard статистика

---

## Критические файлы для модификации

**Backend:**
- `apps/api/prisma/schema.prisma` - новые модели
- `apps/api/src/app.module.ts` - подключить AdminModule
- `apps/api/src/modules/machines/machines.service.ts` - читать тиры из БД
- `apps/api/src/modules/economy/economy.service.ts` - читать настройки из БД
- `packages/shared/src/constants/tiers.ts` - пометить как deprecated

**Frontend:**
- `apps/web/src/app/admin/layout.tsx` - новый layout
- `apps/web/src/middleware.ts` - защита /admin/* роутов

---

## Верификация

1. **Login:** Админ входит с user/pass из .env
2. **Tiers:** Можно создать tier 11, скрыть tier 10, сделать tier 3 публичным
3. **Settings:** Изменение minDeposit отражается в /deposits/rates
4. **Users:** Бан пользователя блокирует его авторизацию
5. **Referrals:** Реферальное дерево показывает 3 уровня связей
6. **Audit:** Все действия записываются в audit_logs

**Команды:**
```bash
cd apps/api && pnpm prisma migrate dev
cd apps/api && pnpm prisma db seed
cd apps/api && pnpm test && pnpm build
cd apps/web && pnpm lint && pnpm build
```
