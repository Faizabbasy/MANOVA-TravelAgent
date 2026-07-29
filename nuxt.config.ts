// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  typescript: {
    strict: false,  // Match React's relaxed mode
    typeCheck: false,
    shim: false
  },

  devServer: {
    port: 8080,  // Same port as React
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
    { path: '~/components/ui', pathPrefix: false }
  ],

  app: {
    head: {
      title: 'MANOVA',
      titleTemplate: (title) => title && title !== 'MANOVA' ? `${title} · MANOVA` : 'MANOVA — Travel Operations Platform',
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
