# Treasury Vault — Аудит безопасности

**Контракт:** Fortune City Treasury Vault
**Фреймворк:** Anchor 0.31.1 (Solana)
**Проведён:** Внутренний аудит
**Дата:** Февраль 2025 (обновлено: withdrawal PDA)
**Размер бинарника:** 287 KB
**Program ID (devnet):** `9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD`

---

## 1. Обзор архитектуры

Treasury Vault — это Solana-программа, выступающая прозрачным on-chain хранилищем для USDT (SPL Token). У контракта единственный authority (hot wallet) и зашитый адрес получателя выплат.

**Инструкции:** `initialize`, `deposit`, `payout`, `set_paused`, `create_withdrawal`, `claim_withdrawal`, `cancel_withdrawal`
**Стейт:** `TreasuryVault` PDA (на authority) + `WithdrawalRequest` PDA (на юзера на vault)
**Стандарт токенов:** SPL Token Interface (совместимость с Token и Token-2022)

### Движение средств

```
Депозит:      Authority Wallet --[deposit]--> Vault PDA Token Account
Выплата:      Vault PDA Token Account --[payout]--> Payout Wallet ATA  (бэкенд инициирует)
Вывод юзером: Authority --[create_withdrawal]--> PDA создан
              User --[claim_withdrawal]--> Vault → User ATA, PDA закрыт  (юзер подписывает)
              Authority --[cancel_withdrawal]--> PDA закрыт (только после expiry)
```

---

## 2. Контроль доступа

| Инструкция              | Кто может вызвать     | Механизм контроля                              |
|------------------------|----------------------|-------------------------------------------------|
| `initialize`           | Любой (однократно)    | PDA `init` — падает, если аккаунт уже существует |
| `deposit`              | Только authority     | `Signer` + `has_one = authority`                |
| `payout`               | Только authority     | `Signer` + `has_one = authority`                |
| `set_paused`           | Только authority     | `Signer` + `has_one = authority`                |
| `create_withdrawal`    | Только authority     | `Signer` + `has_one = authority`                |
| `claim_withdrawal`     | Юзер (владелец PDA)  | `Signer` (user) + `has_one = user` на PDA      |
| `cancel_withdrawal`    | Только authority     | `Signer` + `has_one = authority` + проверка expiry |

**Результат: ПРОЙДЕНО** — Authority-инструкции используют `has_one = authority`. Claim требует подпись кошелька юзера И совпадение PDA (`has_one = user`). Seeds withdrawal PDA `[b"withdrawal", vault.key(), user.key()]` гарантируют один активный запрос на юзера на vault.

---

## 3. Критические свойства безопасности

### 3.1 Нет произвольного вывода средств

**Статус: ПРОЙДЕНО**

В контракте нет инструкций `withdraw`, `close` или `drain`. Единственный способ вывести средства — через `payout`, который обеспечивает:

- `has_one = payout_wallet` — получатель зашит при инициализации
- `has_one = authority` — только authority может инициировать выплату
- Проверка баланса: `require!(vault_token_account.amount >= amount)`

**Нет инструкции для изменения `authority` или `payout_wallet` после инициализации.** Это сделано намеренно — для миграции нужно сначала вывести все средства через `payout`, затем создать новый vault.

### 3.2 Нет закрытия аккаунта

**Статус: ПРОЙДЕНО**

Инструкция `close` отсутствует. Vault PDA и его token account существуют бессрочно. SOL для rent-exempt заблокирован, но vault нельзя опустошить от SOL.

### 3.3 Неизменяемая конфигурация

**Статус: ПРОЙДЕНО**

После инициализации следующие поля нельзя изменить:
- `authority` — нельзя передать управление
- `payout_wallet` — нельзя перенаправить выплаты
- `usdt_mint` — нельзя подменить токен
- `vault_token_account` — нельзя подменить token account

Это исключает все векторы атаки типа "rug pull через изменение конфигурации".

---

## 4. Анализ по инструкциям

### 4.1 `initialize`

```
Seeds: [b"treasury_vault", authority.key()]
Ограничения: init (однократно), payer = authority
```

**Проверки:**
- [x] Уникальность PDA — `init` гарантирует один vault на authority
- [x] Token account создаётся как ATA от vault PDA
- [x] Bump seed сохраняется для будущих операций
- [x] Все поля стейта инициализированы нулями / false
- [x] `payout_wallet` — `UncheckedAccount` — **допустимо**, т.к. на этапе init средства не переводятся

**Риск:** `payout_wallet` не проверяется на валидность. Неправильный адрес = средства заблокированы навсегда.
**Митигация:** Операционный риск, не уязвимость. Деплоер должен верифицировать адрес.

### 4.2 `deposit`

```
Ограничения: has_one = authority, has_one = usdt_mint, !vault.paused
Трансфер: authority_token_account → vault_token_account (authority подписывает)
```

**Проверки:**
- [x] Amount > 0
- [x] `transfer_checked` проверяет mint и decimals
- [x] ATA authority деривится через associated_token constraints
- [x] Vault token account валидируется: `address = vault.vault_token_account`
- [x] `checked_add` предотвращает overflow на `total_deposited` и `deposit_count`
- [x] Проверка паузы

**Риск: НЕТ** — Стандартный паттерн SPL transfer. Authority подписывает свой собственный перевод.

### 4.3 `payout`

```
Ограничения: has_one = authority, has_one = payout_wallet, has_one = usdt_mint, !vault.paused
Трансфер: vault_token_account → payout_token_account (PDA подписывает)
```

**Проверки:**
- [x] Amount > 0
- [x] Проверка баланса: `vault_token_account.amount >= amount`
- [x] PDA signer seeds корректно сконструированы
- [x] `transfer_checked` проверяет mint и decimals
- [x] ATA получателя — `init_if_needed` (создаётся при первой выплате)
- [x] `payout_wallet` валидируется через `has_one` на vault
- [x] `checked_add` предотвращает overflow
- [x] Проверка паузы

**Риск: НЕТ** — Средства могут идти только на зашитый payout_wallet. PDA signing реализован корректно.

### 4.4 `set_paused`

```
Ограничения: has_one = authority
```

**Проверки:**
- [x] Только authority может ставить/снимать паузу
- [x] Эмитирует event с timestamp для аудита

**Риск: НЕТ** — Простой boolean toggle с корректным контролем доступа.

### 4.5 `create_withdrawal`

```
Seeds: [b"withdrawal", vault.key(), user.key()]
Ограничения: has_one = authority, has_one = usdt_mint, !vault.paused, init (PDA)
```

**Проверки:**
- [x] Только authority может создать — юзеры не могут сами себе назначить вывод
- [x] Amount > 0
- [x] Проверка баланса: `vault_token_account.amount >= amount`
- [x] PDA `init` предотвращает дубли для одного юзера
- [x] `checked_add` для overflow-защиты expires_at
- [x] Проверка паузы
- [x] Authority платит rent за PDA (~0.001 SOL)
- [x] Эмитирует `WithdrawalCreatedEvent`

**Риск: НЕТ** — Authority контролирует все параметры. Уникальность PDA исключает race conditions.

### 4.6 `claim_withdrawal`

```
Seeds: [b"withdrawal", vault.key(), user.key()]
Ограничения: has_one = user (Signer), has_one = vault, !vault.paused, close = authority
Трансфер: vault_token_account → user_token_account (PDA подписывает)
```

**Проверки:**
- [x] Юзер должен подписать — только назначенный юзер может claim-ить
- [x] Проверка expiry: `clock.unix_timestamp <= request.expires_at`
- [x] Проверка баланса: `vault_token_account.amount >= request.amount`
- [x] PDA signer seeds для CPI transfer корректны
- [x] `transfer_checked` проверяет mint и decimals
- [x] ATA юзера — `init_if_needed` (юзер платит rent за ATA)
- [x] `close = authority` возвращает rent за PDA authority
- [x] Обновление статистики vault: `total_paid_out`, `payout_count`
- [x] `checked_add` против overflow
- [x] Эмитирует `WithdrawalClaimedEvent`

**Риск: НИЗКИЙ** — `authority` = `UncheckedAccount`, но валидируется через `has_one = authority` на vault. Закрытие PDA через Anchor `close` ставит `CLOSED_ACCOUNT_DISCRIMINATOR`, предотвращая revival-атаки.

### 4.7 `cancel_withdrawal`

```
Seeds: [b"withdrawal", vault.key(), user.key()]
Ограничения: has_one = authority (Signer), has_one = vault, close = authority
```

**Проверки:**
- [x] Только authority может cancel-ить
- [x] Проверка expiry: `clock.unix_timestamp > request.expires_at` — нельзя отменить до истечения срока
- [x] `close = authority` возвращает rent
- [x] Эмитирует `WithdrawalCancelledEvent`

**Риск: НЕТ** — Authority не может отменить активные (не истекшие) запросы. Юзерам гарантировано полное окно для claim.

---

## 5. Чеклист уязвимостей

| Уязвимость                         | Статус    | Комментарий                                              |
|------------------------------------|-----------|----------------------------------------------------------|
| Отсутствие проверки подписи        | БЕЗОПАСНО | Authority + User используют `Signer<'info>` корректно    |
| Отсутствие проверки владельца      | БЕЗОПАСНО | `Account<'info, T>` валидирует discriminator + owner      |
| Коллизия PDA seeds                 | БЕЗОПАСНО | Seeds включают pubkey authority/user — уникально          |
| Целочисленное переполнение         | БЕЗОПАСНО | `checked_add` на всех счётчиках и суммах                 |
| Реентерабельность                  | БЕЗОПАСНО | Модель исполнения Solana исключает reentrancy             |
| Произвольный CPI                   | БЕЗОПАСНО | Единственный CPI — в SPL Token через `transfer_checked`  |
| Подмена аккаунтов                  | БЕЗОПАСНО | `has_one` + `address` constraints на всех аккаунтах       |
| Чтение неинициализированного       | БЕЗОПАСНО | Anchor `Account<T>` валидирует discriminator              |
| Дубликаты мутабельных аккаунтов    | БЕЗОПАСНО | Anchor блокирует дубликаты в одной инструкции             |
| Отсутствие rent-exempt проверки    | БЕЗОПАСНО | Anchor `init` гарантирует rent exemption                  |
| Подмена token program              | БЕЗОПАСНО | `Interface<TokenInterface>` валидирует program ID          |
| Несоответствие mint                | БЕЗОПАСНО | `has_one = usdt_mint` + `transfer_checked` с decimals     |
| Эксплуатация UncheckedAccount      | БЕЗОПАСНО | UncheckedAccounts валидируются через `has_one`            |
| Revival PDA после close            | БЕЗОПАСНО | Anchor `close` ставит CLOSED_ACCOUNT_DISCRIMINATOR       |
| Double-claim withdrawal            | БЕЗОПАСНО | PDA закрыт после claim — повторный claim не найдёт аккаунт |
| Неавторизованный claim             | БЕЗОПАСНО | `has_one = user` + `user: Signer` на claim               |
| Преждевременный cancel             | БЕЗОПАСНО | Проверка expiry предотвращает cancel до дедлайна         |
| Дубль withdrawal request           | БЕЗОПАСНО | PDA `init` падает если request уже существует             |

---

## 6. Экономическая безопасность

### 6.1 Сохранность средств

- Vault хранит USDT на token account, принадлежащем PDA
- Только `payout` может вывести средства, и только на `payout_wallet`
- Нет вектора flash loan — депозиты и выплаты в отдельных транзакциях
- Нет зависимости от оракулов — суммы передаются как явные параметры

### 6.2 Безопасность Withdrawal Request

- **Стоимость rent PDA:** Authority платит ~0.001 SOL за каждый withdrawal PDA. Cron отменяет истекшие PDA и возвращает rent.
- **Гарантия expiry:** Юзеры имеют гарантированное окно для claim (по умолчанию 1 час). Authority не может cancel-ить до истечения.
- **Нет double-spend:** `close` после claim предотвращает повторный claim. Бэкенд запрещает cancel если PDA ещё активен.
- **Резервирование баланса:** `create_withdrawal` проверяет vault balance >= amount. Однако параллельные запросы могут суммарно превысить баланс — бэкенд контролирует лимиты.

### 6.3 Грифинг-векторы

- **Спам депозитами:** Только authority, третьи лица не могут
- **Фронтраннинг выплат:** Невозможен — только authority инициирует
- **Drain rent:** PDA-аккаунты rent-exempt
- **Спам withdrawal PDA:** Только authority может создавать — третьи лица не могут
- **Replay claim:** PDA закрыт после claim, Anchor ставит CLOSED_ACCOUNT_DISCRIMINATOR

### 6.4 Отказ в обслуживании (DoS)

- **Злоупотребление паузой:** Только authority. При компрометации ключа злоумышленник может приостановить, но НЕ может украсть (выплаты — на зашитый кошелёк, claims — только назначенным юзерам)
- **Переполнение счётчика:** `deposit_count` / `payout_count` (u32) переполняется при 4.29 млрд операций (~136 лет)

---

## 7. Операционные риски

| Риск                               | Критичность | Митигация                                              |
|------------------------------------|-------------|--------------------------------------------------------|
| Компрометация ключа authority      | ВЫСОКАЯ     | Злоумышленник может делать deposit/payout, но только на payout_wallet. Может поставить паузу. |
| Неправильный payout_wallet при init | ВЫСОКАЯ     | Средства заблокированы навсегда. Тройная проверка перед mainnet. |
| Неправильный usdt_mint при init    | СРЕДНЯЯ     | Vault бесполезен для настоящего USDT. Нужен редеплой.  |
| Потеря ключа authority             | ВЫСОКАЯ     | Vault заморожен навсегда. Нет механизма восстановления. |
| Апгрейд программы деплоером       | НИЗКАЯ      | Деплоить с `--final` для неизменяемой программы.       |

---

## 8. Отсутствующие функции (по дизайну)

Следующие функции **намеренно не реализованы** для максимальной безопасности:

- `update_authority` — исключает перехват управления
- `update_payout_wallet` — исключает перенаправление средств
- `close_vault` — исключает drain через возврат rent
- `withdraw` (произвольный получатель) — исключает несанкционированный вывод
- Timelocks / multisig — для v1 оставлено простым; можно добавить через программу-обёртку

---

## 9. Покрытие тестами

| Тест                                     | Результат |
|------------------------------------------|-----------|
| Инициализация с корректным стейтом       | ПРОЙДЕН   |
| Отклонение повторной инициализации       | ПРОЙДЕН   |
| Депозит корректной суммы                 | ПРОЙДЕН   |
| Накопление статистики по депозитам       | ПРОЙДЕН   |
| Отклонение нулевого депозита             | ПРОЙДЕН   |
| Отклонение неавторизованного депозита    | ПРОЙДЕН   |
| Выплата на корректный кошелёк            | ПРОЙДЕН   |
| Отклонение выплаты сверх баланса         | ПРОЙДЕН   |
| Отклонение нулевой выплаты              | ПРОЙДЕН   |
| Отклонение выплаты на чужой кошелёк     | ПРОЙДЕН   |
| Пауза блокирует депозиты               | ПРОЙДЕН   |
| Пауза блокирует выплаты                | ПРОЙДЕН   |
| Снятие паузы восстанавливает работу     | ПРОЙДЕН   |
| Депозит работает после снятия паузы     | ПРОЙДЕН   |
| Отклонение неавторизованной паузы       | ПРОЙДЕН   |
| Отклонение повторной инициализации      | ПРОЙДЕН   |
| Создание withdrawal request             | ПРОЙДЕН   |
| Отклонение дубля withdrawal request     | ПРОЙДЕН   |
| Отклонение claim неавторизованным юзером | ПРОЙДЕН   |
| Юзер успешно claim-ит withdrawal        | ПРОЙДЕН   |
| Отклонение cancel до expiry             | ПРОЙДЕН   |
| Отклонение claim после expiry           | ПРОЙДЕН   |
| Cancel истекшего withdrawal request     | ПРОЙДЕН   |
| Отклонение create_withdrawal на паузе   | ПРОЙДЕН   |
| Отклонение claim на паузе               | ПРОЙДЕН   |
| Обновление статистики vault после claim | ПРОЙДЕН   |

**26/26 тестов пройдено** (localnet)

---

## 10. Заключение

**Общий уровень риска: НИЗКИЙ**

Контракт Treasury Vault следует минималистичному, ограничительному паттерну проектирования. Поверхность атаки намеренно мала:

- 7 инструкций: 4 authority-only, 1 user-only (`claim_withdrawal`), 1 однократная (`initialize`)
- Нет изменения конфигурации после инициализации
- Средства идут на зашитый `payout_wallet` (через `payout`) ИЛИ назначенным юзерам (через `claim_withdrawal`)
- Нет механизмов close/drain/upgrade для самого vault
- Жизненный цикл withdrawal PDA: create → claim/cancel → закрыт (необратимо)

Основные риски — операционные (управление ключами, корректные параметры инициализации), а не архитектурные. Контракт подходит для продакшен-деплоя на Solana mainnet.

### Рекомендации

1. Деплоить с флагом `--final` (неизменяемая программа) для защиты от модификации деплоером
2. Хранить keypair authority в аппаратном кошельке или HSM
3. Трижды проверить адреса `payout_wallet` и `usdt_mint` перед инициализацией на mainnet
4. Мониторить on-chain события (`DepositEvent`, `PayoutEvent`, `VaultPausedEvent`, `WithdrawalCreatedEvent`, `WithdrawalClaimedEvent`, `WithdrawalCancelledEvent`) на аномалии
5. В будущих итерациях рассмотреть multisig-обёртку для authority на mainnet
6. Запустить cleanup cron для cancel истекших withdrawal PDA и возврата rent
7. Ограничить количество одновременных withdrawal per user на бэкенде для предотвращения overcommitment
