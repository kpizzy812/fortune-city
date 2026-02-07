use anchor_lang::prelude::*;

use crate::errors::TreasuryError;
use crate::events::VaultPausedEvent;
use crate::state::TreasuryVault;

#[derive(Accounts)]
pub struct SetPaused<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury_vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ TreasuryError::Unauthorized,
    )]
    pub vault: Account<'info, TreasuryVault>,
}

pub fn handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.paused = paused;

    let clock = Clock::get()?;

    emit!(VaultPausedEvent {
        vault: vault.key(),
        paused,
        timestamp: clock.unix_timestamp,
    });

    msg!("Vault paused: {}", paused);
    Ok(())
}
