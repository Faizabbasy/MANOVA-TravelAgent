export type ID = string

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'purple'

export interface StatusOption<Value extends string = string> {
  value: Value
  label: string
  tone: BadgeTone
  order: number
}

export interface AttentionItem {
  id: ID
  severity: 'low' | 'medium' | 'high'
  message: string
  projectId?: ID
  relatedRoute?: string
}

/** Titik koordinat referensi — dipakai untuk peta destinasi (`app/data/geo.ts`) dan field lokasi terstruktur seperti `Opportunity.destinationGeo`/`Project.destinationGeo`. */
export interface GeoPoint {
  destinationId?: ID
  name: string
  country: string
  lat: number
  lng: number
  /** Bandara utama terdekat — membantu tim operasional menaksir rute. */
  airportCode?: string
}
