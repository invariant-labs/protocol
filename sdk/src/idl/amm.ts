export type Amm = {
  "version": "0.1.0",
  "name": "amm",
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
          "name": "bump",
          "type": "u8"
        },
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
          "name": "bump",
          "type": "u8"
        },
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenYReserve",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
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
          "name": "bump",
          "type": "u8"
        },
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
          "name": "bump",
          "type": "u8"
        },
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
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
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
          "name": "bump",
          "type": "u8"
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
          "name": "liquidityDelta",
          "type": {
            "defined": "Decimal"
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
          "name": "bump",
          "type": "u8"
        },
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
            "defined": "Decimal"
          }
        }
      ]
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
              "defined": "Decimal"
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
              "defined": "Decimal"
            }
          },
          {
            "name": "protocolFee",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Decimal"
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
              "defined": "Decimal"
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
              "defined": "Decimal"
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
              "defined": "Decimal"
            }
          },
          {
            "name": "lastSlot",
            "type": "u64"
          },
          {
            "name": "tokensOwedX",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "tokensOwedY",
            "type": {
              "defined": "Decimal"
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
              "defined": "Decimal"
            }
          },
          {
            "name": "liquidityGross",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Decimal"
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
              "defined": "Decimal"
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
                25000
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Decimal",
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
              "defined": "Decimal"
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ZeroAmount",
      "msg": "Amount is zero"
    },
    {
      "code": 6001,
      "name": "ZeroOutput",
      "msg": "Output would be zero"
    },
    {
      "code": 6002,
      "name": "WrongTick",
      "msg": "Not the expected tick"
    },
    {
      "code": 6003,
      "name": "WrongLimit",
      "msg": "Price limit is on the wrong side of price"
    },
    {
      "code": 6004,
      "name": "InvalidTickIndex",
      "msg": "Tick index not divisible by spacing or over limit"
    },
    {
      "code": 6005,
      "name": "InvalidTickInterval",
      "msg": "Invalid tick_lower or tick_upper"
    },
    {
      "code": 6006,
      "name": "NoMoreTicks",
      "msg": "There is no more tick in that direction"
    },
    {
      "code": 6007,
      "name": "TickNotFound",
      "msg": "Correct tick not found in context"
    },
    {
      "code": 6008,
      "name": "PriceLimitReached",
      "msg": "Price would cross swap limit"
    },
    {
      "code": 6009,
      "name": "InvalidTickLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 6010,
      "name": "EmptyPositionPokes",
      "msg": "Disable empty position pokes"
    },
    {
      "code": 6011,
      "name": "InvalidPositionLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 6012,
      "name": "InvalidPoolLiquidity",
      "msg": "Invalid pool liquidity"
    },
    {
      "code": 6013,
      "name": "InvalidPositionIndex",
      "msg": "Invalid position index"
    },
    {
      "code": 6014,
      "name": "PositionWithoutLiquidity",
      "msg": "Position liquidity would be zero"
    },
    {
      "code": 6015,
      "name": "Unauthorized",
      "msg": "You are not admin"
    },
    {
      "code": 6016,
      "name": "InvalidPoolTokenAddresses",
      "msg": "Invalid pool token addresses"
    },
    {
      "code": 6017,
      "name": "NegativeTime",
      "msg": "Time cannot be negative"
    },
    {
      "code": 6018,
      "name": "OracleAlreadyInitialized",
      "msg": "Oracle is already initialized"
    },
    {
      "code": 6019,
      "name": "LimitReached",
      "msg": "Absolute price limit was reached"
    },
    {
      "code": 6020,
      "name": "InvalidProtocolFee",
      "msg": "Invalid protocol fee"
    }
  ]
};

export const IDL: Amm = {
  "version": "0.1.0",
  "name": "amm",
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
          "name": "bump",
          "type": "u8"
        },
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
          "name": "bump",
          "type": "u8"
        },
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenYReserve",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
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
          "name": "bump",
          "type": "u8"
        },
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
          "name": "bump",
          "type": "u8"
        },
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
      "args": [
        {
          "name": "bump",
          "type": "u8"
        }
      ]
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
          "name": "bump",
          "type": "u8"
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
          "name": "liquidityDelta",
          "type": {
            "defined": "Decimal"
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
          "name": "bump",
          "type": "u8"
        },
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
            "defined": "Decimal"
          }
        }
      ]
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
              "defined": "Decimal"
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
              "defined": "Decimal"
            }
          },
          {
            "name": "protocolFee",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Decimal"
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
              "defined": "Decimal"
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
              "defined": "Decimal"
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
              "defined": "Decimal"
            }
          },
          {
            "name": "lastSlot",
            "type": "u64"
          },
          {
            "name": "tokensOwedX",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "tokensOwedY",
            "type": {
              "defined": "Decimal"
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
              "defined": "Decimal"
            }
          },
          {
            "name": "liquidityGross",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "sqrtPrice",
            "type": {
              "defined": "Decimal"
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
              "defined": "Decimal"
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
                25000
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Decimal",
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
              "defined": "Decimal"
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ZeroAmount",
      "msg": "Amount is zero"
    },
    {
      "code": 6001,
      "name": "ZeroOutput",
      "msg": "Output would be zero"
    },
    {
      "code": 6002,
      "name": "WrongTick",
      "msg": "Not the expected tick"
    },
    {
      "code": 6003,
      "name": "WrongLimit",
      "msg": "Price limit is on the wrong side of price"
    },
    {
      "code": 6004,
      "name": "InvalidTickIndex",
      "msg": "Tick index not divisible by spacing or over limit"
    },
    {
      "code": 6005,
      "name": "InvalidTickInterval",
      "msg": "Invalid tick_lower or tick_upper"
    },
    {
      "code": 6006,
      "name": "NoMoreTicks",
      "msg": "There is no more tick in that direction"
    },
    {
      "code": 6007,
      "name": "TickNotFound",
      "msg": "Correct tick not found in context"
    },
    {
      "code": 6008,
      "name": "PriceLimitReached",
      "msg": "Price would cross swap limit"
    },
    {
      "code": 6009,
      "name": "InvalidTickLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 6010,
      "name": "EmptyPositionPokes",
      "msg": "Disable empty position pokes"
    },
    {
      "code": 6011,
      "name": "InvalidPositionLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 6012,
      "name": "InvalidPoolLiquidity",
      "msg": "Invalid pool liquidity"
    },
    {
      "code": 6013,
      "name": "InvalidPositionIndex",
      "msg": "Invalid position index"
    },
    {
      "code": 6014,
      "name": "PositionWithoutLiquidity",
      "msg": "Position liquidity would be zero"
    },
    {
      "code": 6015,
      "name": "Unauthorized",
      "msg": "You are not admin"
    },
    {
      "code": 6016,
      "name": "InvalidPoolTokenAddresses",
      "msg": "Invalid pool token addresses"
    },
    {
      "code": 6017,
      "name": "NegativeTime",
      "msg": "Time cannot be negative"
    },
    {
      "code": 6018,
      "name": "OracleAlreadyInitialized",
      "msg": "Oracle is already initialized"
    },
    {
      "code": 6019,
      "name": "LimitReached",
      "msg": "Absolute price limit was reached"
    },
    {
      "code": 6020,
      "name": "InvalidProtocolFee",
      "msg": "Invalid protocol fee"
    }
  ]
};
