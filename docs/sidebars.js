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
      label: 'Solana',
      collapsed: true,
      items: [
        'solana/introduction',
        'solana/quick_start',
        'solana/pool',
        'solana/minting_position',
        'solana/position_list',
        'solana/swap',
        'solana/withdraw',
        'solana/invariant_errors'
      ]
    },
    {
      type: 'category',
      label: 'Aleph Zero',
      collapsed: true,
      items: ['aleph_zero/project_structure', 'aleph_zero/main_structure', 'aleph_zero/installation', 'aleph_zero/entrypoints', 'aleph_zero/collections', 'aleph_zero/storage']
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
