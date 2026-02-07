use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct WithdrawalRequest {
    /// Which vault this withdrawal is from
    pub vault: Pubkey,

    /// User who can claim this withdrawal
    pub user: Pubkey,

    /// Amount in raw USDT units (6 decimals)
    pub amount: u64,

    /// Unix timestamp when request was created
    pub created_at: i64,

    /// Unix timestamp after which claim is no longer possible
    pub expires_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TreasuryVault {
    /// Authority (backend wallet) — only this key can call deposit/payout
    pub authority: Pubkey,

    /// Payout wallet — the only allowed recipient of payout instructions
    pub payout_wallet: Pubkey,

    /// USDT SPL mint address
    pub usdt_mint: Pubkey,

    /// Vault's token account (ATA owned by this PDA)
    pub vault_token_account: Pubkey,

    /// Total USDT deposited (raw units, 6 decimals)
    pub total_deposited: u64,

    /// Total USDT paid out (raw units, 6 decimals)
    pub total_paid_out: u64,

    /// Number of deposit transactions (u32 = up to 4B ops)
    pub deposit_count: u32,

    /// Number of payout transactions (u32 = up to 4B ops)
    pub payout_count: u32,

    /// Last deposit unix timestamp
    pub last_deposit_at: i64,

    /// Last payout unix timestamp
    pub last_payout_at: i64,

    /// PDA bump seed
    pub bump: u8,
}
