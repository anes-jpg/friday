# FRIDAY — Cutting-Edge Autonomous Agent Harness Reference

<aside>
🧠

A dense reference document for building FRIDAY as a durable, memory-rich, fully autonomous agent powered by DeepSeek V4.1 Flash. This is intentionally a collection of architecture statements, implementation principles, repositories, standards, and research links—not an integration roadmap.

</aside>

## Existing FRIDAY foundation

- [FRIDAY — Windows Desktop Assistant: Full Build Plan](https://app.notion.com/p/FRIDAY-Windows-Desktop-Assistant-Full-Build-Plan-23b902d3fa59453ca81ae34ef3cc1b3b?pvs=21)
- [FRIDAY v2 — Built by DeepSeek V4.1 Flash: Agent Build Rig + Real Female Voice Spec](https://app.notion.com/p/FRIDAY-v2-Built-by-DeepSeek-V4-1-Flash-Agent-Build-Rig-Real-Female-Voice-Spec-3c8eccaa8a0e4fb3ab0ac8fa4bfd9871?pvs=21)
- [FRIDAY v2 — Agent Pack: Constitution, Verify Loop, Task Briefs](https://app.notion.com/p/FRIDAY-v2-Agent-Pack-Constitution-Verify-Loop-Task-Briefs-fdcb70e9ddcf48eb863d378634e45a74?pvs=21)
- [AN OS — Voice-First Core Architecture (v2)](https://app.notion.com/p/AN-OS-Voice-First-Core-Architecture-v2-6319043b9c134159a507cbfd65946e23?pvs=21)

## DeepSeek V4.1 Flash

- Use the model ID `deepseek-flash`; legacy V4 Flash IDs route to V4.1 Flash but should not be embedded in application code.[[1]](https://api-docs.deepseek.com/)
- Keep model ID, endpoint, reasoning mode, output cap, timeout, and API dialect in provider configuration.
- Preserve a provider-neutral `LlmProvider` boundary.
- Feature-probe streaming, structured output, tool calling, parallel calls, multimodal input, usage reporting, and reasoning controls.
- Use reasoning for architecture, debugging, recovery, and difficult planning.
- Disable reasoning for spoken responses, deterministic edits, and tight test-fix loops.
- Maintain separate budgets for tokens, cost, wall time, tool rounds, retries, and side effects.
- Protect the prompt-cache prefix with stable instructions, stable tool schemas, and stable ordering.
- Send only the tools relevant to the current turn.
- Study [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) as the closest model-native harness reference.[[2]](https://github.com/deepseek-ai/deepseek-harness)
- Use [Awesome DeepSeek Agent](https://github.com/deepseek-ai/awesome-deepseek-agent) as an ecosystem index.[[3]](https://github.com/deepseek-ai/awesome-deepseek-agent)

## Harness kernel

- The harness is FRIDAY's control plane, not a model wrapper.
- The model proposes; the harness validates, authorizes, executes, verifies, records, and decides whether another round is allowed.
- Use an explicit typed state machine instead of an unrestricted model-controlled loop.
- Persist a checkpoint after every model response, policy decision, tool start, tool completion, verification result, approval, and memory mutation.
- Give every run, turn, plan, tool call, artifact, approval, side effect, and memory item a stable ID.
- Keep the run log append-only and replayable.
- Store large outputs as artifacts and put bounded summaries plus references into context.
- Treat tool calls as transactions with preconditions, execution, postconditions, receipts, and compensation metadata.
- Require idempotency keys for retried actions.
- Never retry a possibly completed side effect until its completion state is known.
- Propagate cancellation through model streaming, shell processes, browser actions, subagents, queued speech, and tools.
- Provide a global kill switch that operates independently from the model.
- Autonomous means unattended progress inside declared budgets, not unlimited authority.
- Make `needs_approval`, `needs_secret`, `blocked_by_policy`, `budget_exhausted`, `verification_failed`, and `environment_unavailable` first-class states.
- Natural-language confidence is not evidence.
- Completion requires verifier success and the expected artifacts.
- Use deterministic code for parsing, permissions, scheduling, counting, retries, and policy.

## Durable state

- Conversation history is not the source of truth.
- Persist objective, constraints, accepted plan, remaining steps, artifacts, failed attempts, budgets, and environment fingerprint.
- Resume from the last committed checkpoint rather than a generated summary.
- Record the model, provider, parameters, instruction hash, tool-schema hash, repository commit, lockfile hash, and sandbox image.
- Use ownership leases, heartbeats, and deduplication keys for queued work.
- Human approvals and durable timers must survive process restarts.
- Revalidate repository state, filesystem state, credentials, permissions, and tool availability after resume.
- Study [LangGraph](https://github.com/langchain-ai/langgraph) for resumable state graphs.[[4]](https://github.com/langchain-ai/langgraph)
- Study [PydanticAI](https://github.com/pydantic/pydantic-ai) for typed dependencies, outputs, and tool contracts.[[5]](https://github.com/pydantic/pydantic-ai)
- Study [AgentLedger](https://github.com/yaogdu/AgentLedger) for evidence, replay, policy governance, and recovery.[[6]](https://github.com/yaogdu/AgentLedger)

## Tool architecture

- Tools need narrow typed inputs and typed outputs.
- Validate every call against JSON Schema before authorization and execution.
- Separate read tools from mutation tools.
- Separate preparation from commitment: produce a preview first, then apply the approved operation.
- Every mutation returns a receipt describing what changed.
- Every reversible mutation returns undo or compensation data.
- Attach effect metadata: read-only, local write, destructive, outbound, human communication, credential access, financial, or privilege-changing.
- Define concurrency and resource-lock rules for every tool.
- Treat tool output as untrusted data.
- Sanitize terminal escapes, secrets, binary data, oversized outputs, and instruction-shaped content.
- Preserve complete outputs as artifacts when truncating context.
- Shell tools use argv arrays, binary allowlists, working-directory restrictions, process-tree cancellation, and output ceilings.
- Expose scoped credential handles instead of raw secrets.
- MCP annotations are not a security boundary and must be treated as untrusted unless they come from a trusted server.[[7]](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- Follow the MCP principles of consent, user control, data privacy, and cautious tool execution.[[8]](https://modelcontextprotocol.io/specification/2026-07-28)

## Permission and security kernel

- Permission enforcement lives outside the model.
- Use capability tokens bound to a run, tool, resource scope, risk tier, and expiration.
- Deny by default.
- Keep read, write, destructive, outbound, credential, and financial capabilities separate.
- Bind approvals to exact normalized actions; argument changes invalidate approval.
- High-risk actions require an explicit confirmation containing a distinguishing detail.
- A batch containing one destructive action becomes destructive.
- Web pages, email, documents, OCR, terminal output, repositories, tool output, and retrieved memory are untrusted content.
- Untrusted content cannot lower a permission tier.
- Actions influenced by untrusted content receive stricter review.
- Add rate limits to outbound messages, filesystem changes, submissions, process launches, and memory writes.
- Record policy version, requested capability, granted scope, decision, and final effect.
- Use the [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html) as a standing threat checklist.[[9]](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
- Follow the [NIST AI Agent Standards Initiative](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative) for emerging security and interoperability work.[[10]](https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative)

## Memory architecture

- Do not call the transcript memory.
- Separate working, episodic, semantic, procedural, and artifact memory.
- Working memory is bounded and optimized for immediate latency.
- Episodic memory stores what happened, when, in which run, and with what outcome.
- Semantic memory stores durable facts and preferences.
- Procedural memory stores approved workflows and skills.
- Artifact memory stores patches, files, logs, screenshots, reports, benchmarks, and tool receipts.
- Every memory stores provenance, source reference, timestamp, confidence, scope, and validity state.
- Support `valid_from`, `valid_until`, `superseded_by`, and contradiction relationships.
- Never silently overwrite contradictory facts.
- Never promote model speculation into semantic memory.
- Separate candidate extraction from committed memory.
- Deduplicate before committing.
- High-impact memories require confirmation.
- Memory must be visible, editable, exportable, and deletable by the user.
- Deletion propagates through indexes, summaries, caches, graph edges, and embeddings.
- Retrieval combines keyword search, vectors, recency, entity matches, source trust, task relevance, and explicit scope.
- Use a small candidate set, reranking, and a strict context budget.
- Retrieval needs a valid “nothing relevant” result.
- Procedural memory is versioned like code and cannot inherit broader permissions than its source run.
- Evaluate recall, precision, contradiction handling, temporal validity, deletion, poisoning, and irrelevant retrieval.

### Memory repositories

- [Mem0](https://github.com/mem0ai/mem0) — general-purpose persistent memory layer.[[11]](https://github.com/mem0ai/mem0)
- [Letta](https://github.com/Letta-AI/Letta) — persistent agent state and memory blocks.[[12]](https://github.com/Letta-AI/Letta)
- [Graphiti](https://github.com/getzep/graphiti) — temporal knowledge-graph memory.[[13]](https://github.com/getzep/graphiti)
- [Agent Memory Techniques](https://github.com/NirDiamant/Agent_Memory_Techniques) — implementation patterns.[[14]](https://github.com/NirDiamant/Agent_Memory_Techniques)
- [Awesome Agent Memory](https://github.com/TeleAI-UAGI/Awesome-Agent-Memory) — broader research and repository index.[[15]](https://github.com/TeleAI-UAGI/Awesome-Agent-Memory)

## Autonomous coding harness

- Give every task its own branch or Git worktree.
- Never allow autonomous changes directly on a protected branch.
- Snapshot the baseline before the first action.
- Persist the task, acceptance criteria, permitted paths, forbidden paths, dependency policy, and verification commands.
- Build a repository map instead of injecting the repository.
- Include symbols, imports, references, tests, build files, dependency edges, and ownership boundaries.
- Prefer AST and language-server information over raw-text guessing.
- Use text search for discovery, AST search for structure, and compiler feedback for truth.
- Make edits transactional and reject stale patches when source hashes changed.
- Keep patch generation separate from patch application.
- Run the smallest relevant verifier after each meaningful edit and the complete verifier before completion.
- Do not allow the agent to weaken tests, thresholds, assertions, lint rules, or security policy.
- Detect skipped tests, unexplained snapshots, suppressed warnings, and dependency smuggling.
- Store verification command, exit code, duration, environment, and logs.
- Detect flaky tests by repetition rather than model judgment.
- Require an ADR for every new dependency or capability expansion.
- Run autonomous code inside an isolated environment with restricted network access.
- Maintain a repair-attempt budget and force replanning after repeated failure.
- Preserve failed attempts so the model cannot cycle through them.

### Coding-agent references

- [OpenHands](https://github.com/OpenHands/openhands) — full software-development agent platform.[[16]](https://github.com/OpenHands/openhands)
- [SWE-agent](https://github.com/princeton-nlp/SWE-agent) — issue-to-patch loops and environment design.[[17]](https://github.com/princeton-nlp/SWE-agent)
- [Aider](https://github.com/Aider-AI/aider) — git-native editing and repository maps.[[18]](https://github.com/Aider-AI/aider)
- [Aider repository map](https://aider.chat/docs/repomap) — compact structural context.[[19]](https://aider.chat/docs/repomap)
- [OpenCode](https://github.com/opencode-ai/opencode) — provider-neutral terminal harness.[[20]](https://github.com/opencode-ai/opencode)
- [Cline](https://github.com/cline/cline) — Plan/Act separation, checkpoints, IDE, CLI, and SDK.[[21]](https://github.com/cline/cline)
- [Goose](https://github.com/block/goose) — extensible local agent runtime.[[22]](https://github.com/block/goose)
- [Awesome CLI Coding Agents](https://github.com/bradagi/awesome-cli-coding-agents) — broad agent and orchestration catalog.[[23]](https://github.com/bradagi/awesome-cli-coding-agents)
- [Awesome Harness Engineering](https://github.com/ai-boost/awesome-harness-engineering) — harness-focused index.[[24]](https://github.com/ai-boost/awesome-harness-engineering)
- [Awesome Agent Harness](https://github.com/RUCAIBox/awesome-agent-harness) — harness research and implementations.[[25]](https://github.com/RUCAIBox/awesome-agent-harness)

## Repository intelligence

- Use [Tree-sitter](https://github.com/topics/tree-sitter) for language-agnostic syntax trees.[[26]](https://github.com/topics/tree-sitter)
- Use [ast-grep](https://github.com/ast-grep/ast-grep) for structural search and rewriting.[[27]](https://github.com/ast-grep/ast-grep)
- Use [Semgrep](https://github.com/semgrep/semgrep) for security rules, semantic policies, and bug-pattern gates.[[28]](https://github.com/semgrep/semgrep)
- Use CodeQL where deeper data-flow and security analysis are needed.
- Store symbol, import, reference, test, and ownership indexes incrementally.
- Invalidate only affected repository-map regions after an edit.

## Sandboxing

- Model-generated code never executes directly on the host by default.
- Use an ephemeral sandbox per task.
- Mount the repository read-write and everything else read-only.
- Deny home directories, browser profiles, SSH keys, cloud credentials, and host sockets.
- Never mount an unrestricted Docker socket into the agent environment.
- Default network policy is deny; allow egress by hostname and purpose.
- Capture filesystem, process, and network effects.
- Destroy the environment after producing artifacts and receipts.
- Record the image digest for reproducibility.

### Sandbox references

- [E2B](https://github.com/e2b-dev/E2B) — disposable agent execution environments.[[29]](https://github.com/e2b-dev/E2B)
- [Daytona](https://github.com/daytonaio/daytona) — secure elastic development workspaces.[[30]](https://github.com/daytonaio/daytona)
- [Agent Sandbox](https://github.com/agent-sandbox/agent-sandbox) — open agent sandbox implementation.[[31]](https://github.com/agent-sandbox/agent-sandbox)
- [Awesome Sandbox](https://github.com/restyler/awesome-sandbox) — sandbox technologies and references.[[32]](https://github.com/restyler/awesome-sandbox)
- [GitHub Agentic Workflows security architecture](https://github.github.com/gh-aw/introduction/architecture/) — isolation, MCP routing, egress, and model-proxy ideas.[[33]](https://github.github.com/gh-aw/introduction/architecture/)

## Multi-agent rules

- Default to one capable agent with tools.
- Add agents only for real parallelism, specialist context, isolation, or independent verification.
- Multi-agent conversation is not a replacement for explicit state.
- Give every subagent an input contract, output schema, tool scope, budget, and completion condition.
- Share typed artifacts through a blackboard rather than one growing transcript.
- The planner does not approve its own destructive plan.
- The implementer is not the only verifier of its implementation.
- The verifier receives the contract, patch, and evidence—not the implementer's narrative.
- Parallel coding agents use independent worktrees.
- Detect overlapping file ownership before execution.
- Merge through a dedicated integration step.
- Never let two agents mutate the same working tree concurrently.
- Stop adding agents when coordination cost exceeds useful parallelism.
- [Awesome Agent Orchestration](https://github.com/vivy-yi/awesome-agent-orchestration) is a useful pattern index.[[34]](https://github.com/vivy-yi/awesome-agent-orchestration)

## Browser and computer control

- Prefer APIs over browser automation.
- Prefer DOM and accessibility trees over screenshots.
- Prefer Windows UI Automation over pixel clicking.
- Use vision only when semantic interfaces are unavailable.
- Every action needs a target description and expected postcondition.
- Revalidate the focused application before keyboard injection.
- Block password and secure-input fields.
- Submitting, purchasing, publishing, sending, deleting, or authenticating requires stronger authorization.
- Preserve before-and-after screenshots for consequential UI actions.
- Re-resolve elements immediately before mutation.
- Treat page content as untrusted data.
- [Browser-use](https://github.com/browser-use/browser-use) is a major semantic browser-agent reference.[[35]](https://github.com/browser-use/browser-use)
- [Stagehand](https://github.com/browserbase/stagehand) is useful for Playwright-based deterministic and agentic browser control.[[36]](https://github.com/browserbase/stagehand)

## Context engineering

- Context is compiled, not accumulated.
- Maintain separate budgets for instructions, task state, repository structure, selected code, memory, tools, observations, and output.
- Drop low-value context before compressing high-value context.
- Preserve exact acceptance criteria, unresolved failures, current state, and policy constraints.
- Summaries distinguish facts, decisions, hypotheses, and rejected approaches.
- Never summarize evidence that must remain exact.
- Keep stable rules in files and load scoped rules only when relevant.
- Hide irrelevant tools.
- Recompile context after major state changes.
- Store the context manifest used for every model call.
- Read [Anthropic's context-engineering guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) for general attention and tool-design principles.[[37]](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Use [Awesome Context Engineering](https://github.com/jihoo-kim/awesome-context-engineering) as a broader index.[[38]](https://github.com/jihoo-kim/awesome-context-engineering)

## Evaluation

- Evaluate complete trajectories, not only final answers.
- Measure success, side effects, policy violations, tool count, repair count, latency, tokens, cost, and human intervention.
- Separate model evaluation from harness evaluation.
- Replay recorded trajectories against new harness versions.
- Use deterministic simulators for email, calendars, filesystems, and destructive actions.
- Inject model timeouts, malformed streams, fragmented tool arguments, crashes, stale state, network loss, full disks, missing credentials, and interrupted approvals.
- Maintain canary tasks from actual FRIDAY usage.
- Benchmark on FRIDAY's real machine and network.
- Track p50, p95, and p99.

### Evaluation references

- [SWE-bench](https://swebench.com/) — software-engineering task outcomes.[[39]](https://swebench.com/)
- [Terminal-Bench](https://www.tbench.ai/) — terminal-agent evaluation.[[40]](https://www.tbench.ai/)
- [Harness-Bench](https://arxiv.org/html/2605.27922v1) — harness effects across models.[[41]](https://arxiv.org/html/2605.27922v1)
- [Claw-SWE-Bench](https://arxiv.org/html/2606.12344) — autonomous coding harnesses.[[42]](https://arxiv.org/html/2606.12344)
- [SWE-Together](https://arxiv.org/html/2606.29957v1) — interactive human-agent coding.[[43]](https://arxiv.org/html/2606.29957v1)
- [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — task and grader design.[[44]](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

## Observability

- Trace model requests, tool calls, policy decisions, memory retrieval, sandbox actions, verification commands, and state transitions.
- Use one trace ID across voice input, inference, tools, UI updates, memory writes, and speech output.
- Record time-to-first-token separately from total generation time.
- Record queue time separately from execution time.
- Track cache hits when exposed.
- Track cost by run, task, capability, and tool round.
- Redact secrets before persistence.
- Log cancellation reasons, why each memory was retrieved, and why each tool was exposed.
- Use OpenTelemetry-compatible spans.
- [Langfuse](https://github.com/langfuse/langfuse) provides open-source tracing, evaluation, prompt tracking, and cost analysis.[[45]](https://github.com/langfuse/langfuse)
- [Arize Phoenix](https://github.com/Arize-AI/phoenix) provides open-source tracing, evaluation, and retrieval analysis.[[46]](https://github.com/Arize-AI/phoenix)

## Model gateway and provider resilience

- Put a model gateway boundary between FRIDAY's agent kernel and DeepSeek.
- Normalize streaming events, tool-call deltas, usage, finish reasons, reasoning metadata, errors, and rate-limit headers.
- Keep provider-specific request and response fields below the gateway.
- Use capability negotiation instead of assuming every model supports the same features.
- Maintain a model-capability registry with context size, structured-output support, tool support, multimodal support, reasoning controls, price, and measured latency.
- Route by task class: conversational, tool selection, extraction, planning, coding, summarization, vision, and verification.
- Routing policy should be deterministic until a measured reason justifies model-based routing.
- Apply circuit breakers per provider and model.
- Track rolling failure rate, p95 time-to-first-token, p95 total latency, malformed-output rate, and tool-call success.
- Degrade explicitly when a capability is unavailable.
- Never silently switch to a model with weaker privacy or tool guarantees.
- Preserve provider request IDs for support and replay.
- Retry only transient failures and keep the same logical request ID.
- Hedged requests require a cancellation rule and must never race side-effecting tool calls.
- Use [LiteLLM](https://github.com/BerriAI/litellm) as a gateway and normalization reference.[[1]](https://github.com/BerriAI/litellm)
- Use [Portkey Gateway](https://github.com/portkey-ai/gateway) as another routing, guardrail, and observability reference.[[2]](https://github.com/portkey-ai/gateway)

## Structured model output

- Every machine-consumed model response needs a versioned schema.
- Validate the complete object before it reaches policy, tools, memory, or UI state.
- Distinguish syntax validation from semantic validation.
- Semantic validation checks identifiers, path scopes, enum values, resource existence, budgets, permissions, and cross-field constraints.
- Unknown schema versions fail closed.
- Store the raw response and validation result for debugging.
- Repair malformed output with a bounded correction loop.
- Do not let repeated schema repair consume the entire run budget.
- Tool-call arguments must be assembled by call index before parsing.
- Partial JSON is display data, not executable data.
- Prefer native constrained output when the provider supports it; otherwise validate and repair outside the model.
- [Instructor](https://github.com/jxnl/instructor) is a strong reference for validated typed model output.[[3]](https://github.com/jxnl/instructor)
- [Outlines](https://github.com/dottxt-ai/outlines) is useful for constrained generation with JSON Schema, regex, and grammars.[[4]](https://github.com/dottxt-ai/outlines)
- [llguidance](https://github.com/guidance-ai/llguidance) is useful for high-performance grammar-constrained generation and Rust integration.[[5]](https://github.com/guidance-ai/llguidance)

## Agent protocols and interoperability

- Keep internal kernel contracts independent from MCP, A2A, and UI protocols.
- MCP is a tool and resource protocol, not FRIDAY's internal permission system.
- A2A is appropriate for communicating with remote or separately deployed agents.
- AG-UI is appropriate for typed agent-to-interface event streams.
- Never map remote capabilities directly into local trusted capabilities.
- Every remote agent receives an identity, trust level, capability scope, rate limit, and audit trail.
- Validate remote artifacts before admitting them to local memory or execution.
- Remote agent completion claims require local verification when they affect local state.
- Protocol version, feature negotiation, and authentication state belong in every session record.
- Use the [A2A protocol](https://github.com/a2aproject/A2A) as the primary agent-interoperability reference.[[6]](https://github.com/a2aproject/A2A)
- Use [A2A samples](https://github.com/a2aproject/a2a-samples) for cross-framework examples.[[7]](https://github.com/a2aproject/a2a-samples)
- Use [AG-UI](https://github.com/ag-ui-protocol/ag-ui) for agent-to-frontend event design.[[8]](https://github.com/ag-ui-protocol/ag-ui)
- Keep the [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol) as the source of truth for tools and resources.[[9]](https://github.com/modelcontextprotocol/modelcontextprotocol)

## Planning, replanning, and execution semantics

- Plans are typed artifacts, not prose hidden in conversation history.
- Every step declares inputs, expected outputs, dependencies, risk, verifier, budget, and allowed tools.
- Steps should express postconditions rather than implementation wishes.
- A plan is immutable after approval; material changes create a new version.
- Replanning records why the prior plan became invalid.
- Distinguish discovery steps, decision steps, mutation steps, and verification steps.
- Parallelize only steps with independent resources and no ordering dependency.
- Use resource locks to prevent conflicting writes.
- Mark observations with freshness and origin.
- Revalidate stale observations before a destructive action.
- Detect loops by normalized state and action signatures, not only round count.
- Keep a taboo set of failed actions and disproven hypotheses for the active run.
- A verifier can reject a step without automatically authorizing the model's proposed repair.
- Recovery policies should select retry, alternate tool, replan, request approval, pause, or fail.
- The harness—not the model—decides which recovery classes are legal.

## Scheduler and background autonomy

- Scheduled work uses durable jobs, not in-process timers.
- Store trigger, timezone, next fire, missed-run policy, concurrency policy, capability scope, and expiration.
- Make timezone and daylight-saving behavior explicit.
- Every automation has an owner and a kill switch.
- Each scheduled run receives a fresh, minimal capability grant.
- Do not inherit broad permissions from the run that created the automation.
- Prevent overlapping executions unless explicitly allowed.
- Use idempotency keys derived from automation ID and scheduled fire time.
- Missed runs must choose skip, catch up once, or replay all; never guess.
- Background work needs stricter cost and outbound-action limits than interactive work.
- Surface queued, running, paused, failed, and completed jobs in the UI.
- Durable engines such as [Temporal's AI agent example](https://github.com/temporal-community/temporal-ai-agent) demonstrate crash-safe loops, approvals, tools, and compaction.[[10]](https://github.com/temporal-community/temporal-ai-agent)
- [Prefect](https://github.com/PrefectHQ/prefect) is a useful alternative reference for retries, caching, orchestration, and observable workflows.[[11]](https://github.com/PrefectHQ/prefect)

## Self-improvement without uncontrolled self-modification

- FRIDAY may propose improvements but should not silently rewrite its kernel, policy, permissions, verifier, or memory rules.
- Separate behavioral learning from executable-code changes.
- Store corrections as candidate rules before promotion.
- Require evidence across multiple examples before generalizing a correction.
- Version prompts, skills, routing policies, memory extractors, and tool descriptions.
- Every promoted change needs a diff, evaluation delta, rollback target, and author.
- Never optimize solely for task success; include side effects, latency, cost, safety, and user corrections.
- Keep holdout evaluations that the optimizer cannot inspect.
- Avoid training on the same traces used to judge improvement.
- A skill learned from one successful trajectory is still untrusted until replayed against variants and failure cases.
- Automatically generated skills begin disabled or constrained.
- Prevent skills from changing their own permission declarations.
- Keep prompt and policy rollbacks instantaneous.
- Record which configuration version produced every run.

## Memory retrieval and embedded data layer

- Maintain separate tables or namespaces for messages, episodes, facts, entities, skills, artifacts, tool receipts, and audit events.
- Keep the authoritative record relational; embeddings are derived indexes.
- Rebuildable indexes should never be the only copy of information.
- Use FTS/BM25 for exact technical terms, filenames, identifiers, commands, and names.
- Use vectors for semantic similarity.
- Use temporal and entity filters before vector ranking where possible.
- Fuse lexical and semantic ranks explicitly.
- Rerank only a small candidate set.
- Store embedding model, dimension, normalization, chunker version, and source hash with every vector.
- Re-embed only changed or invalidated records.
- Detect embedding-model drift before mixing vector spaces.
- Encrypt sensitive memory at rest and keep encryption keys outside the database.
- Backup the authoritative store and verify restore, not merely backup creation.
- [LanceDB](https://github.com/lancedb/lancedb) is a strong embedded retrieval reference with hybrid search.[[12]](https://github.com/lancedb/lancedb)
- [SQLite-Vector](https://github.com/sqliteai/sqlite-vector) is relevant for embedded cross-platform vector search.[[13]](https://github.com/sqliteai/sqlite-vector)
- [SQLite-Memory](https://github.com/sqliteai/sqlite-memory) is useful as a newer offline-first agent-memory reference.[[14]](https://github.com/sqliteai/sqlite-memory)

## Code intelligence beyond repository maps

- Maintain a symbol graph, reference graph, import graph, test-to-code map, and ownership map.
- Associate diagnostics and historical failures with symbols, not only files.
- Resolve “definition,” “references,” “implementations,” and “callers” through language intelligence before broad text search.
- Prefer incremental indexing after a patch.
- Compute the probable test impact of a changed symbol.
- Use commit history to identify unstable or high-risk areas.
- Use blame only as context, never as a quality score.
- Preserve generated-file markers and avoid editing generated files directly.
- Detect repository conventions from configuration, but do not let detected conventions override explicit rules.
- [SCIP](https://github.com/sourcegraph/scip) is a language-agnostic code-intelligence protocol for definitions, references, and implementations.[[15]](https://github.com/sourcegraph/scip)
- [Tree-sitter](https://github.com/topics/tree-sitter) remains the best general syntax-tree substrate for incremental indexing.[[16]](https://github.com/topics/tree-sitter)

## Supply-chain and dependency integrity

- Pin production dependencies and commit lockfiles.
- Record checksums for downloaded models, binaries, and toolchains.
- Treat model files as executable supply-chain inputs.
- Store model license, source URL, version, hash, quantization, and expected input/output signature.
- Refuse startup when critical model assets fail integrity checks.
- Scan new dependencies for known vulnerabilities, license incompatibility, abandonment, and unexpected native code.
- Generate an SBOM for releases.
- Sign release artifacts and update manifests.
- Verify signatures before applying updates.
- Keep build provenance and reproducible build metadata.
- Prevent the coding agent from changing lockfiles unless dependency work is explicitly authorized.
- [cargo-deny](https://github.com/EmbarkStudios/cargo-deny) checks dependency licenses, advisories, bans, and sources.[[17]](https://github.com/EmbarkStudios/cargo-deny)
- [cargo-audit](https://github.com/RustSec/rustsec/tree/main/cargo-audit) checks Rust dependencies against the RustSec advisory database.[[18]](https://github.com/RustSec/rustsec/tree/main/cargo-audit)

## Stronger verification for FRIDAY's Rust core

- Run tests in isolated processes where hangs or crashes are possible.
- Capture per-test duration and quarantine only with a tracked reason and expiry.
- Use deterministic seeds and preserve failing seeds.
- Add property tests for parsers, policy normalization, memory merging, tool schemas, and text normalization.
- Add fuzzing for streaming tool-call assembly, SSE parsing, IPC decoding, path normalization, and untrusted-content fencing.
- Add mutation testing to verify that tests detect meaningful behavioral changes.
- Test cancellation and cleanup after every blocking operation.
- Test process-tree termination on Windows.
- Test lock ordering and contention under simulated concurrency.
- Test database migrations both forward and from real old fixtures.
- Test recovery from truncated logs and interrupted transactions.
- [cargo-nextest](https://github.com/nextest-rs/nextest) is the preferred high-performance Rust test runner reference.[[19]](https://github.com/nextest-rs/nextest)
- [cargo-mutants](https://mutants.rs/) checks whether tests detect injected defects.[[20]](https://mutants.rs/)

## Voice-runtime harness details

- Treat the voice pipeline as a real-time state machine independent from the language-model loop.
- Maintain explicit states for idle, listening, endpointing, acknowledging, thinking, speaking, interrupted, degraded, and error.
- Give every utterance a generation ID so late ASR, model, and TTS events can be discarded safely.
- Never allow stale audio from a cancelled generation to reach playback.
- Separate acoustic endpoint detection from conversational turn policy.
- Backchannels should not always trigger interruption.
- Distinguish an acknowledgement from a stop command.
- Record timestamps at capture, VAD, ASR partial, ASR final, request dispatch, first token, first clause, synthesis start, first sample, and playback end.
- Measure audio-device changes, underruns, overruns, dropped frames, and resampling cost.
- The audio callback allocates nothing, locks nothing, logs nothing, and performs no model inference.
- Use bounded lock-free queues between capture, recognition, synthesis, and playback.
- Apply backpressure instead of unbounded audio buffering.
- Make device loss and device switching recoverable states.
- Keep phrase-bank audio checksummed and loudness-normalized.
- Run barge-in and echo tests against recorded fixtures, not only live demonstrations.
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) supports local streaming ASR, TTS, VAD, keyword spotting, and related speech functions.[[21]](https://github.com/k2-fsa/sherpa-onnx)
- [openWakeWord](https://github.com/dscripka/openWakeWord) is the primary open wake-word reference.[[22]](https://github.com/dscripka/openWakeWord)
- [Silero VAD](https://github.com/snakers4/silero-vad) is the main VAD reference.[[23]](https://github.com/snakers4/silero-vad)
- [CPAL](https://github.com/RustAudio/cpal) is the low-level Rust audio-I/O reference.[[24]](https://github.com/RustAudio/cpal)
- [Rodio](https://github.com/RustAudio/rodio) is the higher-level Rust playback reference.[[25]](https://github.com/RustAudio/rodio)

## Windows and browser control references

- Prefer Windows UI Automation elements with stable properties over screen coordinates.
- Associate every GUI action with the foreground process, window handle, element identity, and expected postcondition.
- Reconfirm focus immediately before typing.
- Detect secure and password fields through accessibility metadata and refuse text injection.
- Use coordinate clicking only as a last resort and require a fresh screenshot.
- Scale coordinates using per-monitor DPI.
- Detect modal dialogs and unexpected focus steals.
- Capture a compact accessibility snapshot for the model rather than the full desktop tree.
- [Playwright](https://github.com/microsoft/playwright) provides isolated browser contexts, auto-waiting, assertions, screenshots, and accessibility-oriented automation.[[26]](https://github.com/microsoft/playwright)
- [pywinauto](https://github.com/pywinauto/pywinauto) is a practical Windows UI Automation reference.[[27]](https://github.com/pywinauto/pywinauto)
- [FlaUI](https://github.com/FlaUI/FlaUI) is a mature .NET UIA reference even if FRIDAY remains Rust-first.[[28]](https://github.com/FlaUI/FlaUI)

## Red-team and evaluation expansion

- Maintain adversarial tests for prompt injection, memory poisoning, tool-description poisoning, malicious repository instructions, and forged approval text.
- Test data exfiltration through URLs, DNS-like strings, outbound messages, filenames, error reports, and model telemetry.
- Test confused-deputy scenarios where trusted tools process attacker-controlled content.
- Test approval replay and argument substitution.
- Test memory deletion followed by retrieval from stale caches.
- Test tool-output truncation that hides a failure marker.
- Test denial-of-wallet loops and intentionally expensive prompts.
- Test path traversal, symlink escapes, junctions, alternate data streams, and Windows device paths.
- Test archive extraction bombs and nested repositories.
- Test malicious images, PDFs, Office documents, and copied terminal output as untrusted data.
- Compare model and harness versions on the same frozen trajectory suite.
- [Promptfoo](https://github.com/promptfoo/promptfoo) supports agent testing, red teaming, and vulnerability scanning.[[29]](https://github.com/promptfoo/promptfoo)
- [DeepEval](https://github.com/confident-ai/deepeval) provides component-level and trace-level evaluation integrated with tests.[[30]](https://github.com/confident-ai/deepeval)

## OpenTelemetry event vocabulary

- Use standard trace, metric, and event conventions before inventing private field names.
- Emit separate spans for agent invocation, model request, tool authorization, tool execution, memory retrieval, sandbox operation, verification, and speech stage.
- Link asynchronous work to the initiating trace rather than forcing one giant parent-child tree.
- Store provider name, requested model, resolved model, token usage, finish reasons, retry count, and cache status.
- Keep prompt and completion content capture opt-in and redacted.
- Record tool schema version and policy version on every call.
- Export to a local collector so observability does not block the runtime.
- The [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) are the best interoperability target for agent telemetry.[[31]](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

## Additional high-value reading

- [Building Effective AI Agents](https://www.anthropic.com/engineering/building-effective-agents) — workflows versus agents, delegation, evaluation, and simplicity.[[32]](https://www.anthropic.com/engineering/building-effective-agents)
- [Writing Effective Tools for AI Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) — tool interfaces, descriptions, and agent usability.[[33]](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [OpenAI practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents) — orchestration, tools, guardrails, and operating patterns.[[34]](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents)
- [OpenAI agent safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety) — tool risk, data boundaries, and guardrails.[[35]](https://developers.openai.com/api/docs/guides/agent-builder-safety)

## Final architectural position

FRIDAY should have a small typed kernel that owns state, durability, policy, permissions, tools, memory, sandboxing, verification, audit, cancellation, recovery, scheduling, protocol boundaries, and telemetry. DeepSeek V4.1 Flash should remain a replaceable reasoning engine inside that kernel—not the operating system itself.