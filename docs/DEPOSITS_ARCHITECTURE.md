# Solana Deposits Architecture

**Дата:** 2026-01-14
**Статус:** В разработке

## Обзор

Система депозитов для Fortune City на базе Solana blockchain с использованием Helius webhooks для автоматического зачисления.

### Поддерживаемые валюты

| Валюта | Тип | Mint Address | Decimals | Конвертация |
|--------|-----|--------------|----------|-------------|
| **SOL** | Native | — | 9 | SOL → USD (по курсу) |
| **USDT** | SPL Token | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6 | 1:1 USD |
| **FORTUNE** | SPL Token | `4NBMaae5WYamCmHfaXuJDMk2eSWsoHDHqwJm5Epdpump` | 9 | FORTUNE → USD (по курсу) |

**Важно:** Все депозиты конвертируются в USD. Поле `fortuneBalance` в User = USD баланс (историческое название).

---

## Архитектура

### Wallet Structure

```
                    ┌───────────────────────┐
                    │     COLD WALLET       │  ← Manual transfers
                    │   (Ledger/Multisig)   │     (large amounts)
                    │   Long-term storage   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │      HOT WALLET       │  ← Sweep destination
                    │   (Server keypair)    │     + Gas distributor
                    │   Operational funds   │
                    └───────────┬───────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
    ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
    │  Deposit  │        │  Deposit  │        │  Deposit  │
    │ Address 1 │        │ Address 2 │        │ Address N │
    │ (User A)  │        │ (User B)  │        │ (User N)  │
    └───────────┘        └───────────┘        └───────────┘
```

### Deposit Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEPOSIT FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User requests deposit address                                    │
│     └─> Backend generates unique address (HD Wallet derivation)      │
│     └─> Registers address in Helius Webhook                          │
│     └─> Returns address + QR code to user                            │
│                                                                      │
│  2. User sends SOL/USDT/FORTUNE to address                           │
│                                                                      │
│  3. Helius detects transaction                                       │
│     └─> Sends webhook POST to /api/webhooks/helius                   │
│     └─> Payload contains parsed transaction details                  │
│                                                                      │
│  4. Backend processes webhook                                        │
│     └─> Validates signature (HMAC)                                   │
│     └─> Creates Deposit record (status: pending)                     │
│     └─> Waits for finalized commitment                               │
│     └─> Converts to USD, credits fortuneBalance                      │
│     └─> Updates totalFreshDeposits (for tax tracking)                │
│     └─> Processes referral bonuses                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Sweep Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SWEEP FLOW                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SweepService (Cron: каждые 15 минут)                               │
│                                                                      │
│  1. GET all deposit addresses with balance > threshold               │
│                                                                      │
│  2. FOR EACH address:                                                │
│     ┌─────────────────────────────────────────────────────────┐     │
│     │  a) Check SOL balance for gas                           │     │
│     │     └─> If < 0.002 SOL → Transfer gas from Hot Wallet   │     │
│     │                                                          │     │
│     │  b) FOR EACH token (USDT, FORTUNE):                     │     │
│     │     └─> If balance > threshold → Transfer to Hot Wallet │     │
│     │                                                          │     │
│     │  c) Sweep remaining SOL (minus rent-exempt minimum)     │     │
│     │     └─> Transfer to Hot Wallet                          │     │
│     └─────────────────────────────────────────────────────────┘     │
│                                                                      │
│  3. Hot Wallet accumulates all funds                                 │
│     └─> Manual transfer to Cold Wallet when threshold reached        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Структура модулей

```
apps/api/src/modules/
├── deposits/
│   ├── deposits.module.ts
│   ├── deposits.controller.ts          # REST endpoints
│   ├── deposits.service.ts             # Orchestration
│   ├── services/
│   │   ├── solana-rpc.service.ts       # Solana connection + utils
│   │   ├── address-generator.service.ts # HD Wallet derivation
│   │   ├── helius-webhook.service.ts   # Webhook management
│   │   ├── deposit-processor.service.ts # Processing + crediting
│   │   ├── sweep.service.ts            # Auto-sweep to hot wallet
│   │   └── price-oracle.service.ts     # SOL/USD prices
│   ├── dto/
│   │   ├── get-deposit-address.dto.ts
│   │   └── webhook-payload.dto.ts
│   └── constants/
│       └── tokens.ts                   # Mint addresses, decimals
```

---

## Prisma Schema

```prisma
// Добавить в schema.prisma

model Deposit {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  user      User   @relation(fields: [userId], references: [id])

  chain       Chain           @default(solana)
  currency    DepositCurrency
  txSignature String          @unique @map("tx_signature")

  // Original amount in native currency
  amount      Decimal @db.Decimal(20, 8)
  // Converted to USD (this is what gets credited)
  amountUsd   Decimal @default(0) @map("amount_usd") @db.Decimal(20, 8)

  // Exchange rate at deposit time
  rateToUsd   Decimal? @map("rate_to_usd") @db.Decimal(20, 8)

  status       DepositStatus @default(pending)
  slot         BigInt?
  confirmedAt  DateTime?     @map("confirmed_at")
  creditedAt   DateTime?     @map("credited_at")
  errorMessage String?       @map("error_message")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([status])
  @@map("deposits")
}

// Обновить существующую модель DepositAddress
model DepositAddress {
  id       String @id @default(cuid())
  userId   String @map("user_id")
  user     User   @relation(fields: [userId], references: [id])

  chain    Chain
  address  String
  isActive Boolean @default(true) @map("is_active")

  // HD Wallet derivation
  derivationIndex Int @map("derivation_index")

  // Helius webhook tracking
  webhookId String? @map("webhook_id")

  // Sweep tracking
  lastSweptAt DateTime? @map("last_swept_at")

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([userId, chain])
  @@index([address])
  @@map("deposit_addresses")
}

enum DepositCurrency {
  SOL
  USDT_SOL
  FORTUNE
}

enum DepositStatus {
  pending     // Detected, waiting confirmation
  confirmed   // Finalized on chain
  credited    // Balance updated
  failed      // Error during processing
}

// Добавить relation в User
model User {
  // ... existing fields ...
  deposits Deposit[]
}
```

---

## API Endpoints

### REST API

```typescript
@Controller('deposits')
export class DepositsController {

  // GET /deposits/address?currency=SOL|USDT_SOL|FORTUNE
  // Получить (или сгенерировать) депозитный адрес
  @Get('address')
  @UseGuards(JwtAuthGuard)
  async getDepositAddress(
    @CurrentUser() user: User,
    @Query('currency') currency: DepositCurrency
  ): Promise<{
    address: string;
    currency: DepositCurrency;
    qrCode: string; // Base64 PNG
    minDeposit: number;
  }>

  // GET /deposits
  // История депозитов пользователя
  @Get()
  @UseGuards(JwtAuthGuard)
  async getDeposits(@CurrentUser() user: User): Promise<Deposit[]>

  // GET /deposits/rates
  // Текущие курсы валют
  @Get('rates')
  async getRates(): Promise<{
    sol: number;      // SOL/USD
    fortune: number;  // FORTUNE/USD
    usdt: number;     // Always 1
  }>
}

@Controller('webhooks')
export class WebhooksController {
  // POST /webhooks/helius
  // Webhook от Helius (без auth guard, но с HMAC validation)
  @Post('helius')
  async handleHeliusWebhook(
    @Body() payload: HeliusWebhookPayload,
    @Headers('authorization') authHeader: string
  ): Promise<{ received: true }>
}
```

---

## Services Implementation

### AddressGeneratorService

```typescript
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';

@Injectable()
export class AddressGeneratorService {
  private masterSeed: Buffer;

  constructor(private config: ConfigService) {
    // Master seed из .env (SOLANA_MASTER_SEED)
    this.masterSeed = Buffer.from(config.get('SOLANA_MASTER_SEED'), 'hex');
  }

  /**
   * Генерирует уникальный Solana адрес для пользователя
   * Derivation path: m/44'/501'/0'/{derivationIndex}'
   */
  generateDepositAddress(derivationIndex: number): {
    publicKey: string;
    secretKey: Uint8Array;
  } {
    const path = `m/44'/501'/0'/${derivationIndex}'`;
    const derived = derivePath(path, this.masterSeed.toString('hex'));
    const keypair = Keypair.fromSeed(derived.key);

    return {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: keypair.secretKey,
    };
  }

  /**
   * Восстанавливает keypair из derivation index
   */
  getKeypair(derivationIndex: number): Keypair {
    const { secretKey } = this.generateDepositAddress(derivationIndex);
    return Keypair.fromSecretKey(secretKey);
  }
}
```

### DepositProcessorService

```typescript
@Injectable()
export class DepositProcessorService {

  /**
   * Конвертирует депозит в USD и зачисляет на баланс
   */
  async processDeposit(deposit: Deposit): Promise<void> {
    // 1. Конвертация в USD
    const usdAmount = await this.convertToUsd(
      deposit.currency,
      Number(deposit.amount),
    );

    // 2. Атомарная транзакция
    await this.prisma.$transaction(async (tx) => {
      // Зачисление на баланс (fortuneBalance = USD)
      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          fortuneBalance: { increment: usdAmount },
          // Fresh deposit для tax tracking при выводе
          totalFreshDeposits: { increment: usdAmount },
        },
      });

      // Обновить депозит
      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: 'credited',
          amountUsd: usdAmount,
          creditedAt: new Date(),
        },
      });

      // Transaction record
      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'deposit',
          amount: usdAmount,
          currency: 'FORTUNE', // legacy name, actually USD
          netAmount: usdAmount,
          chain: 'solana',
          txHash: deposit.txSignature,
          status: 'completed',
        },
      });

      // Referral bonus (5%/3%/1% от USD суммы)
      const user = await tx.user.findUnique({
        where: { id: deposit.userId },
        select: { referredById: true },
      });

      if (user?.referredById) {
        await this.referralsService.processReferralBonus(
          user.referredById,
          deposit.userId,
          usdAmount,
          tx,
        );
      }
    });
  }

  /**
   * Конвертация в USD
   */
  private async convertToUsd(
    currency: DepositCurrency,
    amount: number,
  ): Promise<number> {
    switch (currency) {
      case 'USDT_SOL':
        // USDT = USD (1:1)
        return amount;

      case 'SOL':
        // SOL → USD по курсу
        const solPrice = await this.priceOracle.getSolPrice();
        return amount * solPrice;

      case 'FORTUNE':
        // FORTUNE → USD по курсу
        const fortunePrice = await this.fortuneRateService.getUsdPrice();
        return amount * fortunePrice;
    }
  }
}
```

### SweepService

```typescript
@Injectable()
export class SweepService {
  private readonly MIN_SOL_FOR_GAS = 0.002 * LAMPORTS_PER_SOL; // 0.002 SOL
  private readonly RENT_EXEMPT_MIN = 0.00089088 * LAMPORTS_PER_SOL; // ~890k lamports
  private readonly SWEEP_THRESHOLD_SOL = 0.01 * LAMPORTS_PER_SOL; // Min 0.01 SOL
  private readonly SWEEP_THRESHOLD_TOKEN = 1; // Min 1 USDT/FORTUNE

  /**
   * Cron: каждые 15 минут
   */
  @Cron('0 */15 * * * *')
  async sweepAllAddresses(): Promise<SweepReport> {
    const hotWallet = this.config.get<string>('SOLANA_HOT_WALLET');
    const addresses = await this.prisma.depositAddress.findMany({
      where: { chain: 'solana', isActive: true },
    });

    const report: SweepReport = {
      processed: 0,
      swept: 0,
      gasDeposited: 0,
      errors: [],
    };

    for (const addr of addresses) {
      try {
        await this.sweepAddress(addr, hotWallet, report);
      } catch (error) {
        report.errors.push({ address: addr.address, error: error.message });
      }
    }

    this.logger.log(`Sweep completed: ${JSON.stringify(report)}`);
    return report;
  }

  private async sweepAddress(
    depositAddr: DepositAddress,
    hotWallet: string,
    report: SweepReport,
  ): Promise<void> {
    report.processed++;

    const keypair = this.addressGenerator.getKeypair(depositAddr.derivationIndex);
    const pubkey = keypair.publicKey;

    // 1. Check SOL balance
    const solBalance = await this.solanaRpc.getBalance(pubkey);

    // 2. Sweep SPL tokens first (USDT, FORTUNE)
    const mints = [
      this.config.get('USDT_MINT'),
      this.config.get('FORTUNE_MINT'),
    ];

    for (const mint of mints) {
      const tokenBalance = await this.solanaRpc.getTokenBalance(pubkey, mint);

      if (tokenBalance >= this.SWEEP_THRESHOLD_TOKEN) {
        // Need gas for token transfer
        if (solBalance < this.MIN_SOL_FOR_GAS) {
          await this.depositGas(pubkey, report);
        }

        await this.sweepToken(keypair, hotWallet, mint, tokenBalance);
        report.swept++;
      }
    }

    // 3. Sweep SOL (keep rent-exempt minimum)
    const sweepableSol = solBalance - this.RENT_EXEMPT_MIN;
    if (sweepableSol >= this.SWEEP_THRESHOLD_SOL) {
      await this.sweepSol(keypair, hotWallet, sweepableSol);
      report.swept++;
    }

    // Update last swept timestamp
    await this.prisma.depositAddress.update({
      where: { id: depositAddr.id },
      data: { lastSweptAt: new Date() },
    });
  }

  /**
   * Докидываем SOL для газа с Hot Wallet
   */
  private async depositGas(recipientPubkey: PublicKey, report: SweepReport): Promise<string> {
    const hotWalletKeypair = this.getHotWalletKeypair();
    const signature = await this.solanaRpc.transferSol(
      hotWalletKeypair,
      recipientPubkey,
      this.MIN_SOL_FOR_GAS,
    );
    report.gasDeposited++;
    return signature;
  }

  private async sweepSol(from: Keypair, to: string, amount: number): Promise<string> {
    return this.solanaRpc.transferSol(from, new PublicKey(to), amount);
  }

  private async sweepToken(from: Keypair, to: string, mint: string, amount: number): Promise<string> {
    return this.solanaRpc.transferToken(from, new PublicKey(to), new PublicKey(mint), amount);
  }
}
```

### HeliusWebhookService

```typescript
@Injectable()
export class HeliusWebhookService {
  private readonly apiUrl = 'https://api.helius.xyz/v0';

  /**
   * Регистрирует адрес для мониторинга через Helius webhook
   */
  async registerAddress(address: string): Promise<string> {
    // Проверяем, есть ли уже webhook
    const existingWebhook = await this.getWebhook();

    if (existingWebhook) {
      // Добавляем адрес в существующий webhook
      await this.addAddressToWebhook(existingWebhook.webhookID, address);
      return existingWebhook.webhookID;
    }

    // Создаём новый webhook
    const response = await fetch(`${this.apiUrl}/webhooks?api-key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookURL: `${this.config.get('API_URL')}/webhooks/helius`,
        transactionTypes: ['TRANSFER', 'ANY'],
        accountAddresses: [address],
        webhookType: 'enhanced',
        authHeader: `Bearer ${this.config.get('HELIUS_WEBHOOK_SECRET')}`,
        txnStatus: 'all',
        encoding: 'jsonParsed',
      }),
    });

    const data = await response.json();
    return data.webhookID;
  }

  /**
   * Валидация подписи webhook
   */
  validateSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.get('HELIUS_WEBHOOK_SECRET'))
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Парсинг payload от Helius
   */
  parseWebhookPayload(payload: HeliusWebhookPayload): ParsedDeposit | null {
    // Enhanced transaction format от Helius
    const { type, source, tokenTransfers, nativeTransfers, accountData } = payload;

    // SOL transfer
    if (nativeTransfers?.length > 0) {
      const transfer = nativeTransfers.find(t =>
        this.isOurDepositAddress(t.toUserAccount)
      );
      if (transfer) {
        return {
          currency: 'SOL',
          amount: transfer.amount / LAMPORTS_PER_SOL,
          toAddress: transfer.toUserAccount,
          signature: payload.signature,
        };
      }
    }

    // SPL Token transfer
    if (tokenTransfers?.length > 0) {
      const transfer = tokenTransfers.find(t =>
        this.isOurDepositAddress(t.toUserAccount)
      );
      if (transfer) {
        const currency = this.getCurrencyFromMint(transfer.mint);
        if (currency) {
          return {
            currency,
            amount: transfer.tokenAmount,
            toAddress: transfer.toUserAccount,
            signature: payload.signature,
            mint: transfer.mint,
          };
        }
      }
    }

    return null;
  }
}
```

---

## ENV Variables

```env
# Solana Network
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
SOLANA_WS_URL=wss://mainnet.helius-rpc.com/?api-key=xxx
SOLANA_NETWORK=mainnet-beta

# Wallets
SOLANA_MASTER_SEED=<64-byte hex for HD derivation>
SOLANA_HOT_WALLET=<hot wallet public key base58>
SOLANA_HOT_WALLET_SECRET=<hot wallet secret key, base58 or JSON array>

# Helius
HELIUS_API_KEY=xxx
HELIUS_WEBHOOK_SECRET=xxx

# Token Mints (Mainnet)
USDT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
FORTUNE_MINT=4NBMaae5WYamCmHfaXuJDMk2eSWsoHDHqwJm5Epdpump

# Sweep Config
SWEEP_ENABLED=true
SWEEP_INTERVAL_MINUTES=15
SWEEP_THRESHOLD_SOL=0.01
SWEEP_THRESHOLD_TOKEN=1

# Price Oracle
COINGECKO_API_KEY=xxx
```

---

## NPM Dependencies

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "ed25519-hd-key": "^1.3.0",
    "bs58": "^5.0.0",
    "tweetnacl": "^1.0.3",
    "helius-sdk": "^1.3.0",
    "qrcode": "^1.5.3"
  }
}
```

---

## Security Considerations

1. **Master Seed** — хранить в secure vault (HashiCorp Vault, AWS Secrets Manager)
2. **Hot Wallet** — держать минимальный баланс, основные средства на Cold Wallet
3. **Webhook Validation** — всегда проверять HMAC подпись от Helius
4. **Rate Limiting** — ограничить частоту запросов на генерацию адресов
5. **Duplicate Detection** — проверять txSignature на уникальность перед зачислением
6. **Confirmation** — ждать `finalized` commitment перед зачислением

---

## Frontend Integration

### Страница депозитов `/cash`

```typescript
// Компоненты
- DepositAddressCard: показывает адрес + QR код
- CurrencySelector: выбор SOL/USDT/FORTUNE
- DepositHistory: список депозитов с статусами
- RatesDisplay: текущие курсы

// Flow
1. User выбирает валюту
2. Запрос GET /deposits/address?currency=XXX
3. Показываем адрес + QR код
4. Polling GET /deposits каждые 10 секунд для обновления статуса
5. При status=credited показываем success notification
```

---

## Testing

### Unit Tests
- AddressGeneratorService: derivation consistency
- DepositProcessorService: conversion rates, balance updates
- HeliusWebhookService: signature validation, payload parsing
- SweepService: threshold logic, gas calculation

### Integration Tests
- Full deposit flow (mock Helius webhook)
- Sweep flow (devnet)

### E2E Tests (Devnet)
- Real deposit → webhook → credit flow
- Sweep to hot wallet

---

## TODO

- [ ] Создать DepositsModule
- [ ] Реализовать AddressGeneratorService
- [ ] Реализовать HeliusWebhookService
- [ ] Реализовать DepositProcessorService
- [ ] Реализовать SweepService
- [ ] Реализовать PriceOracleService
- [ ] Обновить Prisma schema
- [ ] Frontend: страница депозитов
- [ ] Unit tests
- [ ] Integration tests на devnet
