export interface SparklineGeometry {
  line: string
  area: string
  last: { x: number; y: number }
}

/**
 * Path SVG minimalis untuk sparkline inline (dipakai `DashboardHeroPanel`, `MonthlyCashFlowChart`, dan
 * `StatsCard`) — bukan chart interaktif, hanya penguat konteks tren di samping angka utama.
 *
 * Kurva dilewatkan lewat Catmull-Rom → Bezier (bukan garis lurus antar titik) supaya tren kelihatan sebagai
 * lengkungan naik-turun yang halus, bukan garis patah-patah — titik datanya sendiri TETAP sama persis
 * (bukan smoothing yang mengubah nilai), cuma cara menghubungkannya secara visual.
 */
function toSmoothPath (points: { x: number; y: number }[]): string {
  if (points.length < 3) {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  }
  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return path
}

/**
 * Deret angka dekoratif (BUKAN histori transaksi asli) untuk sparkline murni kosmetik — dipakai `StatsCard`
 * saat sparkline dimaksudkan sebagai aksen visual di samping pill persentase, bukan representasi tren data
 * sungguhan (beda dari sparkline `DashboardHeroPanel`/`MonthlyCashFlowChart` yang tetap dari data asli).
 * Deterministik per `seed` (hash string sederhana, bukan `Math.random()`) supaya bentuk gelombang konsisten
 * tiap render/reload, bukan berubah-ubah acak. `trend` cuma menentukan arah drift keseluruhan (naik/turun)
 * supaya visual konsisten dengan warna/arah panah yang sudah dihitung dari data asli di pemanggilnya.
 */
export function buildDecorativeSeries (seed: string, trend: 'up' | 'down' = 'up', length = 14): number[] {
  let hash = 0
  for (let i = 0; i < seed.length; i++) { hash = (hash * 31 + seed.charCodeAt(i)) >>> 0 }
  const next = () => {
    hash = (hash * 1103515245 + 12345) >>> 0
    return (hash % 1000) / 1000
  }
  const driftPerStep = (trend === 'up' ? 1 : -1) * (60 / length)
  return Array.from({ length }, (_, index) => 20 + index * driftPerStep + (next() - 0.5) * 26)
}

export function buildSparkline (values: number[], width = 100, height = 32, padY = 4): SparklineGeometry | null {
  if (values.length < 2) { return null }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values.map((value, index) => ({
    x: index * stepX,
    y: padY + (height - padY * 2) - ((value - min) / range) * (height - padY * 2)
  }))
  const line = toSmoothPath(points)
  const area = `${line} L${width},${height} L0,${height} Z`
  return { line, area, last: points[points.length - 1] }
}
