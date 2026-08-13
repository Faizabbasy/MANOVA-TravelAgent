import { ref, onMounted } from 'vue'

/**
 * Count-up dari 0 ke nilai akhir setiap kali komponen pertama kali mount (bukan watcher — sengaja tidak
 * re-trigger saat data reaktif berubah tanpa remount). Dilewati (langsung tampil final) jika pengguna minta
 * motion dikurangi. Dipakai `DashboardHeroPanel` dan `MonthlyCashFlowChart` — angka finansial yang
 * "menghitung diri" saat halaman pertama dibuka.
 */
export function useCountUp (target: number, startDelayMs = 0, durationMs = 1100) {
  const display = ref(0)
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  onMounted(() => {
    if (prefersReducedMotion) { display.value = target; return }
    function run () {
      const start = performance.now()
      function tick (now: number) {
        const elapsed = Math.min((now - start) / durationMs, 1)
        const eased = 1 - (1 - elapsed) ** 3
        display.value = Math.round(target * eased)
        if (elapsed < 1) { requestAnimationFrame(tick) }
      }
      requestAnimationFrame(tick)
    }
    startDelayMs > 0 ? setTimeout(run, startDelayMs) : run()
  })

  return display
}
