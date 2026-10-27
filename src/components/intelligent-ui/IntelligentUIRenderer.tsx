/**
 * Intelligent UI Dynamic Engine & Renderer.
 * Evaluates OpenUI Lang 1.0 AST, maintains reactive component state,
 * and renders generative UI components adhering to FRIDAY Constitution.
 * Zero inline styles, zero any.
 */

import React, { useState, useMemo, useCallback } from "react"
import { Sparkles, Code2, Copy, Check, RotateCcw } from "lucide-react"
import { parseOpenUILang } from "./parser"
import type {
  OpenUIPrimitive,
  OpenUIValue,
  OpenUINode,
  OpenUIReference,
  OpenUIFunctionCall,
  MapMarkerItem,
} from "./types"

import {
  ColPrimitive,
  RowPrimitive,
  BoxPrimitive,
  GridPrimitive,
  CardPrimitive,
  CarouselPrimitive,
  DividerPrimitive,
  SpacerPrimitive,
} from "./primitives/Layout"

import {
  TitlePrimitive,
  TextPrimitive,
  BadgePrimitive,
  ListPrimitive,
  ListItemPrimitive,
} from "./primitives/Typography"

import {
  SliderPrimitive,
  ButtonPrimitive,
  SegmentedControlPrimitive,
  CheckboxPrimitive,
  TimerPrimitive,
} from "./primitives/Controls"

import {
  MapViewPrimitive,
  ChartPrimitive,
  MetricPrimitive,
} from "./primitives/DataVisuals"

import {
  SearchImagePrimitive,
  ImagePrimitive,
} from "./primitives/Media"

import {
  FlashcardPrimitive,
  CelebrationPrimitive,
  TablePrimitive,
} from "./primitives/InteractiveWidgets"

export interface IntelligentUIRendererProps {
  code: string
  className?: string
}

export const IntelligentUIRenderer: React.FC<IntelligentUIRendererProps> = ({
  code,
  className = "",
}) => {
  const [showRawCode, setShowRawCode] = useState(false)
  const [copied, setCopied] = useState(false)

  // Parse OpenUI program
  const program = useMemo(() => parseOpenUILang(code), [code])

  // Reactive state values for $variables
  // Reactive state values for $variables
  const [stateValues, setStateValues] = useState<Record<string, OpenUIPrimitive>>(() => {
    const init: Record<string, OpenUIPrimitive> = {}
    for (const [k, v] of program.stateVariables) {
      init[k] = v
    }
    return init
  })

  // Synchronize state variables when program or code changes
  React.useEffect(() => {
    const init: Record<string, OpenUIPrimitive> = {}
    for (const [k, v] of program.stateVariables) {
      init[k] = v
    }
    setStateValues(init)
  }, [code, program])

  // Update a single reactive state variable
  const updateState = useCallback((key: string, val: OpenUIPrimitive) => {
    setStateValues((prev) => ({ ...prev, [key]: val }))
  }, [])

  // Reset state to initial program state
  const resetState = useCallback(() => {
    const init: Record<string, OpenUIPrimitive> = {}
    for (const [k, v] of program.stateVariables) {
      init[k] = v
    }
    setStateValues(init)
  }, [program])

  // Copy code to clipboard
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [code])

  /**
   * Evaluates expressions, references, and built-in functions with cycle protection.
   */
  const evaluate = useCallback(
    (val: OpenUIValue, visitedRefs = new Set<string>()): OpenUIValue => {
      if (val === null || typeof val !== "object") {
        return val
      }

      if (Array.isArray(val)) {
        return val.map((item) => evaluate(item, new Set(visitedRefs)))
      }

      // Handle Reference
      if ("type" in val && val.type === "ref") {
        const ref = val as OpenUIReference
        if (ref.name.startsWith("$")) {
          return stateValues[ref.name] ?? null
        }
        if (visitedRefs.has(ref.name)) {
          return null
        }
        visitedRefs.add(ref.name)
        const declared = program.declarations.get(ref.name)
        if (declared !== undefined) {
          return evaluate(declared, visitedRefs)
        }
        return ref.name
      }

      // Handle Function Call
      if ("type" in val && val.type === "fn") {
        const fn = val as OpenUIFunctionCall
        const evalArgs = fn.args.map((a) => evaluate(a, visitedRefs))
        const fnName = fn.name.toLowerCase()

        // 1. @Payment(amount, rate, years) -> monthly loan amortization
        if (fnName === "@payment") {
          const amount = Number(evalArgs[0]) || 0
          const ratePercent = Number(evalArgs[1]) || 0
          const years = Number(evalArgs[2]) || 30
          if (amount <= 0 || ratePercent <= 0 || years <= 0) return 0
          const r = ratePercent / 100 / 12
          const n = years * 12
          const payment = (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
          return Math.round(payment)
        }

        // 2. @Sum(items)
        if (fnName === "@sum") {
          const list = Array.isArray(evalArgs[0]) ? (evalArgs[0] as OpenUIValue[]) : evalArgs
          const sum = list.reduce<number>((acc, cur) => acc + (Number(cur) || 0), 0)
          return sum
        }

        // 3. @Percent(val, total)
        if (fnName === "@percent") {
          const v = Number(evalArgs[0]) || 0
          const t = Number(evalArgs[1]) || 1
          return Math.round((v / t) * 100)
        }

        // 4. @Convert(val, fromUnit, toUnit)
        if (fnName === "@convert") {
          const num = Number(evalArgs[0]) || 0
          const from = String(evalArgs[1]).toLowerCase()
          const to = String(evalArgs[2]).toLowerCase()
          if (from === "km" && to === "mi") return Number((num * 0.621371).toFixed(1))
          if (from === "mi" && to === "km") return Number((num * 1.60934).toFixed(1))
          return num
        }

        // 5. Extended Math Helpers: @Multiply, @Divide, @Add, @Subtract, @Round, @Min, @Max
        if (fnName === "@multiply") {
          const a = Number(evalArgs[0]) || 0
          const b = Number(evalArgs[1]) || 0
          return a * b
        }
        if (fnName === "@divide") {
          const a = Number(evalArgs[0]) || 0
          const b = Number(evalArgs[1]) || 1
          return b !== 0 ? a / b : 0
        }
        if (fnName === "@add") {
          const a = Number(evalArgs[0]) || 0
          const b = Number(evalArgs[1]) || 0
          return a + b
        }
        if (fnName === "@subtract") {
          const a = Number(evalArgs[0]) || 0
          const b = Number(evalArgs[1]) || 0
          return a - b
        }
        if (fnName === "@round") {
          const num = Number(evalArgs[0]) || 0
          const decimals = Number(evalArgs[1]) || 0
          const factor = Math.pow(10, decimals)
          return Math.round(num * factor) / factor
        }
        if (fnName === "@min") {
          const a = Number(evalArgs[0]) || 0
          const b = Number(evalArgs[1]) || 0
          return Math.min(a, b)
        }
        if (fnName === "@max") {
          const a = Number(evalArgs[0]) || 0
          const b = Number(evalArgs[1]) || 0
          return Math.max(a, b)
        }
        if (fnName === "@formatnumber") {
          const num = Number(evalArgs[0]) || 0
          return num.toLocaleString()
        }
        if (fnName === "@currency") {
          const num = Number(evalArgs[0]) || 0
          const symbol = String(evalArgs[1] || "$")
          return `${symbol}${num.toLocaleString()}`
        }
        if (fnName === "@concat") {
          return evalArgs.map((a) => String(a ?? "")).join("")
        }

        // 6. @CopyToClipboard(text)
        if (fnName === "@copytoclipboard") {
          const text = String(evalArgs[0] || "")
          navigator.clipboard.writeText(text).catch(() => {})
          return true
        }

        return evalArgs[0] ?? null
      }

      return val
    },
    [stateValues, program.declarations]
  )

  /**
   * Helper to retrieve property from named props or positional args with fallback.
   */
  const getProp = useCallback(
    <T,>(
      node: OpenUINode,
      propNames: string[],
      argIndex: number,
      fallback: T
    ): T => {
      if (node.props) {
        for (const name of propNames) {
          if (node.props[name] !== undefined) {
            return evaluate(node.props[name]) as unknown as T
          }
        }
      }
      if (node.args && node.args.length > argIndex && node.args[argIndex] !== undefined) {
        return evaluate(node.args[argIndex]) as unknown as T
      }
      return fallback
    },
    [evaluate]
  )

  /**
   * Recursively renders OpenUI AST nodes to React elements with cycle and depth safeguards.
   */
  const renderNode = useCallback(
    (
      node: OpenUINode | OpenUIValue,
      indexKey: string,
      depth = 0,
      visited = new Set<unknown>()
    ): React.ReactNode => {
      if (node === null || node === undefined) return null

      // Safeguard against infinite depth or circular component trees
      if (depth > 20) {
        return null
      }
      if (typeof node === "object" && node !== null) {
        if (visited.has(node)) {
          return null
        }
        visited.add(node)
      }

      // Primitives
      if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") {
        return <span key={indexKey}>{String(node)}</span>
      }

      if (Array.isArray(node)) {
        return (
          <React.Fragment key={indexKey}>
            {node.map((item, i) => renderNode(item, `${indexKey}-${i}`, depth + 1, new Set(visited)))}
          </React.Fragment>
        )
      }

      // References
      if ("type" in node && node.type === "ref") {
        const evalVal = evaluate(node)
        return renderNode(evalVal, `${indexKey}-ref`, depth + 1, visited)
      }

      // Function calls
      if ("type" in node && node.type === "fn") {
        const evalVal = evaluate(node)
        return renderNode(evalVal, `${indexKey}-fn`, depth + 1, visited)
      }

      // Component nodes
      if ("type" in node && node.type === "component") {
        const compNode = node as OpenUINode
        const compName = compNode.component.toLowerCase()
        const rawArgs = compNode.args || []

        // Layout: Col
        if (compName === "col" || compName === "stack") {
          const rawChildren = compNode.props?.children !== undefined
            ? compNode.props.children
            : rawArgs.length === 1 && Array.isArray(rawArgs[0])
            ? rawArgs[0]
            : rawArgs.length === 1
            ? (Array.isArray(evaluate(rawArgs[0])) ? (evaluate(rawArgs[0]) as OpenUIValue[]) : [rawArgs[0]])
            : rawArgs
          const evaluatedChildren = evaluate(rawChildren)
          const childrenList = Array.isArray(evaluatedChildren) ? evaluatedChildren : [evaluatedChildren]

          return (
            <ColPrimitive key={indexKey}>
              {childrenList.map((c, i) => renderNode(c, `${indexKey}-col-${i}`, depth + 1, new Set(visited)))}
            </ColPrimitive>
          )
        }

        // Layout: Row
        if (compName === "row") {
          const rawChildren = compNode.props?.children !== undefined
            ? compNode.props.children
            : rawArgs.length === 1 && Array.isArray(rawArgs[0])
            ? rawArgs[0]
            : rawArgs.length === 1
            ? (Array.isArray(evaluate(rawArgs[0])) ? (evaluate(rawArgs[0]) as OpenUIValue[]) : [rawArgs[0]])
            : rawArgs
          const evaluatedChildren = evaluate(rawChildren)
          const childrenList = Array.isArray(evaluatedChildren) ? evaluatedChildren : [evaluatedChildren]

          return (
            <RowPrimitive key={indexKey}>
              {childrenList.map((c, i) => renderNode(c, `${indexKey}-row-${i}`, depth + 1, new Set(visited)))}
            </RowPrimitive>
          )
        }

        // Layout: Box
        if (compName === "box") {
          const rawChildren = compNode.props?.children !== undefined
            ? compNode.props.children
            : rawArgs.length === 1 && Array.isArray(rawArgs[0])
            ? rawArgs[0]
            : rawArgs.length === 1
            ? (Array.isArray(evaluate(rawArgs[0])) ? (evaluate(rawArgs[0]) as OpenUIValue[]) : [rawArgs[0]])
            : rawArgs
          const evaluatedChildren = evaluate(rawChildren)
          const childrenList = Array.isArray(evaluatedChildren) ? evaluatedChildren : [evaluatedChildren]

          return (
            <BoxPrimitive key={indexKey}>
              {childrenList.map((c, i) => renderNode(c, `${indexKey}-box-${i}`, depth + 1, new Set(visited)))}
            </BoxPrimitive>
          )
        }

        // Layout: Grid
        if (compName === "grid") {
          const cols = Number(getProp<number>(compNode, ["columns", "cols"], 999, 2)) || 2
          const nonColArgs = rawArgs.filter((a) => {
            const ev = evaluate(a)
            return typeof ev !== "number" || (typeof a === "object" && a !== null)
          })
          const rawChildren = compNode.props?.children !== undefined
            ? compNode.props.children
            : nonColArgs.length === 1 && Array.isArray(nonColArgs[0])
            ? nonColArgs[0]
            : nonColArgs.length === 1
            ? (Array.isArray(evaluate(nonColArgs[0])) ? (evaluate(nonColArgs[0]) as OpenUIValue[]) : [nonColArgs[0]])
            : nonColArgs
          const evaluatedChildren = evaluate(rawChildren)
          const childrenList = Array.isArray(evaluatedChildren) ? evaluatedChildren : [evaluatedChildren]

          return (
            <GridPrimitive key={indexKey} columns={cols}>
              {childrenList.map((c, i) => renderNode(c, `${indexKey}-grid-${i}`, depth + 1, new Set(visited)))}
            </GridPrimitive>
          )
        }

        // Layout: Card
        if (compName === "card") {
          const hasNamedTitle = compNode.props?.title !== undefined
          const hasNamedSubtitle = compNode.props?.subtitle !== undefined || compNode.props?.description !== undefined

          let title: string | undefined = hasNamedTitle ? getProp<string>(compNode, ["title"], 0, "") : undefined
          let subtitle: string | undefined = hasNamedSubtitle ? getProp<string>(compNode, ["subtitle", "description"], 1, "") : undefined

          let childItems: OpenUIValue[] = []

          if (compNode.props?.children !== undefined) {
            const ev = evaluate(compNode.props.children)
            childItems = Array.isArray(ev) ? ev : [ev]
          } else {
            let argOffset = 0
            if (!hasNamedTitle && rawArgs.length > 0 && typeof rawArgs[0] === "string") {
              title = rawArgs[0]
              argOffset = 1
              if (!hasNamedSubtitle && rawArgs.length > 1 && typeof rawArgs[1] === "string") {
                subtitle = rawArgs[1]
                argOffset = 2
              }
            }

            const remainingArgs = rawArgs.slice(argOffset)
            if (remainingArgs.length === 1) {
              const ev = evaluate(remainingArgs[0])
              childItems = Array.isArray(ev) ? ev : [ev]
            } else if (remainingArgs.length > 1) {
              childItems = remainingArgs.map((a) => evaluate(a))
            }
          }

          return (
            <CardPrimitive key={indexKey} title={title} subtitle={subtitle}>
              {childItems.map((c, i) => renderNode(c, `${indexKey}-card-${i}`, depth + 1, new Set(visited)))}
            </CardPrimitive>
          )
        }

        // Layout: Carousel
        if (compName === "carousel") {
          const rawItems = compNode.props?.children !== undefined
            ? compNode.props.children
            : compNode.props?.items !== undefined
            ? compNode.props.items
            : rawArgs.length === 1 && Array.isArray(rawArgs[0])
            ? rawArgs[0]
            : rawArgs.length === 1
            ? (Array.isArray(evaluate(rawArgs[0])) ? (evaluate(rawArgs[0]) as OpenUIValue[]) : [rawArgs[0]])
            : rawArgs
          const evaluatedItems = evaluate(rawItems)
          const itemsList = Array.isArray(evaluatedItems) ? evaluatedItems : [evaluatedItems]

          return (
            <CarouselPrimitive key={indexKey}>
              {itemsList.map((c, i) => (
                <div key={`${indexKey}-caro-${i}`} className="min-w-[240px] max-w-[280px] shrink-0 snap-start">
                  {renderNode(c, `${indexKey}-item-${i}`, depth + 1, new Set(visited))}
                </div>
              ))}
            </CarouselPrimitive>
          )
        }

        // Layout: Divider & Spacer
        if (compName === "divider") return <DividerPrimitive key={indexKey} />
        if (compName === "spacer") {
          const h = Number(getProp<number>(compNode, ["height", "h"], 0, 12)) || 12
          return <SpacerPrimitive key={indexKey} height={h} />
        }

        // Typography: Title
        if (compName === "title" || compName === "header") {
          const t = getProp<string>(compNode, ["title", "text", "heading"], 0, "")
          const sub = getProp<string | undefined>(compNode, ["subtitle", "sub"], 1, undefined)
          const badge = getProp<string | undefined>(compNode, ["badge", "tag"], 2, undefined)
          return <TitlePrimitive key={indexKey} title={t} subtitle={sub} badge={badge} />
        }

        // Typography: Text
        if (compName === "text" || compName === "p") {
          const content = getProp<unknown>(compNode, ["content", "text", "children"], 0, "")
          if (Array.isArray(content)) {
            return (
              <div key={indexKey} className="flex flex-wrap items-center gap-1.5 text-xs text-[hsl(var(--ink))]">
                {content.map((c, i) => renderNode(c, `${indexKey}-text-${i}`, depth + 1, new Set(visited)))}
              </div>
            )
          }
          return <TextPrimitive key={indexKey} content={String(content || "")} />
        }

        // Typography: Badge
        if (compName === "badge") {
          const text = getProp<string>(compNode, ["text", "label"], 0, "")
          const rawVariant = String(getProp<string>(compNode, ["variant"], 1, "neutral")).toLowerCase()
          const variant: "neutral" | "signal" | "amber" | "rose" | "blue" | "success" =
            rawVariant === "success"
              ? "success"
              : rawVariant === "signal" || rawVariant === "primary"
              ? "signal"
              : rawVariant === "warning" || rawVariant === "amber"
              ? "amber"
              : rawVariant === "danger" || rawVariant === "rose" || rawVariant === "error"
              ? "rose"
              : rawVariant === "info" || rawVariant === "blue"
              ? "blue"
              : "neutral"
          return <BadgePrimitive key={indexKey} text={text} variant={variant} />
        }

        // Typography: List & ListItem
        if (compName === "list") {
          const items = compNode.props?.children !== undefined
            ? evaluate(compNode.props.children)
            : compNode.props?.items !== undefined
            ? evaluate(compNode.props.items)
            : evaluate(rawArgs[0])
          const title = getProp<string | undefined>(compNode, ["title"], 1, undefined)
          return (
            <ListPrimitive key={indexKey} title={title}>
              {Array.isArray(items)
                ? items.map((c, i) => renderNode(c, `${indexKey}-list-${i}`, depth + 1, new Set(visited)))
                : renderNode(items, `${indexKey}-list`, depth + 1, visited)}
            </ListPrimitive>
          )
        }

        if (compName === "listitem") {
          const label = getProp<string>(compNode, ["label", "time", "step"], 0, "")
          const title = getProp<string>(compNode, ["title", "text"], 1, "")
          const desc = getProp<string | undefined>(compNode, ["description", "desc"], 2, undefined)
          const status = getProp<"done" | "active" | "upcoming">(compNode, ["status"], 3, "upcoming")
          const tag = getProp<string | undefined>(compNode, ["tag"], 4, undefined)
          return (
            <ListItemPrimitive
              key={indexKey}
              label={label}
              title={title}
              description={desc}
              status={status}
              tag={tag}
            />
          )
        }

        // Controls: Slider
        if (compName === "slider") {
          const stateVar = rawArgs[0] && typeof rawArgs[0] === "object" && "type" in rawArgs[0] && rawArgs[0].type === "ref"
            ? (rawArgs[0] as OpenUIReference).name
            : compNode.props?.value && typeof compNode.props.value === "object" && "type" in compNode.props.value && compNode.props.value.type === "ref"
            ? (compNode.props.value as OpenUIReference).name
            : undefined

          const label = getProp<string>(compNode, ["label", "name"], stateVar ? 4 : 0, stateVar ? stateVar.replace(/^\$/, "") : "Slider")
          const min = Number(getProp<number>(compNode, ["min"], stateVar ? 1 : 2, 0)) || 0
          const max = Number(getProp<number>(compNode, ["max"], stateVar ? 2 : 3, 100)) || 100
          const step = Number(getProp<number>(compNode, ["step"], 3, 1)) || 1
          const unit = getProp<string>(compNode, ["unit"], stateVar ? 5 : 4, "")
          const curVal = stateVar
            ? Number(stateValues[stateVar] ?? min)
            : Number(getProp<number>(compNode, ["value", "val"], 1, min) ?? min)

          return (
            <SliderPrimitive
              key={indexKey}
              label={label}
              value={curVal}
              min={min}
              max={max}
              step={step}
              unit={unit}
              onChange={(next) => {
                if (stateVar) {
                  updateState(stateVar, next)
                }
              }}
            />
          )
        }

        // Controls: Button
        if (compName === "button") {
          const label = getProp<string>(compNode, ["label", "title", "text"], 0, "Action")
          const action = getProp<unknown>(compNode, ["action", "onClick"], 1, undefined)
          const variant = getProp<"primary" | "secondary" | "danger" | "ghost">(compNode, ["variant"], 2, "primary")
          return (
            <ButtonPrimitive
              key={indexKey}
              label={label}
              variant={variant}
              onClick={() => {
                if (typeof action === "function") {
                  // Execute
                } else if (typeof action === "string" && action.startsWith("$")) {
                  updateState(action, true)
                }
              }}
            />
          )
        }

        // Controls: SegmentedControl
        if (compName === "segmentedcontrol" || compName === "tabs") {
          const stateVar = rawArgs[0] && typeof rawArgs[0] === "object" && "type" in rawArgs[0] && rawArgs[0].type === "ref"
            ? (rawArgs[0] as OpenUIReference).name
            : "$selectedTab"
          const rawOptions = getProp<unknown>(compNode, ["options", "tabs"], 1, ["Option 1", "Option 2"])
          const options = Array.isArray(rawOptions) ? (rawOptions as string[]) : ["Option 1", "Option 2"]
          const label = getProp<string | undefined>(compNode, ["label"], 2, undefined)
          const curVal = String(stateValues[stateVar] ?? options[0] ?? "")

          return (
            <SegmentedControlPrimitive
              key={indexKey}
              label={label}
              options={options}
              value={curVal}
              onChange={(next) => updateState(stateVar, next)}
            />
          )
        }

        // Controls: Checkbox
        if (compName === "checkbox") {
          const stateVar = rawArgs[0] && typeof rawArgs[0] === "object" && "type" in rawArgs[0] && rawArgs[0].type === "ref"
            ? (rawArgs[0] as OpenUIReference).name
            : "$checked"
          const label = getProp<string>(compNode, ["label", "text"], 1, "Check option")
          const curVal = Boolean(stateValues[stateVar] ?? false)

          return (
            <CheckboxPrimitive
              key={indexKey}
              label={label}
              checked={curVal}
              onChange={(next) => updateState(stateVar, next)}
            />
          )
        }

        // Controls: Timer
        if (compName === "timer") {
          const sec = Number(getProp<number>(compNode, ["seconds", "sec", "time"], 0, 60)) || 60
          const label = getProp<string | undefined>(compNode, ["label", "title"], 1, undefined)
          return <TimerPrimitive key={indexKey} seconds={sec} label={label} />
        }

        // Data Visual: Map / MapView
        if (compName === "map" || compName === "mapview") {
          const centerName = getProp<string>(compNode, ["centerName", "center", "title"], 0, "Map Route")
          const rawMarkers = getProp<unknown>(compNode, ["markers", "stops"], 1, [])
          const title = getProp<string | undefined>(compNode, ["title"], 2, undefined)
          const subtitle = getProp<string | undefined>(compNode, ["subtitle"], 3, undefined)

          const markersList: MapMarkerItem[] = []
          if (Array.isArray(rawMarkers)) {
            rawMarkers.forEach((m, i) => {
              if (m && typeof m === "object" && "type" in m && m.type === "component") {
                const mNode = m as OpenUINode
                const mArgs = mNode.args || []
                markersList.push({
                  id: `m-${i}`,
                  title: String(evaluate(mArgs[0]) || `Stop ${i + 1}`),
                  lat: Number(evaluate(mArgs[1])) || 37.77,
                  lng: Number(evaluate(mArgs[2])) || -122.42,
                  description: mArgs[3] ? String(evaluate(mArgs[3])) : undefined,
                  category: mArgs[4] ? String(evaluate(mArgs[4])) : undefined,
                })
              } else if (m && typeof m === "object") {
                const mRec = m as Record<string, unknown>
                markersList.push({
                  id: `m-${i}`,
                  title: String(mRec.title || `Stop ${i + 1}`),
                  lat: Number(mRec.lat) || 37.77,
                  lng: Number(mRec.lng) || -122.42,
                  description: mRec.description ? String(mRec.description) : undefined,
                  category: mRec.category ? String(mRec.category) : undefined,
                })
              }
            })
          }

          return (
            <MapViewPrimitive
              key={indexKey}
              centerName={centerName}
              markers={markersList}
              title={title}
              subtitle={subtitle}
            />
          )
        }

        // Data Visual: Chart
        if (compName === "chart") {
          const chartType = getProp<"bar" | "line" | "area" | "donut" | "pie">(compNode, ["type"], 0, "bar")
          const rawLabels = getProp<unknown>(compNode, ["labels"], 1, ["Q1", "Q2", "Q3", "Q4"])
          const rawValues = getProp<unknown>(compNode, ["values", "data"], 2, [10, 20, 30, 40])
          const title = getProp<string | undefined>(compNode, ["title"], 3, undefined)
          const unit = getProp<string>(compNode, ["unit"], 4, "")

          const labels = Array.isArray(rawLabels) ? rawLabels.map((l) => String(l)) : ["Q1", "Q2", "Q3", "Q4"]
          const values = Array.isArray(rawValues) ? rawValues.map((v) => Number(v) || 0) : [10, 20, 30, 40]

          return (
            <ChartPrimitive
              key={indexKey}
              type={chartType}
              labels={labels}
              values={values}
              title={title}
              unit={unit}
            />
          )
        }

        // Data Visual: Metric
        if (compName === "metric" || compName === "stat" || compName === "kpi") {
          const hasNamedUnit = compNode.props?.unit !== undefined || compNode.props?.suffix !== undefined
          const hasNamedChange = compNode.props?.change !== undefined || compNode.props?.delta !== undefined
          const hasNamedTrend = compNode.props?.trend !== undefined

          const label = getProp<string>(compNode, ["label", "title", "name"], 0, "Metric")
          const value = getProp<string | number>(compNode, ["value", "val", "stat"], 1, 0)

          let unit = hasNamedUnit ? getProp<string>(compNode, ["unit", "suffix"], 2, "") : ""
          let change = hasNamedChange ? getProp<string | undefined>(compNode, ["change", "delta"], 3, undefined) : undefined
          let trend: "up" | "down" | "neutral" = hasNamedTrend ? getProp<"up" | "down" | "neutral">(compNode, ["trend"], 4, "up") : "up"

          if (!hasNamedUnit && !hasNamedChange && !hasNamedTrend) {
            if (rawArgs.length >= 5) {
              unit = String(evaluate(rawArgs[2]) || "")
              change = String(evaluate(rawArgs[3]) || "")
              const t = String(evaluate(rawArgs[4]) || "up").toLowerCase()
              trend = t === "down" || t === "neutral" ? (t as "down" | "neutral") : "up"
            } else if (rawArgs.length === 4) {
              const arg3 = String(evaluate(rawArgs[3]) || "").toLowerCase()
              if (arg3 === "up" || arg3 === "down" || arg3 === "neutral") {
                change = String(evaluate(rawArgs[2]) || "")
                trend = arg3 as "up" | "down" | "neutral"
              } else {
                unit = String(evaluate(rawArgs[2]) || "")
                change = arg3
              }
            } else if (rawArgs.length === 3) {
              const arg2 = String(evaluate(rawArgs[2]) || "").toLowerCase()
              if (arg2 === "up" || arg2 === "down" || arg2 === "neutral") {
                trend = arg2 as "up" | "down" | "neutral"
              } else {
                unit = String(evaluate(rawArgs[2]) || "")
              }
            }
          }

          return (
            <MetricPrimitive
              key={indexKey}
              label={label}
              value={value ?? 0}
              unit={unit}
              change={change}
              trend={trend}
            />
          )
        }

        // Media: SearchImage & Image
        if (compName === "searchimage") {
          const query = getProp<string>(compNode, ["query", "q"], 0, "photography")
          const caption = getProp<string | undefined>(compNode, ["caption", "title"], 1, undefined)
          const source = getProp<string | undefined>(compNode, ["source"], 2, undefined)
          const url = getProp<string | undefined>(compNode, ["url", "src"], 3, undefined)
          return <SearchImagePrimitive key={indexKey} query={query} caption={caption} source={source} url={url} />
        }

        if (compName === "image") {
          const url = getProp<string>(compNode, ["url", "src"], 0, "")
          const caption = getProp<string | undefined>(compNode, ["caption"], 1, undefined)
          return <ImagePrimitive key={indexKey} url={url} caption={caption} />
        }

        // Interactive Widgets: Flashcard
        if (compName === "flashcard") {
          const q = getProp<string>(compNode, ["question", "q"], 0, "Question")
          const a = getProp<string>(compNode, ["answer", "a"], 1, "Answer")
          const cat = getProp<string | undefined>(compNode, ["category", "cat"], 2, undefined)
          return <FlashcardPrimitive key={indexKey} question={q} answer={a} category={cat} />
        }

        // Interactive Widgets: Celebration
        if (compName === "celebration") {
          const title = getProp<string>(compNode, ["title", "heading"], 0, "Great Job!")
          const msg = getProp<string | undefined>(compNode, ["message", "subtitle"], 1, undefined)
          return <CelebrationPrimitive key={indexKey} title={title} message={msg} />
        }

        // Interactive Widgets: Table
        if (compName === "table") {
          const rawHeaders = getProp<unknown>(compNode, ["headers", "columns"], 0, ["Column 1", "Column 2"])
          const rawRows = getProp<unknown>(compNode, ["rows", "data"], 1, [])
          const title = getProp<string | undefined>(compNode, ["title"], 2, undefined)

          const headers = Array.isArray(rawHeaders) ? rawHeaders.map((h) => String(h)) : ["Column 1", "Column 2"]
          const rows: Array<string | number>[] = []
          if (Array.isArray(rawRows)) {
            rawRows.forEach((r) => {
              if (Array.isArray(r)) {
                rows.push(r.map((c) => (typeof c === "number" ? c : String(c))))
              }
            })
          }

          // Support curly-brace block child rows e.g. Table() { row1 = Row() { c1 = Text(...) ... } }
          if (rows.length === 0 && compNode.props?.children !== undefined) {
            const childRows = evaluate(compNode.props.children)
            if (Array.isArray(childRows)) {
              for (const child of childRows) {
                if (child && typeof child === "object" && "type" in child && child.type === "component") {
                  const rowNode = child as OpenUINode
                  const rowCells: (string | number)[] = []
                  const cellItems = rowNode.props?.children !== undefined
                    ? evaluate(rowNode.props.children)
                    : rowNode.args
                  if (Array.isArray(cellItems)) {
                    for (const cell of cellItems) {
                      const evalCell = evaluate(cell)
                      if (evalCell !== null && typeof evalCell === "object" && "type" in evalCell && evalCell.type === "component") {
                        const cellNode = evalCell as OpenUINode
                        const val = cellNode.props?.text ?? cellNode.props?.label ?? cellNode.props?.content ?? cellNode.args?.[0] ?? ""
                        rowCells.push(String(val))
                      } else if (evalCell !== null && evalCell !== undefined) {
                        rowCells.push(typeof evalCell === "number" ? evalCell : String(evalCell))
                      }
                    }
                  }
                  if (rowCells.length > 0) {
                    rows.push(rowCells)
                  }
                }
              }
            }
          }

          return <TablePrimitive key={indexKey} headers={headers} rows={rows} title={title} />
        }

        // Fallback for generic container
        const children = compNode.props?.children !== undefined
          ? evaluate(compNode.props.children)
          : rawArgs[0]
          ? evaluate(rawArgs[0])
          : null

        return (
          <BoxPrimitive key={indexKey}>
            <div className="text-[11px] font-mono text-[hsl(var(--muted))] mb-1">
              Component: {compNode.component}
            </div>
            {Array.isArray(children)
              ? children.map((c, i) => renderNode(c, `${indexKey}-fallback-${i}`, depth + 1, new Set(visited)))
              : renderNode(children, `${indexKey}-fallback`, depth + 1, visited)}
          </BoxPrimitive>
        )
      }

      return null
    },
    [evaluate, getProp, stateValues, updateState]
  )

  return (
    <div className={`my-3.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden shadow-[0_20px_40px_-15px_rgba(0,0,0,0.6)] ${className}`}>
      {/* Intelligent UI Banner & Operator Chrome (One-Signal Law: Neutral chrome without decorative signal accent) */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/30 dark:bg-black/50 border-b border-black/10 dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center p-1 rounded-md bg-white/5 text-[hsl(var(--muted))] border border-white/10">
            <Sparkles className="size-3" />
          </div>
          <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-[hsl(var(--ink))]">
            INTELLIGENT UI
          </span>
          <span className="text-[hsl(var(--muted))] text-[10px]">·</span>
          <span className="font-mono text-[10px] text-[hsl(var(--muted))]">
            OpenUI 1.0 Generative Surface
          </span>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5">
          {program.stateVariables.size > 0 && (
            <button
              type="button"
              onClick={resetState}
              title="Reset state values"
              aria-label="Reset state values"
              className="px-2 py-1 rounded text-[10px] font-mono border border-black/10 dark:border-white/10 bg-black/20 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="size-2.5" />
              <span>Reset</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyCode}
            title="Copy OpenUI source code"
            aria-label="Copy OpenUI code"
            className="px-2 py-1 rounded text-[10px] font-mono border border-black/10 dark:border-white/10 bg-black/20 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))] cursor-pointer flex items-center gap-1"
          >
            {copied ? <Check className="size-2.5 text-[hsl(var(--success))]" /> : <Copy className="size-2.5" />}
            <span>{copied ? "Copied" : "Copy Code"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRawCode(!showRawCode)}
            title="Toggle OpenUI Lang source view"
            aria-label="Toggle raw source code"
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer flex items-center gap-1 ${
              showRawCode
                ? "bg-white/10 text-[hsl(var(--ink))] border-white/20"
                : "border-black/10 dark:border-white/10 bg-black/20 text-[hsl(var(--muted))] hover:text-[hsl(var(--ink))]"
            }`}
          >
            <Code2 className="size-2.5" />
            <span>{showRawCode ? "Hide Spec" : "View Spec"}</span>
          </button>
        </div>
      </div>

      {/* Raw OpenUI Lang Spec drawer if toggled */}
      {showRawCode && (
        <div className="p-3 bg-black/60 border-b border-white/[0.08] overflow-x-auto">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted))] mb-1.5">
            OpenUI Lang 1.0 Source Specification
          </div>
          <pre className="font-mono text-[11px] leading-relaxed text-[hsl(var(--ink))]/90 whitespace-pre">
            {code}
          </pre>
        </div>
      )}

      {/* Interactive Render Surface */}
      <div className="p-4 md:p-5">
        {program.rootNode ? (
          renderNode(program.rootNode, "ui-root")
        ) : (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 font-mono text-xs">
            OpenUI syntax parsing notice: {program.errors[0] || "No valid root component declared"}
          </div>
        )}
      </div>
    </div>
  )
}
