# Changelog

## [0.2.0] - 2026-06-14
### Resilience & Error Handling
- **Retry Logic**: New `readFileWithRetry` utility retries transient I/O errors (EBUSY, EAGAIN, etc.) with exponential backoff.
- **Circuit Breaker**: `NexusConsumer` and `CoverageAnalyzer` now cap file sizes (1MB and 5MB respectively) to prevent OOM.
- **Line Caps**: Markdown and LCOV parsers cap at 10,000 / 50,000 lines to prevent runaway parsing.
- **Atomic Save Cleanup**: `TddStateStore.save()` now cleans up the `.tmp` file on failure.
- **Transient Error Detection**: New `isTransientIoError` distinguishes retryable I/O errors from logic errors.
- **Output Truncation**: `lastRunOutput` truncated to 500 chars to prevent state.json bloat.
- **ENOTDIR-safe**: `findCoverageReport` catches stat errors gracefully.
- **Test Suite**: Expanded to 40 tests across 5 suites (added `resilience.test.ts`).

## [0.1.0] - 2026-06-14
### Initial Release
- **Test Generator**: Parses TypeScript/JavaScript function signatures and generates minimal failing Jest tests.
- **TDD State Tracker**: Persists RED/GREEN/REFACTOR state to `~/.pi/test-oracle/state.json`.
- **Coverage Analyzer**: Parses Jest JSON and LCOV coverage reports; finds gaps below threshold.
- **Nexus Consumer**: Reads `pi-audit-master` reports and generates prioritized test suggestions.
- **Slash Commands**: `/test-oracle status` and `/test-oracle coverage`.
- **Tools**: `test_oracle_generate`, `test_oracle_status`, `test_oracle_coverage`, `test_oracle_from_audit`.
- **Test Suite**: 25 tests across 4 test files.
