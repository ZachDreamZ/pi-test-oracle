# pi-test-oracle

Automated TDD oracle for the Pi coding agent. Generates minimal failing tests (RED), tracks state to GREEN, and suggests refactors.

## Installation

```bash
pi install npm:pi-test-oracle
```

## What It Does

`pi-test-oracle` is the **proof generator** of the Nexus monorepo. Where `pi-audit-master` finds bugs and `pi-impact-analyzer` maps their blast radius, `pi-test-oracle` turns those findings into executable, runnable tests that validate the fix.

It automates the **RED-GREEN-REFACTOR** cycle:

1.  **RED**: Given a function signature and expected behavior, generate a Jest test that fails because the feature is missing or broken.
2.  **GREEN**: Track when the test passes (after the agent implements a fix).
3.  **REFACTOR**: Suggest improvements once the test is stable.

## Slash Commands

- `/test-oracle status` - Show RED / GREEN / REFACTOR counts for all tracked tests.
- `/test-oracle coverage` - Find files with coverage below 80% (requires `npx jest --coverage` first).

## Tools (for the Pi agent)

- `test_oracle_generate({ signature, importPath, symbolName?, testFilePath? })` - Generate a minimal failing test.
- `test_oracle_status({ state? })` - List tracked tests, optionally filtered by state.
- `test_oracle_coverage({ threshold? })` - Find coverage gaps.
- `test_oracle_from_audit()` - Read the latest `pi-audit-master` report and suggest tests for each finding.

## Usage Example

Ask the agent:

> "Generate a failing test for the `validateToken` function in `src/auth.ts`."

The agent will call `test_oracle_generate` and produce a test file like `tests/validateToken.test.ts`:

```typescript
import { validateToken } from "../src/auth";

describe("validateToken", () => {
  test("handles basic input", () => {
    const result = validateToken("valid-token-string");
    expect(result).toBeDefined();
  });

  test("handles token = \"\"", () => {
    const result = validateToken("");
    expect(result).toBeDefined();
  });

  // ... more generated cases
});
```

The test is saved, recorded in RED state, and the agent can now implement the feature to make it GREEN.

## Integration with Nexus

- **pi-audit-master**: `/test-oracle from-audit` reads the latest audit report and generates test suggestions for each HIGH/CRITICAL finding.
- **pi-impact-analyzer**: Future enhancement to generate tests for affected symbols.
- **pi-secret-sentinel**: Generated test files are checked to ensure they don't contain real secrets.

## State Storage

Test state is persisted to `~/.pi/test-oracle/state.json`:

```json
{
  "version": 1,
  "tests": {
    "tests/auth.test.ts": {
      "path": "tests/auth.test.ts",
      "symbol": "validateToken",
      "state": "RED",
      "createdAt": 1718380000000,
      "lastRunAt": null,
      "lastRunOutput": "",
      "history": [{ "state": "RED", "at": 1718380000000 }]
    }
  }
}
```

## Configuration

Optional `~/.pi/test-oracle/config.json`:

```json
{
  "testFramework": "jest",
  "coverageThreshold": 80,
  "autoRunTests": false
}
```

## Architecture

- `extensions/generator.ts` - Parses function signatures and generates test files.
- `extensions/state.ts` - Persists TDD state to `state.json`.
- `extensions/coverage.ts` - Parses Jest coverage reports.
- `extensions/nexus.ts` - Reads `pi-audit-master` outputs.
- `extensions/index.ts` - Extension entry point with commands and tools.

## License

MIT
