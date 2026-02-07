use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD");

#[program]
pub mod treasury_vault {
    use super::*;

    /// Initialize the treasury vault. Called once after deploy.
    /// Sets authority (backend wallet) and payout_wallet (payout destination).
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handle_initialize(ctx)
    }

    /// Deposit USDT into the vault. Only authority can call.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handle_deposit(ctx, amount)
    }

    /// Payout USDT from vault to payout_wallet. Only authority can call.
    pub fn payout(ctx: Context<Payout>, amount: u64) -> Result<()> {
        instructions::payout::handle_payout(ctx, amount)
    }

    /// Emergency pause/unpause. Only authority can call.
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused::handle_set_paused(ctx, paused)
    }

    /// Create a withdrawal request for a user. Only authority can call.
    /// User can then claim USDT directly by signing with their wallet.
    pub fn create_withdrawal(
        ctx: Context<CreateWithdrawal>,
        amount: u64,
        expires_in: i64,
    ) -> Result<()> {
        instructions::create_withdrawal::handle_create_withdrawal(ctx, amount, expires_in)
    }

    /// Claim a pending withdrawal. User signs with their wallet.
    /// USDT goes directly from vault to user's token account.
    pub fn claim_withdrawal(ctx: Context<ClaimWithdrawal>) -> Result<()> {
        instructions::claim_withdrawal::handle_claim_withdrawal(ctx)
    }

    /// Cancel an expired withdrawal request. Only authority can call.
    /// Cleans up the PDA and returns rent to authority.
    pub fn cancel_withdrawal(ctx: Context<CancelWithdrawal>) -> Result<()> {
        instructions::cancel_withdrawal::handle_cancel_withdrawal(ctx)
    }
}
