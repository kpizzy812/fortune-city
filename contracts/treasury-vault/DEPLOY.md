# Treasury Vault — Deploy Guide

## Архитектура

- **Контракт:** Anchor 0.31.1, non-upgradeable (`--final`)
- **Binary:** ~287 KB → rent-exempt ~1.70 SOL
- **Authority:** hot wallet бэкенда (тот же кто sweeps deposits)
- **Инструкции:** initialize, deposit, payout, create_withdrawal, claim_withdrawal, cancel_withdrawal

---

## Шаг 0: Подготовка

### Нужно иметь
- `solana` CLI (v2.x)
- `anchor` CLI (0.31.x)
- Keypair для деплоя (с достаточным SOL для rent)
- Authority keypair (hot wallet бэкенда) — для initialize

### Проверить версии
```bash
solana --version          # solana-cli 2.x
anchor --version          # anchor-cli 0.31.x
solana balance            # хватит ли SOL (~2 SOL нужно)
```

---

## Шаг 1: Выбрать кластер

### Devnet (тестирование)
```bash
solana config set --url devnet
```

### Mainnet (продакшн)
```bash
solana config set --url mainnet-beta
# или через RPC:
solana config set --url https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

### Проверить
```bash
solana config get
# Должно показать:
# RPC URL: https://api.devnet.solana.com  (или mainnet)
# Keypair Path: ~/.config/solana/id.json
```

---

## Шаг 2: Program Keypair

Текущий program ID: `9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD`
Файл: `target/deploy/treasury_vault-keypair.json`

### Вариант A: Использовать существующий keypair (рекомендуется)
Program ID уже вшит в `declare_id!()`, IDL, бэкенд, фронтенд.
Просто деплоим с тем что есть.

### Вариант B: Новый program ID (если нужен другой адрес)
```bash
cd contracts/treasury-vault
solana-keygen new -o target/deploy/treasury_vault-keypair.json --force
# Запиши новый pubkey!

# Обновить ВЕЗДЕ:
# 1. lib.rs → declare_id!("НОВЫЙ_PUBKEY")
# 2. Anchor.toml → [programs.mainnet] treasury_vault = "НОВЫЙ_PUBKEY"
# 3. anchor build  (пересобрать с новым ID)
# 4. Скопировать IDL → apps/api/src/modules/treasury/idl/
# 5. .env → TREASURY_PROGRAM_ID=НОВЫЙ_PUBKEY
```

---

## Шаг 3: Собрать контракт

```bash
cd contracts/treasury-vault
anchor build
```

### Проверить размер
```bash
ls -la target/deploy/treasury_vault.so
# Должно быть ~287 KB (287096 bytes)
```

### Проверить program ID совпадает
```bash
solana-keygen pubkey target/deploy/treasury_vault-keypair.json
# Должно совпасть с declare_id! в lib.rs
```

---

## Шаг 4: Запустить тесты (localnet)

```bash
anchor test
# 18/18 тестов должны пройти
```

---

## Шаг 5: Deploy

### Devnet
```bash
solana config set --url devnet

# Аирдроп для деплоя (если devnet)
solana airdrop 2

# Deploy (non-upgradeable)
solana program deploy \
  target/deploy/treasury_vault.so \
  --program-id target/deploy/treasury_vault-keypair.json \
  --final
```

### Mainnet
```bash
solana config set --url mainnet-beta

# Проверить баланс (нужно ~2 SOL)
solana balance

# Deploy (NON-UPGRADEABLE — навсегда!)
solana program deploy \
  target/deploy/treasury_vault.so \
  --program-id target/deploy/treasury_vault-keypair.json \
  --final
```

### Что значит `--final`
- Программа становится **immutable** — никто не может обновить или удалить
- НЕ нужен x2 буфер для rent (экономия ~1.7 SOL)
- Нет upgrade authority — максимальное доверие юзеров
- **НЕОБРАТИМО** — убедись что контракт работает на devnet перед mainnet

### Если не хватает SOL
```bash
# Проверить точную стоимость rent
solana rent 287096
# → ~1.996 SOL для 287096 bytes rent-exempt
```

---

## Шаг 6: Проверить деплой

```bash
# Проверить что программа существует
solana program show 9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD

# Должно показать:
# Program Id: 9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# Data Length: XXXXX bytes
# Authority: none  (← потому что --final)
```

---

## Шаг 7: Initialize Vault

Первый вызов после деплоя — создать vault аккаунт.

### Через CLI (ts-node скрипт)
```bash
cd contracts/treasury-vault

# Создать scripts/initialize.ts:
npx ts-node scripts/initialize.ts \
  --cluster mainnet-beta \
  --authority ~/.config/solana/id.json \
  --payout-wallet PAYOUT_WALLET_PUBKEY \
  --usdt-mint Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

### Или через Anchor CLI test
```bash
# Можно написать отдельный тест-скрипт для devnet/mainnet
anchor test --skip-local-validator --provider.cluster devnet
```

### Или бэкенд сделает это автоматически
Если `TREASURY_ENABLED=true` и vault не существует — TreasuryService может вызвать initialize при первом запуске. (Зависит от реализации.)

---

## Шаг 8: Проверить vault

```bash
# Получить vault PDA адрес
# seeds: ["treasury_vault", authority_pubkey]
# Или через API: GET /treasury/info
```

На Solscan: `https://solscan.io/account/VAULT_PDA_ADDRESS`

---

## Шаг 9: Настроить бэкенд

### .env на сервере
```bash
TREASURY_ENABLED=true
TREASURY_PROGRAM_ID=9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD

# Authority = hot wallet (тот же что sweep deposits)
SOLANA_HOT_WALLET=<pubkey>
SOLANA_HOT_WALLET_SECRET=<base58 private key>

# Payout wallet (отдельный для instant withdrawals)
SOLANA_PAYOUT_WALLET=<pubkey>
SOLANA_PAYOUT_WALLET_SECRET=<base58 private key>

# USDT mint (mainnet)
USDT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB

# RPC (Helius mainnet)
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

### Рестартнуть API
```bash
make deploy-api
make logs-api  # проверить "Treasury initialized: vault=..."
```

---

## Шаг 10: E2E проверка

### 1. Deposit
```bash
# Отправить немного USDT на hot wallet
# Дождаться sweep cron (15 мин) → USDT в vault
# Или вручную: POST /treasury/deposit (admin)
# Проверить: GET /treasury/info → currentBalance > 0
```

### 2. Create Withdrawal
```bash
# Через фронтенд: нажать Withdraw с подключённым кошельком
# Бэкенд создаст on-chain PDA
# Проверить: GET /treasury/withdrawal-request/:userPubkey
```

### 3. Claim
```bash
# Фронтенд покажет confirm → юзер подписывает → USDT на ATA юзера
# PDA закрыт, vault stats обновлены
```

### 4. Verify on Solscan
```bash
# Открыть Solscan → vault address → последние транзакции
# Должны быть: deposit, create_withdrawal, claim_withdrawal
```

---

## Чеклист перед mainnet

- [ ] 18/18 тестов проходят на localnet
- [ ] Deploy на devnet успешен
- [ ] E2E на devnet: initialize → deposit → create_withdrawal → claim → cancel
- [ ] Binary size ≤ 300 KB
- [ ] Program ID совпадает в lib.rs, Anchor.toml, IDL, .env
- [ ] Authority keypair = тот же что SOLANA_HOT_WALLET_SECRET
- [ ] Payout wallet настроен и имеет SOL для gas
- [ ] Достаточно SOL для rent (~2 SOL)
- [ ] `--final` флаг (non-upgradeable)
- [ ] Бэкап program keypair (`treasury_vault-keypair.json`) — потеряешь = не задеплоишь на этот же адрес

---

## Важные адреса

| Что | Mainnet |
|-----|---------|
| Program ID | `9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD` |
| USDT Mint | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| Vault PDA | seeds: `["treasury_vault", authority.pubkey]` |
| Authority | = SOLANA_HOT_WALLET |

---

## Rollback план

**Контракт нельзя откатить** — он immutable (`--final`).

Если обнаружен баг:
1. **Бэкенд:** выключить `TREASURY_ENABLED=false` → выводы через payout wallet напрямую
2. **Vault средства:** authority может вызвать `payout()` → вывести всё на payout wallet
3. **Новый контракт:** задеплоить новую версию на новый program ID, обновить .env

Средства в vault **не заблокированы** — authority всегда может вызвать payout.
