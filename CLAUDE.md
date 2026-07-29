# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dashboard application built with Nuxt 4, Vue 3, and TypeScript. It uses shadcn-nuxt for UI components and features a project/task management interface.

## Technology Stack

- **Framework**: Nuxt 4 with Vue 3
- **Language**: TypeScript (non-strict mode)
- **UI Components**: shadcn-nuxt (Vue port of shadcn-ui)
- **UI Primitives**: Reka UI (Vue alternative to Radix UI)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: vee-validate with Zod schemas
- **Charts**: Chart.js with vue-chartjs
- **Utilities**: VueUse for Vue composables
- **Icons**: lucide-vue-next
- **Testing**: Vitest with Vue Test Utils

## Essential Commands

```bash
# Development
npm run dev              # Start dev server on port 8080
npm run build            # Production build
npm run generate         # Generate static site
npm run preview          # Preview production build
npm install              # Install and run postinstall (nuxt prepare)

# Testing
# Note: No test script configured yet - would use vitest
```

## Project Architecture

### Directory Structure

```
app/
├── components/
│   ├── dashboard/       # Dashboard-specific components (charts, stats, tables)
│   ├── layout/          # Layout components (AppSidebar, TopHeader)
│   └── ui/              # shadcn-nuxt components (auto-generated)
├── composables/         # Vue composables (auto-imported)
├── layouts/             # Nuxt layouts (dashboard.vue)
├── pages/               # File-based routing
├── lib/                 # Utilities (utils.ts for cn() helper)
└── utils/               # Additional utilities (auto-imported)
assets/
├── css/
│   └── tailwind.css     # Tailwind imports and CSS variables
public/                  # Static assets
```

### Application Structure

The app follows Nuxt's convention-based architecture:

1. **app.vue**: Root component that imports Tailwind CSS and wraps all pages in `<NuxtLayout>` and `<NuxtPage>`

2. **Layouts**: Defined in `app/layouts/`
   - `dashboard.vue`: Main layout with AppSidebar and TopHeader
   - Pages specify layout using `definePageMeta({ layout: 'dashboard' })`

3. **Pages**: File-based routing in `app/pages/`
   - `index.vue` → `/`
   - `projects.vue` → `/projects`
   - `tasks.vue` → `/tasks`
   - `[...slug].vue` → Catch-all 404 page

4. **Components**: Auto-imported from `app/components/`
   - No need to explicitly import components
   - Organized in subdirectories (dashboard, layout, ui)

### Import Aliases

The project uses `~/` as an alias for the `app/` directory:
```vue
import { cn } from '~/lib/utils'
```

Configured in `components.json` for shadcn-nuxt:
- `~/components` → components
- `~/lib/utils` → utils
- `~/components/ui` → ui
- `~/composables` → hooks (Vue equivalent of React hooks)

### Auto-Imports

Nuxt automatically imports:
- Vue composables from `app/composables/` and subdirectories
- Utilities from `app/utils/`
- Components from `app/components/` and subdirectories
- Nuxt composables (`useRouter`, `navigateTo`, `definePageMeta`, etc.)
- Vue APIs (`ref`, `computed`, `watch`, etc.)

## Styling & Theming

### Tailwind Configuration

Custom theme in [tailwind.config.ts](tailwind.config.ts) includes:
- Extended color palette using HSL CSS variables
- Sidebar-specific colors
- Chart colors (chart-1 through chart-5)
- Custom animations (accordion, fade-in, slide-in)
- Plus Jakarta Sans font family

### CSS Variables

Theme colors are defined as CSS variables in [assets/css/tailwind.css](assets/css/tailwind.css) using HSL values. The file includes both light and dark mode values. To modify colors, update the CSS variables in this file.

### shadcn-nuxt Components

- Located in [app/components/ui/](app/components/ui/)
- Auto-generated via shadcn-nuxt CLI
- Configured in `components.json`
- Modify with caution - prefer wrapping in custom components
- Based on Reka UI primitives (Vue equivalent of Radix UI)

## Development Patterns

### Component Organization

- **Dashboard components**: Domain-specific components composed in pages
- **Layout components**: Shared structure (sidebar, header)
- **UI components**: Reusable shadcn-nuxt primitives

### Page Meta

Pages use `definePageMeta()` to configure routing and layout:
```vue
<script setup>
definePageMeta({
  layout: 'dashboard'
})
</script>
```

### Composables

- Create composables in `app/composables/` (auto-imported)
- Follow Vue composable naming: `use*` (e.g., `useIsMobile.ts`)
- Use VueUse utilities for common functionality

### Forms

- Use `vee-validate` with `@vee-validate/zod` for validation
- Define Zod schemas for form validation
- shadcn-nuxt provides Form components

### Icons

- Use `lucide-vue-next` for icons
- Import specific icons: `import { IconName } from 'lucide-vue-next'`

### Charts

- Use `vue-chartjs` for Chart.js integration
- Chart colors defined in theme (chart-1 through chart-5)

## Build Configuration

### Nuxt Config

Key settings in [nuxt.config.ts](nuxt.config.ts):
- Dev server runs on port 8080 (host: 0.0.0.0)
- TypeScript in non-strict mode
- Modules: @nuxtjs/tailwindcss, @vueuse/nuxt, shadcn-nuxt
- Auto-imports composables from `composables/` and `utils/`
- Components auto-imported with no path prefix

### TypeScript

- TypeScript references in `tsconfig.json` point to `.nuxt/` generated configs
- Nuxt generates type definitions automatically on `nuxt prepare`
- Type checking is disabled in build (`typeCheck: false`)

## Important Notes

- This is a Nuxt 4 project using Vue 3, NOT React
- Use Vue conventions (composables, not hooks; `<template>` not JSX)
- Components are auto-imported - no need for explicit imports
- Use `~/` alias consistently for imports
- shadcn-nuxt components should not be modified directly - wrap or extend them
- File-based routing: files in `app/pages/` automatically become routes
- The `[...slug].vue` catch-all must remain last in routing hierarchy
