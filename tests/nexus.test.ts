import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "path";
import { NexusConsumer } from "../dist/nexus";

describe("NexusConsumer", () => {
	const TMP = path.join(os.tmpdir(), `pi-test-oracle-nexus-${Date.now()}`);
	let consumer: NexusConsumer;

	beforeAll(() => {
		fs.mkdirSync(TMP, { recursive: true });
	});

	afterAll(() => {
		fs.rmSync(TMP, { recursive: true, force: true });
	});

	beforeEach(() => {
		// Pass a non-existent path so readLatestAuditReport returns [] by default
		consumer = new NexusConsumer(path.join(TMP, "nonexistent.md"));
	});

	test("returns empty when no audit report exists", () => {
		const findings = consumer.readLatestAuditReport();
		expect(findings).toEqual([]);
	});

	test("parses a markdown audit report", () => {
		const reportPath = path.join(TMP, "audit-report.md");
		const md = `# Audit Report

| ID | File | Line | Severity | Description |
|----|------|------|----------|-------------|
| F1 | src/auth.ts | 42 | CRITICAL | function validateToken always returns true |
| F2 | src/db.ts | 15 | HIGH | class Database leaks connection on error |
| F3 | src/utils.ts | 8 | LOW | function noop is unused |
`;
		fs.writeFileSync(reportPath, md);
		consumer = new NexusConsumer(reportPath);

		const findings = consumer.readLatestAuditReport();
		expect(findings).toHaveLength(2);
		expect(findings[0].severity).toBe("CRITICAL");
		expect(findings[1].severity).toBe("HIGH");
	});

	test("prioritizes CRITICAL over HIGH", () => {
		const suggestions = consumer.prioritize([
			{ id: "1", file: "a.ts", line: 1, severity: "HIGH", description: "high bug" },
			{ id: "2", file: "b.ts", line: 1, severity: "CRITICAL", description: "critical bug" },
		]);
		expect(suggestions[0].priority).toBe(10);
		expect(suggestions[1].priority).toBe(5);
	});
});
