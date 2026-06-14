import { retry, isTransientIoError, readFileWithLimit, readFileWithRetry } from "../dist/util";
import { TddStateStore } from "../dist/state";
import { NexusConsumer } from "../dist/nexus";
import { CoverageAnalyzer } from "../dist/coverage";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "path";

describe("Resilience features", () => {
	describe("retry()", () => {
		test("returns result on first success", async () => {
			let calls = 0;
			const result = await retry(async () => {
				calls++;
				return "ok";
			});
			expect(result).toBe("ok");
			expect(calls).toBe(1);
		});

		test("retries on failure then succeeds", async () => {
			let calls = 0;
			const result = await retry(
				async () => {
					calls++;
					if (calls < 3) throw new Error("transient");
					return "ok";
				},
				3,
				1,
			);
			expect(result).toBe("ok");
			expect(calls).toBe(3);
		});

		test("throws after max retries", async () => {
			let calls = 0;
			await expect(
				retry(
					async () => {
						calls++;
						throw new Error("always fails");
					},
					2,
					1,
				),
			).rejects.toThrow("always fails");
			expect(calls).toBe(3); // initial + 2 retries
		});

		test("handles sync operations too", async () => {
			let calls = 0;
			const result = await retry(
				() => {
					calls++;
					return calls * 2;
				},
				2,
				1,
			);
			expect(result).toBe(2);
		});
	});

	describe("isTransientIoError()", () => {
		test("returns true for EBUSY", () => {
			const err = Object.assign(new Error("busy"), { code: "EBUSY" });
			expect(isTransientIoError(err)).toBe(true);
		});

		test("returns true for EAGAIN", () => {
			const err = Object.assign(new Error("again"), { code: "EAGAIN" });
			expect(isTransientIoError(err)).toBe(true);
		});

		test("returns false for ENOENT", () => {
			const err = Object.assign(new Error("not found"), { code: "ENOENT" });
			expect(isTransientIoError(err)).toBe(false);
		});

		test("returns false for TypeError", () => {
			expect(isTransientIoError(new TypeError("bad"))).toBe(false);
		});
	});

	describe("readFileWithLimit()", () => {
		const TMP = path.join(os.tmpdir(), `pi-test-oracle-resil-${Date.now()}`);

		beforeAll(() => {
			fs.mkdirSync(TMP, { recursive: true });
		});

		afterAll(() => {
			fs.rmSync(TMP, { recursive: true, force: true });
		});

		test("returns content for small file", () => {
			const p = path.join(TMP, "small.txt");
			fs.writeFileSync(p, "hello");
			expect(readFileWithLimit(p, 100)).toBe("hello");
		});

		test("returns null for file exceeding limit", () => {
			const p = path.join(TMP, "large.txt");
			fs.writeFileSync(p, "x".repeat(200));
			expect(readFileWithLimit(p, 100)).toBeNull();
		});

		test("returns null for missing file", () => {
			expect(readFileWithLimit(path.join(TMP, "missing.txt"))).toBeNull();
		});
	});

	describe("readFileWithRetry()", () => {
		const TMP = path.join(os.tmpdir(), `pi-test-oracle-retry-${Date.now()}`);

		beforeAll(() => {
			fs.mkdirSync(TMP, { recursive: true });
		});

		afterAll(() => {
			fs.rmSync(TMP, { recursive: true, force: true });
		});

		test("returns content for existing file", () => {
			const p = path.join(TMP, "exists.txt");
			fs.writeFileSync(p, "content");
			expect(readFileWithRetry(p)).toBe("content");
		});

		test("returns null for missing file (non-transient ENOENT)", () => {
			expect(readFileWithRetry(path.join(TMP, "missing.txt"))).toBeNull();
		});
	});

	describe("NexusConsumer size limit", () => {
		const TMP = path.join(os.tmpdir(), `pi-test-oracle-nexus-resil-${Date.now()}`);

		beforeAll(() => {
			fs.mkdirSync(TMP, { recursive: true });
		});

		afterAll(() => {
			fs.rmSync(TMP, { recursive: true, force: true });
		});

		test("returns empty array for oversized audit report", () => {
			const p = path.join(TMP, "audit-report.md");
			// Write a file larger than 1MB
			fs.writeFileSync(p, "| ID | File | Line | Severity | Description |\n" + "| F1 | a.ts | 1 | CRITICAL | " + "x".repeat(2_000_000) + " |");
			const consumer = new NexusConsumer(p);
			const findings = consumer.readLatestAuditReport();
			expect(findings).toEqual([]);
		});
	});

	describe("CoverageAnalyzer size limit", () => {
		const TMP = path.join(os.tmpdir(), `pi-test-oracle-cov-resil-${Date.now()}`);

		beforeAll(() => {
			fs.mkdirSync(TMP, { recursive: true });
			fs.mkdirSync(path.join(TMP, "coverage"), { recursive: true });
		});

		afterAll(() => {
			fs.rmSync(TMP, { recursive: true, force: true });
		});

		test("returns null for oversized coverage report", () => {
			const p = path.join(TMP, "coverage", "coverage-summary.json");
			fs.writeFileSync(p, JSON.stringify({ "src/a.ts": { lines: { covered: 0, total: 0, pct: 0 } } }).padEnd(10_000_000, " "));
			const analyzer = new CoverageAnalyzer();
			expect(analyzer.findCoverageReport(TMP)).toBeNull();
		});
	});
});
