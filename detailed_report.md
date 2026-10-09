# FRIDAY: Exhaustive File-by-File Technical Report

This document outlines *every single file* within the core source directories and details their internal structural elements (classes, functions, structs, interfaces).

## Directory: `core/`

### `core/main.py`
  - `async def process_utterance(...)`
  - `async def main(...)`

### `core/requirements.txt`
  - (Configuration or asset file)

### `core/stt_daemon.py`
  - `def main(...)`

### `core/whistle_stt.py`
  - `def record_and_transcribe(...)`

### `core/agent/crew_orchestrator.py`
  - `def create_research_crew(...)`
  - `def run_crew_orchestration(...)`

### `core/agent/graph.py`
  - `class AgentState`
  - `def thinking_node(...)`
  - `def jev_web_node(...)`
  - `def crew_ai_node(...)`
  - `def windows_desktop_node(...)`
  - `def verifying_node(...)`
  - `def route_condition(...)`

### `core/agent/pydantic_agent.py`
  - `class StructuredResult`
  - `def extract_structured_data(...)`

### `core/agent/temporal_worker.py`
  - `async def execute_heavy_refactor(...)`
  - `class AgentWorkflow`
    - `async def run(...)`
  - `async def start_worker(...)`

### `core/gateway/litellm_proxy.py`
  - `class LiteLLMGateway`
    - `def __init__(...)`
    - `def execute_turn(...)`

### `core/memory/graphiti_store.py`
  - `class GraphitiKnowledgeStore`
    - `def __init__(...)`
    - `async def ingest_conversation(...)`
    - `async def query_relations(...)`

### `core/memory/mem0_store.py`
  - `class Mem0Store`
    - `def __init__(...)`
    - `def store_fact(...)`
    - `def retrieve_context(...)`

### `core/observability/langfuse_tracer.py`
  - `class ObservabilityTracer`
    - `def __init__(...)`
    - `def start_trace(...)`
    - `def trace_node(...)`

### `core/observability/phoenix_tracer.py`
  - `def init_phoenix_tracing(...)`

### `core/observability/promptfoo_eval.yaml`
  - (Configuration or asset file)

### `core/tests/test_deepeval.py`
  - `def test_friday_response_relevancy(...)`

### `core/tests/test_graph.py`
  - `def test_basic_graph_execution(...)`
  - `def test_web_routing(...)`

### `core/tests/test_mcp_bridge.py`
  - `async def test_mcp_process_utterance(...)`

### `core/tools/ast_grep_search.py`
  - `class ASTGrepTool`
    - `def __init__(...)`
    - `def find_pattern(...)`

### `core/tools/browser_agent.py`
  - `class BrowserTool`
    - `def __init__(...)`
    - `def search_and_extract(...)`

### `core/tools/jev_browser.py`
  - `class JevUltrafastBrowser`
    - `def __init__(...)`
    - `def run_task(...)`

### `core/tools/kokoro_tts.py`
  - `class KokoroTTS`
    - `def __init__(...)`
    - `def synthesize(...)`

### `core/tools/sandbox_e2b.py`
  - `class CodeSandbox`
    - `def __init__(...)`
    - `def execute_python(...)`

### `core/tools/stagehand_scraper.py`
  - `async def extract_web_data(...)`

### `core/tools/treesitter_parser.py`
  - `def extract_functions_and_classes(...)`

### `core/tools/windows_automation.py`
  - `class WindowsAutomator`
    - `def __init__(...)`
    - `def list_windows(...)`
    - `def focus_and_type(...)`
    - `def capture_and_ocr(...)`

## Directory: `src/`

### `src/App.tsx`
  - `const getTauriWindowLabel` (Arrow Function Component)
  - `const internals` (Arrow Function Component)
  - `const handleVoiceToggleShortcut` (Arrow Function Component)
  - `const handleOpenConsole` (Arrow Function Component)
  - `const handleKeyDown` (Arrow Function Component)
  - `const handleKeyUp` (Arrow Function Component)
  - `const handleContextMenu` (Arrow Function Component)

### `src/main.tsx`
  - (No functions or interfaces found)

### `src/vite-env.d.ts`
  - (No functions or interfaces found)

### `src/assets/images/sky-pixel.jpg`
  - (Configuration or asset file)

### `src/components/coss/InputWithKbd.tsx`
  - `interface CossInputProps`

### `src/components/layout/PillSidebar.tsx`
  - `interface PillSidebarProps`

### `src/components/magic/animated-circular-progress-bar.tsx`
  - `interface AnimatedCircularProgressBarProps`
  - `function AnimatedCircularProgressBar(...)`

### `src/components/magic/animated-list.tsx`
  - `type ComponentPropsWithoutRef`
  - `function AnimatedListItem(...)`
  - `interface AnimatedListProps`

### `src/components/magic/animated-shiny-text.tsx`
  - `type ComponentPropsWithoutRef`
  - `type CSSProperties`
  - `type FC`
  - `interface AnimatedShinyTextProps`

### `src/components/magic/aurora-text.tsx`
  - `interface AuroraTextProps`

### `src/components/magic/blur-fade.tsx`
  - `type MotionProps`
  - `type UseInViewOptions`
  - `type Variants`
  - `type MarginType`
  - `interface BlurFadeProps`
  - `const getFilter` (Arrow Function Component)
  - `function BlurFade(...)`

### `src/components/magic/border-beam.tsx`
  - `interface BorderBeamProps`
  - `const BorderBeam` (Arrow Function Component)

### `src/components/magic/dot-pattern.tsx`
  - `interface DotPatternProps`
  - `function DotPattern(...)`
  - `const updateDimensions` (Arrow Function Component)

### `src/components/magic/flickering-grid.tsx`
  - `interface FlickeringGridProps`
  - `const toRGBA` (Arrow Function Component)
  - `const updateCanvasSize` (Arrow Function Component)
  - `const animate` (Arrow Function Component)
  - `const deltaTime` (Arrow Function Component)

### `src/components/magic/grid-pattern.tsx`
  - `interface GridPatternProps`
  - `function GridPattern(...)`

### `src/components/magic/hyper-text.tsx`
  - `type ComponentType`
  - `type RefAttributes`
  - `type DOMMotionComponents`
  - `type HTMLMotionProps`
  - `type MotionProps`
  - `type CharacterSet`
  - `type MotionElementType`
  - `type HyperTextMotionComponent`
  - `interface HyperTextProps`
  - `const getRandomInt` (Arrow Function Component)
  - `function HyperText(...)`
  - `const handleAnimationTrigger` (Arrow Function Component)
  - `const animate` (Arrow Function Component)

### `src/components/magic/interactive-hover-button.tsx`
  - `function InteractiveHoverButton(...)`

### `src/components/magic/line-shadow-text.tsx`
  - `type DOMMotionComponents`
  - `type MotionProps`
  - `type MotionElementType`
  - `interface LineShadowTextProps`
  - `function LineShadowText(...)`

### `src/components/magic/magic-card.tsx`
  - `interface MagicCardBaseProps`
  - `interface MagicCardGradientProps`
  - `interface MagicCardOrbProps`
  - `type MagicCardProps`
  - `type ResetReason`
  - `function isOrbMode(...)`
  - `function MagicCard(...)`
  - `const handleGlobalPointerOut` (Arrow Function Component)
  - `const handleBlur` (Arrow Function Component)
  - `const handleVisibility` (Arrow Function Component)

### `src/components/magic/marquee.tsx`
  - `interface MarqueeProps`
  - `function Marquee(...)`

### `src/components/magic/meteors.tsx`
  - `interface MeteorsProps`
  - `const Meteors` (Arrow Function Component)

### `src/components/magic/noise-texture.tsx`
  - `interface NoiseTextureProps`
  - `const NoiseTexture` (Arrow Function Component)

### `src/components/magic/number-ticker.tsx`
  - `interface NumberTickerProps`
  - `function NumberTicker(...)`

### `src/components/magic/orbiting-circles.tsx`
  - `interface OrbitingCirclesProps`
  - `function OrbitingCircles(...)`
  - `const angle` (Arrow Function Component)

### `src/components/magic/particles.tsx`
  - `type ComponentPropsWithoutRef`
  - `interface MousePosition`
  - `function MousePosition(...)`
  - `const handleMouseMove` (Arrow Function Component)
  - `interface ParticlesProps`
  - `function hexToRgb(...)`
  - `const red` (Arrow Function Component)
  - `const green` (Arrow Function Component)
  - `type Circle`
  - `const handleResize` (Arrow Function Component)
  - `const initCanvas` (Arrow Function Component)
  - `const onMouseMove` (Arrow Function Component)
  - `const resizeCanvas` (Arrow Function Component)
  - `const circleParams` (Arrow Function Component)
  - `const dx` (Arrow Function Component)
  - `const dy` (Arrow Function Component)
  - `const drawCircle` (Arrow Function Component)
  - `const clearContext` (Arrow Function Component)
  - `const drawParticles` (Arrow Function Component)
  - `const remapValue` (Arrow Function Component)
  - `const animate` (Arrow Function Component)

### `src/components/magic/progressive-blur.tsx`
  - `interface ProgressiveBlurProps`
  - `function ProgressiveBlur(...)`
  - `const midPercent` (Arrow Function Component)
  - `const endPercent` (Arrow Function Component)

### `src/components/magic/pulsating-button.tsx`
  - `interface PulsatingButtonProps`
  - `const updateBg` (Arrow Function Component)
  - `const scheduleBgUpdate` (Arrow Function Component)

### `src/components/magic/ripple.tsx`
  - `interface RippleProps`

### `src/components/magic/scroll-progress.tsx`
  - `interface ScrollProgressProps`
  - `function ScrollProgress(...)`

### `src/components/magic/shimmer-button.tsx`
  - `interface ShimmerButtonProps`

### `src/components/magic/shine-border.tsx`
  - `interface ShineBorderProps`
  - `function ShineBorder(...)`

### `src/components/magic/spinning-text.tsx`
  - `interface SpinningTextProps`
  - `function SpinningText(...)`

### `src/components/magic/terminal.tsx`
  - `type ComponentType`
  - `type RefAttributes`
  - `type DOMMotionComponents`
  - `type HTMLMotionProps`
  - `type MotionProps`
  - `interface SequenceContextValue`
  - `const useSequence` (Arrow Function Component)
  - `const useItemIndex` (Arrow Function Component)
  - `type MotionElementType`
  - `type TerminalTypingMotionComponent`
  - `interface AnimatedSpanProps`
  - `const AnimatedSpan` (Arrow Function Component)
  - `interface TypingAnimationProps`
  - `const TypingAnimation` (Arrow Function Component)
  - `interface TerminalProps`
  - `const Terminal` (Arrow Function Component)
  - `const content` (Arrow Function Component)

### `src/components/magic/text-animate.tsx`
  - `type DOMMotionComponents`
  - `type MotionProps`
  - `type Variants`
  - `type AnimationType`
  - `type AnimationVariant`
  - `type MotionElementType`
  - `interface TextAnimateProps`
  - `const TextAnimateBase` (Arrow Function Component)

### `src/components/magic/typing-animation.tsx`
  - `type ComponentType`
  - `type RefAttributes`
  - `type RefObject`
  - `type DOMMotionComponents`
  - `type HTMLMotionProps`
  - `type MotionProps`
  - `type MotionElementType`
  - `type TypingAnimationMotionComponent`
  - `interface TypingAnimationProps`
  - `function TypingAnimation(...)`
  - `const nextIndex` (Arrow Function Component)
  - `const getCursorChar` (Arrow Function Component)

### `src/components/magic/word-rotate.tsx`
  - `interface WordRotateProps`
  - `function WordRotate(...)`

### `src/components/magicui/AnimatedShinyText.tsx`
  - `interface AnimatedShinyTextProps`

### `src/components/magicui/BorderBeam.tsx`
  - `interface BorderBeamProps`

### `src/components/magicui/DotPattern.tsx`
  - `interface DotPatternProps`

### `src/components/magicui/FlickeringGrid.tsx`
  - `interface FlickeringGridProps`
  - `const updateCanvasSize` (Arrow Function Component)
  - `const animate` (Arrow Function Component)
  - `const deltaTime` (Arrow Function Component)

### `src/components/magicui/Particles.tsx`
  - `interface ParticlesProps`
  - `const resize` (Arrow Function Component)
  - `const render` (Arrow Function Component)

### `src/components/magicui/ShimmerButton.tsx`
  - `interface ShimmerButtonProps`

### `src/components/memory/MemoryGlobe.tsx`
  - `interface MemoryGlobeProps`
  - `interface UnitVertex`
  - `interface ProjectedVertex`
  - `function createGeodesicMesh(...)`
  - `const phi` (Arrow Function Component)
  - `const vertexIdx` (Arrow Function Component)
  - `const render` (Arrow Function Component)
  - `const normalizedZ` (Arrow Function Component)
  - `const avgZ` (Arrow Function Component)
  - `const normalizedEdgeZ` (Arrow Function Component)
  - `const nodeRadius` (Arrow Function Component)

### `src/components/motion/BlurText.tsx`
  - `interface BlurTextProps`

### `src/components/motion/ClickSpark.tsx`
  - `interface ClickSparkProps`
  - `interface Spark`
  - `const handleClick` (Arrow Function Component)

### `src/components/motion/CountUp.tsx`
  - `interface CountUpProps`

### `src/components/motion/DecryptedText.tsx`
  - `interface DecryptedTextProps`

### `src/components/motion/HudReticle.tsx`
  - `interface HudReticleProps`

### `src/components/motion/MotionCard.tsx`
  - `interface MotionCardProps`
  - `const handleMouseMove` (Arrow Function Component)
  - `const handleMouseLeave` (Arrow Function Component)

### `src/components/motion/SpotlightCard.tsx`
  - `interface SpotlightCardProps`
  - `const handleMouseEnter` (Arrow Function Component)
  - `const handleMouseLeave` (Arrow Function Component)

### `src/components/providers/SmoothScroll.tsx`
  - `interface SmoothScrollContextValue`
  - `const useLenis` (Arrow Function Component)
  - `interface SmoothScrollProps`
  - `const scrollTo` (Arrow Function Component)

### `src/components/telemetry/AudioSpectrumVisualizer.tsx`
  - `interface AudioSpectrumVisualizerProps`

### `src/components/telemetry/DenseMonochromeHUD.tsx`
  - `interface DenseMonochromeHUDProps`

### `src/components/tremor/Badge.tsx`
  - `interface TremorBadgeProps`

### `src/components/tremor/Card.tsx`
  - `interface CardProps`

### `src/components/tremor/KpiCard.tsx`
  - `interface TremorKpiProps`

### `src/components/tremor/ProgressCircle.tsx`
  - `interface ProgressCircleProps`
  - `const strokeDashoffset` (Arrow Function Component)

### `src/components/tremor/StatusMonitoring.tsx`
  - `interface PipelineStage`

### `src/components/tremor/Tracker.tsx`
  - `interface TrackerBlockProps`
  - `const Block` (Arrow Function Component)
  - `interface TrackerProps`

### `src/components/ui/accordion.tsx`
  - `function Accordion(...)`
  - `function AccordionItem(...)`
  - `function AccordionTrigger(...)`
  - `function AccordionContent(...)`

### `src/components/ui/alert.tsx`
  - `function Alert(...)`
  - `function AlertTitle(...)`
  - `function AlertDescription(...)`

### `src/components/ui/AsciiAdam.tsx`
  - `interface AsciiAdamProps`

### `src/components/ui/AsciiSkull.tsx`
  - `interface AsciiSkullProps`

### `src/components/ui/avatar.tsx`
  - `function Avatar(...)`
  - `function AvatarImage(...)`
  - `function AvatarFallback(...)`
  - `function AvatarBadge(...)`
  - `function AvatarGroup(...)`
  - `function AvatarGroupCount(...)`

### `src/components/ui/badge.tsx`
  - `type RiskTier`
  - `interface BadgeProps`

### `src/components/ui/button.tsx`
  - `interface ButtonProps`

### `src/components/ui/card.tsx`
  - `interface CardProps`

### `src/components/ui/checkbox.tsx`
  - `function Checkbox(...)`

### `src/components/ui/collapsible.tsx`
  - `function Collapsible(...)`
  - `function CollapsibleTrigger(...)`
  - `function CollapsibleContent(...)`

### `src/components/ui/command.tsx`
  - `function Command(...)`
  - `function CommandDialog(...)`
  - `function CommandInput(...)`
  - `function CommandList(...)`
  - `function CommandEmpty(...)`
  - `function CommandGroup(...)`
  - `function CommandSeparator(...)`
  - `function CommandItem(...)`
  - `function CommandShortcut(...)`

### `src/components/ui/DataTable.tsx`
  - (No functions or interfaces found)

### `src/components/ui/dialog.tsx`
  - `function Dialog(...)`
  - `function DialogTrigger(...)`
  - `function DialogPortal(...)`
  - `function DialogClose(...)`
  - `function DialogOverlay(...)`
  - `function DialogContent(...)`
  - `function DialogHeader(...)`
  - `function DialogFooter(...)`
  - `function DialogTitle(...)`
  - `function DialogDescription(...)`

### `src/components/ui/DiffViewer.tsx`
  - `interface DiffViewerProps`

### `src/components/ui/dropdown-menu.tsx`
  - `function DropdownMenu(...)`
  - `function DropdownMenuPortal(...)`
  - `function DropdownMenuTrigger(...)`
  - `function DropdownMenuContent(...)`
  - `function DropdownMenuGroup(...)`
  - `function DropdownMenuItem(...)`
  - `function DropdownMenuCheckboxItem(...)`
  - `function DropdownMenuRadioGroup(...)`
  - `function DropdownMenuRadioItem(...)`
  - `function DropdownMenuLabel(...)`
  - `function DropdownMenuSeparator(...)`
  - `function DropdownMenuShortcut(...)`
  - `function DropdownMenuSub(...)`
  - `function DropdownMenuSubTrigger(...)`
  - `function DropdownMenuSubContent(...)`

### `src/components/ui/empty.tsx`
  - `function Empty(...)`
  - `function EmptyHeader(...)`
  - `function EmptyMedia(...)`
  - `function EmptyTitle(...)`
  - `function EmptyDescription(...)`
  - `function EmptyContent(...)`

### `src/components/ui/field.tsx`
  - `function FieldSet(...)`
  - `function FieldLegend(...)`
  - `function FieldGroup(...)`
  - `function Field(...)`
  - `function FieldContent(...)`
  - `function FieldLabel(...)`
  - `function FieldTitle(...)`
  - `function FieldDescription(...)`
  - `function FieldSeparator(...)`
  - `function FieldError(...)`

### `src/components/ui/HalftoneBudgetCard.tsx`
  - `interface HalftoneBudgetCardProps`

### `src/components/ui/HalftoneCard.tsx`
  - `interface HalftoneCardProps`

### `src/components/ui/input.tsx`
  - `interface InputProps`

### `src/components/ui/item.tsx`
  - `function ItemGroup(...)`
  - `function ItemSeparator(...)`
  - `function Item(...)`
  - `function ItemMedia(...)`
  - `function ItemContent(...)`
  - `function ItemTitle(...)`
  - `function ItemDescription(...)`
  - `function ItemActions(...)`
  - `function ItemHeader(...)`
  - `function ItemFooter(...)`

### `src/components/ui/kbd.tsx`
  - `interface KbdProps`

### `src/components/ui/label.tsx`
  - `function Label(...)`

### `src/components/ui/MetricCard.tsx`
  - `interface MetricCardProps`

### `src/components/ui/popover.tsx`
  - `function Popover(...)`
  - `function PopoverTrigger(...)`
  - `function PopoverContent(...)`
  - `function PopoverAnchor(...)`
  - `function PopoverHeader(...)`
  - `function PopoverTitle(...)`
  - `function PopoverDescription(...)`

### `src/components/ui/progress.tsx`
  - `function Progress(...)`

### `src/components/ui/scroll-area.tsx`
  - `function ScrollArea(...)`
  - `function ScrollBar(...)`

### `src/components/ui/select.tsx`
  - `function Select(...)`
  - `function SelectGroup(...)`
  - `function SelectValue(...)`
  - `function SelectTrigger(...)`
  - `function SelectContent(...)`
  - `function SelectLabel(...)`
  - `function SelectItem(...)`
  - `function SelectSeparator(...)`
  - `function SelectScrollUpButton(...)`
  - `function SelectScrollDownButton(...)`

### `src/components/ui/separator.tsx`
  - `function Separator(...)`

### `src/components/ui/sheet.tsx`
  - `function Sheet(...)`
  - `function SheetTrigger(...)`
  - `function SheetClose(...)`
  - `function SheetPortal(...)`
  - `function SheetOverlay(...)`
  - `function SheetContent(...)`
  - `function SheetHeader(...)`
  - `function SheetFooter(...)`
  - `function SheetTitle(...)`
  - `function SheetDescription(...)`

### `src/components/ui/skeleton.tsx`
  - `function Skeleton(...)`

### `src/components/ui/slider.tsx`
  - `function Slider(...)`

### `src/components/ui/sonner.tsx`
  - `const Toaster` (Arrow Function Component)

### `src/components/ui/switch.tsx`
  - `function Switch(...)`

### `src/components/ui/table.tsx`
  - `function Table(...)`
  - `function TableHeader(...)`
  - `function TableBody(...)`
  - `function TableFooter(...)`
  - `function TableRow(...)`
  - `function TableHead(...)`
  - `function TableCell(...)`
  - `function TableCaption(...)`

### `src/components/ui/tabs.tsx`
  - `function Tabs(...)`
  - `function TabsList(...)`
  - `function TabsTrigger(...)`
  - `function TabsContent(...)`

### `src/components/ui/textarea.tsx`
  - `function Textarea(...)`

### `src/components/ui/tooltip.tsx`
  - `function TooltipProvider(...)`
  - `function Tooltip(...)`
  - `function TooltipTrigger(...)`
  - `function TooltipContent(...)`

### `src/lib/ai.ts`
  - `interface AiTurnResult`
  - `function getAiConfig(...)`
  - `interface BackendTurnRes`

### `src/lib/bindings.ts`
  - `type OrbState`
  - `type InputMode`
  - `type RiskTier`
  - `interface ToolCall`
  - `interface PlanStep`
  - `interface PendingPlan`
  - `interface ChatMessage`
  - `interface Thread`
  - `interface Fact`
  - `interface AuditEntry`
  - `interface Automation`
  - `interface Skill`
  - `interface SystemTelemetry`
  - `interface GlmSettings`

### `src/lib/ipc.ts`
  - `function toCamelCase(...)`
  - `function normalizeIpcArgs(...)`
  - `const showBar` (Arrow Function Component)
  - `const hideBar` (Arrow Function Component)
  - `const showConsole` (Arrow Function Component)
  - `const resizeBar` (Arrow Function Component)
  - `const setClickThrough` (Arrow Function Component)
  - `type FridayEvent`
  - `function surfaceLabel(...)`
  - `const label` (Arrow Function Component)
  - `interface BackendFact`
  - `const getBackendFacts` (Arrow Function Component)
  - `const addBackendFact` (Arrow Function Component)
  - `const deleteBackendFact` (Arrow Function Component)
  - `interface CodeHit`
  - `type CodeSearchResult`
  - `interface SymbolHit`
  - `type SymbolInfo`
  - `interface FileContentResult`
  - `interface DirEntry`
  - `interface MediaProbeResult`
  - `const searchCode` (Arrow Function Component)
  - `const findSymbols` (Arrow Function Component)
  - `const rrfSearch` (Arrow Function Component)
  - `const readFileContent` (Arrow Function Component)
  - `const listDirectory` (Arrow Function Component)
  - `const processText` (Arrow Function Component)
  - `const probeMedia` (Arrow Function Component)
  - `interface BrowserActionElement`
  - `interface BrowserSnapshot`
  - `interface ActionExecutionResult`
  - `interface DiffLine`
  - `interface DiffHunk`
  - `interface DiffFile`
  - `interface ReviewFinding`
  - `interface CodeChunk`
  - `const browserSnapshot` (Arrow Function Component)
  - `const browserAction` (Arrow Function Component)
  - `const reviewDiff` (Arrow Function Component)
  - `const reviewScan` (Arrow Function Component)
  - `const codeChunk` (Arrow Function Component)
  - `interface ScreenCaptureData`
  - `interface WindowInfo`
  - `const captureScreen` (Arrow Function Component)
  - `const listWindows` (Arrow Function Component)
  - `const focusWindow` (Arrow Function Component)
  - `const setWindowState` (Arrow Function Component)
  - `interface ScreenOcrData`
  - `const ocrScreen` (Arrow Function Component)
  - `const getActiveThread` (Arrow Function Component)
  - `const setActiveThread` (Arrow Function Component)

### `src/lib/kokoro.ts`
  - `interface KokoroVoiceProfile`
  - `function getAudioContext(...)`
  - `function getOrCreateStudioDsp(...)`
  - `function stopKokoroAudio(...)`
  - `function playKokoroBuffer(...)`
  - `const updateLevel` (Arrow Function Component)
  - `function shapeHumanProsody(...)`
  - `const isShortAffirmation` (Arrow Function Component)

### `src/lib/lenis.ts`
  - `interface LenisOptions`
  - `interface ScrollEventData`
  - `const loop` (Arrow Function Component)

### `src/lib/phrasebank.ts`
  - `function normalizeKey(...)`
  - `function matchPhraseBank(...)`
  - `function generateAcousticCueBuffer(...)`
  - `function playInstantAcousticCue(...)`
  - `const profile` (Arrow Function Component)
  - `function getPhraseBankTelemetry(...)`

### `src/lib/seed.ts`
  - `const at` (Arrow Function Component)
  - `function makeBlocks(...)`

### `src/lib/sim.ts`
  - `const sleep` (Arrow Function Component)
  - `const jitter` (Arrow Function Component)
  - `const live` (Arrow Function Component)
  - `const alive` (Arrow Function Component)
  - `function cancel(...)`
  - `interface Scenario`
  - `type ScenarioKey`
  - `const scenario` (Arrow Function Component)
  - `interface RunOptions`
  - `function startTelemetry(...)`

### `src/lib/store.ts`
  - `type ConsoleTab`
  - `function stopNativeVoice(...)`
  - `function speakWithNativeVoice(...)`
  - `interface State`
  - `function useActiveThread(...)`
  - `const recentMessages` (Arrow Function Component)

### `src/lib/types.ts`
  - `type OrbState`
  - `type Mode`
  - `type Emotion`
  - `interface Delivery`
  - `interface TurnOutput`
  - `type RiskTier`
  - `type ToolStatus`
  - `interface ToolCall`
  - `interface PlanStep`
  - `interface Utterance`
  - `interface Confirmation`
  - `interface Message`
  - `interface Thread`
  - `interface Fact`
  - `interface AuditEntry`
  - `interface Automation`
  - `interface Skill`
  - `interface LatencyStage`
  - `interface ResourceSample`
  - `type Connectivity`
  - `type ModelStatus`
  - `interface TrackerBlockItem`
  - `interface ModelTelemetry`
  - `interface AiModel`
  - `type KokoroVoiceId`
  - `type PhraseCategory`
  - `interface PhraseBankItem`
  - `interface WakeWordSettings`
  - `interface ScreenContext`
  - `interface RunningWindow`

### `src/lib/utils.ts`
  - `function cn(...)`
  - `function ms(...)`
  - `function ago(...)`

### `src/lib/voice.ts`
  - `type KokoroVoiceProfile`
  - `type VoiceProfile`
  - `interface VoiceSettings`
  - `function resolveKokoroVoice(...)`
  - `function initVoices(...)`
  - `function getAvailableVoices(...)`
  - `function pickBestVoice(...)`
  - `const isEn` (Arrow Function Component)
  - `const findByName` (Arrow Function Component)
  - `function normalizeForSpeech(...)`
  - `function stopFridayVoice(...)`
  - `interface SpeakOptions`
  - `function normalizeSentenceKey(...)`
  - `function splitSpeechSentences(...)`
  - `function speakViaWebSpeech(...)`
  - `function speakGoldenPhrase(...)`

### `src/styles/theme.css`
  - (Configuration or asset file)

### `src/surfaces/console/AuditTab.tsx`
  - (No functions or interfaces found)

### `src/surfaces/console/AutomationsTab.tsx`
  - `const handleCreate` (Arrow Function Component)

### `src/surfaces/console/BeastTab.tsx`
  - `const copyText` (Arrow Function Component)

### `src/surfaces/console/BrowserTab.tsx`
  - `const copyText` (Arrow Function Component)

### `src/surfaces/console/ChatTab.tsx`
  - `function formatMessageTime(...)`
  - `const handleSend` (Arrow Function Component)

### `src/surfaces/console/Console.tsx`
  - `const handleMinimize` (Arrow Function Component)
  - `const handleClose` (Arrow Function Component)
  - `const handleHeaderMouseDown` (Arrow Function Component)

### `src/surfaces/console/DebugDrawer.tsx`
  - `function DebugDrawer(...)`
  - `function Stage(...)`

### `src/surfaces/console/DelphiTab.tsx`
  - `type DelphiSubtool`
  - `const copyToClipboard` (Arrow Function Component)

### `src/surfaces/console/Inspector.tsx`
  - `function Inspector(...)`
  - `function Block(...)`
  - `function Empty(...)`
  - `function FactRow(...)`

### `src/surfaces/console/Markdown.tsx`
  - `function Markdown(...)`

### `src/surfaces/console/MemoryTab.tsx`
  - (No functions or interfaces found)

### `src/surfaces/console/Rail.tsx`
  - `function Rail(...)`
  - `function Item(...)`

### `src/surfaces/console/ReviewTab.tsx`
  - `const copyText` (Arrow Function Component)
  - `const toggleHunk` (Arrow Function Component)

### `src/surfaces/console/SettingsTab.tsx`
  - `const handleAudition` (Arrow Function Component)

### `src/surfaces/console/SkillsTab.tsx`
  - (No functions or interfaces found)

### `src/surfaces/console/ToolCallCard.tsx`
  - `function ToolCallCard(...)`
  - `function argsPreview(...)`

### `src/surfaces/landing/LandingShowcase.tsx`
  - `interface LandingShowcaseProps`

### `src/surfaces/onboarding/Onboarding.tsx`
  - `function Onboarding(...)`
  - `const next` (Arrow Function Component)
  - `function Hello(...)`
  - `function Listening(...)`
  - `function Voice(...)`
  - `const handlePreview` (Arrow Function Component)
  - `const handleConfirm` (Arrow Function Component)
  - `function Reasoning(...)`
  - `function Authority(...)`
  - `function Stopping(...)`
  - `const onKey` (Arrow Function Component)
  - `function Ready(...)`
  - `function Next(...)`
  - `function Key(...)`

### `src/surfaces/onboarding/OnboardingModal.tsx`
  - `interface OnboardingModalProps`

### `src/surfaces/palette/commands.ts`
  - `interface Command`
  - `function staticCommands(...)`
  - `function derivedCommands(...)`
  - `function allCommands(...)`

### `src/surfaces/palette/Palette.tsx`
  - `interface PaletteCommand`
  - `interface PaletteProps`
  - `const handleKeyDown` (Arrow Function Component)
  - `const paletteContent` (Arrow Function Component)

## Directory: `src-tauri/src/`

### `src-tauri/src/lib.rs`
  - `struct AppState`
  - `struct TelemetryResponse`
  - `struct AudioRmsResponse`
    - `fn submit_utterance(...)`
    - `fn confirm_plan(...)`
    - `fn undo_last(...)`
    - `fn start_mic_capture(...)`
    - `fn stop_mic_capture(...)`
    - `fn start_listening(...)`
    - `fn stop_listening(...)`
    - `fn get_audio_rms(...)`
    - `fn barge_in(...)`
    - `fn is_speaking(...)`
    - `fn speak_text(...)`
    - `fn start_wake_word(...)`
    - `fn stop_wake_word(...)`
    - `fn get_wake_word_status(...)`
    - `fn set_wake_word_sensitivity(...)`
    - `fn get_facts(...)`
    - `fn add_fact(...)`
    - `fn delete_fact(...)`
    - `fn get_audit_log(...)`
    - `fn get_threads(...)`
    - `fn get_active_thread(...)`
    - `fn set_active_thread(...)`
    - `fn get_messages(...)`
    - `fn get_automations(...)`
    - `fn toggle_automation(...)`
    - `fn trigger_automation(...)`
    - `fn get_skills(...)`
    - `fn toggle_skill(...)`
  - `struct GlmSettingsDto`
    - `fn get_glm_settings(...)`
    - `fn update_glm_settings(...)`
    - `fn spawn_kokoro_service_if_needed(...)`
    - `fn get_kokoro_status(...)`
    - `fn get_ai_models(...)`
    - `fn set_active_model(...)`
    - `fn update_ai_model(...)`
    - `fn add_ai_model(...)`
    - `fn delete_ai_model(...)`
    - `fn toggle_model_status(...)`
    - `fn test_model_connection(...)`
    - `fn test_all_models(...)`
    - `fn save_api_key(...)`
    - `fn get_api_key_status(...)`
    - `fn test_glm_connection(...)`
    - `fn learn_correction(...)`
    - `fn get_hotwords(...)`
    - `fn get_telemetry(...)`
    - `fn show_console(...)`
    - `fn hide_console(...)`
    - `fn show_bar(...)`
    - `fn hide_bar(...)`
    - `fn app_minimize(...)`
    - `fn app_toggle_maximize(...)`
    - `fn app_is_maximized(...)`
    - `fn app_start_dragging(...)`
    - `fn app_close(...)`
    - `fn set_bar_height(...)`
    - `fn resize_bar(...)`
    - `fn set_click_through(...)`
    - `fn process_voice_utterance(...)`
    - `fn search_code(...)`
    - `fn find_symbols(...)`
    - `fn rrf_search(...)`
    - `fn read_file_content(...)`
    - `fn list_directory(...)`
    - `fn process_text(...)`
    - `fn probe_media(...)`
    - `fn browser_snapshot(...)`
    - `fn browser_action(...)`
    - `fn review_diff(...)`
    - `fn review_scan(...)`
    - `fn code_chunk(...)`
    - `fn capture_screen(...)`
    - `fn screen_ocr(...)`
    - `fn set_stt_cadence(...)`
    - `fn list_windows(...)`
    - `fn focus_window(...)`
    - `fn set_window_state(...)`
    - `fn run(...)`

### `src-tauri/src/main.rs`
    - `fn main(...)`

### `src-tauri/src/agent/beast.rs`
  - `struct Hit`
  - `struct SymbolHit`
  - `struct CodeChunk`
    - `fn rrf_merge(...)`
  - `struct Acc`
    - `fn tokenize_code(...)`
    - `fn split_identifier(...)`
  - `struct BeastSearcher`
  - `impl BeastSearcher`
    - `fn new(...)`
    - `fn chunk_file(...)`
    - `fn search(...)`
    - `fn rrf_search(...)`
    - `fn chunk_path(...)`
    - `fn find_symbols(...)`
    - `fn collect_searchable_files(...)`

### `src-tauri/src/agent/browser.rs`
  - `struct ActionElement`
  - `struct ElementRect`
  - `struct BrowserSnapshot`
  - `struct ActionExecutionResult`
  - `struct BrowserOperator`
  - `impl Default`
    - `fn default(...)`
  - `impl BrowserOperator`
    - `fn new(...)`
    - `fn snapshot_url(...)`
    - `fn parse_html_snapshot(...)`
    - `fn execute_action(...)`
    - `fn extract_attr(...)`
    - `fn extract_label(...)`

### `src-tauri/src/agent/loop_legacy.rs`
  - `struct PlanStep`
  - `struct PendingPlan`
  - `struct TurnResult`
  - `struct AgentCore`
  - `impl AgentCore`
    - `fn new(...)`
    - `fn record_turn_to_db(...)`
    - `fn execute_turn(...)`
    - `fn confirm_plan(...)`
    - `fn undo_last(...)`
    - `fn learn_correction(...)`
    - `fn refresh_hotwords(...)`
    - `fn parse_glm_response(...)`
    - `fn clean_say_channel(...)`
    - `fn extract_spoken_summary(...)`
    - `fn test_agent_fast_intent_screen(...)`
    - `fn test_agent_plan_creation_and_confirm(...)`
    - `fn test_agent_memory_fact_recording_and_recall(...)`
    - `fn test_agent_user_name_memory_and_correction(...)`
    - `fn test_agent_dictation_mode_verbatim(...)`
    - `fn test_agent_spelling_mode(...)`
    - `fn test_agent_learned_correction(...)`
    - `fn test_glm_response_json_parsing(...)`
    - `fn test_glm_response_markdown_fallback_parsing(...)`
    - `fn test_agent_missing_key_guidance(...)`

### `src-tauri/src/agent/machine.rs`
  - `enum AgentState`
  - `struct HarnessKernel`
  - `impl HarnessKernel`
    - `fn new(...)`
    - `fn boot(...)`
    - `fn on_utterance_end(...)`

### `src-tauri/src/agent/mcp_client.rs`
  - `struct AgentMcpClient`
  - `impl AgentMcpClient`
    - `fn spawn(...)`
    - `fn process_utterance(...)`

### `src-tauri/src/agent/mod.rs`
  - (No structs, enums, or functions defined)

### `src-tauri/src/agent/review.rs`
  - `struct DiffLine`
  - `enum DiffLineType`
  - `struct DiffHunk`
  - `struct DiffFile`
  - `enum FileStatus`
  - `struct ReviewFinding`
  - `enum FindingSeverity`
  - `struct FileBundle`
  - `struct ReviewDiffResponse`
  - `struct ReviewScanResponse`
  - `struct CodeReviewEngine`
  - `impl CodeReviewEngine`
    - `fn parse_git_diff(...)`
    - `fn bundle_files(...)`
    - `fn review_diff(...)`
    - `fn parse_hunk_header(...)`

### `src-tauri/src/memory/db.rs`
  - `struct DbThread`
  - `struct DbMessage`
  - `struct DbFact`
  - `struct DbAuditEntry`
  - `struct DbAutomation`
  - `struct DbSkill`
  - `struct Database`
  - `impl Database`
    - `fn open(...)`
    - `fn open_in_memory(...)`
    - `fn open_app_database(...)`
    - `fn get_app_db_path(...)`
    - `fn init_schema(...)`
    - `fn seed_defaults_if_empty(...)`
    - `fn get_all_ai_models(...)`
    - `fn get_model_telemetry(...)`
    - `fn save_ai_model(...)`
    - `fn set_active_ai_model(...)`
    - `fn delete_ai_model(...)`
    - `fn update_model_telemetry(...)`
    - `fn get_threads(...)`
    - `fn insert_thread(...)`
    - `fn delete_thread(...)`
    - `fn ensure_thread_exists(...)`
    - `fn get_active_thread_id(...)`
    - `fn set_active_thread_id(...)`
    - `fn insert_message(...)`
    - `fn get_messages_for_thread(...)`
    - `fn insert_fact(...)`
    - `fn get_all_facts(...)`
    - `fn search_facts(...)`
    - `fn delete_fact(...)`
    - `fn insert_audit_entry(...)`
    - `fn get_audit_log(...)`
    - `fn get_automations(...)`
    - `fn insert_automation(...)`
    - `fn toggle_automation(...)`
    - `fn delete_automation(...)`
    - `fn get_skills(...)`
    - `fn insert_skill(...)`
    - `fn toggle_skill(...)`
    - `fn save_setting(...)`
    - `fn get_setting(...)`
    - `fn get_user_name(...)`
    - `fn set_user_name(...)`
    - `fn test_db_init_and_crud(...)`

### `src-tauri/src/memory/facts.rs`
  - `struct FactExtractor`
  - `impl FactExtractor`
    - `fn extract_user_name(...)`
    - `fn try_extract(...)`
  - `struct FactRetriever`
  - `impl FactRetriever`
    - `fn new(...)`
    - `fn retrieve_context(...)`
    - `fn format_facts_xml(...)`
    - `fn test_fact_extraction(...)`
    - `fn test_fact_retriever(...)`

### `src-tauri/src/memory/mod.rs`
  - (No structs, enums, or functions defined)

### `src-tauri/src/providers/glm.rs`
  - `struct GlmConfig`
  - `impl Default`
    - `fn default(...)`
  - `enum StreamDelta`
  - `struct ToolCallAccumulator`
    - `fn normalize_api_url(...)`
  - `struct GlmProvider`
  - `impl GlmProvider`
    - `fn new(...)`
    - `fn get_effective_api_key(...)`
    - `fn get_key_from_keyring(...)`
    - `fn save_key_to_keyring(...)`
    - `fn select_model(...)`
    - `fn prepare_payload(...)`
    - `fn stream_completion(...)`
    - `fn handle_json_response(...)`
    - `fn handle_sse_stream(...)`
    - `fn test_model_selection(...)`
    - `fn test_payload_preparation(...)`

### `src-tauri/src/providers/llm.rs`
  - `struct DeepSeekProvider`
  - `impl DeepSeekProvider`
    - `fn new(...)`
    - `fn execute_turn(...)`

### `src-tauri/src/providers/mod.rs`
  - (No structs, enums, or functions defined)

### `src-tauri/src/providers/models.rs`
  - `enum ModelStatus`
  - `impl ModelStatus`
    - `fn as_str(...)`
    - `fn from_str(...)`
  - `struct TrackerBlock`
  - `struct ModelTelemetry`
  - `struct AiModel`
  - `impl AiModel`
    - `fn update_with_test_result(...)`
    - `fn build_synthetic_tracker(...)`
    - `fn get_default_models_fleet(...)`
    - `fn test_model_ping(...)`

### `src-tauri/src/providers/router.rs`
  - `struct AiRouter`
  - `impl AiRouter`
    - `fn new(...)`
    - `fn get_models(...)`
    - `fn get_active_model(...)`
    - `fn set_active_model(...)`
    - `fn toggle_status(...)`
    - `fn update_model(...)`
    - `fn add_model(...)`
    - `fn delete_model(...)`
    - `fn select_execution_candidates(...)`
    - `fn test_model(...)`
    - `fn execute_routed_turn(...)`

### `src-tauri/src/scheduler/mod.rs`
  - `struct SchedulerManager`
  - `impl SchedulerManager`
    - `fn new(...)`
    - `fn is_running(...)`
    - `fn start(...)`
    - `fn stop(...)`
    - `fn trigger_now(...)`
    - `fn md5_digest(...)`
    - `fn test_scheduler_manual_trigger(...)`

### `src-tauri/src/skills/mod.rs`
  - `struct SkillTrigger`
  - `struct SkillManifest`
  - `struct SkillRegistry`
  - `impl SkillRegistry`
    - `fn new(...)`
    - `fn load_bundled_skills(...)`
    - `fn discover_filesystem_skills(...)`
    - `fn check_permission(...)`
    - `fn execute_skill_action(...)`
    - `fn get_all_manifests(...)`
    - `fn test_skill_permission_enforcement(...)`

### `src-tauri/src/tools/delphi.rs`
  - `struct MediaProbeResult`
  - `struct DelphiTools`
  - `impl DelphiTools`
    - `fn probe_file(...)`
    - `fn format_json(...)`
    - `fn generate_uuid(...)`
    - `fn decode_jwt_payload(...)`
    - `fn base64_decode(...)`

### `src-tauri/src/tools/mod.rs`
  - `struct ToolDefinition`
  - `struct ToolExecutionResult`
  - `struct WindowInfo`
  - `struct RECT`
  - `struct BITMAPINFOHEADER`
  - `struct BITMAPINFO`
    - `fn GetForegroundWindow(...)`
    - `fn GetWindowTextW(...)`
    - `fn GetWindowThreadProcessId(...)`
    - `fn GetDC(...)`
    - `fn ReleaseDC(...)`
    - `fn GetWindowRect(...)`
    - `fn SetForegroundWindow(...)`
    - `fn ShowWindow(...)`
    - `fn EnumWindows(...)`
    - `fn IsWindowVisible(...)`
    - `fn GetSystemMetrics(...)`
    - `fn SetCursorPos(...)`
    - `fn mouse_event(...)`
    - `fn keybd_event(...)`
    - `fn CreateCompatibleDC(...)`
    - `fn CreateCompatibleBitmap(...)`
    - `fn SelectObject(...)`
    - `fn BitBlt(...)`
    - `fn DeleteDC(...)`
    - `fn DeleteObject(...)`
    - `fn GetDIBits(...)`
    - `fn OpenProcess(...)`
    - `fn CloseHandle(...)`
    - `fn QueryFullProcessImageNameW(...)`
    - `fn get_process_name_by_pid(...)`
    - `fn get_active_window_info(...)`
    - `fn list_windows(...)`
    - `fn focus_window(...)`
    - `fn set_window_state(...)`
    - `fn mouse_click(...)`
    - `fn type_text(...)`
    - `fn capture_screen(...)`
    - `fn base64_encode(...)`
  - `struct WindowInfo`
    - `fn get_active_window_info(...)`
    - `fn list_windows(...)`
    - `fn focus_window(...)`
    - `fn set_window_state(...)`
    - `fn capture_screen(...)`
    - `fn mouse_click(...)`
    - `fn type_text(...)`
    - `fn base64_encode(...)`
  - `struct ToolRegistry`
  - `impl Default`
    - `fn default(...)`
  - `impl ToolRegistry`
    - `fn new(...)`
    - `fn register_defaults(...)`
    - `fn register(...)`
    - `fn get(...)`
    - `fn list(...)`
    - `fn invoke(...)`
    - `fn chrono_now_ms(...)`
    - `fn find_script_path(...)`
    - `fn test_tool_registry_defaults(...)`
    - `fn test_shell_allowlist_gate(...)`
    - `fn test_tool_name_normalization(...)`

### `src-tauri/src/tools/security.rs`
  - `enum RiskTier`
  - `enum Resource`
  - `struct CapabilityToken`
  - `impl CapabilityToken`
    - `fn new(...)`
    - `fn is_valid(...)`
  - `struct ToolReceipt`
  - `enum ToolError`
  - `impl std`
    - `fn fmt(...)`
    - `fn validate_tool_args(...)`

### `src-tauri/src/voice/capture.rs`
  - `struct SherpaAudioNode`
  - `impl SherpaAudioNode`
    - `fn new(...)`
    - `fn start(...)`
  - `struct WakeWordStub`
  - `impl WakeWordStub`
    - `fn enable(...)`
    - `fn disable(...)`
    - `fn get_status(...)`
    - `fn set_sensitivity(...)`
  - `impl AudioCaptureManager`
    - `fn new(...)`
    - `fn start_capture(...)`
    - `fn stop_capture(...)`
    - `fn get_current_rms(...)`
    - `fn ensure_stream_running(...)`
    - `fn shutdown(...)`
    - `fn set_stt_cadence(...)`
    - `fn set_app_handle(...)`
    - `fn set_phrase_bank(...)`
  - `struct AudioCaptureManager`

### `src-tauri/src/voice/directives.rs`
  - `enum VoiceEmotion`
  - `struct DeliveryDirective`
  - `impl Default`
    - `fn default(...)`
  - `struct CompiledSynthesisParams`
  - `impl DeliveryDirective`
    - `fn compile(...)`
    - `fn test_directive_clamping(...)`

### `src-tauri/src/voice/hotwords.rs`
  - `struct HotwordEntry`
  - `struct HotwordsEngine`
  - `impl Default`
    - `fn default(...)`
  - `impl HotwordsEngine`
    - `fn new(...)`
    - `fn register_hotword(...)`
    - `fn register_correction(...)`
    - `fn learn_correction(...)`
    - `fn ingest_from_facts(...)`
    - `fn decode_spelling_mode(...)`
    - `fn apply_dictation_punctuation(...)`
    - `fn export_hotwords_file(...)`
    - `fn apply_corrections(...)`
    - `fn process_transcript(...)`
    - `fn hotword_count(...)`
    - `fn correction_count(...)`
    - `fn test_hotwords_export_and_count(...)`
    - `fn test_phonetic_correction_dictionary(...)`
    - `fn test_spelling_mode_nato_decoding(...)`
    - `fn test_dictation_punctuation(...)`
    - `fn test_learn_correction(...)`
    - `fn test_ingest_from_facts(...)`

### `src-tauri/src/voice/mod.rs`
  - (No structs, enums, or functions defined)

### `src-tauri/src/voice/normalize.rs`
    - `fn normalize_for_speech(...)`
    - `fn regex_replace_urls(...)`
    - `fn regex_replace_paths(...)`
    - `fn strip_markdown(...)`
    - `fn test_normalization_basic(...)`
    - `fn test_strips_urls_and_markdown(...)`

### `src-tauri/src/voice/openwakeword.rs`
  - `struct OpenWakeWordNode`
  - `impl OpenWakeWordNode`
    - `fn new(...)`
    - `fn enable(...)`
    - `fn disable(...)`
    - `fn get_status(...)`
    - `fn process_chunk(...)`

### `src-tauri/src/voice/phrasebank.rs`
  - `struct PhraseBank`
  - `impl Default`
    - `fn default(...)`
  - `impl PhraseBank`
    - `fn new(...)`
    - `fn get_acknowledgement(...)`
    - `fn is_speaking(...)`
    - `fn get_output_rms(...)`
    - `fn barge_in(...)`
    - `fn generate_cue_samples(...)`
    - `fn play_instant_acknowledgement(...)`
    - `fn load_phrase_wav(...)`
    - `fn speak_sentence(...)`
    - `fn test_cue_duration_budget(...)`
    - `fn test_barge_in_stop_latency(...)`

### `src-tauri/src/voice/playback.rs`
  - `struct RodioPlaybackNode`
  - `impl RodioPlaybackNode`
    - `fn new(...)`
    - `fn play_audio_file(...)`
    - `fn stop(...)`

### `src-tauri/src/voice/silero_vad.rs`
  - `struct SileroVadNode`
  - `impl SileroVadNode`
    - `fn new(...)`
    - `fn process_chunk(...)`

### `src-tauri/src/voice/wakeword.rs`
  - `struct WakeWordStatus`
  - `struct WakeWordDetector`
  - `impl Default`
    - `fn default(...)`
  - `impl WakeWordDetector`
    - `fn new(...)`
    - `fn is_enabled(...)`
    - `fn enable(...)`
    - `fn disable(...)`
    - `fn set_sensitivity(...)`
    - `fn get_status(...)`
    - `fn trigger_external(...)`
    - `fn process_samples(...)`
