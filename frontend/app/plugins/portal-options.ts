import { setPortalsEnabled } from '~/data/rbac'

/**
 * S12a — asks the server once whether the client/vendor portals may sign in (`GET /auth/options`: on in
 * development/staging, never in production) before any page renders, so the login page, the role switcher and the
 * cookie-restored user agree with the server. Fetched during SSR and handed to the browser through `useState`; an
 * unreachable server means "off".
 */
export default defineNuxtPlugin(async () => {
  const portalLogin = useState<boolean | null>('manova-portal-login', () => null)
  if (portalLogin.value === null) {
    try {
      portalLogin.value = (await useApi().auth.options()).data.portalLogin
    } catch {
      portalLogin.value = false
    }
  }
  setPortalsEnabled(portalLogin.value)
})
