export type Invariant = {
  "version": "0.1.0",
  "name": "invariant",
  "instructions": [
    {
      "name": "createState",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createFeeTier",
      "accounts": [
        {
          "name": "feeTier",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "fee",
          "type": "u128"
        },
        {
          "name": "tickSpacing",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createPool",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTier",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenXReserve",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenYReserve",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "initTick",
          "type": "i32"
        }
      ]
    },
    {
      "name": "swap",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "xToY",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "byAmountIn",
          "type": "bool"
        },
        {
          "name": "sqrtPriceLimit",
          "type": "u128"
        }
      ]
    },
    {
      "name": "initializeOracle",
      "accounts": [
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createTick",
      "accounts": [
        {
          "name": "tick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "i32"
        }
      ]
    },
    {
      "name": "createPositionList",
      "accounts": [
        {
          "name": "positionList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createPosition",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "lowerTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        },
        {
          "name": "liquidityDelta",
          "type": {
            "defined": "Liquidity"
          }
        },
        {
          "name": "slippageLimitLower",
          "type": {
            "defined": "Price"
          }
        },
        {
          "name": "slippageLimitUpper",
          "type": {
            "defined": "Price"
          }
        }
      ]
    },
    {
      "name": "removePosition",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "removedPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lastPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lowerTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "transferPositionOwnership",
      "accounts": [
        {
          "name": "ownerList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipientList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "newPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "removedPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lastPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "recipient",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        }
      ]
    },
    {
      "name": "claimFee",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lowerTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "updateSecondsPerLiquidity",
      "accounts": [
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lowerTick",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        },
        {
          "name": "index",
          "type": "i32"
        }
      ]
    },
    {
      "name": "withdrawProtocolFee",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "changeProtocolFee",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "protocolFee",
          "type": {
            "defined": "FixedPoint"
          }
        }
      ]
    },
    {
      "name": "changeFeeReceiver",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "feeReceiver",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "feeTier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fee",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "tickSpacing",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "oracle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "data",
            "type": {
              "array": [
                {
                  "defined": "Record"
                },
                256
              ]
            }
          },
          {
            "name": "head",
            "type": "u16"
          },
          {
            "name": "amount",
            "type": "u16"
          },
          {
            "name": "size",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenX",
            "type": "publicKey"
          },
          {
            "name": "tokenY",
            "type": "publicKey"
          },
          {
            "name": "tokenXReserve",
            "type": "publicKey"
          },
          {
            "name": "tokenYReserve",
            "type": "publicKey"
          },
          {
            "name": "positionIterator",
            "type": "u128"
          },
          {
            "name": "tickSpacing",
            "type": "u16"
          },
          {
            "name": "fee",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "protocolFee",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Price"
            }
          },
          {
            "name": "currentTickIndex",
            "type": "i32"
          },
          {
            "name": "tickmap",
            "type": "publicKey"
          },
          {
            "name": "feeGrowthGlobalX",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeGrowthGlobalY",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeProtocolTokenX",
            "type": "u64"
          },
          {
            "name": "feeProtocolTokenY",
            "type": "u64"
          },
          {
            "name": "secondsPerLiquidityGlobal",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "startTimestamp",
            "type": "u64"
          },
          {
            "name": "lastTimestamp",
            "type": "u64"
          },
          {
            "name": "feeReceiver",
            "type": "publicKey"
          },
          {
            "name": "oracleAddress",
            "type": "publicKey"
          },
          {
            "name": "oracleInitialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "id",
            "type": "u128"
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "lowerTickIndex",
            "type": "i32"
          },
          {
            "name": "upperTickIndex",
            "type": "i32"
          },
          {
            "name": "feeGrowthInsideX",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeGrowthInsideY",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "secondsPerLiquidityInside",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "lastSlot",
            "type": "u64"
          },
          {
            "name": "tokensOwedX",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "tokensOwedY",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "positionList",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "head",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "state",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "nonce",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tick",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "index",
            "type": "i32"
          },
          {
            "name": "sign",
            "type": "bool"
          },
          {
            "name": "liquidityChange",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "liquidityGross",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Price"
            }
          },
          {
            "name": "feeGrowthOutsideX",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeGrowthOutsideY",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "secondsPerLiquidityOutside",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "secondsOutside",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tickmap",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bitmap",
            "type": {
              "array": [
                "u8",
                11091
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Price",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "Liquidity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "FeeGrowth",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "FixedPoint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "Record",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "u64"
          },
          {
            "name": "price",
            "type": {
              "defined": "Price"
            }
          }
        ]
      }
    },
    {
      "name": "InvariantErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "ZeroAmount"
          },
          {
            "name": "ZeroOutput"
          },
          {
            "name": "WrongTick"
          },
          {
            "name": "WrongLimit"
          },
          {
            "name": "InvalidTickIndex"
          },
          {
            "name": "InvalidTickInterval"
          },
          {
            "name": "NoMoreTicks"
          },
          {
            "name": "TickNotFound"
          },
          {
            "name": "PriceLimitReached"
          },
          {
            "name": "InvalidTickLiquidity"
          },
          {
            "name": "EmptyPositionPokes"
          },
          {
            "name": "InvalidPositionLiquidity"
          },
          {
            "name": "InvalidPoolLiquidity"
          },
          {
            "name": "InvalidPositionIndex"
          },
          {
            "name": "PositionWithoutLiquidity"
          },
          {
            "name": "Unauthorized"
          },
          {
            "name": "InvalidPoolTokenAddresses"
          },
          {
            "name": "NegativeTime"
          },
          {
            "name": "OracleAlreadyInitialized"
          },
          {
            "name": "LimitReached"
          },
          {
            "name": "InvalidProtocolFee"
          },
          {
            "name": "NoGainSwap"
          },
          {
            "name": "InvalidTokenAccount"
          },
          {
            "name": "InvalidAdmin"
          },
          {
            "name": "InvalidAuthority"
          },
          {
            "name": "InvalidOwner"
          },
          {
            "name": "InvalidMint"
          },
          {
            "name": "InvalidTickmap"
          },
          {
            "name": "InvalidTickmapOwner"
          },
          {
            "name": "InvalidListOwner"
          },
          {
            "name": "InvalidTickSpacing"
          }
        ]
      }
    }
  ]
};

export const IDL: Invariant = {
  "version": "0.1.0",
  "name": "invariant",
  "instructions": [
    {
      "name": "createState",
      "accounts": [
        {
          "name": "state",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u8"
        }
      ]
    },
    {
      "name": "createFeeTier",
      "accounts": [
        {
          "name": "feeTier",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "fee",
          "type": "u128"
        },
        {
          "name": "tickSpacing",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createPool",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeTier",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenXReserve",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenYReserve",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "initTick",
          "type": "i32"
        }
      ]
    },
    {
      "name": "swap",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "xToY",
          "type": "bool"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "byAmountIn",
          "type": "bool"
        },
        {
          "name": "sqrtPriceLimit",
          "type": "u128"
        }
      ]
    },
    {
      "name": "initializeOracle",
      "accounts": [
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "oracle",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createTick",
      "accounts": [
        {
          "name": "tick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "i32"
        }
      ]
    },
    {
      "name": "createPositionList",
      "accounts": [
        {
          "name": "positionList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "createPosition",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "lowerTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        },
        {
          "name": "liquidityDelta",
          "type": {
            "defined": "Liquidity"
          }
        },
        {
          "name": "slippageLimitLower",
          "type": {
            "defined": "Price"
          }
        },
        {
          "name": "slippageLimitUpper",
          "type": {
            "defined": "Price"
          }
        }
      ]
    },
    {
      "name": "removePosition",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "removedPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "positionList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lastPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tickmap",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lowerTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "transferPositionOwnership",
      "accounts": [
        {
          "name": "ownerList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipientList",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "newPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "removedPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lastPosition",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "recipient",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        }
      ]
    },
    {
      "name": "claimFee",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lowerTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        }
      ]
    },
    {
      "name": "updateSecondsPerLiquidity",
      "accounts": [
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lowerTick",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "upperTick",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "signer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "lowerTickIndex",
          "type": "i32"
        },
        {
          "name": "upperTickIndex",
          "type": "i32"
        },
        {
          "name": "index",
          "type": "i32"
        }
      ]
    },
    {
      "name": "withdrawProtocolFee",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "accountX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "accountY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveX",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "reserveY",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "changeProtocolFee",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "programAuthority",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "protocolFee",
          "type": {
            "defined": "FixedPoint"
          }
        }
      ]
    },
    {
      "name": "changeFeeReceiver",
      "accounts": [
        {
          "name": "state",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenX",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenY",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "feeReceiver",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "feeTier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "fee",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "tickSpacing",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "oracle",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "data",
            "type": {
              "array": [
                {
                  "defined": "Record"
                },
                256
              ]
            }
          },
          {
            "name": "head",
            "type": "u16"
          },
          {
            "name": "amount",
            "type": "u16"
          },
          {
            "name": "size",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "pool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenX",
            "type": "publicKey"
          },
          {
            "name": "tokenY",
            "type": "publicKey"
          },
          {
            "name": "tokenXReserve",
            "type": "publicKey"
          },
          {
            "name": "tokenYReserve",
            "type": "publicKey"
          },
          {
            "name": "positionIterator",
            "type": "u128"
          },
          {
            "name": "tickSpacing",
            "type": "u16"
          },
          {
            "name": "fee",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "protocolFee",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Price"
            }
          },
          {
            "name": "currentTickIndex",
            "type": "i32"
          },
          {
            "name": "tickmap",
            "type": "publicKey"
          },
          {
            "name": "feeGrowthGlobalX",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeGrowthGlobalY",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeProtocolTokenX",
            "type": "u64"
          },
          {
            "name": "feeProtocolTokenY",
            "type": "u64"
          },
          {
            "name": "secondsPerLiquidityGlobal",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "startTimestamp",
            "type": "u64"
          },
          {
            "name": "lastTimestamp",
            "type": "u64"
          },
          {
            "name": "feeReceiver",
            "type": "publicKey"
          },
          {
            "name": "oracleAddress",
            "type": "publicKey"
          },
          {
            "name": "oracleInitialized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "position",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "id",
            "type": "u128"
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "lowerTickIndex",
            "type": "i32"
          },
          {
            "name": "upperTickIndex",
            "type": "i32"
          },
          {
            "name": "feeGrowthInsideX",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeGrowthInsideY",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "secondsPerLiquidityInside",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "lastSlot",
            "type": "u64"
          },
          {
            "name": "tokensOwedX",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "tokensOwedY",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "positionList",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "head",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "state",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "publicKey"
          },
          {
            "name": "nonce",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tick",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "index",
            "type": "i32"
          },
          {
            "name": "sign",
            "type": "bool"
          },
          {
            "name": "liquidityChange",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "liquidityGross",
            "type": {
              "defined": "Liquidity"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Price"
            }
          },
          {
            "name": "feeGrowthOutsideX",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "feeGrowthOutsideY",
            "type": {
              "defined": "FeeGrowth"
            }
          },
          {
            "name": "secondsPerLiquidityOutside",
            "type": {
              "defined": "FixedPoint"
            }
          },
          {
            "name": "secondsOutside",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tickmap",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bitmap",
            "type": {
              "array": [
                "u8",
                11091
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Price",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "Liquidity",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "FeeGrowth",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "FixedPoint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "Record",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "u64"
          },
          {
            "name": "price",
            "type": {
              "defined": "Price"
            }
          }
        ]
      }
    },
    {
      "name": "InvariantErrorCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "ZeroAmount"
          },
          {
            "name": "ZeroOutput"
          },
          {
            "name": "WrongTick"
          },
          {
            "name": "WrongLimit"
          },
          {
            "name": "InvalidTickIndex"
          },
          {
            "name": "InvalidTickInterval"
          },
          {
            "name": "NoMoreTicks"
          },
          {
            "name": "TickNotFound"
          },
          {
            "name": "PriceLimitReached"
          },
          {
            "name": "InvalidTickLiquidity"
          },
          {
            "name": "EmptyPositionPokes"
          },
          {
            "name": "InvalidPositionLiquidity"
          },
          {
            "name": "InvalidPoolLiquidity"
          },
          {
            "name": "InvalidPositionIndex"
          },
          {
            "name": "PositionWithoutLiquidity"
          },
          {
            "name": "Unauthorized"
          },
          {
            "name": "InvalidPoolTokenAddresses"
          },
          {
            "name": "NegativeTime"
          },
          {
            "name": "OracleAlreadyInitialized"
          },
          {
            "name": "LimitReached"
          },
          {
            "name": "InvalidProtocolFee"
          },
          {
            "name": "NoGainSwap"
          },
          {
            "name": "InvalidTokenAccount"
          },
          {
            "name": "InvalidAdmin"
          },
          {
            "name": "InvalidAuthority"
          },
          {
            "name": "InvalidOwner"
          },
          {
            "name": "InvalidMint"
          },
          {
            "name": "InvalidTickmap"
          },
          {
            "name": "InvalidTickmapOwner"
          },
          {
            "name": "InvalidListOwner"
          },
          {
            "name": "InvalidTickSpacing"
          }
        ]
      }
    }
  ]
};
