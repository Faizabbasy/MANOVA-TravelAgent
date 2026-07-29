const isCollapsed = ref(false)

export function useSidebar() {
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
    toggle,
    collapse,
    expand,
  }
}
