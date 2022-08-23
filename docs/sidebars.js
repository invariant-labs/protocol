module.exports = {
  docs: [
    'home',
    {
      type: 'category',
      label: 'What is Invariant',
      // collapsed: true,
      items: [
        'what_is/the_birth_of_the_idea',
        'what_is/solana',
        'what_is/concentrated_liquidity',
        'what_is/price_of_the_token',
        'what_is/single_token_lp',
        'what_is/ticks',
        'what_is/fees',
        'what_is/merge',
        'what_is/glossary'
      ]
    },
    {
      type: 'category',
      label: 'Tutorial',
      collapsed: true,
      items: [
        'tutorial/how_to_connect_your_wallet',
        'tutorial/how_to_swap',
        'tutorial/how_to_add_remove_liquidity',
        'tutorial/uniform_concentration'
      ]
    },
    {
      type: 'category',
      label: 'Invariant Bonds',
      // collapsed: true,
      items: [
        'invariant_bonds/introduction',
        'invariant_bonds/math',
        'invariant_bonds/bond_example'
      ]
    },
    {
      type: 'category',
      label: 'Invariant Staker',
      // collapsed: true,
      items: ['invariant_staker/introduction', 'invariant_staker/calculation']
    },
    {
      type: 'category',
      label: 'Technical side',
      collapsed: true,
      items: [
        'technical_side/introduction',
        'technical_side/quick_start',
        'technical_side/pool',
        'technical_side/minting_position',
        'technical_side/position_list',
        'technical_side/swap',
        'technical_side/withdraw',
        'technical_side/invariant_errors'
      ]
    },
    'faq',
    'resources',
    {
      href: 'https://twitter.com/invariant_labs',
      label: 'Twitter',
      type: 'link'
    },
    {
      href: 'https://discord.gg/w6hTeWTJvG',
      label: 'Discord',
      type: 'link'
    },
    {
      href: 'https://github.com/invariant-labs',
      label: 'GitHub',
      type: 'link'
    }
  ]
}
