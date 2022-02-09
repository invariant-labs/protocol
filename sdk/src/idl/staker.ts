export type Staker = {
  "version": "0.1.0",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "invariant",
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
          "name": "nonce",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "invariant",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakerAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "invariant",
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
          "name": "nonce",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
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
            "name": "endClaimTime",
            "type": "u64"
          },
          {
            "name": "numOfStakes",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "nonce",
            "type": "u8"
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
            "name": "incentive",
            "type": "publicKey"
          },
          {
            "name": "position",
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
      "code": 6000,
      "name": "NotStarted",
      "msg": "The incentive didn't start yet!"
    },
    {
      "code": 6001,
      "name": "EmptyPositionPokes",
      "msg": "Disable empty position pokes"
    },
    {
      "code": 6002,
      "name": "InvalidPositionLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 6003,
      "name": "ZeroAmount",
      "msg": "Amount is zero"
    },
    {
      "code": 6004,
      "name": "TooLongDuration",
      "msg": "Incentive duration is too long"
    },
    {
      "code": 6005,
      "name": "StartInPast",
      "msg": "Start in past"
    },
    {
      "code": 6006,
      "name": "Ended",
      "msg": "Incentive is over"
    },
    {
      "code": 6007,
      "name": "ZeroLiquidity",
      "msg": "User have no liquidity"
    },
    {
      "code": 6008,
      "name": "SlotsAreNotEqual",
      "msg": "Slots are not equal"
    },
    {
      "code": 6009,
      "name": "ZeroSecondsStaked",
      "msg": "Zero seconds staked"
    },
    {
      "code": 6010,
      "name": "ZeroSecPerLiq",
      "msg": "Seconds per liquidity is zero"
    },
    {
      "code": 6011,
      "name": "TooEarly",
      "msg": "Incentive not ended"
    },
    {
      "code": 6012,
      "name": "StakeExist",
      "msg": "Too early to remove incentive"
    },
    {
      "code": 6013,
      "name": "ZeroReward",
      "msg": "Remaining reward is 0"
    }
  ]
};

export const IDL: Staker = {
  "version": "0.1.0",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "invariant",
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
          "name": "nonce",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "incentive",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "invariant",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakerAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "invariant",
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
          "name": "nonce",
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
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
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
            "name": "endClaimTime",
            "type": "u64"
          },
          {
            "name": "numOfStakes",
            "type": "u64"
          },
          {
            "name": "pool",
            "type": "publicKey"
          },
          {
            "name": "nonce",
            "type": "u8"
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
            "name": "incentive",
            "type": "publicKey"
          },
          {
            "name": "position",
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
      "code": 6000,
      "name": "NotStarted",
      "msg": "The incentive didn't start yet!"
    },
    {
      "code": 6001,
      "name": "EmptyPositionPokes",
      "msg": "Disable empty position pokes"
    },
    {
      "code": 6002,
      "name": "InvalidPositionLiquidity",
      "msg": "Invalid tick liquidity"
    },
    {
      "code": 6003,
      "name": "ZeroAmount",
      "msg": "Amount is zero"
    },
    {
      "code": 6004,
      "name": "TooLongDuration",
      "msg": "Incentive duration is too long"
    },
    {
      "code": 6005,
      "name": "StartInPast",
      "msg": "Start in past"
    },
    {
      "code": 6006,
      "name": "Ended",
      "msg": "Incentive is over"
    },
    {
      "code": 6007,
      "name": "ZeroLiquidity",
      "msg": "User have no liquidity"
    },
    {
      "code": 6008,
      "name": "SlotsAreNotEqual",
      "msg": "Slots are not equal"
    },
    {
      "code": 6009,
      "name": "ZeroSecondsStaked",
      "msg": "Zero seconds staked"
    },
    {
      "code": 6010,
      "name": "ZeroSecPerLiq",
      "msg": "Seconds per liquidity is zero"
    },
    {
      "code": 6011,
      "name": "TooEarly",
      "msg": "Incentive not ended"
    },
    {
      "code": 6012,
      "name": "StakeExist",
      "msg": "Too early to remove incentive"
    },
    {
      "code": 6013,
      "name": "ZeroReward",
      "msg": "Remaining reward is 0"
    }
  ]
};
