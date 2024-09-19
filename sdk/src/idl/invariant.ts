/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/invariant.json`.
 */
export type Invariant = {
  address: '5KLfYtAYvUchvTg8jb27eYgeRXLjPPsa9DqwjJJuYGQJ'
  metadata: {
    name: 'invariant'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'Created with Anchor'
  }
  instructions: [
    {
      name: 'changeFeeReceiver'
      discriminator: [92, 14, 241, 152, 58, 92, 188, 57]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'admin'
          signer: true
        },
        {
          name: 'feeReceiver'
        }
      ]
      args: []
    },
    {
      name: 'changeProtocolFee'
      discriminator: [16, 252, 253, 159, 48, 242, 32, 84]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'admin'
          signer: true
        },
        {
          name: 'programAuthority'
        }
      ]
      args: [
        {
          name: 'protocolFee'
          type: {
            defined: {
              name: 'fixedPoint'
            }
          }
        }
      ]
    },
    {
      name: 'claimFee'
      discriminator: [169, 32, 79, 137, 136, 232, 70, 137]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'position'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'arg'
                path: 'index'
              }
            ]
          }
        },
        {
          name: 'lowerTick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'lowerTickIndex'
              }
            ]
          }
        },
        {
          name: 'upperTick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'upperTickIndex'
              }
            ]
          }
        },
        {
          name: 'owner'
          signer: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'accountX'
          writable: true
        },
        {
          name: 'accountY'
          writable: true
        },
        {
          name: 'reserveX'
          writable: true
        },
        {
          name: 'reserveY'
          writable: true
        },
        {
          name: 'programAuthority'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        }
      ]
      args: [
        {
          name: 'index'
          type: 'u32'
        },
        {
          name: 'lowerTickIndex'
          type: 'i32'
        },
        {
          name: 'upperTickIndex'
          type: 'i32'
        }
      ]
    },
    {
      name: 'createFeeTier'
      discriminator: [150, 158, 85, 114, 219, 75, 212, 91]
      accounts: [
        {
          name: 'feeTier'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [102, 101, 101, 116, 105, 101, 114, 118, 49]
              },
              {
                kind: 'const'
                value: [
                  64,
                  33,
                  111,
                  233,
                  171,
                  40,
                  217,
                  230,
                  119,
                  248,
                  192,
                  128,
                  20,
                  161,
                  191,
                  219,
                  60,
                  218,
                  201,
                  25,
                  66,
                  82,
                  85,
                  181,
                  216,
                  206,
                  40,
                  92,
                  13,
                  23,
                  229,
                  91
                ]
              },
              {
                kind: 'arg'
                path: 'fee'
              },
              {
                kind: 'arg'
                path: 'tickSpacing'
              }
            ]
          }
        },
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'fee'
          type: 'u128'
        },
        {
          name: 'tickSpacing'
          type: 'u16'
        }
      ]
    },
    {
      name: 'createPool'
      discriminator: [233, 146, 209, 142, 207, 104, 64, 188]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'feeTier'
              },
              {
                kind: 'account'
                path: 'feeTier'
              }
            ]
          }
        },
        {
          name: 'feeTier'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [102, 101, 101, 116, 105, 101, 114, 118, 49]
              },
              {
                kind: 'const'
                value: [
                  64,
                  33,
                  111,
                  233,
                  171,
                  40,
                  217,
                  230,
                  119,
                  248,
                  192,
                  128,
                  20,
                  161,
                  191,
                  219,
                  60,
                  218,
                  201,
                  25,
                  66,
                  82,
                  85,
                  181,
                  216,
                  206,
                  40,
                  92,
                  13,
                  23,
                  229,
                  91
                ]
              },
              {
                kind: 'account'
                path: 'feeTier'
              },
              {
                kind: 'account'
                path: 'feeTier'
              }
            ]
          }
        },
        {
          name: 'tickmap'
          writable: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'tokenXReserve'
          writable: true
          signer: true
        },
        {
          name: 'tokenYReserve'
          writable: true
          signer: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'authority'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'initTick'
          type: 'i32'
        }
      ]
    },
    {
      name: 'createPosition'
      discriminator: [48, 215, 197, 153, 96, 203, 180, 133]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'position'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'account'
                path: 'positionList'
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'positionList'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 108, 105, 115, 116, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              }
            ]
          }
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'owner'
          signer: true
        },
        {
          name: 'lowerTick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'lowerTickIndex'
              }
            ]
          }
        },
        {
          name: 'upperTick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'upperTickIndex'
              }
            ]
          }
        },
        {
          name: 'tickmap'
          writable: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'accountX'
          writable: true
        },
        {
          name: 'accountY'
          writable: true
        },
        {
          name: 'reserveX'
          writable: true
        },
        {
          name: 'reserveY'
          writable: true
        },
        {
          name: 'programAuthority'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'lowerTickIndex'
          type: 'i32'
        },
        {
          name: 'upperTickIndex'
          type: 'i32'
        },
        {
          name: 'liquidityDelta'
          type: {
            defined: {
              name: 'liquidity'
            }
          }
        },
        {
          name: 'slippageLimitLower'
          type: {
            defined: {
              name: 'price'
            }
          }
        },
        {
          name: 'slippageLimitUpper'
          type: {
            defined: {
              name: 'price'
            }
          }
        }
      ]
    },
    {
      name: 'createPositionList'
      discriminator: [135, 165, 83, 94, 175, 24, 149, 4]
      accounts: [
        {
          name: 'positionList'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 108, 105, 115, 116, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              }
            ]
          }
        },
        {
          name: 'owner'
        },
        {
          name: 'signer'
          writable: true
          signer: true
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: []
    },
    {
      name: 'createState'
      discriminator: [214, 211, 209, 79, 107, 105, 247, 222]
      accounts: [
        {
          name: 'state'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'programAuthority'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [73, 110, 118, 97, 114, 105, 97, 110, 116]
              }
            ]
          }
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'nonce'
          type: 'u8'
        }
      ]
    },
    {
      name: 'createTick'
      discriminator: [227, 158, 200, 168, 122, 104, 133, 81]
      accounts: [
        {
          name: 'tick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'index'
              }
            ]
          }
        },
        {
          name: 'pool'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'tickmap'
          writable: true
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        }
      ]
      args: [
        {
          name: 'index'
          type: 'i32'
        }
      ]
    },
    {
      name: 'initializeOracle'
      discriminator: [144, 223, 131, 120, 196, 253, 181, 99]
      accounts: [
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'oracle'
          writable: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'payer'
          signer: true
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: []
    },
    {
      name: 'removePosition'
      discriminator: [219, 24, 236, 110, 138, 80, 129, 6]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'removedPosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'arg'
                path: 'index'
              }
            ]
          }
        },
        {
          name: 'positionList'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 108, 105, 115, 116, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              }
            ]
          }
        },
        {
          name: 'lastPosition'
          writable: true
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'tickmap'
          writable: true
        },
        {
          name: 'lowerTick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'lowerTickIndex'
              }
            ]
          }
        },
        {
          name: 'upperTick'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'upperTickIndex'
              }
            ]
          }
        },
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'owner'
          signer: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'accountX'
          writable: true
        },
        {
          name: 'accountY'
          writable: true
        },
        {
          name: 'reserveX'
          writable: true
        },
        {
          name: 'reserveY'
          writable: true
        },
        {
          name: 'programAuthority'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        }
      ]
      args: [
        {
          name: 'index'
          type: 'u32'
        },
        {
          name: 'lowerTickIndex'
          type: 'i32'
        },
        {
          name: 'upperTickIndex'
          type: 'i32'
        }
      ]
    },
    {
      name: 'swap'
      discriminator: [248, 198, 158, 145, 225, 117, 135, 200]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'account_x.mint'
              },
              {
                kind: 'account'
                path: 'account_y.mint'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'tickmap'
          writable: true
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'accountX'
          writable: true
        },
        {
          name: 'accountY'
          writable: true
        },
        {
          name: 'reserveX'
          writable: true
        },
        {
          name: 'reserveY'
          writable: true
        },
        {
          name: 'owner'
          signer: true
        },
        {
          name: 'programAuthority'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        }
      ]
      args: [
        {
          name: 'xToY'
          type: 'bool'
        },
        {
          name: 'amount'
          type: 'u64'
        },
        {
          name: 'byAmountIn'
          type: 'bool'
        },
        {
          name: 'sqrtPriceLimit'
          type: 'u128'
        }
      ]
    },
    {
      name: 'transferPositionOwnership'
      discriminator: [99, 194, 166, 162, 172, 182, 45, 228]
      accounts: [
        {
          name: 'ownerList'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 108, 105, 115, 116, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              }
            ]
          }
        },
        {
          name: 'recipientList'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 108, 105, 115, 116, 118, 49]
              },
              {
                kind: 'account'
                path: 'recipient'
              }
            ]
          }
        },
        {
          name: 'newPosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 118, 49]
              },
              {
                kind: 'account'
                path: 'recipient'
              },
              {
                kind: 'account'
                path: 'recipientList'
              }
            ]
          }
        },
        {
          name: 'removedPosition'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'arg'
                path: 'index'
              }
            ]
          }
        },
        {
          name: 'lastPosition'
          writable: true
        },
        {
          name: 'owner'
          writable: true
          signer: true
        },
        {
          name: 'recipient'
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'index'
          type: 'u32'
        }
      ]
    },
    {
      name: 'updateSecondsPerLiquidity'
      discriminator: [189, 141, 35, 129, 86, 57, 205, 219]
      accounts: [
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'lowerTick'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'lowerTickIndex'
              }
            ]
          }
        },
        {
          name: 'upperTick'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [116, 105, 99, 107, 118, 49]
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'arg'
                path: 'upperTickIndex'
              }
            ]
          }
        },
        {
          name: 'position'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 115, 105, 116, 105, 111, 110, 118, 49]
              },
              {
                kind: 'account'
                path: 'owner'
              },
              {
                kind: 'arg'
                path: 'index'
              }
            ]
          }
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'owner'
        },
        {
          name: 'signer'
          writable: true
          signer: true
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        }
      ]
      args: [
        {
          name: 'lowerTickIndex'
          type: 'i32'
        },
        {
          name: 'upperTickIndex'
          type: 'i32'
        },
        {
          name: 'index'
          type: 'i32'
        }
      ]
    },
    {
      name: 'withdrawProtocolFee'
      discriminator: [158, 201, 158, 189, 33, 93, 162, 103]
      accounts: [
        {
          name: 'state'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [115, 116, 97, 116, 101, 118, 49]
              }
            ]
          }
        },
        {
          name: 'pool'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [112, 111, 111, 108, 118, 49]
              },
              {
                kind: 'account'
                path: 'tokenX'
              },
              {
                kind: 'account'
                path: 'tokenY'
              },
              {
                kind: 'account'
                path: 'pool'
              },
              {
                kind: 'account'
                path: 'pool'
              }
            ]
          }
        },
        {
          name: 'tokenX'
        },
        {
          name: 'tokenY'
        },
        {
          name: 'accountX'
          writable: true
        },
        {
          name: 'accountY'
          writable: true
        },
        {
          name: 'reserveX'
          writable: true
        },
        {
          name: 'reserveY'
          writable: true
        },
        {
          name: 'authority'
          signer: true
        },
        {
          name: 'programAuthority'
        },
        {
          name: 'tokenXProgram'
        },
        {
          name: 'tokenYProgram'
        }
      ]
      args: []
    }
  ]
  accounts: [
    {
      name: 'feeTier'
      discriminator: [56, 75, 159, 76, 142, 68, 190, 105]
    },
    {
      name: 'oracle'
      discriminator: [139, 194, 131, 179, 140, 179, 229, 244]
    },
    {
      name: 'pool'
      discriminator: [241, 154, 109, 4, 17, 177, 109, 188]
    },
    {
      name: 'position'
      discriminator: [170, 188, 143, 228, 122, 64, 247, 208]
    },
    {
      name: 'positionList'
      discriminator: [32, 7, 119, 109, 46, 230, 105, 205]
    },
    {
      name: 'state'
      discriminator: [216, 146, 107, 94, 104, 75, 182, 177]
    },
    {
      name: 'tick'
      discriminator: [176, 94, 67, 247, 133, 173, 7, 115]
    },
    {
      name: 'tickmap'
      discriminator: [236, 6, 101, 196, 85, 189, 0, 227]
    }
  ]
  errors: [
    {
      code: 6000
      name: 'zeroAmount'
      msg: 'Amount is zero'
    },
    {
      code: 6001
      name: 'zeroOutput'
      msg: 'Output would be zero'
    },
    {
      code: 6002
      name: 'wrongTick'
      msg: 'Not the expected tick'
    },
    {
      code: 6003
      name: 'wrongLimit'
      msg: 'Price limit is on the wrong side of price'
    },
    {
      code: 6004
      name: 'invalidTickIndex'
      msg: 'Tick index not divisible by spacing or over limit'
    },
    {
      code: 6005
      name: 'invalidTickInterval'
      msg: 'Invalid tick_lower or tick_upper'
    },
    {
      code: 6006
      name: 'noMoreTicks'
      msg: 'There is no more tick in that direction'
    },
    {
      code: 6007
      name: 'tickNotFound'
      msg: 'Correct tick not found in context'
    },
    {
      code: 6008
      name: 'priceLimitReached'
      msg: 'Price would cross swap limit'
    },
    {
      code: 6009
      name: 'invalidTickLiquidity'
      msg: 'Invalid tick liquidity'
    },
    {
      code: 6010
      name: 'emptyPositionPokes'
      msg: 'Disable empty position pokes'
    },
    {
      code: 6011
      name: 'invalidPositionLiquidity'
      msg: 'Invalid tick liquidity'
    },
    {
      code: 6012
      name: 'invalidPoolLiquidity'
      msg: 'Invalid pool liquidity'
    },
    {
      code: 6013
      name: 'invalidPositionIndex'
      msg: 'Invalid position index'
    },
    {
      code: 6014
      name: 'positionWithoutLiquidity'
      msg: 'Position liquidity would be zero'
    },
    {
      code: 6015
      name: 'unauthorized'
      msg: 'You are not admin'
    },
    {
      code: 6016
      name: 'invalidPoolTokenAddresses'
      msg: 'Invalid pool token addresses'
    },
    {
      code: 6017
      name: 'negativeTime'
      msg: 'Time cannot be negative'
    },
    {
      code: 6018
      name: 'oracleAlreadyInitialized'
      msg: 'Oracle is already initialized'
    },
    {
      code: 6019
      name: 'limitReached'
      msg: 'Absolute price limit was reached'
    },
    {
      code: 6020
      name: 'invalidProtocolFee'
      msg: 'Invalid protocol fee'
    },
    {
      code: 6021
      name: 'noGainSwap'
      msg: 'Swap amount out is 0'
    },
    {
      code: 6022
      name: 'invalidTokenAccount'
      msg: 'Provided token account is different than expected'
    },
    {
      code: 6023
      name: 'invalidAdmin'
      msg: 'Admin address is different than expected'
    },
    {
      code: 6024
      name: 'invalidAuthority'
      msg: 'Provided authority is different than expected'
    },
    {
      code: 6025
      name: 'invalidOwner'
      msg: 'Provided token owner is different than expected'
    },
    {
      code: 6026
      name: 'invalidMint'
      msg: 'Provided token account mint is different than expected mint token'
    },
    {
      code: 6027
      name: 'invalidTickmap'
      msg: 'Provided tickmap is different than expected'
    },
    {
      code: 6028
      name: 'invalidTickmapOwner'
      msg: 'Provided tickmap owner is different than program ID'
    },
    {
      code: 6029
      name: 'invalidListOwner'
      msg: 'Recipient list address and owner list address should be different'
    },
    {
      code: 6030
      name: 'invalidTickSpacing'
      msg: 'Invalid tick spacing'
    },
    {
      code: 6031
      name: 'invalidTokenProgram'
      msg: 'Invalid token program'
    }
  ]
  types: [
    {
      name: 'feeGrowth'
      serialization: 'bytemuck'
      repr: {
        kind: 'c'
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'v'
            type: 'u128'
          }
        ]
      }
    },
    {
      name: 'feeTier'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'fee'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'tickSpacing'
            type: 'u16'
          },
          {
            name: 'bump'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'fixedPoint'
      serialization: 'bytemuck'
      repr: {
        kind: 'c'
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'v'
            type: 'u128'
          }
        ]
      }
    },
    {
      name: 'liquidity'
      serialization: 'bytemuck'
      repr: {
        kind: 'c'
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'v'
            type: 'u128'
          }
        ]
      }
    },
    {
      name: 'oracle'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'data'
            type: {
              array: [
                {
                  defined: {
                    name: 'record'
                  }
                },
                256
              ]
            }
          },
          {
            name: 'head'
            type: 'u16'
          },
          {
            name: 'amount'
            type: 'u16'
          },
          {
            name: 'size'
            type: 'u16'
          }
        ]
      }
    },
    {
      name: 'pool'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'tokenX'
            type: 'pubkey'
          },
          {
            name: 'tokenY'
            type: 'pubkey'
          },
          {
            name: 'tokenXReserve'
            type: 'pubkey'
          },
          {
            name: 'tokenYReserve'
            type: 'pubkey'
          },
          {
            name: 'positionIterator'
            type: 'u128'
          },
          {
            name: 'tickSpacing'
            type: 'u16'
          },
          {
            name: 'fee'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'protocolFee'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'liquidity'
            type: {
              defined: {
                name: 'liquidity'
              }
            }
          },
          {
            name: 'sqrtPrice'
            type: {
              defined: {
                name: 'price'
              }
            }
          },
          {
            name: 'currentTickIndex'
            type: 'i32'
          },
          {
            name: 'tickmap'
            type: 'pubkey'
          },
          {
            name: 'feeGrowthGlobalX'
            type: {
              defined: {
                name: 'feeGrowth'
              }
            }
          },
          {
            name: 'feeGrowthGlobalY'
            type: {
              defined: {
                name: 'feeGrowth'
              }
            }
          },
          {
            name: 'feeProtocolTokenX'
            type: 'u64'
          },
          {
            name: 'feeProtocolTokenY'
            type: 'u64'
          },
          {
            name: 'secondsPerLiquidityGlobal'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'startTimestamp'
            type: 'u64'
          },
          {
            name: 'lastTimestamp'
            type: 'u64'
          },
          {
            name: 'feeReceiver'
            type: 'pubkey'
          },
          {
            name: 'oracleAddress'
            type: 'pubkey'
          },
          {
            name: 'oracleInitialized'
            type: 'bool'
          },
          {
            name: 'bump'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'position'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'owner'
            type: 'pubkey'
          },
          {
            name: 'pool'
            type: 'pubkey'
          },
          {
            name: 'id'
            type: 'u128'
          },
          {
            name: 'liquidity'
            type: {
              defined: {
                name: 'liquidity'
              }
            }
          },
          {
            name: 'lowerTickIndex'
            type: 'i32'
          },
          {
            name: 'upperTickIndex'
            type: 'i32'
          },
          {
            name: 'feeGrowthInsideX'
            type: {
              defined: {
                name: 'feeGrowth'
              }
            }
          },
          {
            name: 'feeGrowthInsideY'
            type: {
              defined: {
                name: 'feeGrowth'
              }
            }
          },
          {
            name: 'secondsPerLiquidityInside'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'lastSlot'
            type: 'u64'
          },
          {
            name: 'tokensOwedX'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'tokensOwedY'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'bump'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'positionList'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'head'
            type: 'u32'
          },
          {
            name: 'bump'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'price'
      serialization: 'bytemuck'
      repr: {
        kind: 'c'
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'v'
            type: 'u128'
          }
        ]
      }
    },
    {
      name: 'record'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'timestamp'
            type: 'u64'
          },
          {
            name: 'price'
            type: {
              defined: {
                name: 'price'
              }
            }
          }
        ]
      }
    },
    {
      name: 'state'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'admin'
            type: 'pubkey'
          },
          {
            name: 'nonce'
            type: 'u8'
          },
          {
            name: 'authority'
            type: 'pubkey'
          },
          {
            name: 'bump'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'tick'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'pool'
            type: 'pubkey'
          },
          {
            name: 'index'
            type: 'i32'
          },
          {
            name: 'sign'
            type: 'bool'
          },
          {
            name: 'liquidityChange'
            type: {
              defined: {
                name: 'liquidity'
              }
            }
          },
          {
            name: 'liquidityGross'
            type: {
              defined: {
                name: 'liquidity'
              }
            }
          },
          {
            name: 'sqrtPrice'
            type: {
              defined: {
                name: 'price'
              }
            }
          },
          {
            name: 'feeGrowthOutsideX'
            type: {
              defined: {
                name: 'feeGrowth'
              }
            }
          },
          {
            name: 'feeGrowthOutsideY'
            type: {
              defined: {
                name: 'feeGrowth'
              }
            }
          },
          {
            name: 'secondsPerLiquidityOutside'
            type: {
              defined: {
                name: 'fixedPoint'
              }
            }
          },
          {
            name: 'secondsOutside'
            type: 'u64'
          },
          {
            name: 'bump'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'tickmap'
      serialization: 'bytemuckunsafe'
      repr: {
        kind: 'rust'
        packed: true
      }
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'bitmap'
            type: {
              array: ['u8', 11091]
            }
          }
        ]
      }
    }
  ]
}
