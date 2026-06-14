# Proposal: pi-test-oracle

## Automated TDD Oracle for Pi

### 1. Overview
pi-test-oracle is a Pi extension that automates the **RED-GREEN-REFACTOR** cycle of Test-Driven Development. Given a function signature and a description of expected behavior (or a bug report), it generates the **Minimal Failing Test** that proves the code is broken or the feature is missing. It then tracks the test's state as the agent implements a fix, transitioning from RED to GREEN.

This is the **proof generator** of the Nexus monorepo. Where pi-audit-master finds bugs and pi-impact-analyzer maps their blast radius, pi-test-oracle turns those findings into executable, runnable tests that validate the fix.

### 2. Core Objectives
- **RED Generator**: Produce the minimal Jest/Vitest test that fails for the right reason.
- **TDD State Tracker**: Persist the state of each test (RED -> GREEN -> REFACTOR) in `~/.pi/test-oracle/state.json`.
- **Property-Based Suggestions**: Infer invariants from function signatures and suggest property tests.
- **Coverage Gap Analysis**: Identify untested branches and recommend tests.
- **Nexus Integration**: Consume pi-audit-master reports and pi-impact-analyzer output to prioritize test generation.

### 3. Technical Architecture

#### A. Test Generator Engine
- Parses function signatures using a lightweight regex/AST-free approach (zero-dependency).
- Generates test inputs based on heuristics:
  - **Primitives**: null, undefined, 0, "", false, boundaries.
  - **Arrays**: [], [item], large arrays.
  - **Objects**: {}, populated fixtures.
  - **Strings**: empty, whitespace, unicode, very long.
- Constructs the test file using a string template.

#### B. TDD State Store
- JSON file at `~/.pi/test-oracle/state.json`.
- Schema: `{ tests: { [testPath]: { status: "RED" | "GREEN" | "REFACTOR", createdAt, lastRunAt, history: [...] } } }`
- Updated after each `npm test` run (parsed from Jest output).

#### C. Coverage Analyzer
- Parses Jest's `coverage-summary.json` (if available).
- Identifies files with < 80% coverage.
- Suggests functions that need tests.

#### D. Nexus Consumer
- Reads pi-audit-master markdown reports for bug findings.
- Reads pi-impact-analyzer JSON output for affected symbols.
- Cross-references: "Bug found in X by audit-master -> Generate test for X."

### 4. User Experience

#### Slash Commands
- `/test-oracle generate <symbol>` - Generate a failing test for the given function/class.
- `/test-oracle status` - List all tracked tests and their states.
- `/test-oracle coverage` - Show coverage gaps and recommended tests.
- `/test-oracle from-audit` - Read the latest pi-audit-master report and generate tests for each finding.

#### Tool Registration
- Registered as a tool so the agent can call it programmatically: test_oracle_generate, test_oracle_status, test_oracle_coverage.

### 5. Success Criteria
- [ ] `npm run build` succeeds.
- [ ] `npm test` passes (at least 5 tests).
- [ ] `/test-oracle generate` produces a syntactically valid Jest test file.
- [ ] Generated test fails when run against a buggy implementation.
- [ ] State persists across sessions.
- [ ] `/test-oracle status` correctly reports RED/GREEN/REFACTOR.
- [ ] Coverage analyzer correctly parses Jest output.
- [ ] Reads pi-audit-master reports without crashing.

### 6. Non-Goals
- No AI/LLM integration (purely heuristic to keep it fast and zero-dep).
- No property-based testing library integration.
- No test runner replacement (uses Jest/Vitest's existing CLI).

### 7. Risks
- **AST-less parsing**: Function signatures with complex generics may be hard to parse. Mitigation: Use a robust regex with fallbacks.
- **Test framework lock-in**: We assume Jest. Mitigation: Make the template configurable.
- **State corruption**: If state.json is corrupted, the extension should rebuild from scratch gracefully.
