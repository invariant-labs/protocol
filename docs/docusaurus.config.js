/** @type {import('@docusaurus/types').DocusaurusConfig} */

const math = require('remark-math')
const katex = require('rehype-katex')
module.exports = {
  title: 'Invariant docs',
  tagline: 'Peer-to-peer system for exchanging assets on the Solana blockchain.',
  url: 'https://invariant.app/',
  baseUrl: '/',
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon-16x16.png',
  organizationName: 'Invariant',
  projectName: 'Invariant docs',
  themeConfig: {
    prism: {
      theme: require('prism-react-renderer/themes/vsDark'),
      additionalLanguages: ['rust']
    },
    navbar: {
      title: 'Invariant',
      logo: {
        alt: 'Invariant Logo',
        src: 'img/logo.png'
      },
      items: [
        { to: '/docs/solana/introduction', label: 'Solana', position: 'left' },
        { to: '/docs/aleph_zero/entrypoints', label: 'Aleph Zero', position: 'left' }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Home',
              to: '/docs/'
            }
          ]
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/w6hTeWTJvG'
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/invariant_labs'
            }
          ]
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/invariant-labs'
            }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Invariant | Built with Docusaurus.`
    }
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          remarkPlugins: [math],
          rehypePlugins: [katex],
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://invariant.app/'
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css')
        }
      }
    ]
  ],
  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity: 'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous'
    }
  ]
}
