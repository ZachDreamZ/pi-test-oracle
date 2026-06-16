# pi-test-oracle Fix Plan

## Phase 1: Critical Infrastructure (TDD Closed-Loop)

- **[C1] Implement `test_oracle_update` tool**:
  - Parse Jest/Mocha output to identify passing/failing tests.
  - Update `TddStateStore` automatically.
- **[C2] Implement `test_oracle_run` tool**:
  - Execute test command (e.g., `npm test`).
  - Capture output and pipe to `test_oracle_update`.

## Phase 2: Generator Enhancements (High Priority)

- **[H1] Advanced Type Support**:
  - Implement recursive type resolution for objects and generics.
  - Add support for `Intersection` and `Union` types.
- **[H2] Intelligent Test Prioritization**:
  - Implement a scoring system for input types.
  - prioritize edge cases (null, undefined, empty) over common cases.
- **[H4] Signature Token Management**:
  - Add length limits to input signatures.
  - Implement truncation for extremely large signatures.

## Phase 3: Stability & Performance (Medium Priority)

- **[H3] Performance Benchmarking**:
  - Create `perf-test.ts` to measure generation and parsing speed.
- **[M1] State Store Utility**:
  - Use `lastRunOutput` in `/test-oracle status` to show failure reasons.
- **[M3] Robust Coverage Parsing**:
  - Add try-catch blocks and validation to `parseLcovCoverage`.
- **[M4] Logging System**:
  - Replace `console.warn` with a structured `Logger` utility.
- **[M5] Input Sanitization**:
  - Add input validation and length limits to `parseSignature`.
- **[M6] State Persistence Backup**:
  - Implement a simple `.bak` rotation for `state.json`.

## Phase 4: Polish & Professionalization (Low Priority)

- **[M2] JSDoc Documentation**: Add detailed docs to all public methods.
- **[L1] Code Formatting**: Standardize style across the package.
- **[L3] Import Optimization**: Use `import type` where applicable.
- **[L4] CI/CD Setup**: Add GitHub Actions for automated tests.

---

## Verification Plan

1. **Functional**: Run `test_oracle_run` $\to$ verify `test_oracle_status` shows GREEN.
2. **Performance**: Run `perf-test.ts` and verify latency is within limits.
3. **Coverage**: Run `test_oracle_coverage` $\to$ verify gaps are correctly identified.
4. **Resilience**: Test with malformed signatures and corrupt coverage reports.
