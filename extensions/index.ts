/**
 * pi-test-oracle
 * Automated TDD oracle for the Pi coding agent.
 * Generates minimal failing tests (RED), tracks state to GREEN, suggests refactors.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TestGenerator } from "./generator";
import { TddStateStore } from "./state";
import { CoverageAnalyzer } from "./coverage";
import { NexusConsumer } from "./nexus";

export default async function piTestOracle(pi: ExtensionAPI) {
	const generator = new TestGenerator();
	const store = new TddStateStore();
	const coverage = new CoverageAnalyzer();
	const nexus = new NexusConsumer();

	// ============ Tool: Update State ============
	pi.registerTool({
		name: "test_oracle_update",
		description:
			"Update TDD states from test output. Pass the stdout/stderr from a test run.",
		parameters: {
			type: "object",
			properties: {
				output: { type: "string", description: "The test output to parse" },
			},
			required: ["output"],
		},
		handler: async (_ctx: any, args: any) => {
			const result = store.updateFromOutput(args.output);
			return {
				message: `Updated ${result.updated} tests: ${result.passed} passed, ${result.failed} failed.`,
				updated: result.updated,
				passed: result.passed,
				failed: result.failed,
			};
		},
	});

	// ============ Tool: Run Tests ============
	pi.registerTool({
		name: "test_oracle_run",
		description: "Run the project tests and automatically update TDD states.",
		parameters: {
			type: "object",
			properties: {
				command: {
					type: "string",
					description: "The test command to run (default: 'npm test')",
				},
			},
		},
		handler: async (_ctx: any, args: any) => {
			const cmd = args.command || "npm test";
			try {
				const { stdout, stderr } = await pi.bash({ command: cmd });
				const output = stdout + "\n" + stderr;
				const updateResult = store.updateFromOutput(output);
				return {
					message: `Tests executed. ${updateResult.updated} tests updated.`,
					output: output,
					update: updateResult,
				};
			} catch (err: any) {
				return { error: `Test execution failed: ${err.message}` };
			}
		},
	});

	// ============ Tool: Generate Test ============
	pi.registerTool({
		name: "test_oracle_generate",
		description:
			"Generate a minimal failing test (RED) for a given function signature. Returns the test file content and records the test in RED state.",
		parameters: {
			type: "object",
			properties: {
				signature: {
					type: "string",
					description: "The function signature to generate a test for",
				},
				importPath: {
					type: "string",
					description:
						"The module path to import the function from (e.g., '../src/auth')",
				},
				symbolName: {
					type: "string",
					description: "Optional: override the symbol name",
				},
				testFilePath: {
					type: "string",
					description: "Optional: override the test file path",
				},
			},
			required: ["signature", "importPath"],
		},
		handler: async (_ctx: any, args: any) => {
			try {
				const generated = generator.generateTest(
					args.signature,
					args.importPath,
					{
						symbolName: args.symbolName,
						testFilePath: args.testFilePath,
					},
				);
				if (!generated) {
					return { error: "Failed to parse the function signature" };
				}
				// Record the test in RED state
				store.recordTest(generated.filePath, generated.symbol);
				return {
					filePath: generated.filePath,
					content: generated.content,
					symbol: generated.symbol,
					state: "RED",
					message: `Generated failing test for ${generated.symbol}. Save to ${generated.filePath} and run jest to verify RED state.`,
				};
			} catch (err: any) {
				return { error: err.message };
			}
		},
	});

	// ============ Tool: Status ============
	pi.registerTool({
		name: "test_oracle_status",
		description:
			"List all tracked tests and their TDD states (RED, GREEN, REFACTOR).",
		parameters: {
			type: "object",
			properties: {
				state: {
					type: "string",
					enum: ["RED", "GREEN", "REFACTOR", "UNKNOWN"],
				},
			},
		},
		handler: async (_ctx: any, args: any) => {
			const tests = args.state ? store.getByState(args.state) : store.getAll();
			return {
				total: tests.length,
				tests: tests.map((t) => ({
					path: t.path,
					symbol: t.symbol,
					state: t.state,
					createdAt: t.createdAt,
					lastRunAt: t.lastRunAt,
					lastRunOutput: t.lastRunOutput,
				})),
			};
		},
	});

	// ============ Tool: Coverage ============
	pi.registerTool({
		name: "test_oracle_coverage",
		description:
			"Find code coverage gaps below a threshold and recommend files that need tests.",
		parameters: {
			type: "object",
			properties: {
				threshold: {
					type: "number",
					description: "Coverage percentage threshold (default 80)",
				},
			},
		},
		handler: async (_ctx: any, args: any) => {
			const threshold = args.threshold || 80;
			const reportPath = coverage.findCoverageReport();
			if (!reportPath) {
				return {
					error: "No coverage report found. Run `npx jest --coverage` first.",
				};
			}
			const gaps = reportPath.endsWith(".json")
				? coverage.parseJsonCoverage(reportPath)
				: coverage.parseLcovCoverage(reportPath);
			const belowThreshold = coverage.getGaps(gaps, threshold);
			return {
				threshold,
				totalFiles: gaps.length,
				filesBelowThreshold: belowThreshold.length,
				gaps: belowThreshold.slice(0, 20),
			};
		},
	});

	// ============ Tool: From Audit ============
	pi.registerTool({
		name: "test_oracle_from_audit",
		description:
			"Read the latest pi-audit-master report and generate prioritized test suggestions for each finding.",
		parameters: { type: "object", properties: {} },
		handler: async (_ctx: any, _args: any) => {
			const findings = nexus.readLatestAuditReport();
			if (findings.length === 0) {
				return {
					message: "No audit findings found. Run pi-audit-master first.",
					suggestions: [],
				};
			}
			const suggestions = nexus.prioritize(findings);
			return {
				total: suggestions.length,
				suggestions: suggestions.slice(0, 10),
			};
		},
	});

	// ============ Slash Command: /test-oracle generate ============
	const piAny = pi as any;
	if (typeof piAny.registerCommand === "function") {
		piAny.registerCommand("test-oracle", {
			description:
				"Test oracle commands: generate, status, coverage, from-audit",
			handler: async (args: any, ctx: any) => {
				const argStr = typeof args === "string" ? args.trim() : "";
				const [subcommand] = argStr.split(/\s+/);

				switch (subcommand?.toLowerCase()) {
					case "status": {
						const tests = store.getAll();
						const red = tests.filter((t) => t.state === "RED").length;
						const green = tests.filter((t) => t.state === "GREEN").length;
						const refactor = tests.filter((t) => t.state === "REFACTOR").length;
						ctx.ui.notify(
							`TDD Status: ${red} RED, ${green} GREEN, ${refactor} REFACTOR, ${tests.length} total`,
							"info",
						);
						return;
					}
					case "coverage": {
						const reportPath = coverage.findCoverageReport();
						if (!reportPath) {
							ctx.ui.notify(
								"No coverage report found. Run `npx jest --coverage` first.",
								"warning",
							);
							return;
						}
						const gaps = reportPath.endsWith(".json")
							? coverage.parseJsonCoverage(reportPath)
							: coverage.parseLcovCoverage(reportPath);
						const below = coverage.getGaps(gaps, 80);
						ctx.ui.notify(
							`Coverage gaps: ${below.length} of ${gaps.length} files below 80%`,
							below.length > 0 ? "warning" : "success",
						);
						return;
					}
					default: {
						ctx.ui.notify(
							`pi-test-oracle commands: status, coverage, from-audit, update, run. Or use the test_oracle_generate tool.`,
							"info",
						);
					}
				}
			},
		});
	}

	console.log(
		"[pi-test-oracle] Loaded. Tools: test_oracle_generate, test_oracle_status, test_oracle_coverage, test_oracle_from_audit, test_oracle_update, test_oracle_run",
	);
}
