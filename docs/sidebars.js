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
        'tutorial/how_to_add_remove_liquidity'
      ]
    },
    {
      type: 'category',
      label: 'Invariant Bonds',
      // collapsed: true,
      items: ['invariant_bonds/introduction', 'invariant_bonds/math', 'invariant_bonds/example']
    },
    {
      type: 'category',
      label: 'Technical docs',
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'Invariant',
          collapsed: true,
          items: ['technical_docs/invariant/todo']
        },
        {
          type: 'category',
          label: 'Staker',
          collapsed: true,
          items: ['technical_docs/staker/todo']
        },
        {
          type: 'category',
          label: 'Bonds',
          collapsed: true,
          items: ['technical_docs/bonds/todo']
        }
      ]
    },
    'faq',
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
