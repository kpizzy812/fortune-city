# Fortune City - Progress Tracker

## Current Task: Admin Panel Implementation

**Started:** 2026-01-15
**Plan:** [docs/ADMIN_PANEL_PLAN.md](docs/ADMIN_PANEL_PLAN.md)

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

## Phase 4: Управление пользователями (PENDING)

- [ ] Список с фильтрами
- [ ] Детальный просмотр
- [ ] Бан/анбан функционал
- [ ] Реферальное дерево (3 уровня)

---

## Phase 5: Финансы и аудит (PENDING)

- [ ] Управление выводами (approve/reject)
- [ ] Управление депозитами
- [ ] Audit log UI
- [ ] Dashboard статистика с графиками

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
