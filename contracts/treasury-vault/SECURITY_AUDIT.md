# Treasury Vault — Security & Transparency Report

**Contract:** Fortune City Treasury Vault
**Framework:** Anchor 0.31.1 (Solana)
**Audited by:** Internal security review
**Date:** February 2025
**Binary size:** 287 KB
**Program ID (devnet):** `9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD`

---

## Why This Contract Exists

Fortune City uses an **on-chain Treasury Vault** to store player funds as USDT on the Solana blockchain. This means your deposits are not held in a traditional database — they are held in a **publicly verifiable smart contract** that anyone can audit.

**Key principle:** Users maintain control over their assets. When withdrawing via wallet connect, users sign the transaction themselves — funds go directly from the vault to the user's wallet with no intermediary.

---

## 1. Architecture Overview

The Treasury Vault is a Solana program (smart contract) that acts as a **transparent on-chain escrow** for USDT (SPL Token).

**Instructions:** `initialize`, `deposit`, `payout`, `set_paused`, `create_withdrawal`, `claim_withdrawal`, `cancel_withdrawal`
**State:** `TreasuryVault` PDA (vault account) + `WithdrawalRequest` PDAs (per-user withdrawal requests)
**Token standard:** SPL Token Interface (Token + Token-2022 compatible)

### How Funds Move

```
Deposit:    Player deposits → Vault on-chain token account
Withdrawal: Vault → Player's wallet (user signs the claim transaction)
```

Every deposit, withdrawal, and claim is a **Solana transaction** — publicly visible on any block explorer (Solscan, Solana Explorer).

---

## 2. Anti-Scam Design

The Treasury Vault is designed to make rug pulls and fund misappropriation **structurally impossible** at the smart contract level:

### 2.1 No Arbitrary Withdrawal

There is no `withdraw`, `close`, or `drain` instruction in the contract. Funds cannot be sent to arbitrary addresses.

- Payouts go **only** to a hardcoded payout wallet set at initialization
- User withdrawals go **only** to the user's own wallet (user must sign)
- No one — not even the contract authority — can redirect funds elsewhere

### 2.2 Immutable Configuration

Once the vault is initialized, the following parameters **cannot be changed**:

- **Authority** — who operates the vault
- **Payout wallet** — where operational payouts go
- **USDT mint** — which token the vault holds
- **Token account** — which account stores the USDT

There is no `update_authority`, `update_payout_wallet`, or similar instruction. This eliminates all "rug pull via config change" vectors.

### 2.3 No Vault Closure

There is no `close` instruction. The vault PDA and its token account **exist permanently**. The vault cannot be drained of SOL or closed.

### 2.4 Non-Upgradeable Program

The contract is deployed with the `--final` flag, making it **non-upgradeable**. No one — including the original deployer — can modify the program code after deployment.

---

## 3. User Withdrawal — Direct On-Chain Control

Users who connect their Solana wallet can withdraw USDT **directly from the vault** by signing a claim transaction. This is the most transparent withdrawal method:

### How It Works

1. **Withdrawal request created** — an on-chain PDA records the user's address and approved amount
2. **User signs `claim_withdrawal`** — USDT transfers directly from the vault to the user's token account
3. **PDA closed** — the withdrawal request is permanently closed after the claim

### User Protections

| Protection | How it works |
|-----------|-------------|
| Only you can claim your withdrawal | `claim_withdrawal` requires **your wallet signature** |
| No one can cancel your active request | `cancel_withdrawal` only works **after the expiry window** |
| Guaranteed claim window | Users have a full time window (default: 1 hour) to claim |
| Funds go directly to your wallet | USDT lands in your Associated Token Account (ATA) |
| No double-spending | After claim, the PDA is permanently closed — cannot be re-used |
| On-chain proof | Every claim is a Solana transaction visible on block explorers |

---

## 4. Access Control

| Instruction           | Who can call        | What it does                                    |
|-----------------------|---------------------|-------------------------------------------------|
| `initialize`          | Anyone (once)       | Creates the vault (one-time setup)              |
| `deposit`             | Authority only      | Deposits USDT into the vault                    |
| `payout`              | Authority only      | Sends USDT to the hardcoded payout wallet       |
| `set_paused`          | Authority only      | Emergency pause/unpause                         |
| `create_withdrawal`   | Authority only      | Creates a withdrawal request for a user         |
| `claim_withdrawal`    | **User only**       | User claims USDT directly to their wallet       |
| `cancel_withdrawal`   | Authority only      | Cancels **expired** withdrawal requests only    |

**Key:** The authority can operate the vault, but **cannot redirect funds** to any address other than the hardcoded payout wallet or designated users.

---

## 5. Vulnerability Checklist

| Vulnerability                     | Status | Details                                                  |
|-----------------------------------|--------|----------------------------------------------------------|
| Missing signer check              | SAFE   | Authority + User use `Signer<'info>` appropriately       |
| Missing owner check               | SAFE   | `Account<'info, T>` validates discriminator + owner      |
| PDA seed collision                 | SAFE   | Seeds include unique pubkeys — no collision possible      |
| Integer overflow                   | SAFE   | `checked_add` on all counters and amounts                |
| Reentrancy                         | SAFE   | Solana's execution model prevents reentrancy             |
| Arbitrary CPI                      | SAFE   | Only CPI is to SPL Token program via `transfer_checked`  |
| Account confusion                  | SAFE   | `has_one` + `address` constraints on all accounts        |
| Uninitialized account read         | SAFE   | Anchor's `Account<T>` validates discriminator            |
| Duplicate mutable accounts         | SAFE   | Anchor prevents duplicate accounts in same instruction   |
| Missing rent-exempt check          | SAFE   | Anchor's `init` ensures rent exemption                   |
| Token program substitution         | SAFE   | `Interface<TokenInterface>` validates program ID         |
| Mint mismatch                      | SAFE   | `has_one = usdt_mint` + `transfer_checked` with decimals |
| PDA revival after close            | SAFE   | Anchor `close` sets CLOSED_ACCOUNT_DISCRIMINATOR         |
| Withdrawal double-claim            | SAFE   | PDA closed after claim — second claim finds no account   |
| Unauthorized claim                 | SAFE   | `has_one = user` + `user: Signer` on claim               |
| Premature cancel                   | SAFE   | Expiry check prevents cancel before user's deadline      |
| Duplicate withdrawal request       | SAFE   | PDA `init` fails if request already exists               |

---

## 6. Economic Security

### 6.1 Fund Safety

- Vault holds USDT in a **PDA-owned token account** — no individual controls the private key
- No flash loan vector — deposits and withdrawals are separate transactions
- No oracle dependency — amounts are explicit parameters, no price manipulation possible
- All token transfers use `transfer_checked` — enforcing correct mint and decimal validation

### 6.2 Withdrawal Request Security

- **Guaranteed claim window:** Users have a full time window to claim. The authority **cannot cancel** an active (non-expired) request
- **No double-spend:** PDA is permanently closed after claim — cannot be re-used or replayed
- **Balance verification:** Both creation and claim verify that the vault has sufficient balance
- **One request per user:** PDA seeds enforce at most one active withdrawal request per user

### 6.3 Griefing Vectors

- **Deposit spam:** Authority-only — third parties cannot affect the vault
- **Payout front-running:** Not applicable — only authority can initiate
- **Claim replay:** PDA closed after claim — `CLOSED_ACCOUNT_DISCRIMINATOR` prevents reactivation
- **Withdrawal PDA spam:** Authority-only creation — third parties cannot create PDAs

---

## 7. On-Chain Transparency

### What You Can Verify

Every action on the Treasury Vault emits on-chain events and creates verifiable Solana transactions:

| Event | What it proves |
|-------|---------------|
| `DepositEvent` | Funds were deposited into the vault |
| `PayoutEvent` | Funds were sent to the payout wallet |
| `WithdrawalCreatedEvent` | A withdrawal request was created for a user |
| `WithdrawalClaimedEvent` | A user claimed their funds |
| `WithdrawalCancelledEvent` | An expired withdrawal request was cleaned up |
| `VaultPausedEvent` | Vault was paused/unpaused (emergency only) |

### How to Verify

1. **Vault balance** — check the vault's token account on [Solscan](https://solscan.io)
2. **Transaction history** — view all deposits, payouts, and claims on any Solana explorer
3. **Program code** — the contract source code is open and the deployed binary matches
4. **Your withdrawal** — every claim_withdrawal is a signed Solana transaction in your wallet history

---

## 8. Test Coverage

| Test                                    | Status |
|-----------------------------------------|--------|
| Initialize creates correct state        | PASS   |
| Rejects double initialization           | PASS   |
| Deposits correct amount                 | PASS   |
| Accumulates deposit stats               | PASS   |
| Rejects zero deposit                    | PASS   |
| Rejects unauthorized deposit            | PASS   |
| Payout sends to correct wallet          | PASS   |
| Rejects payout exceeding balance        | PASS   |
| Rejects zero payout                     | PASS   |
| Rejects payout to wrong wallet          | PASS   |
| Pause blocks deposits                   | PASS   |
| Pause blocks payouts                    | PASS   |
| Unpause restores functionality          | PASS   |
| Deposit works after unpause             | PASS   |
| Rejects unauthorized pause              | PASS   |
| Rejects double init                     | PASS   |
| Creates withdrawal request              | PASS   |
| Rejects duplicate withdrawal request    | PASS   |
| Rejects claim by unauthorized user      | PASS   |
| User claims withdrawal successfully     | PASS   |
| Rejects cancel before expiry            | PASS   |
| Rejects claim after expiry              | PASS   |
| Cancels expired withdrawal request      | PASS   |
| Rejects create_withdrawal when paused   | PASS   |
| Rejects claim when paused               | PASS   |
| Vault stats updated after claim         | PASS   |

**26/26 tests passing** (localnet)

---

## 9. Conclusion

**Overall Risk: LOW**

The Treasury Vault is designed with a **security-first, minimal-surface** approach:

- **7 instructions** with strict access control — no backdoors, no admin override on user claims
- **Immutable configuration** — vault parameters cannot be changed after initialization
- **Non-upgradeable program** — deployed with `--final` flag, code cannot be modified
- **User sovereignty** — users sign their own withdrawal transactions with their wallet
- **Full on-chain transparency** — every transaction is publicly verifiable on Solana explorers
- **No close/drain mechanism** — the vault cannot be emptied or shut down by anyone

The contract is designed so that **even if the authority key were compromised**, funds cannot be redirected to unauthorized addresses. The payout destination is hardcoded at initialization, and user claims require the user's own wallet signature.

Fortune City's Treasury Vault provides the same level of transparency and user control that you would expect from a DeFi protocol — your funds are on-chain, verifiable, and accessible through your own wallet.
