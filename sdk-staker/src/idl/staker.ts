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
          "isSigner": true
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
          "name": "incentiveToken",
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
            "defined": "TokenAmount"
          }
        },
        {
          "name": "startTime",
          "type": {
            "defined": "Seconds"
          }
        },
        {
          "name": "endTime",
          "type": {
            "defined": "Seconds"
          }
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
              "defined": "TokenAmount"
            }
          },
          {
            "name": "totalSecondsClaimed",
            "type": {
              "defined": "Seconds"
            }
          },
          {
            "name": "startTime",
            "type": {
              "defined": "Seconds"
            }
          },
          {
            "name": "endTime",
            "type": {
              "defined": "Seconds"
            }
          },
          {
            "name": "endClaimTime",
            "type": {
              "defined": "Seconds"
            }
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
              "defined": "SecondsPerLiquidity"
            }
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Liquidity"
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
      "name": "SecondsPerLiquidity",
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
      "name": "TokenAmount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Seconds",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u64"
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
    },
    {
      "code": 6014,
      "name": "NoStakes",
      "msg": "There is no any stakes"
    },
    {
      "code": 6015,
      "name": "InvalidFounder",
      "msg": "Founder address is different than expected"
    },
    {
      "code": 6016,
      "name": "InvalidStake",
      "msg": "Provided stake doesn't belong to incentive"
    },
    {
      "code": 6017,
      "name": "InvalidTokenAccount",
      "msg": "Provided token account is different than expected"
    },
    {
      "code": 6018,
      "name": "InvalidIncentive",
      "msg": "Incentive address is different than expected"
    },
    {
      "code": 6019,
      "name": "InvalidAuthority",
      "msg": "Provided authority is different than expected"
    },
    {
      "code": 6020,
      "name": "InvalidOwner",
      "msg": "Provided token owner is different than expected"
    },
    {
      "code": 6021,
      "name": "InvalidMint",
      "msg": "Provided token account mint is different than expected mint token"
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
          "isSigner": true
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
          "name": "incentiveToken",
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
            "defined": "TokenAmount"
          }
        },
        {
          "name": "startTime",
          "type": {
            "defined": "Seconds"
          }
        },
        {
          "name": "endTime",
          "type": {
            "defined": "Seconds"
          }
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
              "defined": "TokenAmount"
            }
          },
          {
            "name": "totalSecondsClaimed",
            "type": {
              "defined": "Seconds"
            }
          },
          {
            "name": "startTime",
            "type": {
              "defined": "Seconds"
            }
          },
          {
            "name": "endTime",
            "type": {
              "defined": "Seconds"
            }
          },
          {
            "name": "endClaimTime",
            "type": {
              "defined": "Seconds"
            }
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
              "defined": "SecondsPerLiquidity"
            }
          },
          {
            "name": "liquidity",
            "type": {
              "defined": "Liquidity"
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
      "name": "SecondsPerLiquidity",
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
      "name": "TokenAmount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Seconds",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "v",
            "type": "u64"
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
    },
    {
      "code": 6014,
      "name": "NoStakes",
      "msg": "There is no any stakes"
    },
    {
      "code": 6015,
      "name": "InvalidFounder",
      "msg": "Founder address is different than expected"
    },
    {
      "code": 6016,
      "name": "InvalidStake",
      "msg": "Provided stake doesn't belong to incentive"
    },
    {
      "code": 6017,
      "name": "InvalidTokenAccount",
      "msg": "Provided token account is different than expected"
    },
    {
      "code": 6018,
      "name": "InvalidIncentive",
      "msg": "Incentive address is different than expected"
    },
    {
      "code": 6019,
      "name": "InvalidAuthority",
      "msg": "Provided authority is different than expected"
    },
    {
      "code": 6020,
      "name": "InvalidOwner",
      "msg": "Provided token owner is different than expected"
    },
    {
      "code": 6021,
      "name": "InvalidMint",
      "msg": "Provided token account mint is different than expected mint token"
    }
  ]
};
