# Trustless Vault v2 — Design Doc

## Мотивация

Текущий treasury-vault — custodial. Backend (authority) может:
- Вызвать payout() и дренажить vault
- Создать withdrawal на любой адрес с любой суммой
- Юзер "подписывает claim" — но сумму определяет backend

Нужен контракт где **депозиты юзеров защищены on-chain**, а admin физически не может их украсть.

## Архитектура

### On-chain (контракт)

```
VaultState PDA {
  authority: Pubkey,         // backend wallet (для payouts)
  usdt_mint: Pubkey,
  vault_token_account: Pubkey,
  total_deposits: u64,       // сумма всех активных депозитов
  total_paid_out: u64,       // сумма всех выплат
  deposit_count: u32,
  payout_count: u32,
  bump: u8,
}

UserDeposit PDA (seeds: ["deposit", vault, user]) {
  user: Pubkey,
  deposit_amount: u64,       // сколько юзер вложил (raw USDT)
  total_paid_out: u64,       // сколько юзеру выплатили профита
  created_at: i64,
  bump: u8,
}
```

### Инструкции

#### 1. `initialize()` — admin
Создаёт VaultState PDA и vault token account.

#### 2. `deposit(amount)` — USER подписывает
- Юзер переводит USDT в vault
- Создаётся/обновляется UserDeposit PDA
- `vault.total_deposits += amount`
- Emit: DepositEvent { user, amount }
- Backend слушает event → создаёт машину в PostgreSQL

#### 3. `payout(user, amount)` — backend only
- Переводит USDT из vault на кошелёк юзера (профит)
- **RESERVE CHECK:**
  ```
  require!(
    vault_balance - amount >= vault.total_deposits - vault.total_paid_out,
    "Cannot pay from deposit reserves"
  )
  ```
- `user_deposit.total_paid_out += amount`
- `vault.total_paid_out += amount`
- Backend не может дренажить депозиты других юзеров

#### 4. `withdraw_deposit()` — USER подписывает (без backend!)
- Юзер забирает: `deposit_amount - total_paid_out - fees`
- Fees: фиксированный % в контракте (например 5% early exit)
- `vault.total_deposits -= deposit_amount`
- `vault.total_paid_out -= user_deposit.total_paid_out`
- UserDeposit PDA закрывается
- **Юзер всегда может вызвать это без backend'а**

#### 5. `close_deposit(user)` — backend only
- Только когда `total_paid_out >= deposit_amount` (тело выплачено)
- Закрывает UserDeposit PDA, возвращает rent
- `vault.total_deposits -= deposit_amount`
- `vault.total_paid_out -= user_deposit.total_paid_out`

#### 6. НЕТ admin withdraw/payout-to-wallet функций
Деньги покидают vault только через:
- payout() → юзеру (с reserve check)
- withdraw_deposit() → юзеру (его собственный депозит)

### Reserve Requirement

```
INVARIANT: vault_balance >= total_deposits - total_paid_out

Пример:
  Vault: $10,000 USDT
  total_deposits: $8,000 (сумма всех активных депозитов)
  total_paid_out: $1,000 (сумма всех profit payouts)

  Reserve = $8,000 - $1,000 = $7,000
  Available for payouts = $10,000 - $7,000 = $3,000

  Backend может выплатить макс $3,000 профита.
  Даже если backend "сойдёт с ума" — $7,000 депозитов защищены.
```

## Trust Analysis

| Вопрос | Ответ |
|---|---|
| Admin может украсть депозиты? | **НЕТ** — reserve check on-chain |
| Admin может украсть профит? | Может дренажить profit portion через фейковые payouts |
| Admin может цензурировать payouts? | Да — может не выплачивать профит |
| Юзер может забрать депозит? | **ВСЕГДА** — withdraw_deposit() без backend |
| Нужен ли backend для deposit? | Нет — юзер подписывает сам |

## Изменения в backend

### TreasuryService (рефакторинг)
- Новый IDL для vault-v2
- Слушать DepositEvent → создавать машину в БД
- payout() вместо create_withdrawal + claim_withdrawal
- close_deposit() когда тело автомата выплачено
- Убрать: deposit cron, create_withdrawal, cancel_withdrawal

### Withdrawal flow
- Profit withdrawal: backend вызывает payout() → USDT идут юзеру
- Deposit return: юзер вызывает withdraw_deposit() → frontend строит tx

## Изменения в frontend

- Deposit: юзер подписывает deposit() tx напрямую в контракт
- "Вернуть депозит": новая кнопка → withdraw_deposit() tx
- Profit withdrawals: юзер запрашивает → backend вызывает payout()

## Оценка

- Контракт: ~300-400 строк Rust, <280 KB binary, <2 SOL deploy
- Backend: 1-2 дня (TreasuryService рефакторинг)
- Frontend: 1 день (deposit flow + withdraw button)
- Деплой: upgradeable (для будущих патчей), потом можно --final

## Статус

- [ ] Написать контракт
- [ ] Тесты (Anchor test suite)
- [ ] Интеграция backend
- [ ] Интеграция frontend
- [ ] Deploy devnet + тестирование
- [ ] Deploy mainnet
