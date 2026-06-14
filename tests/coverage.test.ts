import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "path";
import { CoverageAnalyzer } from "../dist/coverage";

describe("CoverageAnalyzer", () => {
	const analyzer = new CoverageAnalyzer();
	const TMP = path.join(os.tmpdir(), `pi-test-oracle-cov-${Date.now()}`);

	beforeAll(() => {
		fs.mkdirSync(TMP, { recursive: true });
	});

	afterAll(() => {
		fs.rmSync(TMP, { recursive: true, force: true });
	});

	test("parses Jest JSON coverage", () => {
		const report = {
			"src/foo.ts": {
				lines: { covered: 8, total: 10, pct: 80 },
				branches: { covered: 2, total: 4, pct: 50 },
				functions: { covered: 1, total: 2, pct: 50 },
			},
			"src/bar.ts": {
				lines: { covered: 10, total: 10, pct: 100 },
				branches: { covered: 4, total: 4, pct: 100 },
				functions: { covered: 2, total: 2, pct: 100 },
			},
			total: { lines: { covered: 18, total: 20, pct: 90 } },
		};
		const reportPath = path.join(TMP, "coverage-summary.json");
		fs.writeFileSync(reportPath, JSON.stringify(report));

		// Pass the path directly to avoid cwd mocking
		const gaps = analyzer.parseJsonCoverage(reportPath);
		expect(gaps).toHaveLength(2);
		const foo = gaps.find((g) => g.file === "src/foo.ts");
		expect(foo?.lines.pct).toBe(80);
		expect(foo?.branches.pct).toBe(50);
	});

	test("filters gaps below threshold", () => {
		const gaps = [
			{
				file: "good.ts",
				lines: { covered: 100, total: 100, pct: 100 },
				branches: { covered: 0, total: 0, pct: 100 },
				functions: { covered: 0, total: 0, pct: 100 },
			},
			{
				file: "bad.ts",
				lines: { covered: 5, total: 10, pct: 50 },
				branches: { covered: 0, total: 0, pct: 100 },
				functions: { covered: 0, total: 0, pct: 100 },
			},
		];
		const below = analyzer.getGaps(gaps, 80);
		expect(below).toHaveLength(1);
		expect(below[0].file).toBe("bad.ts");
	});

	test("findCoverageReport returns null when no report exists", () => {
		// Use a fresh temp dir that we know has no coverage
		const emptyDir = path.join(os.tmpdir(), `pi-test-oracle-empty-${Date.now()}`);
		fs.mkdirSync(emptyDir, { recursive: true });
		const found = analyzer.findCoverageReport(emptyDir);
		expect(found).toBeNull();
		fs.rmSync(emptyDir, { recursive: true, force: true });
	});

	test("parses LCOV format", () => {
		const lcov = `TN:
SF:src/foo.ts
LF:10
LH:8
BRF:4
BRH:2
FNF:2
FNH:1
end_of_record
`;
		const reportPath = path.join(TMP, "lcov.info");
		fs.writeFileSync(reportPath, lcov);
		const gaps = analyzer.parseLcovCoverage(reportPath);
		expect(gaps).toHaveLength(1);
		expect(gaps[0].file).toBe("src/foo.ts");
		expect(gaps[0].lines.pct).toBe(80);
		expect(gaps[0].branches.pct).toBe(50);
	});
});
