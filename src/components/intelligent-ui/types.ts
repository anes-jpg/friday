/**
 * Types and AST representation for OpenUI Lang and Intelligent UI.
 * Conforms to OpenUI 1.0 specification and FRIDAY Architecture Guidelines.
 * Strict zero 'any' policy.
 */

export type OpenUIPrimitive = string | number | boolean | null

export type OpenUIValue =
  | OpenUIPrimitive
  | OpenUIValue[]
  | { [key: string]: OpenUIValue }
  | OpenUIReference
  | OpenUINode
  | OpenUIFunctionCall

export interface OpenUIReference {
  type: "ref"
  name: string
}

export interface OpenUIFunctionCall {
  type: "fn"
  name: string
  args: OpenUIValue[]
}

export interface OpenUINode {
  type: "component"
  component: string
  args: OpenUIValue[]
  props?: Record<string, OpenUIValue>
}

export interface OpenUIProgram {
  rootNode: OpenUINode | null
  declarations: Map<string, OpenUIValue>
  stateVariables: Map<string, OpenUIPrimitive>
  errors: string[]
  rawSource: string
}

export type UIComponentMap = Record<
  string,
  React.FC<{
    node: OpenUINode
    scope: Record<string, OpenUIValue>
    state: Record<string, OpenUIPrimitive>
    updateState: (key: string, val: OpenUIPrimitive) => void
    evaluate: (val: OpenUIValue) => OpenUIValue
  }>
>

export interface MapMarkerItem {
  id: string
  title: string
  lat: number
  lng: number
  description?: string
  category?: string
  time?: string
  completed?: boolean
}

export interface ChartDataset {
  type: "bar" | "line" | "area" | "donut" | "pie"
  labels: string[]
  values: number[]
  title?: string
  unit?: string
  colors?: string[]
}
