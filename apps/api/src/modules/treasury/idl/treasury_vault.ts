/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/treasury_vault.json`.
 */
export type TreasuryVault = {
  address: '9brgETdzzaoxH9DcctMx7KprqpQkdDtcdQmM1y6pgDgD';
  metadata: {
    name: 'treasuryVault';
    version: '0.1.0';
    spec: '0.1.0';
    description: 'Fortune City Treasury Vault';
  };
  instructions: [
    {
      name: 'cancelWithdrawal';
      docs: [
        'Cancel an expired withdrawal request. Only authority can call.',
        'Cleans up the PDA and returns rent to authority.',
      ];
      discriminator: [183, 104, 181, 250, 28, 128, 210, 70];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['vault'];
        },
        {
          name: 'vault';
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
          relations: ['withdrawalRequest'];
        },
        {
          name: 'user';
        },
        {
          name: 'withdrawalRequest';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [119, 105, 116, 104, 100, 114, 97, 119, 97, 108];
              },
              {
                kind: 'account';
                path: 'vault';
              },
              {
                kind: 'account';
                path: 'user';
              },
            ];
          };
        },
      ];
      args: [];
    },
    {
      name: 'claimWithdrawal';
      docs: [
        'Claim a pending withdrawal. User signs with their wallet.',
        "USDT goes directly from vault to user's token account.",
      ];
      discriminator: [118, 206, 173, 38, 239, 165, 65, 30];
      accounts: [
        {
          name: 'user';
          docs: ['User signs the transaction with their wallet'];
          writable: true;
          signer: true;
          relations: ['withdrawalRequest'];
        },
        {
          name: 'authority';
          docs: ['Validated through vault.has_one = authority.'];
          writable: true;
          relations: ['vault'];
        },
        {
          name: 'vault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
          relations: ['withdrawalRequest'];
        },
        {
          name: 'withdrawalRequest';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [119, 105, 116, 104, 100, 114, 97, 119, 97, 108];
              },
              {
                kind: 'account';
                path: 'vault';
              },
              {
                kind: 'account';
                path: 'user';
              },
            ];
          };
        },
        {
          name: 'usdtMint';
          relations: ['vault'];
        },
        {
          name: 'vaultTokenAccount';
          docs: ["Vault's USDT token account (source)"];
          writable: true;
        },
        {
          name: 'userTokenAccount';
          docs: ["User's USDT token account (destination)"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'user';
              },
              {
                kind: 'account';
                path: 'tokenProgram';
              },
              {
                kind: 'account';
                path: 'usdtMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'createWithdrawal';
      docs: [
        'Create a withdrawal request for a user. Only authority can call.',
        'User can then claim USDT directly by signing with their wallet.',
      ];
      discriminator: [247, 103, 160, 95, 42, 161, 108, 91];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['vault'];
        },
        {
          name: 'vault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'usdtMint';
          relations: ['vault'];
        },
        {
          name: 'vaultTokenAccount';
        },
        {
          name: 'user';
        },
        {
          name: 'withdrawalRequest';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [119, 105, 116, 104, 100, 114, 97, 119, 97, 108];
              },
              {
                kind: 'account';
                path: 'vault';
              },
              {
                kind: 'account';
                path: 'user';
              },
            ];
          };
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
        {
          name: 'expiresIn';
          type: 'i64';
        },
      ];
    },
    {
      name: 'deposit';
      docs: ['Deposit USDT into the vault. Only authority can call.'];
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['vault'];
        },
        {
          name: 'vault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'usdtMint';
          relations: ['vault'];
        },
        {
          name: 'authorityTokenAccount';
          docs: ["Authority's USDT token account (source of deposit)"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'authority';
              },
              {
                kind: 'account';
                path: 'tokenProgram';
              },
              {
                kind: 'account';
                path: 'usdtMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'vaultTokenAccount';
          docs: ["Vault's USDT token account (destination)"];
          writable: true;
        },
        {
          name: 'tokenProgram';
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
      ];
    },
    {
      name: 'initialize';
      docs: [
        'Initialize the treasury vault. Called once after deploy.',
        'Sets authority (backend wallet) and payout_wallet (payout destination).',
      ];
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
        },
        {
          name: 'vault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'usdtMint';
          docs: ['USDT SPL mint'];
        },
        {
          name: 'vaultTokenAccount';
          docs: ["Vault's token account (ATA owned by vault PDA)"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'vault';
              },
              {
                kind: 'account';
                path: 'tokenProgram';
              },
              {
                kind: 'account';
                path: 'usdtMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'payoutWallet';
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [];
    },
    {
      name: 'payout';
      docs: [
        'Payout USDT from vault to payout_wallet. Only authority can call.',
      ];
      discriminator: [149, 140, 194, 236, 174, 189, 6, 239];
      accounts: [
        {
          name: 'authority';
          writable: true;
          signer: true;
          relations: ['vault'];
        },
        {
          name: 'vault';
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'const';
                value: [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116,
                ];
              },
              {
                kind: 'account';
                path: 'authority';
              },
            ];
          };
        },
        {
          name: 'usdtMint';
          relations: ['vault'];
        },
        {
          name: 'vaultTokenAccount';
          docs: ["Vault's USDT token account (source — PDA is authority)"];
          writable: true;
        },
        {
          name: 'payoutTokenAccount';
          docs: ["Payout wallet's USDT token account (destination)"];
          writable: true;
          pda: {
            seeds: [
              {
                kind: 'account';
                path: 'payoutWallet';
              },
              {
                kind: 'account';
                path: 'tokenProgram';
              },
              {
                kind: 'account';
                path: 'usdtMint';
              },
            ];
            program: {
              kind: 'const';
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ];
            };
          };
        },
        {
          name: 'payoutWallet';
          relations: ['vault'];
        },
        {
          name: 'tokenProgram';
        },
        {
          name: 'associatedTokenProgram';
          address: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
        },
        {
          name: 'systemProgram';
          address: '11111111111111111111111111111111';
        },
      ];
      args: [
        {
          name: 'amount';
          type: 'u64';
        },
      ];
    },
  ];
  accounts: [
    {
      name: 'treasuryVault';
      discriminator: [86, 102, 19, 109, 56, 58, 144, 81];
    },
    {
      name: 'withdrawalRequest';
      discriminator: [242, 88, 147, 173, 182, 62, 229, 193];
    },
  ];
  events: [
    {
      name: 'depositEvent';
      discriminator: [120, 248, 61, 83, 31, 142, 107, 144];
    },
    {
      name: 'payoutEvent';
      discriminator: [84, 234, 195, 72, 143, 79, 70, 82];
    },
    {
      name: 'vaultInitialized';
      discriminator: [180, 43, 207, 2, 18, 71, 3, 75];
    },
    {
      name: 'withdrawalCancelledEvent';
      discriminator: [40, 218, 165, 230, 31, 49, 238, 127];
    },
    {
      name: 'withdrawalClaimedEvent';
      discriminator: [112, 246, 33, 174, 230, 205, 121, 26];
    },
    {
      name: 'withdrawalCreatedEvent';
      discriminator: [173, 205, 34, 150, 97, 42, 211, 30];
    },
  ];
  errors: [
    {
      code: 6000;
      name: 'unauthorized';
      msg: 'Unauthorized: only vault authority can perform this action';
    },
    {
      code: 6001;
      name: 'invalidMint';
      msg: 'Invalid USDT mint address';
    },
    {
      code: 6002;
      name: 'invalidVaultAccount';
      msg: 'Invalid vault token account';
    },
    {
      code: 6003;
      name: 'invalidPayoutWallet';
      msg: 'Invalid payout wallet';
    },
    {
      code: 6004;
      name: 'zeroAmount';
      msg: 'Amount must be greater than zero';
    },
    {
      code: 6005;
      name: 'insufficientBalance';
      msg: 'Insufficient vault balance for payout';
    },
    {
      code: 6006;
      name: 'overflow';
      msg: 'Arithmetic overflow';
    },
    {
      code: 6007;
      name: 'withdrawalExpired';
      msg: 'Withdrawal request has expired';
    },
    {
      code: 6008;
      name: 'withdrawalNotExpired';
      msg: 'Withdrawal has not expired yet, cannot cancel';
    },
  ];
  types: [
    {
      name: 'depositEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'totalDeposited';
            type: 'u64';
          },
          {
            name: 'depositCount';
            type: 'u32';
          },
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'payoutEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            type: 'pubkey';
          },
          {
            name: 'payoutWallet';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'totalPaidOut';
            type: 'u64';
          },
          {
            name: 'payoutCount';
            type: 'u32';
          },
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'treasuryVault';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'authority';
            docs: [
              'Authority (backend wallet) — only this key can call deposit/payout',
            ];
            type: 'pubkey';
          },
          {
            name: 'payoutWallet';
            docs: [
              'Payout wallet — the only allowed recipient of payout instructions',
            ];
            type: 'pubkey';
          },
          {
            name: 'usdtMint';
            docs: ['USDT SPL mint address'];
            type: 'pubkey';
          },
          {
            name: 'vaultTokenAccount';
            docs: ["Vault's token account (ATA owned by this PDA)"];
            type: 'pubkey';
          },
          {
            name: 'totalDeposited';
            docs: ['Total USDT deposited (raw units, 6 decimals)'];
            type: 'u64';
          },
          {
            name: 'totalPaidOut';
            docs: ['Total USDT paid out (raw units, 6 decimals)'];
            type: 'u64';
          },
          {
            name: 'depositCount';
            docs: ['Number of deposit transactions (u32 = up to 4B ops)'];
            type: 'u32';
          },
          {
            name: 'payoutCount';
            docs: ['Number of payout transactions (u32 = up to 4B ops)'];
            type: 'u32';
          },
          {
            name: 'lastDepositAt';
            docs: ['Last deposit unix timestamp'];
            type: 'i64';
          },
          {
            name: 'lastPayoutAt';
            docs: ['Last payout unix timestamp'];
            type: 'i64';
          },
          {
            name: 'bump';
            docs: ['PDA bump seed'];
            type: 'u8';
          },
        ];
      };
    },
    {
      name: 'vaultInitialized';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            type: 'pubkey';
          },
          {
            name: 'authority';
            type: 'pubkey';
          },
          {
            name: 'payoutWallet';
            type: 'pubkey';
          },
          {
            name: 'usdtMint';
            type: 'pubkey';
          },
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'withdrawalCancelledEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            type: 'pubkey';
          },
          {
            name: 'user';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'withdrawalClaimedEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            type: 'pubkey';
          },
          {
            name: 'user';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'totalPaidOut';
            type: 'u64';
          },
          {
            name: 'payoutCount';
            type: 'u32';
          },
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'withdrawalCreatedEvent';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            type: 'pubkey';
          },
          {
            name: 'user';
            type: 'pubkey';
          },
          {
            name: 'amount';
            type: 'u64';
          },
          {
            name: 'expiresAt';
            type: 'i64';
          },
          {
            name: 'timestamp';
            type: 'i64';
          },
        ];
      };
    },
    {
      name: 'withdrawalRequest';
      type: {
        kind: 'struct';
        fields: [
          {
            name: 'vault';
            docs: ['Which vault this withdrawal is from'];
            type: 'pubkey';
          },
          {
            name: 'user';
            docs: ['User who can claim this withdrawal'];
            type: 'pubkey';
          },
          {
            name: 'amount';
            docs: ['Amount in raw USDT units (6 decimals)'];
            type: 'u64';
          },
          {
            name: 'createdAt';
            docs: ['Unix timestamp when request was created'];
            type: 'i64';
          },
          {
            name: 'expiresAt';
            docs: ['Unix timestamp after which claim is no longer possible'];
            type: 'i64';
          },
          {
            name: 'bump';
            docs: ['PDA bump seed'];
            type: 'u8';
          },
        ];
      };
    },
  ];
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TREASURY_VAULT_IDL = require('./treasury_vault.json');
