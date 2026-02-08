use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::errors::TreasuryError;
use crate::events::WithdrawalCreatedEvent;
use crate::state::{TreasuryVault, WithdrawalRequest};

#[derive(Accounts)]
pub struct CreateWithdrawal<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ TreasuryError::Unauthorized,
        has_one = usdt_mint @ TreasuryError::InvalidMint,
    )]
    pub vault: Account<'info, TreasuryVault>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    #[account(address = vault.vault_token_account @ TreasuryError::InvalidVaultAccount)]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: User wallet that will be allowed to claim. Not a signer — authority creates on behalf.
    pub user: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + WithdrawalRequest::INIT_SPACE,
        seeds = [b"withdrawal", vault.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub withdrawal_request: Account<'info, WithdrawalRequest>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_withdrawal(
    ctx: Context<CreateWithdrawal>,
    amount: u64,
    expires_in: i64,
) -> Result<()> {
    require!(amount > 0, TreasuryError::ZeroAmount);
    require!(expires_in > 0, TreasuryError::InvalidExpiration);

    // Verify vault has enough balance to cover this withdrawal
    require!(
        ctx.accounts.vault_token_account.amount >= amount,
        TreasuryError::InsufficientBalance
    );

    let clock = Clock::get()?;

    let request = &mut ctx.accounts.withdrawal_request;
    request.vault = ctx.accounts.vault.key();
    request.user = ctx.accounts.user.key();
    request.amount = amount;
    request.created_at = clock.unix_timestamp;
    request.expires_at = clock
        .unix_timestamp
        .checked_add(expires_in)
        .ok_or(TreasuryError::Overflow)?;
    request.bump = ctx.bumps.withdrawal_request;

    emit!(WithdrawalCreatedEvent {
        vault: ctx.accounts.vault.key(),
        user: ctx.accounts.user.key(),
        amount,
        expires_at: request.expires_at,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
