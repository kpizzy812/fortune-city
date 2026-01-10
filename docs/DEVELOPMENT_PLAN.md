# Fortune City - План разработки

## Обзор проекта

**Fortune City** - геймифицированный пресейл с механикой idle-тайкуна в стиле ретро-Vegas 80s.

**Платформы**:
- **Web (основная)** — полноценный веб-интерфейс, доступный всем
- **Telegram Mini App (дополнение)** — для удобства пользователей Telegram

**Авторизация**: Telegram Login Widget (для обеих платформ)
**Депозиты**: USDT мультичейн (SOL, BEP-20, TON, TRC-20)
**Команда**: Минимальная (разработчик + архитектор)

---

## Рекомендуемый технологический стек

### Frontend
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Фреймворк | **Next.js 16+** | SSR, Turbopack, улучшенный кэшинг, PWA |
| UI | **React 19 + Tailwind CSS** | Server Components, Actions, synthwave-эстетика |
| Состояние | **Zustand** | Легковесный, простой для real-time |
| Real-time | **Socket.io Client** | Обновления дохода, уведомления |
| Анимации | **Framer Motion** | Slot машины, неоновые эффекты |

#### Telegram интеграция
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| UI Kit | **@telegram-apps/telegram-ui** | Готовые компоненты в стиле Telegram |
| TG API хуки | **@vkruglikov/react-telegram-web-app** | Простые хуки: MainButton, BackButton, HapticFeedback |
| Валидация initData | **@tma.js/init-data-node** (backend) | Безопасная проверка данных от Telegram |

> **Примечание**: `@telegram-apps/sdk-react` — низкоуровневая библиотека, заменена на более простые решения.

### Backend
| Компонент | Технология | Обоснование |
|-----------|------------|-------------|
| Runtime | **Node.js + TypeScript** | Типобезопасность для финансовой логики |
| Фреймворк | **NestJS** | Модульность, WebSocket, guards |
| БД | **PostgreSQL** | Транзакции, сложные связи |
| Кэш/Очереди | **Redis** | Сессии, real-time счётчики, очереди |
| ORM | **Prisma** | Type-safe, миграции |
| Очереди задач | **BullMQ** | Background jobs |
| TG Auth | **@tma.js/init-data-node** | Валидация initData от Telegram Mini App |

### Мультичейн инфраструктура
| Сеть | Для депозитов | Для вывода |
|------|---------------|------------|
| TON | USDT (Jetton) | USDT (Jetton) |
| BNB Chain | USDT BEP-20 | USDT BEP-20 |
| Solana | USDT (SPL Token) | USDT (SPL Token) |
| Tron | USDT TRC-20 | USDT TRC-20 |

---

## Архитектура системы

```
┌──────────────────────────────────────────────────────────────┐
│                      КЛИЕНТЫ                                  │
│  ┌─────────────────┐     ┌─────────────────┐                 │
│  │   Web (основн.) │     │ Telegram Mini   │                 │
│  │   (Next.js)     │     │  App (доп.)     │                 │
│  └────────┬────────┘     └────────┬────────┘                 │
│           │                       │                          │
│  Telegram Login Widget    initData validation                │
│           └──────────┬───────────┘                           │
└──────────────────────┼───────────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────────┐
│                 NestJS Backend                                │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  REST API  │  WebSocket Gateway  │  BullMQ Workers    │   │
│  └───────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Auth  │  Machines  │  Economy  │  Referral  │ Wheel  │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────┼───────────────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────────────┐
│                  Data Layer                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │ PostgreSQL  │  │    Redis    │  │ Chain Watchers      │   │
│  │ (основная)  │  │ (кэш/jobs)  │  │ (TON/SOL/BSC/TRX)   │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Авторизация через Telegram

**Web-версия**: Telegram Login Widget
```
Пользователь → Кнопка "Войти через Telegram" → Telegram OAuth
→ Callback с данными пользователя → JWT токен
```

**Telegram Mini App**: initData validation
```
Mini App открывается → window.Telegram.WebApp.initData
→ Backend валидирует через @tma.js/init-data-node → JWT токен
```

Оба способа создают одного пользователя по telegram_id.

---

## Схема базы данных (ключевые таблицы)

### users
```sql
- id, telegram_id, wallet_addresses (jsonb)
- max_tier_reached, current_tax_rate
- fortune_balance, usdt_balance
- referral_code, referred_by_id
- free_spins_remaining
```

### machines
```sql
- id, user_id, tier
- purchase_price, total_yield, profit_amount
- service_life_days, started_at, expires_at
- rate_per_second, accumulated_income
- profit_paid_out, principal_paid_out
- reinvest_round, profit_reduction_rate
- coin_box_level, coin_box_current
- status (active/expired/sold_early)
```

### fund_sources (критично для корректного налогообложения)
```sql
- id, machine_id
- fresh_usdt_amount (чистые депозиты)
- profit_derived_amount (из прибыли)
- source_machine_ids[]
```

### transactions
```sql
- id, user_id, machine_id
- type, amount, currency
- tax_amount, tax_rate, net_amount
- from_fresh_usdt, from_profit
- chain, tx_hash, status
```

### deposit_addresses
```sql
- id, user_id
- chain (ton/sol/bsc/tron)
- address, created_at
- is_active
```

---

## Фазы разработки

### Phase 1: MVP Foundation (4-6 недель)

**Цель**: Работающий игровой цикл с базовыми депозитами

**Неделя 1-2: Инфраструктура**
- [ ] Настройка монорепозитория (frontend + backend)
- [ ] NestJS backend с TypeScript
- [ ] PostgreSQL + Prisma схема
- [ ] Redis для сессий и кэша
- [ ] Next.js frontend с Tailwind
- [ ] Telegram Mini App интеграция
- [ ] Docker Compose для разработки

**Неделя 3-4: Core Game Loop**
- [ ] Аутентификация через Telegram
- [ ] Тиры 1-3 машин
- [ ] Покупка машин
- [ ] Real-time расчёт дохода (on-demand)
- [ ] Сбор монет (Coin Box)
- [ ] Истечение срока машин

**Неделя 5-6: Экономика базовая**
- [ ] Балансы FORTUNE/USDT
- [ ] Базовый UI в synthwave стиле
- [ ] История транзакций
- [ ] Staging deployment

**Deliverables MVP**:
- Telegram Mini App работает
- Можно "купить" машины (без реальных депозитов)
- Доход генерируется и собирается
- Машины истекают
- Базовый UI

---

### Phase 2: Полный функционал (4-6 недель)

**Неделя 7-8: Все тиры + механики**
- [ ] Тиры 4-10
- [ ] Реинвест штраф (урезание прибыли)
- [ ] Порядок выплат (прибыль → тело)
- [ ] Отслеживание источников средств
- [ ] Досрочный вывод с комиссией

**Неделя 9-10: Апгрейды + Рефералы**
- [ ] Апгрейды Coin Box (5 уровней)
- [ ] Auto Collect модуль
- [ ] 3-уровневая реферальная система
- [ ] Реферальные бонусы
- [ ] Push-уведомления

**Неделя 11-12: Wheel of Fortune**
- [ ] UI колеса с анимациями
- [ ] Система призов
- [ ] Jackpot pool
- [ ] Буфы временные (+5%/+10%/+20%)
- [ ] Бесплатные спины

---

### Phase 3: Интеграция депозитов (2-3 недели)

**Примечание**: Используем готовую реализацию мониторинга и автозачисления из существующего проекта.

**Неделя 13-14: Интеграция существующей системы**
- [ ] Адаптация существующего deposit watcher под Fortune City
- [ ] Интеграция с БД Fortune City (user balances)
- [ ] Unified deposit flow для всех сетей
- [ ] Тестирование на всех сетях (TON/SOL/BSC/TRX)

**Неделя 15: Выводы**
- [ ] Реализация withdrawal flow
- [ ] Подтверждение через Telegram
- [ ] Лимиты и задержки безопасности

---

### Phase 4: Engagement + Launch (3-4 недели)

**Неделя 18-19: Social features**
- [ ] Лидерборд
- [ ] Достижения
- [ ] Ежедневные задания

**Неделя 20-21: Season + Token**
- [ ] Сезонная механика
- [ ] Аллокация токенов
- [ ] Security audit
- [ ] Production deployment

---

## Критические файлы для реализации

### Backend
1. `backend/src/modules/machines/services/income-calculator.service.ts`
   - On-demand расчёт дохода
   - Формула: income = rate_per_second × elapsed_seconds

2. `backend/src/modules/economy/services/fund-source-tracker.service.ts`
   - Отслеживание fresh USDT vs profit-derived
   - Критично для корректного налогообложения

3. `backend/src/modules/blockchain/services/deposit-watcher.service.ts`
   - Мониторинг депозитов по всем сетям
   - Подтверждение транзакций

4. `backend/src/modules/machines/services/machine-lifecycle.service.ts`
   - Покупка, истечение, досрочный вывод
   - Расчёт штрафов

### Frontend
1. `frontend/src/hooks/useMachineIncome.ts`
   - Client-side интерполяция дохода
   - Плавное отображение без нагрузки на сервер

2. `frontend/src/components/SlotMachine/`
   - Визуал машин по тирам
   - Анимации, неоновые эффекты

3. `frontend/src/app/telegram/`
   - Telegram Mini App специфичный код
   - TWA SDK интеграция

---

## Архитектура мультичейн депозитов

```
Пользователь хочет пополнить
           │
           ▼
┌─────────────────────────────────────────┐
│  Выбор сети (TON/SOL/BSC/TRON)         │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Генерация уникального адреса           │
│  (или показ существующего)              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Chain Watcher мониторит адрес          │
│  ├─ TON: tonweb / ton-api               │
│  ├─ SOL: @solana/web3.js                │
│  ├─ BSC: ethers.js                      │
│  └─ TRX: tronweb                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Транзакция обнаружена                  │
│  → Ждём подтверждений                   │
│  → Зачисляем USDT на баланс             │
│  → Создаём transaction record           │
└─────────────────────────────────────────┘
```

---

## Real-time доход: подход

**Проблема**: Нельзя писать в БД каждую секунду для 1000+ машин.

**Решение**: On-demand calculation + client interpolation

```typescript
// Backend: при запросе
function calculateIncome(machine) {
  const elapsed = (now - machine.lastCalcAt) / 1000;
  const gross = machine.ratePerSecond * elapsed;
  const capped = Math.min(machine.accumulated + gross, coinBoxCapacity);
  return capped;
}

// Frontend: интерполяция
function useMachineIncome(machine) {
  const [display, setDisplay] = useState(machine.accumulated);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplay(prev => {
        const newValue = prev + machine.ratePerSecond;
        return Math.min(newValue, coinBoxCapacity);
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [machine]);

  return display;
}

// Синхронизация каждые 30 сек через WebSocket
```

---

## Безопасность

1. **Финансовая безопасность**
   - Double-entry accounting для всех операций
   - Atomic transactions в PostgreSQL
   - Ежедневная сверка балансов

2. **Депозиты**
   - Уникальные адреса на пользователя
   - Минимум 3-6 подтверждений
   - Rate limiting на генерацию адресов

3. **Выводы**
   - Задержка 24ч для крупных сумм
   - Telegram 2FA подтверждение
   - Дневные лимиты по тиру

4. **API**
   - Rate limiting
   - Input validation (class-validator)
   - JWT с коротким TTL

---

## Приоритеты для старта

**Начинаем с**:
1. Telegram Mini App scaffold + auth
2. Базовая схема БД (users, machines, transactions)
3. Покупка и lifecycle машин (без реальных денег)
4. Real-time доход в UI
5. Базовый synthwave дизайн

**Откладываем**:
- Мультичейн депозиты (Phase 3)
- Wheel of Fortune (Phase 2)
- Сезонные механики (Phase 4)

---

## Верификация

**Как тестировать**:
1. Telegram Bot + Mini App в тестовом режиме
2. Unit тесты для income-calculator, fund-tracker
3. Integration тесты для machine lifecycle
4. E2E: покупка → доход → сбор → истечение
5. Load testing для real-time компонентов

---

## Следующий шаг

Готов начать реализацию с Phase 1:
1. Создание структуры монорепозитория
2. Настройка NestJS backend
3. Prisma схема базы данных
4. Next.js frontend с Telegram Mini App SDK
