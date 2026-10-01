// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
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
    '/expenses': { redirect: { to: '/finance/statement?kind=expense', statusCode: 301 } },
    '/projects/create': { redirect: { to: '/project-orders', statusCode: 301 } },
    '/customer-journey/project-orders': { redirect: { to: '/project-orders', statusCode: 301 } }
  },

  /**
   * Backend API (backend/, Elysia on :3000). The browser calls `/api/v1/**` on this origin and
   * `server/routes/api/v1/[...path].ts` proxies it, so the HttpOnly session cookie stays first-party.
   * `NUXT_API_PROXY_TARGET` / `NUXT_PUBLIC_API_BASE` override these at runtime (see frontend/.env.example).
   */
  runtimeConfig: {
    apiProxyTarget: 'http://localhost:3000',
    public: {
      apiBase: '/api/v1'
    }
  },

  app: {
    head: {
      title: 'MANOVA',
      titleTemplate: title => title && title !== 'MANOVA' ? `${title} · MANOVA` : 'MANOVA — Travel Operations Platform',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'MANOVA — mockup pengelolaan operasional project travel agent (CRM, Project, Operations, Vendor, Finance).' },
        /** Opt keluar dari "Force Dark Mode"/auto-dark browser (Chrome dkk) — app ini TIDAK punya dark mode
         * (lihat komentar `color-scheme: light` di `assets/css/tailwind.css`). Deklarasi di CSS `body` saja
         * kadang tidak cukup untuk sinyal document-level yang dicek browser; meta tag ini pola resmi yang
         * direkomendasikan supaya browser tidak meng-invert warna sheet/dialog (portal ke luar `body`) di
         * device/browser dengan dark mode dipaksa aktif. */
        { name: 'color-scheme', content: 'light' }
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
