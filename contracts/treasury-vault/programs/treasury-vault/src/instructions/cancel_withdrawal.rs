use anchor_lang::prelude::*;

use crate::errors::TreasuryError;
use crate::events::WithdrawalCancelledEvent;
use crate::state::{TreasuryVault, WithdrawalRequest};

#[derive(Accounts)]
pub struct CancelWithdrawal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ TreasuryError::Unauthorized,
    )]
    pub vault: Account<'info, TreasuryVault>,

    /// CHECK: Needed for PDA seed derivation. Validated through withdrawal_request.has_one.
    pub user: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"withdrawal", vault.key().as_ref(), user.key().as_ref()],
        bump = withdrawal_request.bump,
        has_one = vault @ TreasuryError::InvalidVaultAccount,
        close = authority,
    )]
    pub withdrawal_request: Account<'info, WithdrawalRequest>,
}

pub fn handle_cancel_withdrawal(ctx: Context<CancelWithdrawal>) -> Result<()> {
    let clock = Clock::get()?;

    // Can only cancel expired withdrawal requests
    require!(
        clock.unix_timestamp > ctx.accounts.withdrawal_request.expires_at,
        TreasuryError::WithdrawalNotExpired
    );

    emit!(WithdrawalCancelledEvent {
        vault: ctx.accounts.vault.key(),
        user: ctx.accounts.user.key(),
        amount: ctx.accounts.withdrawal_request.amount,
        timestamp: clock.unix_timestamp,
    });

    // PDA is closed automatically via `close = authority` constraint

    Ok(())
}
