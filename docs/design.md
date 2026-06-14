# Design: pi-test-oracle

## Implementation Specification

### 1. Module Architecture

```
extensions/
├── index.ts          # Entry point: async factory, commands, tools
├── generator.ts      # TestGenerator class: signature -> test file
├── state.ts          # TddStateStore class: persistence to state.json
├── coverage.ts       # CoverageAnalyzer class: parse Jest output
├── nexus.ts          # NexusConsumer class: read audit-master reports
├── templates.ts      # Jest test file template
└── types.ts          # Shared TypeScript interfaces
```

### 2. Data Model

```typescript
// types.ts
export type TddState = "RED" | "GREEN" | "REFACTOR" | "UNKNOWN";

export interface TestRecord {
  path: string;              // e.g., "tests/auth.test.ts"
  symbol: string;            // e.g., "validateToken"
  state: TddState;
  createdAt: number;
  lastRunAt: number | null;
  lastRunOutput: string;     // Truncated Jest output
  history: Array<{ state: TddState; at: number }>;
}

export interface TddStateFile {
  version: 1;
  tests: Record<string, TestRecord>;
}
```

### 3. TestGenerator Algorithm

**Input:** A function signature string like `function validateToken(token: string): boolean`

**Step 1: Parse signature**
- Use regex to extract: `name`, `params[]`, `returnType`.
- Fallback: If parse fails, return a "best-effort" test with a single `expect(true).toBe(false)` placeholder.

**Step 2: Generate inputs per parameter**
For each parameter, apply heuristics based on its type:
| Type | Generated Inputs |
|---|---|
| `string` | `""`, `" "`, `"a"`, `"x".repeat(1000)`, unicode |
| `number` | `0`, `-1`, `1`, `Number.MAX_SAFE_INTEGER` |
| `boolean` | `true`, `false` |
| `T[]` (array) | `[]`, `[null]`, `Array(100).fill(0)` |
| `object` | `{}`, `{ key: "value" }` |
| `T \| null` | `null`, sample of T |
| `unknown` | `null`, `undefined`, `0`, `""` |

**Step 3: Construct the test file**
```typescript
import { validateToken } from "<import-path>";

describe("validateToken", () => {
  test("returns true for valid token", () => {
    expect(validateToken("valid-token-string")).toBe(true);
  });
  test("returns false for empty string", () => {
    expect(validateToken("")).toBe(false);
  });
  // ... more generated cases
});
```

The test is intentionally RED: it asserts behavior that the (presumably missing or broken) implementation doesn't have.

### 4. State Store API

```typescript
class TddStateStore {
  load(): TddStateFile;                  // Read state.json, rebuild if missing
  save(state: TddStateFile): void;       // Write atomically (write to .tmp, rename)
  recordTest(path: string, symbol: string): TestRecord;
  updateState(path: string, newState: TddState, output: string): void;
  getAll(): TestRecord[];
  getByState(state: TddState): TestRecord[];
}
```

### 5. Coverage Analyzer

```typescript
class CoverageAnalyzer {
  // Parse coverage-summary.json (lcov or json format)
  parseLcov(content: string): CoverageReport;
  parseJson(content: string): CoverageReport;
  getGaps(report: CoverageReport, threshold: number = 80): Gap[];
}
```

### 6. Nexus Consumer

```typescript
class NexusConsumer {
  // Read the latest audit report from ~/.pi/audit-master/audit-report.md
  readLatestAuditReport(): AuditFinding[];
  // Read impact-analyzer output if available
  readImpactReport(path: string): ImpactResult[];
  // Cross-reference and return prioritized test suggestions
  prioritize(audit: AuditFinding[], impact: ImpactResult[]): TestSuggestion[];
}
```

### 7. Tool & Command Spec

**Tools (for agent):**
- `test_oracle_generate({ symbol: string, file: string, importPath: string })`
- `test_oracle_status({ state?: TddState })`
- `test_oracle_coverage({ path?: string, threshold?: number })`
- `test_oracle_from_audit()`

**Commands (for user TUI):**
- `/test-oracle generate <symbol>` 
- `/test-oracle status`
- `/test-oracle coverage`
- `/test-oracle from-audit`

### 8. Test Runner Integration

After generating a test, the extension can optionally run `npx jest <test-path>` and parse the output to determine if the test is RED (failure) or GREEN (success). Output is truncated to 500 chars for storage.

### 9. Error Handling

- All file I/O wrapped in try/catch.
- If state.json is corrupted, log a warning and rebuild from scratch.
- If signature parsing fails, return a placeholder test with a TODO comment.
- If audit-master report doesn't exist, return an empty list (don't crash).

### 10. Configuration

Read from `~/.pi/test-oracle/config.json` (optional):
```json
{
  "testFramework": "jest",  // or "vitest"
  "coverageThreshold": 80,
  "autoRunTests": false     // auto-run jest after generating a test
}
```
