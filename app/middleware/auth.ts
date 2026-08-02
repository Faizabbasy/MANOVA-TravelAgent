export default defineNuxtRouteMiddleware((to) => {
  // Check if running on client side
  if (process.client) {
    const isAuthenticated = localStorage.getItem('isAuthenticated')

    // If not authenticated and not going to login page, redirect to login
    if (!isAuthenticated && to.path !== '/login') {
      return navigateTo('/login')
    }

    // If authenticated and going to login page, redirect to dashboard
    if (isAuthenticated && to.path === '/login') {
      return navigateTo('/')
    }
  }
})
