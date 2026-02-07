use anchor_lang::prelude::*;

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

    /// Number of deposit transactions
    pub deposit_count: u64,

    /// Number of payout transactions
    pub payout_count: u64,

    /// Last deposit unix timestamp
    pub last_deposit_at: i64,

    /// Last payout unix timestamp
    pub last_payout_at: i64,

    /// PDA bump seed
    pub bump: u8,

    /// Emergency pause flag
    pub paused: bool,
}
