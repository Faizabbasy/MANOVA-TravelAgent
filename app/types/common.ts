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
