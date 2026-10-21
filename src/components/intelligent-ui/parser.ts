/**
 * Streaming-resilient parser for OpenUI Lang 1.0 and Intelligent UI specs.
 *
 * Handles:
 * - Line-oriented statements: identifier = Component(args...)
 * - State variables: $variable = value
 * - References: pointing to other identifiers
 * - Nested inline components: Col([Title("Title"), Map(...)])
 * - Primitive arrays and objects
 * - JSON and markdown block extraction
 */

import type {
  OpenUIPrimitive,
  OpenUIValue,
  OpenUIReference,
  OpenUIFunctionCall,
  OpenUINode,
  OpenUIProgram,
} from "./types"

// Token types for lexing
type TokenType =
  | "IDENT"
  | "STATE_VAR"
  | "FN_NAME"
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "NULL"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "LBRACE"
  | "RBRACE"
  | "EQUALS"
  | "COMMA"
  | "COLON"

interface Token {
  type: TokenType
  value: string
  raw?: OpenUIPrimitive
}

class Lexer {
  private src: string
  private pos = 0

  constructor(src: string) {
    this.src = src
  }

  tokenize(): Token[] {
    const tokens: Token[] = []
    while (this.pos < this.src.length) {
      this.skipWhitespace()
      if (this.pos >= this.src.length) break

      const ch = this.src[this.pos]

      if (ch === "(") {
        tokens.push({ type: "LPAREN", value: "(" })
        this.pos++
      } else if (ch === ")") {
        tokens.push({ type: "RPAREN", value: ")" })
        this.pos++
      } else if (ch === "[") {
        tokens.push({ type: "LBRACKET", value: "[" })
        this.pos++
      } else if (ch === "]") {
        tokens.push({ type: "RBRACKET", value: "]" })
        this.pos++
      } else if (ch === "{") {
        tokens.push({ type: "LBRACE", value: "{" })
        this.pos++
      } else if (ch === "}") {
        tokens.push({ type: "RBRACE", value: "}" })
        this.pos++
      } else if (ch === "=") {
        tokens.push({ type: "EQUALS", value: "=" })
        this.pos++
      } else if (ch === ",") {
        tokens.push({ type: "COMMA", value: "," })
        this.pos++
      } else if (ch === ":") {
        tokens.push({ type: "COLON", value: ":" })
        this.pos++
      } else if (ch === '"' || ch === "'") {
        tokens.push(this.readString(ch))
      } else if (ch === "$") {
        tokens.push(this.readStateVar())
      } else if (ch === "@") {
        tokens.push(this.readFnName())
      } else if (this.isDigit(ch) || (ch === "-" && this.isDigit(this.peekNext()))) {
        tokens.push(this.readNumber())
      } else if (this.isAlpha(ch) || ch === "_") {
        tokens.push(this.readIdent())
      } else {
        // Skip unknown token safely
        this.pos++
      }
    }
    return tokens
  }

  private skipWhitespace() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) {
      this.pos++
    }
  }

  private isDigit(ch: string | undefined): boolean {
    return ch !== undefined && ch >= "0" && ch <= "9"
  }

  private isAlpha(ch: string | undefined): boolean {
    if (!ch) return false
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")
  }

  private isAlphaNum(ch: string | undefined): boolean {
    return this.isAlpha(ch) || this.isDigit(ch) || ch === "_"
  }

  private peekNext(): string | undefined {
    return this.src[this.pos + 1]
  }

  private readString(quote: string): Token {
    this.pos++ // skip open quote
    let str = ""
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]
      if (ch === "\\") {
        this.pos++
        if (this.pos < this.src.length) {
          const next = this.src[this.pos]
          if (next === "n") str += "\n"
          else if (next === "t") str += "\t"
          else if (next === "r") str += "\r"
          else str += next
        }
      } else if (ch === quote) {
        this.pos++
        break
      } else {
        str += ch
      }
      this.pos++
    }
    return { type: "STRING", value: str, raw: str }
  }

  private readStateVar(): Token {
    const start = this.pos
    this.pos++ // skip $
    while (this.pos < this.src.length && this.isAlphaNum(this.src[this.pos])) {
      this.pos++
    }
    const val = this.src.slice(start, this.pos)
    return { type: "STATE_VAR", value: val }
  }

  private readFnName(): Token {
    const start = this.pos
    this.pos++ // skip @
    while (this.pos < this.src.length && this.isAlphaNum(this.src[this.pos])) {
      this.pos++
    }
    const val = this.src.slice(start, this.pos)
    return { type: "FN_NAME", value: val }
  }

  private readNumber(): Token {
    const start = this.pos
    if (this.src[this.pos] === "-") this.pos++
    while (this.pos < this.src.length && this.isDigit(this.src[this.pos])) {
      this.pos++
    }
    if (this.pos < this.src.length && this.src[this.pos] === "." && this.isDigit(this.peekNext())) {
      this.pos++
      while (this.pos < this.src.length && this.isDigit(this.src[this.pos])) {
        this.pos++
      }
    }
    const rawStr = this.src.slice(start, this.pos)
    const num = Number(rawStr)
    return { type: "NUMBER", value: rawStr, raw: num }
  }

  private readIdent(): Token {
    const start = this.pos
    while (this.pos < this.src.length && this.isAlphaNum(this.src[this.pos])) {
      this.pos++
    }
    const val = this.src.slice(start, this.pos)
    if (val === "true") return { type: "BOOLEAN", value: "true", raw: true }
    if (val === "false") return { type: "BOOLEAN", value: "false", raw: false }
    if (val === "null") return { type: "NULL", value: "null", raw: null }
    return { type: "IDENT", value: val }
  }
}

class ExpressionParser {
  private tokens: Token[]
  private index = 0
  public innerDeclarations = new Map<string, OpenUIValue>()
  public innerStateVars = new Map<string, OpenUIPrimitive>()

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): OpenUIValue {
    if (this.index >= this.tokens.length) return null
    return this.parseValue()
  }

  private peek(): Token | undefined {
    return this.tokens[this.index]
  }

  private consume(expected?: TokenType): Token | undefined {
    const tok = this.tokens[this.index]
    if (!tok) return undefined
    if (expected && tok.type !== expected) {
      return undefined
    }
    this.index++
    return tok
  }

  private parseValue(): OpenUIValue {
    const tok = this.peek()
    if (!tok) return null

    // Component or Function call or Identifier Reference
    if (tok.type === "IDENT") {
      const next = this.tokens[this.index + 1]
      if (next && (next.type === "LPAREN" || next.type === "LBRACE")) {
        return this.parseComponentOrCall()
      }
      this.consume("IDENT")
      return { type: "ref", name: tok.value } as OpenUIReference
    }

    if (tok.type === "STATE_VAR") {
      this.consume("STATE_VAR")
      return { type: "ref", name: tok.value } as OpenUIReference
    }

    if (tok.type === "FN_NAME") {
      return this.parseFunctionCall()
    }

    if (tok.type === "STRING") {
      this.consume("STRING")
      return tok.raw ?? tok.value
    }

    if (tok.type === "NUMBER") {
      this.consume("NUMBER")
      return typeof tok.raw === "number" ? tok.raw : Number(tok.value)
    }

    if (tok.type === "BOOLEAN") {
      this.consume("BOOLEAN")
      return tok.raw === true
    }

    if (tok.type === "NULL") {
      this.consume("NULL")
      return null
    }

    if (tok.type === "LBRACKET") {
      return this.parseArray()
    }

    if (tok.type === "LBRACE") {
      return this.parseObject()
    }

    // Default fallback
    this.index++
    return null
  }

  private parseComponentOrCall(): OpenUINode {
    const identTok = this.consume("IDENT")
    const compName = identTok ? identTok.value : "Box"

    const args: OpenUIValue[] = []
    const props: Record<string, OpenUIValue> = {}

    // 1. If LPAREN is present, parse argument list: (arg1, arg2, key=val, ...)
    if (this.peek()?.type === "LPAREN") {
      this.consume("LPAREN")

      while (this.index < this.tokens.length && this.peek()?.type !== "RPAREN") {
        // Check for named prop: key = value
        const cur = this.peek()
        const next = this.tokens[this.index + 1]
        if (cur?.type === "IDENT" && next?.type === "EQUALS") {
          this.consume("IDENT")
          this.consume("EQUALS")
          const val = this.parseValue()
          props[cur.value] = val
        } else {
          const val = this.parseValue()
          args.push(val)
        }

        if (this.peek()?.type === "COMMA") {
          this.consume("COMMA")
        } else {
          break
        }
      }

      this.consume("RPAREN")
    }

    // 2. If LBRACE is present, parse curly brace block syntax: { child1 = Comp() child2 = Comp() ... }
    if (this.peek()?.type === "LBRACE") {
      this.consume("LBRACE")
      const blockChildren: OpenUIValue[] = []

      while (this.index < this.tokens.length && this.peek()?.type !== "RBRACE") {
        const cur = this.peek()
        const next = this.tokens[this.index + 1]

        if ((cur?.type === "IDENT" || cur?.type === "STATE_VAR") && next?.type === "EQUALS") {
          const varName = cur.value
          this.consume() // IDENT or STATE_VAR
          this.consume("EQUALS")
          const val = this.parseValue()

          if (varName.startsWith("$")) {
            const primitiveVal: OpenUIPrimitive =
              typeof val === "string" || typeof val === "number" || typeof val === "boolean"
                ? val
                : null
            this.innerStateVars.set(varName, primitiveVal)
          } else {
            this.innerDeclarations.set(varName, val)
            blockChildren.push(val)
          }
        } else {
          const val = this.parseValue()
          if (val !== null && val !== undefined) {
            blockChildren.push(val)
          }
        }

        if (this.peek()?.type === "COMMA") {
          this.consume("COMMA")
        }
      }

      this.consume("RBRACE")

      if (blockChildren.length > 0) {
        if (props.children === undefined) {
          props.children = blockChildren
        } else if (Array.isArray(props.children)) {
          props.children.push(...blockChildren)
        }
      }
    }

    return {
      type: "component",
      component: compName,
      args,
      props: Object.keys(props).length > 0 ? props : undefined,
    }
  }

  private parseFunctionCall(): OpenUIFunctionCall {
    const fnTok = this.consume("FN_NAME")
    const fnName = fnTok ? fnTok.value : "@Unknown"
    this.consume("LPAREN")

    const args: OpenUIValue[] = []
    while (this.index < this.tokens.length && this.peek()?.type !== "RPAREN") {
      args.push(this.parseValue())
      if (this.peek()?.type === "COMMA") {
        this.consume("COMMA")
      } else {
        break
      }
    }
    this.consume("RPAREN")
    return {
      type: "fn",
      name: fnName,
      args,
    }
  }

  private parseArray(): OpenUIValue[] {
    this.consume("LBRACKET")
    const arr: OpenUIValue[] = []

    while (this.index < this.tokens.length && this.peek()?.type !== "RBRACKET") {
      arr.push(this.parseValue())
      if (this.peek()?.type === "COMMA") {
        this.consume("COMMA")
      } else {
        break
      }
    }

    this.consume("RBRACKET")
    return arr
  }

  private parseObject(): Record<string, OpenUIValue> {
    this.consume("LBRACE")
    const obj: Record<string, OpenUIValue> = {}

    while (this.index < this.tokens.length && this.peek()?.type !== "RBRACE") {
      const keyTok = this.peek()
      let key = ""
      if (keyTok?.type === "IDENT" || keyTok?.type === "STRING") {
        this.consume()
        key = keyTok.value
      } else {
        break
      }

      if (this.peek()?.type === "COLON" || this.peek()?.type === "EQUALS") {
        this.consume()
      }

      const val = this.parseValue()
      obj[key] = val

      if (this.peek()?.type === "COMMA") {
        this.consume("COMMA")
      } else {
        break
      }
    }

    this.consume("RBRACE")
    return obj
  }
}

/**
/**
 * Splits raw OpenUI Lang source into logical statements, correctly accumulating
 * multiline expressions, arrays, and objects until delimiters are balanced.
 */
function splitIntoStatements(source: string): string[] {
  const statements: string[] = []
  let current = ""
  let depthParen = 0
  let depthBracket = 0
  let depthBrace = 0
  let inQuotes = false
  let quoteChar = ""

  const lines = source.split(/\r?\n/)
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex]
    const trimmed = rawLine.trim()

    // If we're at statement boundary and line is a comment or blank, skip
    if (!inQuotes && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) {
        continue
      }
    }

    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i]
      if (ch === '"' || ch === "'") {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = ch
        } else if (ch === quoteChar && rawLine[i - 1] !== "\\") {
          inQuotes = false
        }
      } else if (!inQuotes) {
        if (ch === "/" && rawLine[i + 1] === "/") {
          break
        }
        if (ch === "#") {
          break
        }
        if (ch === "(") depthParen++
        else if (ch === ")") depthParen--
        else if (ch === "[") depthBracket++
        else if (ch === "]") depthBracket--
        else if (ch === "{") depthBrace++
        else if (ch === "}") depthBrace--
      }
      current += ch
    }

    // Statement finishes when all brackets/parentheses/braces/quotes are balanced
    if (!inQuotes && depthParen <= 0 && depthBracket <= 0 && depthBrace <= 0) {
      const cleanStmt = current.trim()
      if (cleanStmt) {
        statements.push(cleanStmt)
      }
      current = ""
      depthParen = 0
      depthBracket = 0
      depthBrace = 0
    } else {
      current += "\n"
    }
  }

  const trailing = current.trim()
  if (trailing) {
    statements.push(trailing)
  }

  return statements
}

/**
 * Parses raw OpenUI Lang source code or JSON into an executable OpenUIProgram.
 */
export function parseOpenUILang(source: string): OpenUIProgram {
  const cleanSource = source.trim()
  const declarations = new Map<string, OpenUIValue>()
  const stateVariables = new Map<string, OpenUIPrimitive>()
  const errors: string[] = []
  let rootNode: OpenUINode | null = null

function normalizeJsonToOpenUI(obj: unknown): OpenUIValue {
  if (Array.isArray(obj)) {
    return obj.map(normalizeJsonToOpenUI)
  }
  if (obj && typeof obj === "object" && obj !== null) {
    const rec = obj as Record<string, unknown>
    if (rec.component || (rec.type && typeof rec.type === "string" && rec.type !== "ref" && rec.type !== "fn" && rec.type !== "component") || rec.root) {
      const compName = String(rec.component || rec.type || rec.root || "Card")
      const rawChildren = rec.children ?? rec.args
      const children = Array.isArray(rawChildren)
        ? (rawChildren.map(normalizeJsonToOpenUI) as OpenUIValue[])
        : []
      const props: Record<string, OpenUIValue> = {}
      for (const [k, v] of Object.entries(rec)) {
        if (k !== "component" && k !== "type" && k !== "root" && k !== "children" && k !== "args") {
          props[k] = normalizeJsonToOpenUI(v)
        }
      }
      return {
        type: "component",
        component: compName,
        args: children,
        props: Object.keys(props).length > 0 ? props : undefined,
      } as OpenUINode
    }
  }
  return obj as OpenUIValue
}

  // 1. Check if the block is JSON
  if (cleanSource.startsWith("{") && cleanSource.endsWith("}")) {
    try {
      const parsedJson: unknown = JSON.parse(cleanSource)
      if (typeof parsedJson === "object" && parsedJson !== null) {
        const record = parsedJson as Record<string, unknown>
        if (record.root || record.component || record.type) {
          const normalized = normalizeJsonToOpenUI(record)
          if (normalized && typeof normalized === "object" && "type" in normalized && normalized.type === "component") {
            rootNode = normalized as OpenUINode
            return {
              rootNode,
              declarations,
              stateVariables,
              errors,
              rawSource: cleanSource,
            }
          }
        }
      }
    } catch {
      // Continue to line-by-line parsing
    }
  }

  // 2. Multiline statement OpenUI Lang 1.0 parsing
  const statements = splitIntoStatements(cleanSource)

  for (let stmtIndex = 0; stmtIndex < statements.length; stmtIndex++) {
    const rawStmt = statements[stmtIndex].trim()
    if (!rawStmt || rawStmt.startsWith("//") || rawStmt.startsWith("#")) {
      continue
    }

    // Split on first '=' that isn't inside quotes or parentheses
    let splitPos = -1
    let depthParen = 0
    let depthBracket = 0
    let depthBrace = 0
    let inQuotes = false
    let quoteChar = ""

    for (let i = 0; i < rawStmt.length; i++) {
      const ch = rawStmt[i]
      if (ch === '"' || ch === "'") {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = ch
        } else if (ch === quoteChar && rawStmt[i - 1] !== "\\") {
          inQuotes = false
        }
      } else if (!inQuotes) {
        if (ch === "(") depthParen++
        else if (ch === ")") depthParen--
        else if (ch === "[") depthBracket++
        else if (ch === "]") depthBracket--
        else if (ch === "{") depthBrace++
        else if (ch === "}") depthBrace--
        else if (ch === "=" && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
          splitPos = i
          break
        }
      }
    }

    if (splitPos !== -1) {
      const lhs = rawStmt.slice(0, splitPos).trim()
      const rhs = rawStmt.slice(splitPos + 1).trim()

      try {
        const lexer = new Lexer(rhs)
        const tokens = lexer.tokenize()
        const parser = new ExpressionParser(tokens)
        const parsedValue = parser.parse()

        // Merge any declarations or state variables nested inside blocks
        for (const [k, v] of parser.innerDeclarations) {
          declarations.set(k, v)
        }
        for (const [k, v] of parser.innerStateVars) {
          stateVariables.set(k, v)
        }

        if (lhs.startsWith("$")) {
          // Reactive state variable
          const primitiveVal: OpenUIPrimitive =
            typeof parsedValue === "string" ||
            typeof parsedValue === "number" ||
            typeof parsedValue === "boolean"
              ? parsedValue
              : null
          stateVariables.set(lhs, primitiveVal)
        } else {
          declarations.set(lhs, parsedValue)
        }
      } catch (err) {
        errors.push(`Statement ${stmtIndex + 1}: ${String(err)}`)
      }
    } else {
      // Statement without '=', e.g. standalone Component(...)
      try {
        const lexer = new Lexer(rawStmt)
        const tokens = lexer.tokenize()
        const parser = new ExpressionParser(tokens)
        const parsedValue = parser.parse()

        for (const [k, v] of parser.innerDeclarations) {
          declarations.set(k, v)
        }
        for (const [k, v] of parser.innerStateVars) {
          stateVariables.set(k, v)
        }

        if (parsedValue && typeof parsedValue === "object" && "type" in parsedValue && parsedValue.type === "component") {
          if (!rootNode) {
            rootNode = parsedValue as OpenUINode
          }
        }
      } catch (err) {
        // Dropped line due to syntax / partial stream
      }
    }
  }

  // 3. Resolve Root Component
  // Dereference helper to resolve reference chains without cyclical loops
  const dereferenceComponent = (val: OpenUIValue | undefined, visited = new Set<string>()): OpenUINode | null => {
    if (!val || typeof val !== "object") return null
    if ("type" in val) {
      if (val.type === "component") {
        return val as OpenUINode
      }
      if (val.type === "ref") {
        const refName = (val as OpenUIReference).name
        if (visited.has(refName)) return null
        visited.add(refName)
        const target = declarations.get(refName)
        return dereferenceComponent(target, visited)
      }
    }
    return null
  }

  // A. Check if explicit 'root' declaration exists and dereference it
  if (declarations.has("root")) {
    const resolved = dereferenceComponent(declarations.get("root"))
    if (resolved) {
      rootNode = resolved
    }
  }

  // B. Infer DAG root if root was omitted or did not resolve
  if (!rootNode && declarations.size > 0) {
    const referencedNames = new Set<string>()

    const scanRefs = (val: OpenUIValue, visited = new Set<unknown>()) => {
      if (!val || typeof val !== "object" || visited.has(val)) return
      visited.add(val)

      if ("type" in val && val.type === "ref") {
        referencedNames.add((val as OpenUIReference).name)
      } else if ("type" in val && val.type === "component") {
        const node = val as OpenUINode
        node.args?.forEach((a) => scanRefs(a, visited))
        if (node.props) {
          Object.values(node.props).forEach((p) => scanRefs(p, visited))
        }
      } else if ("type" in val && val.type === "fn") {
        (val as OpenUIFunctionCall).args?.forEach((a) => scanRefs(a, visited))
      } else if (Array.isArray(val)) {
        val.forEach((item) => scanRefs(item, visited))
      } else {
        Object.values(val).forEach((v) => scanRefs(v, visited))
      }
    }

    for (const [, val] of declarations) {
      scanRefs(val)
    }

    // Candidates are declared components NOT referenced by other components
    const candidates: OpenUINode[] = []
    for (const [name, val] of declarations) {
      if (name !== "root" && !referencedNames.has(name)) {
        const comp = dereferenceComponent(val)
        if (comp) {
          candidates.push(comp)
        }
      }
    }

    if (candidates.length > 0) {
      // Prioritize layout containers
      const containerCandidates = candidates.filter((c) =>
        /^(col|row|grid|card|box|carousel|stack)$/i.test(c.component)
      )
      rootNode = containerCandidates[containerCandidates.length - 1] || candidates[candidates.length - 1]
    } else {
      // Fallback: pick any component in declarations
      for (const [, val] of declarations) {
        const comp = dereferenceComponent(val)
        if (comp) {
          rootNode = comp
          break
        }
      }
    }
  }

  return {
    rootNode,
    declarations,
    stateVariables,
    errors,
    rawSource: cleanSource,
  }
}

/**
 * Checks whether text content represents OpenUI Lang or Intelligent UI code.
 */
export function isOpenUICode(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^\s*root\s*=/m.test(trimmed)) return true
  if (/^\$[a-zA-Z0-9_]+\s*=/m.test(trimmed)) return true
  if (/^[a-zA-Z0-9_]+\s*=\s*[A-Z][a-zA-Z0-9_]*\s*[\(\{]/m.test(trimmed)) return true
  if (
    /^\s*(?:Col|Row|Card|Grid|Box|Title|Text|Metric|Table|Map|MapView|Chart|List|ListItem|Flashcard|Carousel|Slider|Button|Badge|SegmentedControl|Tabs|Checkbox|Timer|Divider|Spacer)\s*[\(\{]/m.test(
      trimmed
    )
  ) {
    return true
  }
  if (
    trimmed.startsWith("{") &&
    (trimmed.includes('"root"') || trimmed.includes('"component"') || trimmed.includes('"type"'))
  ) {
    return true
  }
  return false
}

/**
 * Extracts OpenUI Lang code from markdown text or returns the text if it's already OpenUI.
 */
export function extractOpenUIFromMarkdown(text: string): {
  isMatch: boolean
  code: string
  proseBefore: string
  proseAfter: string
} {
  const trimmed = text.trim()

  // 1. First, search for explicit openui/intelligent-ui/generative-ui/ui code fences
  const taggedRegex = /```(?:openui|open-ui|intelligent-ui|intelligentui|generative-ui|ui)\s*\r?\n([\s\S]*?)```/gi
  let taggedMatch: RegExpExecArray | null = null
  while ((taggedMatch = taggedRegex.exec(trimmed)) !== null) {
    const code = taggedMatch[1].trim()
    const matchIdx = taggedMatch.index
    const proseBefore = trimmed.slice(0, matchIdx).trim()
    const proseAfter = trimmed.slice(matchIdx + taggedMatch[0].length).trim()
    return { isMatch: true, code, proseBefore, proseAfter }
  }

  // 2. Next, search any code fence whose interior code passes isOpenUICode
  const genericFenceRegex = /```[a-zA-Z0-9_-]*\s*\r?\n([\s\S]*?)```/gi
  let genericMatch: RegExpExecArray | null = null
  while ((genericMatch = genericFenceRegex.exec(trimmed)) !== null) {
    const code = genericMatch[1].trim()
    if (isOpenUICode(code)) {
      const matchIdx = genericMatch.index
      const proseBefore = trimmed.slice(0, matchIdx).trim()
      const proseAfter = trimmed.slice(matchIdx + genericMatch[0].length).trim()
      return { isMatch: true, code, proseBefore, proseAfter }
    }
  }

  // 3. Check if raw text starts with root = or has openui statements
  if (isOpenUICode(trimmed)) {
    // If there is prose before the first OpenUI statement line, partition it
    const lines = trimmed.split("\n")
    const openUILineRegex = /^\s*(?:root\s*=|(?:\$[a-zA-Z0-9_]+\s*=)|(?:[a-zA-Z0-9_]+\s*=\s*[A-Z][a-zA-Z0-9_]*\s*[\(\{])|(?:(?:Col|Row|Card|Grid|Box|Title|Text|Metric|Table|Map|MapView|Chart|List|ListItem|Flashcard|Carousel|Slider|Button|Badge|SegmentedControl|Tabs|Checkbox|Timer|Divider|Spacer)\s*[\(\{]))/
    const firstOpenUIIdx = lines.findIndex((l) => openUILineRegex.test(l))

    if (firstOpenUIIdx >= 0) {
      const proseBefore = firstOpenUIIdx > 0 ? lines.slice(0, firstOpenUIIdx).join("\n").trim() : ""

      // Scan from firstOpenUIIdx to locate where OpenUI code ends
      let lastOpenUILineIdx = lines.length - 1
      let depthParen = 0
      let depthBracket = 0
      let depthBrace = 0
      let inQuotes = false
      let quoteChar = ""

      for (let i = firstOpenUIIdx; i < lines.length; i++) {
        const line = lines[i]
        const trimmedLine = line.trim()

        const isAtZeroDepth = depthParen === 0 && depthBracket === 0 && depthBrace === 0 && !inQuotes
        if (i > firstOpenUIIdx && isAtZeroDepth && trimmedLine.length > 0) {
          if (!openUILineRegex.test(line) && !trimmedLine.startsWith("//") && !trimmedLine.startsWith("#")) {
            // Found trailing prose after the OpenUI code block
            lastOpenUILineIdx = i - 1
            break
          }
        }

        for (let j = 0; j < line.length; j++) {
          const ch = line[j]
          if (ch === '"' || ch === "'") {
            if (!inQuotes) {
              inQuotes = true
              quoteChar = ch
            } else if (ch === quoteChar && line[j - 1] !== "\\") {
              inQuotes = false
            }
          } else if (!inQuotes) {
            if (ch === "(") depthParen++
            else if (ch === ")") depthParen = Math.max(0, depthParen - 1)
            else if (ch === "[") depthBracket++
            else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1)
            else if (ch === "{") depthBrace++
            else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1)
          }
        }
      }

      const code = lines.slice(firstOpenUIIdx, lastOpenUILineIdx + 1).join("\n").trim()
      const proseAfter = lastOpenUILineIdx < lines.length - 1 ? lines.slice(lastOpenUILineIdx + 1).join("\n").trim() : ""
      return { isMatch: true, code, proseBefore, proseAfter }
    }

    return { isMatch: true, code: trimmed, proseBefore: "", proseAfter: "" }
  }

  return { isMatch: false, code: "", proseBefore: trimmed, proseAfter: "" }
}
