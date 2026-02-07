use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
    },
};

use crate::errors::TreasuryError;
use crate::events::PayoutEvent;
use crate::state::TreasuryVault;

#[derive(Accounts)]
pub struct Payout<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ TreasuryError::Unauthorized,
        has_one = payout_wallet @ TreasuryError::InvalidPayoutWallet,
        has_one = usdt_mint @ TreasuryError::InvalidMint,
        constraint = !vault.paused @ TreasuryError::VaultPaused,
    )]
    pub vault: Account<'info, TreasuryVault>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    /// Vault's USDT token account (source — PDA is authority)
    #[account(
        mut,
        address = vault.vault_token_account @ TreasuryError::InvalidVaultAccount,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Payout wallet's USDT token account (destination)
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = usdt_mint,
        associated_token::authority = payout_wallet,
        associated_token::token_program = token_program,
    )]
    pub payout_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validated via has_one constraint on vault
    pub payout_wallet: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Payout>, amount: u64) -> Result<()> {
    require!(amount > 0, TreasuryError::ZeroAmount);

    // Check vault has enough balance
    let vault_balance = ctx.accounts.vault_token_account.amount;
    require!(vault_balance >= amount, TreasuryError::InsufficientBalance);

    let clock = Clock::get()?;

    // Transfer USDT from vault to payout wallet using PDA signer seeds
    let authority_key = ctx.accounts.authority.key();
    let seeds: &[&[u8]] = &[
        b"treasury_vault",
        authority_key.as_ref(),
        &[ctx.accounts.vault.bump],
    ];

    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.payout_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdt_mint.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        ctx.accounts.usdt_mint.decimals,
    )?;

    // Update vault stats
    let vault = &mut ctx.accounts.vault;
    vault.total_paid_out = vault
        .total_paid_out
        .checked_add(amount)
        .ok_or(TreasuryError::Overflow)?;
    vault.payout_count = vault
        .payout_count
        .checked_add(1)
        .ok_or(TreasuryError::Overflow)?;
    vault.last_payout_at = clock.unix_timestamp;

    emit!(PayoutEvent {
        vault: vault.key(),
        payout_wallet: ctx.accounts.payout_wallet.key(),
        amount,
        total_paid_out: vault.total_paid_out,
        payout_count: vault.payout_count,
        timestamp: clock.unix_timestamp,
    });

    msg!("Paid out {} USDT units to payout wallet", amount);
    Ok(())
}
