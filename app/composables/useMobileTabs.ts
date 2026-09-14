import { computed } from 'vue'
import { CLIENT_MOBILE_TABS, INTERNAL_MOBILE_TABS, type MobileTabItem } from '~/constants/mobile-nav'
import { isNavPathActive } from '~/utils/nav-active'

/**
 * Set tab bottom-nav mobile sesuai role user, plus deteksi tab aktif. Dipakai `MobileBottomNav.vue`.
 */
export function useMobileTabs () {
  const route = useRoute()
  const { isRole } = usePermissions()

  const tabs = computed<MobileTabItem[]>(() =>
    isRole('client') ? CLIENT_MOBILE_TABS : INTERNAL_MOBILE_TABS
  )

  function isTabActive (tab: MobileTabItem) {
    return isNavPathActive(tab.to, route)
  }

  const activeTabKey = computed(() => tabs.value.find(isTabActive)?.key)

  return {
    tabs,
    isTabActive,
    activeTabKey
  }
}
