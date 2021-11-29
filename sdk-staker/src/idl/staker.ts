export type Staker = {
  "version": "0.0.0",
  "name": "staker",
  "instructions": [
    {
      "name": "createIncentive",
      "accounts": [
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "incentiveTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "founderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "founder",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakerAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
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
          "name": "reward",
          "type": {
            "defined": "Decimal"
          }
        },
        {
          "name": "startTime",
          "type": "u64"
        },
        {
          "name": "endTime",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stake",
      "accounts": [
        {
          "name": "userStake",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "i32"
        },
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "userStake",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentiveTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakerAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "i32"
        },
        {
          "name": "bumpStake",
          "type": "u8"
        },
        {
          "name": "bumpAuthority",
          "type": "u8"
        }
      ]
    },
    {
      "name": "endIncentive",
      "accounts": [
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentiveTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "founderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakerAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bumpAuthority",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "incentive",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "founder",
            "type": "publicKey"
          },
          {
            "name": "tokenAccount",
            "type": "publicKey"
          },
          {
            "name": "totalRewardUnclaimed",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "totalSecondsClaimed",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "startTime",
            "type": "u64"
          },
          {
            "name": "endTime",
            "type": "u64"
          },
          {
            "name": "numOfStakes",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "userStake",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "position",
            "type": "publicKey"
          },
          {
            "name": "incentive",
            "type": "publicKey"
          },
          {
            "name": "secondsPerLiquidityInitial",
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
            "name": "index",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
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
    }
  ],
  "errors": [
    {
      "code": 300,
      "name": "NotStarted",
      "msg": "The incentive didn't start yet!"
    },
    {
      "code": 301,
      "name": "EmptyPositionPokes",
      "msg": "Disable empty position pokes"
    },
    {
      "code": 302,
      "name": "InvalidPositionLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 303,
      "name": "ZeroAmount",
      "msg": "Amount is zero"
    },
    {
      "code": 304,
      "name": "TooLongDuration",
      "msg": "Incentive duration is too long"
    },
    {
      "code": 305,
      "name": "StartInPast",
      "msg": "Start in past"
    },
    {
      "code": 306,
      "name": "Ended",
      "msg": "Incentive is over"
    },
    {
      "code": 307,
      "name": "ZeroLiquidity",
      "msg": "User have no liquidity"
    },
    {
      "code": 308,
      "name": "SlotsAreNotEqual",
      "msg": "Slots are not equal"
    },
    {
      "code": 309,
      "name": "ZeroSecondsStaked",
      "msg": "Zero seconds staked"
    },
    {
      "code": 310,
      "name": "ZeroSecPerLiq",
      "msg": "Seconds per liquidity is zero"
    },
    {
      "code": 311,
      "name": "NotEnded",
      "msg": "Incentive not ended"
    },
    {
      "code": 312,
      "name": "StakeExist",
      "msg": "Can't end id stake exists"
    },
    {
      "code": 313,
      "name": "ZeroReward",
      "msg": "Remaining reward is 0"
    }
  ]
};

export const IDL: Staker = {
  "version": "0.0.0",
  "name": "staker",
  "instructions": [
    {
      "name": "createIncentive",
      "accounts": [
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "incentiveTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "founderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "pool",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "founder",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakerAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
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
          "name": "reward",
          "type": {
            "defined": "Decimal"
          }
        },
        {
          "name": "startTime",
          "type": "u64"
        },
        {
          "name": "endTime",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stake",
      "accounts": [
        {
          "name": "userStake",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "i32"
        },
        {
          "name": "bump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "withdraw",
      "accounts": [
        {
          "name": "userStake",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentiveTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "ownerTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "position",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakerAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "amm",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "i32"
        },
        {
          "name": "bumpStake",
          "type": "u8"
        },
        {
          "name": "bumpAuthority",
          "type": "u8"
        }
      ]
    },
    {
      "name": "endIncentive",
      "accounts": [
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "incentiveTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "founderTokenAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakerAuthority",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "bumpAuthority",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "incentive",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "founder",
            "type": "publicKey"
          },
          {
            "name": "tokenAccount",
            "type": "publicKey"
          },
          {
            "name": "totalRewardUnclaimed",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "totalSecondsClaimed",
            "type": {
              "defined": "Decimal"
            }
          },
          {
            "name": "startTime",
            "type": "u64"
          },
          {
            "name": "endTime",
            "type": "u64"
          },
          {
            "name": "numOfStakes",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "userStake",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "position",
            "type": "publicKey"
          },
          {
            "name": "incentive",
            "type": "publicKey"
          },
          {
            "name": "secondsPerLiquidityInitial",
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
            "name": "index",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
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
    }
  ],
  "errors": [
    {
      "code": 300,
      "name": "NotStarted",
      "msg": "The incentive didn't start yet!"
    },
    {
      "code": 301,
      "name": "EmptyPositionPokes",
      "msg": "Disable empty position pokes"
    },
    {
      "code": 302,
      "name": "InvalidPositionLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 303,
      "name": "ZeroAmount",
      "msg": "Amount is zero"
    },
    {
      "code": 304,
      "name": "TooLongDuration",
      "msg": "Incentive duration is too long"
    },
    {
      "code": 305,
      "name": "StartInPast",
      "msg": "Start in past"
    },
    {
      "code": 306,
      "name": "Ended",
      "msg": "Incentive is over"
    },
    {
      "code": 307,
      "name": "ZeroLiquidity",
      "msg": "User have no liquidity"
    },
    {
      "code": 308,
      "name": "SlotsAreNotEqual",
      "msg": "Slots are not equal"
    },
    {
      "code": 309,
      "name": "ZeroSecondsStaked",
      "msg": "Zero seconds staked"
    },
    {
      "code": 310,
      "name": "ZeroSecPerLiq",
      "msg": "Seconds per liquidity is zero"
    },
    {
      "code": 311,
      "name": "NotEnded",
      "msg": "Incentive not ended"
    },
    {
      "code": 312,
      "name": "StakeExist",
      "msg": "Can't end id stake exists"
    },
    {
      "code": 313,
      "name": "ZeroReward",
      "msg": "Remaining reward is 0"
    }
  ]
};
