use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::errors::TreasuryError;
use crate::events::DepositEvent;
use crate::state::TreasuryVault;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ TreasuryError::Unauthorized,
        has_one = usdt_mint @ TreasuryError::InvalidMint,
        constraint = !vault.paused @ TreasuryError::VaultPaused,
    )]
    pub vault: Account<'info, TreasuryVault>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    /// Authority's USDT token account (source of deposit)
    #[account(
        mut,
        associated_token::mint = usdt_mint,
        associated_token::authority = authority,
        associated_token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Vault's USDT token account (destination)
    #[account(
        mut,
        address = vault.vault_token_account @ TreasuryError::InvalidVaultAccount,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, TreasuryError::ZeroAmount);

    // Transfer USDT from authority to vault (authority signs as owner)
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.authority_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
                mint: ctx.accounts.usdt_mint.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.usdt_mint.decimals,
    )?;

    // Update vault stats
    let vault = &mut ctx.accounts.vault;
    vault.total_deposited = vault
        .total_deposited
        .checked_add(amount)
        .ok_or(TreasuryError::Overflow)?;
    vault.deposit_count = vault
        .deposit_count
        .checked_add(1)
        .ok_or(TreasuryError::Overflow)?;
    vault.last_deposit_at = Clock::get()?.unix_timestamp;

    emit!(DepositEvent {
        vault: vault.key(),
        amount,
        total_deposited: vault.total_deposited,
        deposit_count: vault.deposit_count,
        timestamp: vault.last_deposit_at,
    });

    Ok(())
}
