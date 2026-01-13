# Solana Deposits Architecture

**Дата:** 2026-01-14
**Статус:** В разработке

## Обзор

Гибридная система депозитов для Fortune City на базе Solana blockchain:
1. **Wallet Connect** — прямой перевод с подключённого кошелька (Phantom, Solflare, etc.)
2. **Deposit Address** — уникальный адрес для пополнения с биржи или другого кошелька

### Поддерживаемые валюты

| Валюта | Тип | Mint Address | Decimals | Конвертация |
|--------|-----|--------------|----------|-------------|
| **SOL** | Native | — | 9 | SOL → USD (по курсу) |
| **USDT** | SPL Token | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6 | 1:1 USD |
| **FORTUNE** | SPL Token | `4NBMaae5WYamCmHfaXuJDMk2eSWsoHDHqwJm5Epdpump` | 9 | FORTUNE → USD (по курсу) |

**Важно:** Все депозиты конвертируются в USD. Поле `fortuneBalance` в User = USD баланс (историческое название).

---

## Архитектура

### Гибридный Deposit Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     HYBRID DEPOSIT SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐    │
│  │     METHOD 1: WALLET        │    │    METHOD 2: DEPOSIT        │    │
│  │        CONNECT              │    │       ADDRESS               │    │
│  │   (Phantom, Solflare...)    │    │   (Биржи, другие кошельки)  │    │
│  └──────────────┬──────────────┘    └──────────────┬──────────────┘    │
│                 │                                   │                   │
│                 ▼                                   ▼                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      HOT WALLET                                   │  │
│  │                  (Единая точка приёма)                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                        │
│                                ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    HELIUS WEBHOOKS                                │  │
│  │              (Мониторинг входящих транзакций)                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                        │
│                                ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                 DEPOSIT PROCESSOR                                 │  │
│  │   • Идентификация пользователя (memo / wallet / deposit addr)   │  │
│  │   • Конвертация в USD                                            │  │
│  │   • Зачисление на fortuneBalance                                 │  │
│  │   • Обновление totalFreshDeposits                                │  │
│  │   • Реферальные бонусы                                           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Method 1: Wallet Connect Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WALLET CONNECT FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User подключает кошелёк (Phantom/Solflare/etc.)                 │
│     └─> @solana/wallet-adapter-react                                │
│     └─> Сохраняем связь walletAddress ↔ userId в WalletConnection  │
│                                                                      │
│  2. User выбирает сумму и валюту                                    │
│     └─> Frontend строит транзакцию на Hot Wallet                    │
│     └─> memo = unique depositId для идентификации                   │
│                                                                      │
│  3. User подписывает транзакцию в кошельке                          │
│     └─> useWallet().sendTransaction()                               │
│     └─> Создаём Deposit record (status: pending, signature)        │
│                                                                      │
│  4. Helius webhook получает транзакцию                              │
│     └─> Валидация signature                                         │
│     └─> Находим Deposit по signature или memo                       │
│     └─> Подтверждаем и зачисляем                                    │
│                                                                      │
│  Преимущества:                                                       │
│  ✓ Мгновенное подтверждение                                         │
│  ✓ Не нужны HD wallets и sweep                                      │
│  ✓ User видит точную сумму до подписи                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Method 2: Deposit Address Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                   DEPOSIT ADDRESS FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User запрашивает депозитный адрес                               │
│     └─> Backend генерирует уникальный адрес (HD Wallet derivation) │
│     └─> Регистрирует адрес в Helius Webhook                        │
│     └─> Возвращает адрес + QR код                                  │
│                                                                      │
│  2. User отправляет SOL/USDT/FORTUNE на адрес                       │
│     └─> С биржи, другого кошелька и т.д.                           │
│                                                                      │
│  3. Helius webhook получает транзакцию                              │
│     └─> Находим DepositAddress по toAddress                        │
│     └─> Создаём Deposit record                                     │
│     └─> Конвертируем в USD, зачисляем                              │
│                                                                      │
│  4. SweepService (cron каждые 15 мин)                               │
│     └─> Собирает средства с deposit addresses на Hot Wallet        │
│     └─> Докидывает gas при необходимости                           │
│                                                                      │
│  Преимущества:                                                       │
│  ✓ Работает для бирж (Binance, OKX и т.д.)                         │
│  ✓ Не требует установленного кошелька                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Wallet Structure

```
                    ┌───────────────────────┐
                    │     COLD WALLET       │  ← Manual transfers
                    │   (Ledger/Multisig)   │     (large amounts)
                    │   Long-term storage   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │      HOT WALLET       │  ← Wallet Connect destination
                    │   (Server keypair)    │  ← Sweep destination
                    │   Operational funds   │  ← Gas distributor
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
│   │   ├── initiate-deposit.dto.ts     # Wallet connect deposit
│   │   └── webhook-payload.dto.ts
│   └── constants/
│       └── tokens.ts                   # Mint addresses, decimals

apps/web/src/
├── providers/
│   └── SolanaWalletProvider.tsx        # Wallet adapter setup
├── components/
│   └── deposits/
│       ├── WalletConnectDeposit.tsx    # Wallet connect UI
│       ├── DepositAddressCard.tsx      # QR code + address
│       ├── CurrencySelector.tsx        # SOL/USDT/FORTUNE
│       └── DepositHistory.tsx          # История депозитов
├── stores/
│   └── deposits.store.ts               # Zustand state
└── app/
    └── cash/
        └── page.tsx                    # Deposit page
```

---

## Prisma Schema

```prisma
// Добавить в schema.prisma

model Deposit {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  user      User   @relation(fields: [userId], references: [id])

  // Deposit method
  method      DepositMethod             // wallet_connect | deposit_address

  chain       Chain           @default(solana)
  currency    DepositCurrency
  txSignature String          @unique @map("tx_signature")

  // Original amount in native currency
  amount      Decimal @db.Decimal(20, 8)
  // Converted to USD (this is what gets credited)
  amountUsd   Decimal @default(0) @map("amount_usd") @db.Decimal(20, 8)

  // Exchange rate at deposit time
  rateToUsd   Decimal? @map("rate_to_usd") @db.Decimal(20, 8)

  // For wallet connect: memo used in transaction
  memo        String?

  status       DepositStatus @default(pending)
  slot         BigInt?
  confirmedAt  DateTime?     @map("confirmed_at")
  creditedAt   DateTime?     @map("credited_at")
  errorMessage String?       @map("error_message")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([userId])
  @@index([status])
  @@index([memo])
  @@map("deposits")
}

// Связь кошелька пользователя для Wallet Connect
model WalletConnection {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  user      User   @relation(fields: [userId], references: [id])

  chain         Chain
  walletAddress String @map("wallet_address")

  // Последнее подключение
  connectedAt   DateTime @default(now()) @map("connected_at")

  @@unique([userId, chain])
  @@unique([walletAddress, chain])
  @@index([walletAddress])
  @@map("wallet_connections")
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

enum DepositMethod {
  wallet_connect
  deposit_address
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
  deposits          Deposit[]
  walletConnections WalletConnection[]
}
```

---

## API Endpoints

### REST API

```typescript
@Controller('deposits')
export class DepositsController {

  // ========== WALLET CONNECT ==========

  // POST /deposits/wallet-connect
  // Привязать кошелёк к пользователю
  @Post('wallet-connect')
  @UseGuards(JwtAuthGuard)
  async connectWallet(
    @CurrentUser() user: User,
    @Body() dto: ConnectWalletDto  // { walletAddress, chain, signature }
  ): Promise<{ connected: true }>

  // POST /deposits/initiate
  // Инициировать депозит через Wallet Connect
  // Frontend вызывает перед sendTransaction
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiateDeposit(
    @CurrentUser() user: User,
    @Body() dto: InitiateDepositDto  // { currency, amount, walletAddress }
  ): Promise<{
    depositId: string;
    memo: string;              // Включить в транзакцию
    recipientAddress: string;  // Hot Wallet
    amount: number;
    currency: DepositCurrency;
  }>

  // POST /deposits/confirm
  // Подтвердить отправленную транзакцию
  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  async confirmDeposit(
    @CurrentUser() user: User,
    @Body() dto: ConfirmDepositDto  // { depositId, txSignature }
  ): Promise<{ status: DepositStatus }>

  // ========== DEPOSIT ADDRESS ==========

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

  // ========== COMMON ==========

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

### DepositsService (Orchestration)

```typescript
@Injectable()
export class DepositsService {
  constructor(
    private prisma: PrismaService,
    private addressGenerator: AddressGeneratorService,
    private heliusWebhook: HeliusWebhookService,
    private depositProcessor: DepositProcessorService,
    private config: ConfigService,
  ) {}

  /**
   * Wallet Connect: привязка кошелька
   */
  async connectWallet(userId: string, walletAddress: string, chain: Chain): Promise<void> {
    await this.prisma.walletConnection.upsert({
      where: { userId_chain: { userId, chain } },
      update: { walletAddress, connectedAt: new Date() },
      create: { userId, chain, walletAddress },
    });
  }

  /**
   * Wallet Connect: инициация депозита
   */
  async initiateWalletDeposit(
    userId: string,
    currency: DepositCurrency,
    amount: number,
    walletAddress: string,
  ): Promise<{ depositId: string; memo: string; recipientAddress: string }> {
    // Генерируем уникальный memo для идентификации
    const memo = nanoid(16);
    const hotWallet = this.config.get<string>('SOLANA_HOT_WALLET');

    // Создаём pending deposit
    const deposit = await this.prisma.deposit.create({
      data: {
        userId,
        method: 'wallet_connect',
        chain: 'solana',
        currency,
        amount,
        memo,
        txSignature: `pending_${memo}`, // Placeholder, обновится после confirm
        status: 'pending',
      },
    });

    return {
      depositId: deposit.id,
      memo,
      recipientAddress: hotWallet,
    };
  }

  /**
   * Wallet Connect: подтверждение транзакции
   */
  async confirmWalletDeposit(depositId: string, txSignature: string): Promise<Deposit> {
    return this.prisma.deposit.update({
      where: { id: depositId },
      data: { txSignature },
    });
  }

  /**
   * Deposit Address: получить или создать адрес
   */
  async getOrCreateDepositAddress(userId: string): Promise<DepositAddress> {
    const existing = await this.prisma.depositAddress.findUnique({
      where: { userId_chain: { userId, chain: 'solana' } },
    });

    if (existing) return existing;

    // Получаем следующий derivation index
    const lastAddress = await this.prisma.depositAddress.findFirst({
      where: { chain: 'solana' },
      orderBy: { derivationIndex: 'desc' },
    });
    const derivationIndex = (lastAddress?.derivationIndex ?? -1) + 1;

    // Генерируем адрес
    const { publicKey } = this.addressGenerator.generateDepositAddress(derivationIndex);

    // Создаём запись
    const depositAddress = await this.prisma.depositAddress.create({
      data: {
        userId,
        chain: 'solana',
        address: publicKey,
        derivationIndex,
      },
    });

    // Регистрируем в Helius webhook
    const webhookId = await this.heliusWebhook.registerAddress(publicKey);
    await this.prisma.depositAddress.update({
      where: { id: depositAddress.id },
      data: { webhookId },
    });

    return depositAddress;
  }
}
```

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
   * Обработка подтверждённой транзакции (вызывается из webhook)
   */
  async processConfirmedDeposit(deposit: Deposit): Promise<void> {
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

### HeliusWebhookService

```typescript
@Injectable()
export class HeliusWebhookService {
  private readonly apiUrl = 'https://api.helius.xyz/v0';
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = config.get('HELIUS_API_KEY');
  }

  /**
   * Регистрирует адрес для мониторинга (Hot Wallet или Deposit Address)
   */
  async registerAddress(address: string): Promise<string> {
    const existingWebhook = await this.getWebhook();

    if (existingWebhook) {
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
   * Добавить адрес в существующий webhook
   */
  async addAddressToWebhook(webhookId: string, address: string): Promise<void> {
    await fetch(`${this.apiUrl}/webhooks/${webhookId}?api-key=${this.apiKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountAddresses: [address],
        // append mode
      }),
    });
  }

  /**
   * Валидация подписи webhook
   */
  validateSignature(payload: string, authHeader: string): boolean {
    const expectedToken = `Bearer ${this.config.get('HELIUS_WEBHOOK_SECRET')}`;
    return authHeader === expectedToken;
  }

  /**
   * Парсинг payload от Helius Enhanced Webhook
   */
  parseWebhookPayload(payload: HeliusWebhookPayload[]): ParsedDeposit[] {
    const deposits: ParsedDeposit[] = [];

    for (const tx of payload) {
      // SOL transfer
      if (tx.nativeTransfers?.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          if (this.isOurAddress(transfer.toUserAccount)) {
            deposits.push({
              currency: 'SOL',
              amount: transfer.amount / 1e9, // lamports to SOL
              toAddress: transfer.toUserAccount,
              fromAddress: transfer.fromUserAccount,
              signature: tx.signature,
              slot: tx.slot,
            });
          }
        }
      }

      // SPL Token transfer
      if (tx.tokenTransfers?.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          if (this.isOurAddress(transfer.toUserAccount)) {
            const currency = this.getCurrencyFromMint(transfer.mint);
            if (currency) {
              deposits.push({
                currency,
                amount: transfer.tokenAmount,
                toAddress: transfer.toUserAccount,
                fromAddress: transfer.fromUserAccount,
                signature: tx.signature,
                slot: tx.slot,
                mint: transfer.mint,
              });
            }
          }
        }
      }
    }

    return deposits;
  }

  private getCurrencyFromMint(mint: string): DepositCurrency | null {
    const USDT_MINT = this.config.get('USDT_MINT');
    const FORTUNE_MINT = this.config.get('FORTUNE_MINT');

    if (mint === USDT_MINT) return 'USDT_SOL';
    if (mint === FORTUNE_MINT) return 'FORTUNE';
    return null;
  }
}
```

### SweepService

```typescript
@Injectable()
export class SweepService {
  private readonly MIN_SOL_FOR_GAS = 0.002 * LAMPORTS_PER_SOL;
  private readonly RENT_EXEMPT_MIN = 0.00089088 * LAMPORTS_PER_SOL;
  private readonly SWEEP_THRESHOLD_SOL = 0.01 * LAMPORTS_PER_SOL;
  private readonly SWEEP_THRESHOLD_TOKEN = 1;

  /**
   * Cron: каждые 15 минут
   */
  @Cron('0 */15 * * * *')
  async sweepAllAddresses(): Promise<SweepReport> {
    if (!this.config.get<boolean>('SWEEP_ENABLED')) {
      return { processed: 0, swept: 0, gasDeposited: 0, errors: [] };
    }

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
}
```

---

## Frontend Implementation

### SolanaWalletProvider.tsx

```typescript
'use client';

import { FC, ReactNode, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import type { WalletError, Adapter } from '@solana/wallet-adapter-base';

import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!;

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  const onError = useCallback((error: WalletError, adapter?: Adapter) => {
    console.error('Wallet error:', error, adapter);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

### WalletConnectDeposit.tsx

```typescript
'use client';

import { FC, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useDepositsStore } from '@/stores/deposits.store';

interface Props {
  currency: 'SOL' | 'USDT_SOL' | 'FORTUNE';
  amount: number;
  onSuccess: (txSignature: string) => void;
}

export const WalletConnectDeposit: FC<Props> = ({ currency, amount, onSuccess }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { initiateDeposit, confirmDeposit } = useDepositsStore();
  const [loading, setLoading] = useState(false);

  const handleDeposit = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      // 1. Инициируем депозит на бэкенде
      const { depositId, memo, recipientAddress } = await initiateDeposit({
        currency,
        amount,
        walletAddress: publicKey.toBase58(),
      });

      // 2. Строим транзакцию
      const transaction = new Transaction();
      const recipient = new PublicKey(recipientAddress);

      if (currency === 'SOL') {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipient,
            lamports: amount * LAMPORTS_PER_SOL,
          })
        );
      } else {
        // SPL Token transfer
        const mint = currency === 'USDT_SOL'
          ? new PublicKey(process.env.NEXT_PUBLIC_USDT_MINT!)
          : new PublicKey(process.env.NEXT_PUBLIC_FORTUNE_MINT!);

        const fromAta = await getAssociatedTokenAddress(mint, publicKey);
        const toAta = await getAssociatedTokenAddress(mint, recipient);

        const decimals = currency === 'USDT_SOL' ? 6 : 9;
        const tokenAmount = amount * Math.pow(10, decimals);

        transaction.add(
          createTransferInstruction(
            fromAta,
            toAta,
            publicKey,
            tokenAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // 3. Добавляем memo для идентификации
      // (опционально, можно использовать Memo Program)

      // 4. Отправляем транзакцию
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      // 5. Ждём подтверждения
      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      });

      // 6. Подтверждаем на бэкенде
      await confirmDeposit(depositId, signature);

      onSuccess(signature);
    } catch (error) {
      console.error('Deposit failed:', error);
    } finally {
      setLoading(false);
    }
  }, [publicKey, currency, amount, connection, sendTransaction]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p>Подключите кошелёк для депозита</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-gray-400">
        Кошелёк: {publicKey?.toBase58().slice(0, 8)}...
      </div>
      <button
        onClick={handleDeposit}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? 'Отправка...' : `Отправить ${amount} ${currency}`}
      </button>
    </div>
  );
};
```

### deposits.store.ts

```typescript
import { create } from 'zustand';
import { api } from '@/lib/api';

interface DepositsState {
  deposits: Deposit[];
  rates: { sol: number; fortune: number; usdt: number } | null;
  depositAddress: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchDeposits: () => Promise<void>;
  fetchRates: () => Promise<void>;
  fetchDepositAddress: (currency: DepositCurrency) => Promise<string>;
  initiateDeposit: (dto: InitiateDepositDto) => Promise<InitiateDepositResponse>;
  confirmDeposit: (depositId: string, txSignature: string) => Promise<void>;
}

export const useDepositsStore = create<DepositsState>((set, get) => ({
  deposits: [],
  rates: null,
  depositAddress: null,
  loading: false,
  error: null,

  fetchDeposits: async () => {
    set({ loading: true });
    try {
      const deposits = await api.getDeposits();
      set({ deposits, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchRates: async () => {
    const rates = await api.getDepositRates();
    set({ rates });
  },

  fetchDepositAddress: async (currency) => {
    const { address } = await api.getDepositAddress(currency);
    set({ depositAddress: address });
    return address;
  },

  initiateDeposit: async (dto) => {
    return api.initiateDeposit(dto);
  },

  confirmDeposit: async (depositId, txSignature) => {
    await api.confirmDeposit({ depositId, txSignature });
    // Обновляем список депозитов
    get().fetchDeposits();
  },
}));
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

# Frontend
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
NEXT_PUBLIC_USDT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
NEXT_PUBLIC_FORTUNE_MINT=4NBMaae5WYamCmHfaXuJDMk2eSWsoHDHqwJm5Epdpump
```

---

## NPM Dependencies

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "@solana/wallet-adapter-base": "^0.9.23",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-ui": "^0.9.35",
    "@solana/wallet-adapter-phantom": "^0.9.24",
    "@solana/wallet-adapter-solflare": "^0.6.28",
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
3. **Webhook Validation** — всегда проверять auth header от Helius
4. **Rate Limiting** — ограничить частоту запросов на генерацию адресов
5. **Duplicate Detection** — проверять txSignature на уникальность перед зачислением
6. **Confirmation** — ждать `confirmed` commitment перед зачислением
7. **Wallet Verification** — при Wallet Connect проверять подпись для привязки

---

## Frontend Integration

### Страница депозитов `/cash`

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEPOSIT PAGE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │   WALLET CONNECT    │  │   DEPOSIT ADDRESS   │                   │
│  │  (Рекомендуется)    │  │   (Для бирж)        │                   │
│  └──────────┬──────────┘  └──────────┬──────────┘                   │
│             │                         │                              │
│             ▼                         ▼                              │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ [Connect Wallet]    │  │ [Show QR Code]      │                   │
│  │                     │  │                     │                   │
│  │ Select currency:    │  │ Your address:       │                   │
│  │ ○ SOL              │  │ ABC...XYZ           │                   │
│  │ ○ USDT             │  │                     │                   │
│  │ ○ FORTUNE          │  │ ┌─────────────┐     │                   │
│  │                     │  │ │   QR CODE   │     │                   │
│  │ Amount: [____]      │  │ └─────────────┘     │                   │
│  │                     │  │                     │                   │
│  │ [Deposit Now]       │  │ Min: 0.01 SOL       │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    DEPOSIT HISTORY                               ││
│  ├─────────────────────────────────────────────────────────────────┤│
│  │ Date       │ Method  │ Currency │ Amount │ USD    │ Status      ││
│  │ 2026-01-14 │ Wallet  │ SOL      │ 1.5    │ $150   │ ✓ Credited  ││
│  │ 2026-01-13 │ Address │ USDT     │ 100    │ $100   │ ✓ Credited  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Testing

### Unit Tests
- AddressGeneratorService: derivation consistency
- DepositProcessorService: conversion rates, balance updates
- HeliusWebhookService: payload parsing, address matching
- SweepService: threshold logic, gas calculation

### Integration Tests
- Full wallet connect deposit flow (mock Helius webhook)
- Full deposit address flow (mock Helius webhook)
- Sweep flow (devnet)

### E2E Tests (Devnet)
- Real wallet connect deposit → webhook → credit flow
- Real deposit address → webhook → credit → sweep flow

---

## TODO

### Backend
- [ ] Создать DepositsModule (controller, service, DTOs)
- [ ] Реализовать AddressGeneratorService
- [ ] Реализовать HeliusWebhookService
- [ ] Реализовать DepositProcessorService
- [ ] Реализовать SweepService
- [ ] Реализовать PriceOracleService (SOL/USD)
- [ ] Обновить Prisma schema

### Frontend
- [ ] Добавить SolanaWalletProvider
- [ ] Создать deposits.store.ts
- [ ] Создать WalletConnectDeposit компонент
- [ ] Создать DepositAddressCard компонент
- [ ] Создать страницу /cash

### Testing
- [ ] Unit tests для всех сервисов
- [ ] Integration tests на devnet
