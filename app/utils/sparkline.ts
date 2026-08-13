export interface SparklineGeometry {
  line: string
  area: string
  last: { x: number; y: number }
}

/**
 * Path SVG minimalis untuk sparkline inline (dipakai `DashboardHeroPanel` dan `MonthlyCashFlowChart`) —
 * bukan chart interaktif, hanya penguat konteks tren di samping angka utama.
 */
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
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  return { line, area, last: points[points.length - 1] }
}
