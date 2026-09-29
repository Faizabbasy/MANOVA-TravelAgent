const isCollapsed = ref(false)
/** Phone widths (<768px): the sidebar is an off-canvas drawer, closed by default. */
const isMobileOpen = ref(false)

export function useSidebar () {
  const toggle = () => {
    isCollapsed.value = !isCollapsed.value
  }

  const collapse = () => {
    isCollapsed.value = true
  }

  const expand = () => {
    isCollapsed.value = false
  }

  return {
    isCollapsed: readonly(isCollapsed),
    isMobileOpen: readonly(isMobileOpen),
    openMobile: () => { isMobileOpen.value = true },
    closeMobile: () => { isMobileOpen.value = false },
    toggle,
    collapse,
    expand
  }
}
