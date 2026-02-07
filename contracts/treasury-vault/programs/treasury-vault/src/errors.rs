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

    #[msg("Vault is paused")]
    VaultPaused,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Insufficient vault balance for payout")]
    InsufficientBalance,

    #[msg("Arithmetic overflow")]
    Overflow,
}
