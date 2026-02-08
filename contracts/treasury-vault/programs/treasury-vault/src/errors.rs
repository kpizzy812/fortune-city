use anchor_lang::prelude::*;

#[error_code]
pub enum TreasuryError {
    #[msg("Unauthorized: only vault authority can perform this action")]
    Unauthorized,

    #[msg("Invalid USDT mint address")]
    InvalidMint,

    #[msg("Invalid vault token account")]
    InvalidVaultAccount,

    #[msg("Invalid payout wallet")]
    InvalidPayoutWallet,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Insufficient vault balance for payout")]
    InsufficientBalance,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Withdrawal request has expired")]
    WithdrawalExpired,

    #[msg("Withdrawal has not expired yet, cannot cancel")]
    WithdrawalNotExpired,

    #[msg("Expiration duration must be positive")]
    InvalidExpiration,
}
