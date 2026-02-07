use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::errors::TreasuryError;
use crate::events::WithdrawalClaimedEvent;
use crate::state::{TreasuryVault, WithdrawalRequest};

#[derive(Accounts)]
pub struct ClaimWithdrawal<'info> {
    /// User signs the transaction with their wallet
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: Authority pubkey needed for vault PDA seeds derivation.
    /// Validated through vault.has_one = authority.
    #[account(mut)]
    pub authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ TreasuryError::Unauthorized,
        has_one = usdt_mint @ TreasuryError::InvalidMint,
    )]
    pub vault: Account<'info, TreasuryVault>,

    #[account(
        mut,
        seeds = [b"withdrawal", vault.key().as_ref(), user.key().as_ref()],
        bump = withdrawal_request.bump,
        has_one = user @ TreasuryError::Unauthorized,
        has_one = vault @ TreasuryError::InvalidVaultAccount,
        close = authority,
    )]
    pub withdrawal_request: Account<'info, WithdrawalRequest>,

    pub usdt_mint: InterfaceAccount<'info, Mint>,

    /// Vault's USDT token account (source)
    #[account(
        mut,
        address = vault.vault_token_account @ TreasuryError::InvalidVaultAccount,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// User's USDT token account (destination)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = usdt_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_claim_withdrawal(ctx: Context<ClaimWithdrawal>) -> Result<()> {
    let clock = Clock::get()?;
    let request = &ctx.accounts.withdrawal_request;

    // Check withdrawal hasn't expired
    require!(
        clock.unix_timestamp <= request.expires_at,
        TreasuryError::WithdrawalExpired
    );

    // Check vault has enough balance
    require!(
        ctx.accounts.vault_token_account.amount >= request.amount,
        TreasuryError::InsufficientBalance
    );

    // Transfer USDT from vault to user using PDA signer seeds
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
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.usdt_mint.to_account_info(),
            },
            &[seeds],
        ),
        request.amount,
        ctx.accounts.usdt_mint.decimals,
    )?;

    // Update vault stats
    let vault = &mut ctx.accounts.vault;
    vault.total_paid_out = vault
        .total_paid_out
        .checked_add(request.amount)
        .ok_or(TreasuryError::Overflow)?;
    vault.payout_count = vault
        .payout_count
        .checked_add(1)
        .ok_or(TreasuryError::Overflow)?;
    vault.last_payout_at = clock.unix_timestamp;

    emit!(WithdrawalClaimedEvent {
        vault: vault.key(),
        user: ctx.accounts.user.key(),
        amount: request.amount,
        total_paid_out: vault.total_paid_out,
        payout_count: vault.payout_count,
        timestamp: clock.unix_timestamp,
    });

    // PDA is closed automatically via `close = authority` constraint

    Ok(())
}
