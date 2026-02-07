use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5bdiY9qaWc5qYtxgHzydCmU4dpssmCXLqXQBtG6Q2pa4");

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
}
