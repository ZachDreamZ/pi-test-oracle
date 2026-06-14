# Changelog

## [0.1.0] - 2026-06-14
### Initial Release
- **Test Generator**: Parses TypeScript/JavaScript function signatures and generates minimal failing Jest tests.
- **TDD State Tracker**: Persists RED/GREEN/REFACTOR state to `~/.pi/test-oracle/state.json`.
- **Coverage Analyzer**: Parses Jest JSON and LCOV coverage reports; finds gaps below threshold.
- **Nexus Consumer**: Reads `pi-audit-master` reports and generates prioritized test suggestions.
- **Slash Commands**: `/test-oracle status` and `/test-oracle coverage`.
- **Tools**: `test_oracle_generate`, `test_oracle_status`, `test_oracle_coverage`, `test_oracle_from_audit`.
- **Test Suite**: 25 tests across 4 test files.
