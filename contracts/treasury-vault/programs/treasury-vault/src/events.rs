use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub authority: Pubkey,
    pub payout_wallet: Pubkey,
    pub usdt_mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DepositEvent {
    pub vault: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub deposit_count: u32,
    pub timestamp: i64,
}

#[event]
pub struct PayoutEvent {
    pub vault: Pubkey,
    pub payout_wallet: Pubkey,
    pub amount: u64,
    pub total_paid_out: u64,
    pub payout_count: u32,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalCreatedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub expires_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalClaimedEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub total_paid_out: u64,
    pub payout_count: u32,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawalCancelledEvent {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
