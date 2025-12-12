import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'AgroBridge Documentation',
  description: 'Enterprise-grade governance & developer docs for AgroBridge International.',
  
  themeConfig: {
    logo: '/logo.svg', // Placeholder for when assets are added
    siteTitle: 'AgroBridge Docs',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Strategy', link: '/strategy/CORPORATE_GOVERNANCE' },
      { text: 'Technical', link: '/technical/ECOSYSTEM' },
      { 
        text: 'Guides', 
        items: [
          { text: 'Onboarding (EN)', link: '/en/ONBOARDING' },
          { text: 'Onboarding (ES)', link: '/es/ONBOARDING' },
          { text: 'Backup Ops', link: '/en/BACKUP' },
          { text: 'Migrations', link: '/en/MIGRATIONS' }
        ]
      },
      { text: 'Legal', link: '/legal/PRIVACY_POLICY' },
      {
        text: '🌐 Language',
        items: [
          { text: 'English', link: '/en/' },
          { text: 'Español', link: '/es/' }
        ]
      }
    ],

    sidebar: {
      '/strategy/': [
        {
          text: 'Governance & Culture',
          items: [
            { text: 'Corporate Governance', link: '/strategy/CORPORATE_GOVERNANCE' },
            { text: 'Culture & Leadership', link: '/strategy/CULTURE_AND_LEADERSHIP' },
            { text: 'ESG Policy', link: '/strategy/ESG_POLICY' },
            { text: 'Roadmap', link: '/strategy/ROADMAP' }
          ]
        }
      ],
      '/technical/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Ecosystem', link: '/technical/ECOSYSTEM' },
            { text: 'Security', link: '/technical/SECURITY' },
            { text: 'Access Control', link: '/technical/ACCESS_CONTROL' },
            { text: 'Scalability', link: '/technical/SCALABILITY' }
          ]
        }
      ],
      '/legal/': [
        {
          text: 'Legal Framework',
          items: [
            { text: 'Privacy Policy', link: '/legal/PRIVACY_POLICY' },
            { text: 'Terms of Service', link: '/legal/TERMS_OF_SERVICE' }
          ]
        },
        {
          text: 'Compliance',
          items: [
            { text: 'Review Package', link: '/legal/review_package_2025_11_25/LEGAL_AUDIT_CHECKLIST' }
          ]
        }
      ],
      '/en/': [
        {
          text: 'Developer Guides',
          items: [
            { text: 'Onboarding', link: '/en/ONBOARDING' },
            { text: 'Backup & Recovery', link: '/en/BACKUP' },
            { text: 'Migrations', link: '/en/MIGRATIONS' }
          ]
        }
      ],
      '/es/': [
        {
          text: 'Guías para Desarrolladores',
          items: [
            { text: 'Onboarding', link: '/es/ONBOARDING' },
            { text: 'Respaldo y Recuperación', link: '/es/BACKUP' },
            { text: 'Migraciones', link: '/es/MIGRATIONS' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/AgroBridge/agrobridgeint.com' }
    ],

    footer: {
      message: 'Released under Proprietary License.',
      copyright: 'Copyright © 2025 AgroBridge S.A. de C.V.'
    },

    outline: 'deep'
  },
  
  appearance: 'dark',
  lastUpdated: true
})
