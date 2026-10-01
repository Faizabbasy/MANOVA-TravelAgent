import { ref, onMounted, watch } from 'vue'

/**
 * Count-up dari 0 ke nilai akhir saat komponen pertama kali mount, DAN ikut menghitung ulang (dari nilai
 * yang sedang tampil ke nilai baru) setiap kali `target()` berubah — dipakai supaya widget finansial tetap
 * "hidup" saat filter periode Dashboard (Bulan Ini/Tahun Ini/dst) diganti, bukan cuma animasi one-shot saat
 * halaman pertama dibuka (perilaku lama, sebelum ada filter yang bisa mengubah nilai tanpa remount —
 * lihat [[dashboard-period-filter]]). `target` berupa getter (bukan angka polos) supaya `watch` membaca
 * nilai LIVE dari sumbernya (mis. `props.metrics[index]?.valueIdr`), bukan snapshot beku saat komponen mount.
 * Dilewati (langsung tampil final, tanpa animasi) jika pengguna minta motion dikurangi.
 * Dipakai `DashboardHeroPanel`, `DashboardCashFlowSection`, dan `DashboardKpiHero`.
 */
export function useCountUp (target: () => number, startDelayMs = 0, durationMs = 1100) {
  const display = ref(0)
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function animateTo (nextTarget: number, fromValue: number, delayMs = 0) {
    if (prefersReducedMotion) { display.value = nextTarget; return }
    function run () {
      const start = performance.now()
      function tick (now: number) {
        const elapsed = Math.min((now - start) / durationMs, 1)
        const eased = 1 - (1 - elapsed) ** 3
        display.value = Math.round(fromValue + (nextTarget - fromValue) * eased)
        if (elapsed < 1) { requestAnimationFrame(tick) }
      }
      requestAnimationFrame(tick)
    }
    delayMs > 0 ? setTimeout(run, delayMs) : run()
  }

  onMounted(() => animateTo(target(), 0, startDelayMs))
  /** Perubahan berikutnya (mis. ganti filter) dihitung ulang TANPA delay awal — delay cuma dipakai sekali
   * untuk efek "muncul bergantian" saat mount. */
  watch(target, (nextTarget, previousTarget) => animateTo(nextTarget, previousTarget ?? display.value))

  return display
}
