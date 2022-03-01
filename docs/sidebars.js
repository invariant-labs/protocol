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
      label: 'Smart contract overview',
      collapsed: true,
      items: ['smart_contract/todo']
    },
    {
      type: 'category',
      label: 'Invariant SDK',
      collapsed: true,
      items: ['invariant_sdk/todo']
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
