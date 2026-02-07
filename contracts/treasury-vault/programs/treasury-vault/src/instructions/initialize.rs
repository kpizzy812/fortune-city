use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::events::VaultInitialized;
use crate::state::TreasuryVault;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + TreasuryVault::INIT_SPACE,
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TreasuryVault>,

    /// USDT SPL mint
    pub usdt_mint: InterfaceAccount<'info, Mint>,

    /// Vault's token account (ATA owned by vault PDA)
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdt_mint,
        associated_token::authority = vault,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Payout destination wallet, validated by being stored in vault state
    pub payout_wallet: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.authority = ctx.accounts.authority.key();
    vault.payout_wallet = ctx.accounts.payout_wallet.key();
    vault.usdt_mint = ctx.accounts.usdt_mint.key();
    vault.vault_token_account = ctx.accounts.vault_token_account.key();
    vault.total_deposited = 0;
    vault.total_paid_out = 0;
    vault.deposit_count = 0;
    vault.payout_count = 0;
    vault.last_deposit_at = 0;
    vault.last_payout_at = 0;
    vault.bump = ctx.bumps.vault;
    vault.paused = false;

    emit!(VaultInitialized {
        vault: vault.key(),
        authority: vault.authority,
        payout_wallet: vault.payout_wallet,
        usdt_mint: vault.usdt_mint,
        timestamp: clock.unix_timestamp,
    });

    msg!("Treasury vault initialized");
    Ok(())
}
