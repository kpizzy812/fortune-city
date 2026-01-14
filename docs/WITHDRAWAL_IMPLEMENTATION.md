# Withdrawal Implementation Guide

**Дата:** 2026-01-14
**Статус:** В разработке
**Цель:** Вывод средств только в USDT SPL на Solana

---

## Изученная архитектура проекта

### Стек технологий
- **Backend:** NestJS 11, Prisma 6, PostgreSQL
- **Frontend:** Next.js 16, React 19, Zustand, Tailwind
- **Blockchain:** Solana (mainnet)
- **Библиотеки Solana:**
  - `@solana/web3.js`: ^1.98.4 (классический API v1)
  - `@solana/spl-token`: ^0.4.14

### Ключевые существующие сервисы

#### 1. SolanaRpcService (`apps/api/src/modules/deposits/services/solana-rpc.service.ts`)
```typescript
// Уже реализованные методы:
- getConnection(): Connection
- getHotWalletKeypair(): Keypair | null
- getHotWalletAddress(): string | null
- getBalance(pubkey: PublicKey): Promise<number>
- getTokenBalance(owner: PublicKey, mint: string): Promise<number>
- transferSol(from: Keypair, to: PublicKey, lamports: number): Promise<string>
- transferToken(from: Keypair, to: PublicKey, mint: PublicKey, amount: number): Promise<string>
- confirmTransaction(signature: string, commitment?: Commitment): Promise<boolean>
```

#### 2. FundSourceService (`apps/api/src/modules/economy/services/fund-source.service.ts`)
**КРИТИЧЕСКИ ВАЖНЫЙ для налогообложения!**
```typescript
// Методы для отслеживания источников средств:
- calculateSourceBreakdown(userFortuneBalance, userTotalFreshDeposits, amountToSpend): FundSourceBreakdown
- recordProfitCollection(userId, incomeAmount, tx?): Promise<void>
- recordFreshDeposit(userId, amount, tx?): Promise<void>
- recordWithdrawal(userId, amount, tx?): Promise<{ fromFresh: Decimal; fromProfit: Decimal }>
```

**Логика налогообложения:**
- `fromProfit` — облагается налогом (currentTaxRate зависит от maxTierReached)
- `fromFresh` — 0% налог (это изначальные депозиты пользователя)
- При выводе сначала списывается profit (с налогом), потом fresh (без налога)

#### 3. DepositsService (`apps/api/src/modules/deposits/deposits.service.ts`)
Паттерн для Withdrawal:
- Использует nanoid для генерации уникальных ID
- Атомарные транзакции через Prisma.$transaction
- Статусы: pending → confirmed → credited/failed

### Prisma Schema — существующие модели

```prisma
// User (ключевые поля для withdrawal)
model User {
  fortuneBalance       Decimal  // Баланс в USD (исторически называется fortune)
  totalFreshDeposits   Decimal  // Чистые депозиты (0% налог при выводе)
  totalProfitCollected Decimal  // Накопленный profit (облагается налогом)
  maxTierReached       Int      // Для расчёта налоговой ставки
  currentTaxRate       Decimal  // Текущая ставка (0.5 → 0.1)
  walletConnections    WalletConnection[]
}

// WalletConnection — связь кошелька пользователя
model WalletConnection {
  userId        String
  chain         Chain    // solana
  walletAddress String
  @@unique([userId, chain])
}

// Deposit — образец для Withdrawal
model Deposit {
  id          String
  userId      String
  method      DepositMethod
  chain       Chain
  currency    DepositCurrency
  txSignature String @unique
  amount      Decimal
  amountUsd   Decimal
  status      DepositStatus // pending, confirmed, credited, failed
}
```

### Константы токенов (`apps/api/src/modules/deposits/constants/tokens.ts`)

```typescript
SOLANA_TOKENS = {
  SOL: { decimals: 9 },
  USDT: { decimals: 6, mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  FORTUNE: { decimals: 9 }
}

LAMPORTS_PER_SOL = 1_000_000_000
```

### Налоговые ставки (из math.md)

| Макс тир | Налог на прибыль |
|----------|------------------|
| 1 | 50% |
| 2 | 45% |
| 3 | 40% |
| 4 | 35% |
| 5 | 30% |
| 6 | 25% |
| 7 | 20% |
| 8 | 15% |
| 9 | 12% |
| 10 | 10% |

---

## План реализации Withdrawal Module

### 1. Prisma Schema — добавить модель Withdrawal

```prisma
model Withdrawal {
  id        String @id @default(cuid())
  userId    String @map("user_id")
  user      User   @relation(fields: [userId], references: [id])

  // Destination
  chain           Chain    @default(solana)
  currency        WithdrawalCurrency  // Только USDT_SOL
  walletAddress   String   @map("wallet_address")

  // Amounts (все в USD, т.к. fortuneBalance = USD)
  requestedAmount Decimal  @map("requested_amount") @db.Decimal(20, 8)  // Сколько запросил

  // Tax breakdown
  fromFreshDeposit Decimal @map("from_fresh_deposit") @db.Decimal(20, 8)  // Часть из fresh (0% налог)
  fromProfit       Decimal @map("from_profit") @db.Decimal(20, 8)         // Часть из profit (taxed)
  taxAmount        Decimal @map("tax_amount") @db.Decimal(20, 8)          // Сумма налога
  taxRate          Decimal @map("tax_rate") @db.Decimal(5, 4)             // Ставка на момент вывода

  // Final amount
  netAmount        Decimal @map("net_amount") @db.Decimal(20, 8)          // После налога (в USD)
  usdtAmount       Decimal @map("usdt_amount") @db.Decimal(20, 8)         // USDT к отправке (= netAmount для USDT)

  // Transaction
  txSignature      String? @unique @map("tx_signature")

  // Status
  status           WithdrawalStatus @default(pending)
  errorMessage     String?          @map("error_message")

  // Timestamps
  processedAt      DateTime?        @map("processed_at")
  createdAt        DateTime         @default(now()) @map("created_at")
  updatedAt        DateTime         @updatedAt @map("updated_at")

  @@index([userId])
  @@index([status])
  @@map("withdrawals")
}

enum WithdrawalCurrency {
  USDT_SOL
}

enum WithdrawalStatus {
  pending      // Создан, ожидает обработки
  processing   // В процессе отправки
  completed    // Успешно отправлен
  failed       // Ошибка
  cancelled    // Отменён пользователем
}

// Добавить relation в User
model User {
  // ... existing
  withdrawals Withdrawal[]
}
```

### 2. DTOs (`apps/api/src/modules/withdrawals/dto/`)

```typescript
// withdrawal.dto.ts
export class CreateWithdrawalDto {
  @IsNumber()
  @Min(1) // Минимум 1 USD
  amount: number;

  @IsString()
  walletAddress: string; // Куда отправить USDT
}

export class WithdrawalPreviewDto {
  requestedAmount: number;
  fromFreshDeposit: number;
  fromProfit: number;
  taxRate: number;
  taxAmount: number;
  netAmount: number;
  usdtAmount: number;
}

export class WithdrawalResponseDto {
  id: string;
  status: WithdrawalStatus;
  requestedAmount: number;
  netAmount: number;
  txSignature: string | null;
}
```

### 3. WithdrawalService — основная логика

```typescript
// apps/api/src/modules/withdrawals/withdrawals.service.ts

@Injectable()
export class WithdrawalsService {
  constructor(
    private prisma: PrismaService,
    private fundSource: FundSourceService,
    private solanaRpc: SolanaRpcService,
    private config: ConfigService,
  ) {}

  /**
   * Предварительный расчёт (показать пользователю до подтверждения)
   */
  async previewWithdrawal(userId: string, amount: number): Promise<WithdrawalPreviewDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fortuneBalance: true,
        totalFreshDeposits: true,
        totalProfitCollected: true,
        currentTaxRate: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const balance = Number(user.fortuneBalance);
    if (amount > balance) {
      throw new BadRequestException('Insufficient balance');
    }

    // Рассчитываем breakdown: сколько из profit, сколько из fresh
    const breakdown = this.fundSource.calculateSourceBreakdown(
      user.fortuneBalance,
      user.totalFreshDeposits,
      amount,
    );

    const taxRate = Number(user.currentTaxRate);
    // Налог только на profit часть
    const taxAmount = breakdown.profitDerived * taxRate;
    const netAmount = amount - taxAmount;

    return {
      requestedAmount: amount,
      fromFreshDeposit: breakdown.freshDeposit,
      fromProfit: breakdown.profitDerived,
      taxRate,
      taxAmount,
      netAmount,
      usdtAmount: netAmount, // 1:1 для USDT
    };
  }

  /**
   * Создание заявки на вывод
   */
  async createWithdrawal(userId: string, dto: CreateWithdrawalDto): Promise<Withdrawal> {
    const { amount, walletAddress } = dto;

    // Валидация адреса Solana
    try {
      new PublicKey(walletAddress);
    } catch {
      throw new BadRequestException('Invalid Solana wallet address');
    }

    // Проверка баланса hot wallet
    const hotWalletHasBalance = await this.checkHotWalletBalance(amount);
    if (!hotWalletHasBalance) {
      throw new BadRequestException('Withdrawal temporarily unavailable');
    }

    // Рассчитываем налог
    const preview = await this.previewWithdrawal(userId, amount);

    // Атомарная транзакция
    return this.prisma.$transaction(async (tx) => {
      // 1. Списываем с баланса пользователя
      await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: amount },
        },
      });

      // 2. Обновляем трекеры (fresh/profit)
      await this.fundSource.recordWithdrawal(userId, amount, tx);

      // 3. Создаём запись withdrawal
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          chain: 'solana',
          currency: 'USDT_SOL',
          walletAddress,
          requestedAmount: amount,
          fromFreshDeposit: preview.fromFreshDeposit,
          fromProfit: preview.fromProfit,
          taxAmount: preview.taxAmount,
          taxRate: preview.taxRate,
          netAmount: preview.netAmount,
          usdtAmount: preview.usdtAmount,
          status: 'pending',
        },
      });

      // 4. Создаём Transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'withdrawal',
          amount,
          currency: 'USDT',
          taxAmount: preview.taxAmount,
          taxRate: preview.taxRate,
          netAmount: preview.netAmount,
          fromFreshDeposit: preview.fromFreshDeposit,
          fromProfit: preview.fromProfit,
          chain: 'solana',
          status: 'pending',
        },
      });

      return withdrawal;
    });
  }

  /**
   * Обработка вывода (отправка USDT)
   * Вызывается через Cron или вручную админом
   */
  async processWithdrawal(withdrawalId: string): Promise<Withdrawal> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Withdrawal already processed');
    }

    // Обновляем статус
    await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'processing' },
    });

    try {
      const hotWallet = this.solanaRpc.getHotWalletKeypair();
      if (!hotWallet) {
        throw new Error('Hot wallet not configured');
      }

      const recipient = new PublicKey(withdrawal.walletAddress);
      const usdtMint = new PublicKey(this.config.get('USDT_MINT'));

      // USDT имеет 6 decimals
      const usdtAmount = Math.floor(Number(withdrawal.usdtAmount) * 1_000_000);

      // Отправляем USDT
      const signature = await this.solanaRpc.transferToken(
        hotWallet,
        recipient,
        usdtMint,
        usdtAmount,
      );

      // Обновляем статус
      return this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'completed',
          txSignature: signature,
          processedAt: new Date(),
        },
      });

    } catch (error) {
      // Ошибка — откатываем средства пользователю
      await this.rollbackWithdrawal(withdrawal);

      return this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          errorMessage: error.message,
        },
      });
    }
  }

  /**
   * Откат при ошибке — возврат средств пользователю
   */
  private async rollbackWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Возвращаем баланс
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          fortuneBalance: { increment: withdrawal.requestedAmount },
          totalFreshDeposits: { increment: withdrawal.fromFreshDeposit },
          totalProfitCollected: { increment: withdrawal.fromProfit },
        },
      });
    });
  }

  /**
   * Проверка баланса hot wallet
   */
  private async checkHotWalletBalance(amountUsd: number): Promise<boolean> {
    const hotWallet = this.solanaRpc.getHotWalletAddress();
    if (!hotWallet) return false;

    const usdtMint = this.config.get<string>('USDT_MINT');
    const balance = await this.solanaRpc.getTokenBalance(
      new PublicKey(hotWallet),
      usdtMint,
    );

    // Balance в raw units (6 decimals для USDT)
    const balanceUsd = balance / 1_000_000;
    return balanceUsd >= amountUsd;
  }
}
```

### 4. WithdrawalController

```typescript
// apps/api/src/modules/withdrawals/withdrawals.controller.ts

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalsController {
  constructor(private withdrawalsService: WithdrawalsService) {}

  /**
   * GET /withdrawals/preview?amount=100
   * Предварительный расчёт налога
   */
  @Get('preview')
  async previewWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Query('amount', ParseFloatPipe) amount: number,
  ): Promise<WithdrawalPreviewDto> {
    return this.withdrawalsService.previewWithdrawal(user.sub, amount);
  }

  /**
   * POST /withdrawals
   * Создать заявку на вывод
   */
  @Post()
  async createWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWithdrawalDto,
  ): Promise<WithdrawalResponseDto> {
    const withdrawal = await this.withdrawalsService.createWithdrawal(user.sub, dto);
    return {
      id: withdrawal.id,
      status: withdrawal.status,
      requestedAmount: Number(withdrawal.requestedAmount),
      netAmount: Number(withdrawal.netAmount),
      txSignature: withdrawal.txSignature,
    };
  }

  /**
   * GET /withdrawals
   * История выводов
   */
  @Get()
  async getWithdrawals(@CurrentUser() user: JwtPayload): Promise<Withdrawal[]> {
    return this.withdrawalsService.getUserWithdrawals(user.sub);
  }

  /**
   * GET /withdrawals/:id
   * Статус конкретного вывода
   */
  @Get(':id')
  async getWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<Withdrawal> {
    return this.withdrawalsService.getWithdrawalById(user.sub, id);
  }
}
```

### 5. WithdrawalModule

```typescript
// apps/api/src/modules/withdrawals/withdrawals.module.ts

@Module({
  imports: [
    PrismaModule,
    DepositsModule, // Для SolanaRpcService
    EconomyModule,  // Для FundSourceService
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
```

### 6. Cron для обработки выводов

```typescript
// В WithdrawalsService или отдельный WithdrawalProcessorService

@Cron('*/30 * * * * *') // Каждые 30 секунд
async processPendingWithdrawals(): Promise<void> {
  if (!this.config.get<boolean>('WITHDRAWAL_PROCESSING_ENABLED')) {
    return;
  }

  const pending = await this.prisma.withdrawal.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 5, // Обрабатываем по 5 за раз
  });

  for (const withdrawal of pending) {
    try {
      await this.processWithdrawal(withdrawal.id);
      this.logger.log(`Processed withdrawal ${withdrawal.id}`);
    } catch (error) {
      this.logger.error(`Failed to process withdrawal ${withdrawal.id}`, error);
    }
  }
}
```

---

## Frontend Implementation

### 1. withdrawals.store.ts

```typescript
// apps/web/src/stores/withdrawals.store.ts

interface WithdrawalsState {
  withdrawals: Withdrawal[];
  preview: WithdrawalPreview | null;
  loading: boolean;
  error: string | null;

  fetchWithdrawals: () => Promise<void>;
  previewWithdrawal: (amount: number) => Promise<WithdrawalPreview>;
  createWithdrawal: (amount: number, walletAddress: string) => Promise<Withdrawal>;
}

export const useWithdrawalsStore = create<WithdrawalsState>((set, get) => ({
  withdrawals: [],
  preview: null,
  loading: false,
  error: null,

  fetchWithdrawals: async () => {
    set({ loading: true });
    try {
      const withdrawals = await api.getWithdrawals();
      set({ withdrawals, error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  previewWithdrawal: async (amount: number) => {
    const preview = await api.previewWithdrawal(amount);
    set({ preview });
    return preview;
  },

  createWithdrawal: async (amount: number, walletAddress: string) => {
    set({ loading: true });
    try {
      const withdrawal = await api.createWithdrawal({ amount, walletAddress });
      get().fetchWithdrawals();
      return withdrawal;
    } finally {
      set({ loading: false });
    }
  },
}));
```

### 2. API методы (lib/api.ts)

```typescript
// Добавить в apps/web/src/lib/api.ts

export async function previewWithdrawal(amount: number): Promise<WithdrawalPreview> {
  return fetchApi(`/withdrawals/preview?amount=${amount}`);
}

export async function createWithdrawal(dto: CreateWithdrawalDto): Promise<Withdrawal> {
  return fetchApi('/withdrawals', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getWithdrawals(): Promise<Withdrawal[]> {
  return fetchApi('/withdrawals');
}
```

### 3. UI компоненты

Страница `/cash` должна иметь две вкладки:
1. **Deposit** — существующая
2. **Withdraw** — новая

```
┌─────────────────────────────────────────────────────────────┐
│                    WITHDRAW (Cash Out)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Available Balance: $1,247.50                               │
│  Your Tax Rate: 30% (Tier 5)                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Amount (USD): [________100________]                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ USDT Address: [__________________________]           │    │
│  │ (Solana SPL Token address)                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ═══════════════════════════════════════════════════════    │
│  BREAKDOWN:                                                  │
│  ───────────────────────────────────────────────────────    │
│  From Fresh Deposits (0% tax):    $65.00                    │
│  From Profit (30% tax):           $35.00                    │
│  Tax Amount:                      -$10.50                   │
│  ───────────────────────────────────────────────────────    │
│  YOU WILL RECEIVE:                $89.50 USDT               │
│  ═══════════════════════════════════════════════════════    │
│                                                              │
│  [        WITHDRAW $100 → $89.50 USDT        ]             │
│                                                              │
│  ⚠️ Withdrawals are processed within 5-15 minutes          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Локализация

Добавить переводы в `apps/web/src/messages/`:

```json
// ru/cash.json
{
  "withdraw": {
    "title": "Вывод средств",
    "availableBalance": "Доступный баланс",
    "yourTaxRate": "Ваша налоговая ставка",
    "amount": "Сумма (USD)",
    "walletAddress": "USDT адрес (Solana)",
    "breakdown": "Расчёт",
    "fromFresh": "Из депозитов (0% налог)",
    "fromProfit": "Из прибыли ({rate}% налог)",
    "taxAmount": "Сумма налога",
    "youWillReceive": "Вы получите",
    "withdrawButton": "Вывести {amount} → {net} USDT",
    "processingNote": "Выводы обрабатываются в течение 5-15 минут",
    "minAmount": "Минимальная сумма: $1",
    "insufficientBalance": "Недостаточно средств",
    "invalidAddress": "Неверный адрес кошелька"
  }
}
```

---

## Безопасность

1. **Rate Limiting** — ограничить частоту создания withdrawals (например, 1 в минуту)
2. **Minimum Amount** — минимум $1 для вывода
3. **Maximum Amount** — лимит на разовый вывод (например, $10,000)
4. **Daily Limit** — дневной лимит на вывод
5. **KYC Requirement** — для крупных выводов (опционально)
6. **Cooldown** — задержка между выводами
7. **Address Validation** — проверка что адрес валидный Solana pubkey
8. **Hot Wallet Monitoring** — мониторинг баланса hot wallet

---

## ENV Variables

```env
# Withdrawal Processing
WITHDRAWAL_PROCESSING_ENABLED=true
WITHDRAWAL_MIN_AMOUNT=1
WITHDRAWAL_MAX_AMOUNT=10000
WITHDRAWAL_DAILY_LIMIT=50000
WITHDRAWAL_COOLDOWN_MINUTES=5

# Существующие (для deposits/withdrawals)
SOLANA_HOT_WALLET=<public key>
SOLANA_HOT_WALLET_SECRET=<secret key>
USDT_MINT=Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
```

---

## Чеклист реализации

- [ ] 1. Обновить Prisma schema (добавить Withdrawal model)
- [ ] 2. `pnpm db:generate && pnpm db:push`
- [ ] 3. Создать `apps/api/src/modules/withdrawals/`:
  - [ ] dto/index.ts
  - [ ] withdrawals.service.ts
  - [ ] withdrawals.controller.ts
  - [ ] withdrawals.module.ts
- [ ] 4. Добавить WithdrawalsModule в app.module.ts
- [ ] 5. Создать тесты withdrawals.service.spec.ts
- [ ] 6. Frontend:
  - [ ] stores/withdrawals.store.ts
  - [ ] API методы в lib/api.ts
  - [ ] Компонент WithdrawForm в components/cash/
  - [ ] Обновить cash/page.tsx (добавить вкладку Withdraw)
- [ ] 7. Локализация (messages/ru/cash.json, messages/en/cash.json)
- [ ] 8. `pnpm lint && pnpm build`
- [ ] 9. Тестирование на devnet

---

## Важные паттерны из кодовой базы

1. **Атомарные транзакции** — всегда использовать `prisma.$transaction()` для связанных операций
2. **Decimal** — все денежные суммы хранить как `Decimal`, не `number`
3. **Status enum** — использовать enum для статусов (pending → processing → completed/failed)
4. **Error handling** — при ошибке отправки откатывать средства пользователю
5. **Logging** — логировать все операции через `Logger`
6. **Guards** — использовать `@UseGuards(JwtAuthGuard)` для защиты endpoints
7. **CurrentUser** — использовать `@CurrentUser()` decorator для получения userId

---

## Ссылки на ключевые файлы

- Schema: `apps/api/prisma/schema.prisma`
- SolanaRPC: `apps/api/src/modules/deposits/services/solana-rpc.service.ts`
- FundSource: `apps/api/src/modules/economy/services/fund-source.service.ts`
- Deposits: `apps/api/src/modules/deposits/deposits.service.ts`
- Token constants: `apps/api/src/modules/deposits/constants/tokens.ts`
- Deposits DTOs: `apps/api/src/modules/deposits/dto/index.ts`
