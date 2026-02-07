// Auto-generated from contracts/treasury-vault/target/idl/treasury_vault.json
// Do not edit manually — re-generate after `anchor build`

export const TREASURY_VAULT_IDL = {
  address: '5bdiY9qaWc5qYtxgHzydCmU4dpssmCXLqXQBtG6Q2pa4',
  metadata: {
    name: 'treasury_vault',
    version: '0.1.0',
    spec: '0.1.0',
    description: 'Fortune City Treasury Vault',
  },
  instructions: [
    {
      name: 'deposit',
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182],
      accounts: [
        {
          name: 'authority',
          writable: true,
          signer: true,
          relations: ['vault'],
        },
        {
          name: 'vault',
          writable: true,
          pda: {
            seeds: [
              {
                kind: 'const',
                value: [
                  116, 114, 101, 97, 115, 117, 114, 121, 95, 118, 97, 117,
                  108, 116,
                ],
              },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
        { name: 'usdt_mint', relations: ['vault'] },
        {
          name: 'authority_token_account',
          writable: true,
          pda: {
            seeds: [
              { kind: 'account', path: 'authority' },
              { kind: 'account', path: 'token_program' },
              { kind: 'account', path: 'usdt_mint' },
            ],
            program: {
              kind: 'const',
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20,
                142, 13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142,
                123, 216, 219, 233, 248, 89,
              ],
            },
          },
        },
        { name: 'vault_token_account', writable: true },
        { name: 'token_program' },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'initialize',
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237],
      accounts: [
        { name: 'authority', writable: true, signer: true },
        {
          name: 'vault',
          writable: true,
          pda: {
            seeds: [
              {
                kind: 'const',
                value: [
                  116, 114, 101, 97, 115, 117, 114, 121, 95, 118, 97, 117,
                  108, 116,
                ],
              },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
        { name: 'usdt_mint' },
        {
          name: 'vault_token_account',
          writable: true,
          pda: {
            seeds: [
              { kind: 'account', path: 'vault' },
              { kind: 'account', path: 'token_program' },
              { kind: 'account', path: 'usdt_mint' },
            ],
            program: {
              kind: 'const',
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20,
                142, 13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142,
                123, 216, 219, 233, 248, 89,
              ],
            },
          },
        },
        { name: 'payout_wallet' },
        { name: 'token_program' },
        {
          name: 'associated_token_program',
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        },
        {
          name: 'system_program',
          address: '11111111111111111111111111111111',
        },
      ],
      args: [],
    },
    {
      name: 'payout',
      discriminator: [149, 140, 194, 236, 174, 189, 6, 239],
      accounts: [
        {
          name: 'authority',
          writable: true,
          signer: true,
          relations: ['vault'],
        },
        {
          name: 'vault',
          writable: true,
          pda: {
            seeds: [
              {
                kind: 'const',
                value: [
                  116, 114, 101, 97, 115, 117, 114, 121, 95, 118, 97, 117,
                  108, 116,
                ],
              },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
        { name: 'usdt_mint', relations: ['vault'] },
        { name: 'vault_token_account', writable: true },
        {
          name: 'payout_token_account',
          writable: true,
          pda: {
            seeds: [
              { kind: 'account', path: 'payout_wallet' },
              { kind: 'account', path: 'token_program' },
              { kind: 'account', path: 'usdt_mint' },
            ],
            program: {
              kind: 'const',
              value: [
                140, 151, 37, 143, 78, 36, 137, 241, 187, 61, 16, 41, 20,
                142, 13, 131, 11, 90, 19, 153, 218, 255, 16, 132, 4, 142,
                123, 216, 219, 233, 248, 89,
              ],
            },
          },
        },
        { name: 'payout_wallet', relations: ['vault'] },
        { name: 'token_program' },
        {
          name: 'associated_token_program',
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
        },
        {
          name: 'system_program',
          address: '11111111111111111111111111111111',
        },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'set_paused',
      discriminator: [91, 60, 125, 192, 176, 225, 166, 218],
      accounts: [
        { name: 'authority', signer: true, relations: ['vault'] },
        {
          name: 'vault',
          writable: true,
          pda: {
            seeds: [
              {
                kind: 'const',
                value: [
                  116, 114, 101, 97, 115, 117, 114, 121, 95, 118, 97, 117,
                  108, 116,
                ],
              },
              { kind: 'account', path: 'authority' },
            ],
          },
        },
      ],
      args: [{ name: 'paused', type: 'bool' }],
    },
  ],
  accounts: [
    {
      name: 'TreasuryVault',
      discriminator: [86, 102, 19, 109, 56, 58, 144, 81],
    },
  ],
  events: [
    {
      name: 'DepositEvent',
      discriminator: [120, 248, 61, 83, 31, 142, 107, 144],
    },
    {
      name: 'PayoutEvent',
      discriminator: [84, 234, 195, 72, 143, 79, 70, 82],
    },
    {
      name: 'VaultInitialized',
      discriminator: [180, 43, 207, 2, 18, 71, 3, 75],
    },
    {
      name: 'VaultPausedEvent',
      discriminator: [75, 189, 120, 167, 117, 229, 155, 60],
    },
  ],
  errors: [
    {
      code: 6000,
      name: 'Unauthorized',
      msg: 'Unauthorized: only vault authority can perform this action',
    },
    { code: 6001, name: 'InvalidMint', msg: 'Invalid USDT mint address' },
    {
      code: 6002,
      name: 'InvalidVaultAccount',
      msg: 'Invalid vault token account',
    },
    {
      code: 6003,
      name: 'InvalidPayoutWallet',
      msg: 'Invalid payout wallet',
    },
    { code: 6004, name: 'VaultPaused', msg: 'Vault is paused' },
    {
      code: 6005,
      name: 'ZeroAmount',
      msg: 'Amount must be greater than zero',
    },
    {
      code: 6006,
      name: 'InsufficientBalance',
      msg: 'Insufficient vault balance for payout',
    },
    { code: 6007, name: 'Overflow', msg: 'Arithmetic overflow' },
  ],
  types: [
    {
      name: 'DepositEvent',
      type: {
        kind: 'struct',
        fields: [
          { name: 'vault', type: 'pubkey' },
          { name: 'amount', type: 'u64' },
          { name: 'total_deposited', type: 'u64' },
          { name: 'deposit_count', type: 'u32' },
          { name: 'timestamp', type: 'i64' },
        ],
      },
    },
    {
      name: 'PayoutEvent',
      type: {
        kind: 'struct',
        fields: [
          { name: 'vault', type: 'pubkey' },
          { name: 'payout_wallet', type: 'pubkey' },
          { name: 'amount', type: 'u64' },
          { name: 'total_paid_out', type: 'u64' },
          { name: 'payout_count', type: 'u32' },
          { name: 'timestamp', type: 'i64' },
        ],
      },
    },
    {
      name: 'TreasuryVault',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'pubkey' },
          { name: 'payout_wallet', type: 'pubkey' },
          { name: 'usdt_mint', type: 'pubkey' },
          { name: 'vault_token_account', type: 'pubkey' },
          { name: 'total_deposited', type: 'u64' },
          { name: 'total_paid_out', type: 'u64' },
          { name: 'deposit_count', type: 'u32' },
          { name: 'payout_count', type: 'u32' },
          { name: 'last_deposit_at', type: 'i64' },
          { name: 'last_payout_at', type: 'i64' },
          { name: 'bump', type: 'u8' },
          { name: 'paused', type: 'bool' },
        ],
      },
    },
    {
      name: 'VaultInitialized',
      type: {
        kind: 'struct',
        fields: [
          { name: 'vault', type: 'pubkey' },
          { name: 'authority', type: 'pubkey' },
          { name: 'payout_wallet', type: 'pubkey' },
          { name: 'usdt_mint', type: 'pubkey' },
          { name: 'timestamp', type: 'i64' },
        ],
      },
    },
    {
      name: 'VaultPausedEvent',
      type: {
        kind: 'struct',
        fields: [
          { name: 'vault', type: 'pubkey' },
          { name: 'paused', type: 'bool' },
          { name: 'timestamp', type: 'i64' },
        ],
      },
    },
  ],
} as const;
