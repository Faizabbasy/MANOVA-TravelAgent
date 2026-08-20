// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  typescript: {
    strict: false, // Match React's relaxed mode
    typeCheck: false,
    shim: false
  },

  devServer: {
    port: 8080, // Same port as React
    host: '0.0.0.0'
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@vueuse/nuxt',
    'shadcn-nuxt'
  ],

  tailwindcss: {
    cssPath: './assets/css/tailwind.css',
    configPath: './tailwind.config.ts',
    exposeConfig: false,
    viewer: true
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  },

  imports: {
    dirs: ['composables', 'composables/**', 'utils/**']
  },

  components: [
    { path: '~/components', pathPrefix: false },
    { path: '~/components/layout', pathPrefix: false },
    { path: '~/components/dashboard', pathPrefix: false },
    { path: '~/components/shared', pathPrefix: false },
    { path: '~/components/client', pathPrefix: false },
    { path: '~/components/ui', pathPrefix: false }
  ],

  /**
   * Redirect rute yang dihapus pada Revisi 9-Modul. Keempatnya adalah sisa template awal (data Inggris/USD,
   * tidak tersambung ke domain MANOVA) yang kini punya pengganti nyata. Tanpa redirect, bookmark dan tautan
   * di dokumen lama akan jatuh ke halaman 404.
   */
  routeRules: {
    '/tasks': { redirect: { to: '/project-orders', statusCode: 301 } },
    '/expenses': { redirect: { to: '/finance/opex', statusCode: 301 } },
    '/projects/create': { redirect: { to: '/project-orders', statusCode: 301 } },
    '/customer-journey/project-orders': { redirect: { to: '/project-orders', statusCode: 301 } }
  },

  app: {
    head: {
      title: 'MANOVA',
      titleTemplate: title => title && title !== 'MANOVA' ? `${title} · MANOVA` : 'MANOVA — Travel Operations Platform',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'MANOVA — mockup pengelolaan operasional project travel agent (CRM, Project, Operations, Vendor, Finance).' }
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap'
        }
      ]
    },
    pageTransition: { name: 'page', mode: 'out-in' }
  }
})
