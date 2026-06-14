// NexusConsumer: Reads outputs from other Nexus packages.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AuditFinding, TestSuggestion } from "./types";

export class NexusConsumer {
	private auditReportPath: string;

	constructor(auditReportPath?: string) {
		// Default path: pi-audit-master writes to ~/.pi/audit-master/audit-report.md
		this.auditReportPath = auditReportPath || path.join(os.homedir(), ".pi", "audit-master", "audit-report.md");
	}

	/**
	 * Read the latest pi-audit-master report and extract findings.
	 */
	public readLatestAuditReport(): AuditFinding[] {
		try {
			if (!fs.existsSync(this.auditReportPath)) {
				return [];
			}
			const content = fs.readFileSync(this.auditReportPath, "utf8");
			return this.parseAuditMarkdown(content);
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to read audit report: ${(err as Error).message}`);
			return [];
		}
	}

	/**
	 * Parse the audit report markdown to extract findings.
	 * Format: | ID | File | Line | Severity | Description |
	 */
	private parseAuditMarkdown(content: string): AuditFinding[] {
		const findings: AuditFinding[] = [];
		const lines = content.split("\n");

		for (const line of lines) {
			// Skip headers and dividers
			if (!line.startsWith("|") || line.includes("---")) continue;
			const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
			if (cells.length < 5) continue;

			const [id, file, lineNum, severity, ...descParts] = cells;
			const description = descParts.join(" ").trim();

			// Only generate tests for HIGH/CRITICAL findings
			const sev = severity.toUpperCase();
			if (sev !== "HIGH" && sev !== "CRITICAL") continue;

			findings.push({
				id: id || "unknown",
				file: file || "unknown",
				line: parseInt(lineNum, 10) || 0,
				severity: sev,
				description,
			});
		}
		return findings;
	}

	/**
	 * Convert audit findings to prioritized test suggestions.
	 */
	public prioritize(findings: AuditFinding[]): TestSuggestion[] {
		return findings
			.map((f) => {
				// Try to extract a symbol name from the description
				const symbolMatch = f.description.match(/(?:function|class|method|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
				const symbol = symbolMatch ? symbolMatch[1] : path.basename(f.file, path.extname(f.file));

				// Priority: CRITICAL = 10, HIGH = 5
				const priority = f.severity === "CRITICAL" ? 10 : 5;

				return {
					symbol,
					file: f.file,
					reason: `${f.severity}: ${f.description}`,
					priority,
				};
			})
			.sort((a, b) => b.priority - a.priority);
	}
}
