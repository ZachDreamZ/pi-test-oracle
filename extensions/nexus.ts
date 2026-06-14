// NexusConsumer: Reads outputs from other Nexus packages.
// Includes size limits (circuit breaker) and resilient file reading.

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { AuditFinding, TestSuggestion } from "./types";
import { readFileWithRetry, isTransientIoError } from "./util";

const MAX_AUDIT_SIZE = 1_048_576;

export class NexusConsumer {
	private auditReportPath: string;

	constructor(auditReportPath?: string) {
		this.auditReportPath = auditReportPath || path.join(os.homedir(), ".pi", "audit-master", "audit-report.md");
	}

	public readLatestAuditReport(): AuditFinding[] {
		try {
			if (!fs.existsSync(this.auditReportPath)) {
				return [];
			}
			const stat = fs.statSync(this.auditReportPath);
			if (stat.size > MAX_AUDIT_SIZE) {
				console.warn(
					`[pi-test-oracle] Audit report exceeds size limit (${stat.size} > ${MAX_AUDIT_SIZE} bytes). Skipping.`,
				);
				return [];
			}
			const content = readFileWithRetry(this.auditReportPath, 2, 50);
			if (content === null) {
				if (isTransientIoError({ code: "EBUSY" } as unknown as Error)) {
					console.error(`[pi-test-oracle] Transient I/O error reading audit report`);
				}
				return [];
			}
			return this.parseAuditMarkdown(content);
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to read audit report: ${(err as Error).message}`);
			return [];
		}
	}

	private parseAuditMarkdown(content: string): AuditFinding[] {
		const findings: AuditFinding[] = [];
		const MAX_LINES = 10_000;
		const lines = content.split("\n").slice(0, MAX_LINES);

		for (const line of lines) {
			if (!line.startsWith("|") || line.includes("---")) continue;
			const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
			if (cells.length < 5) continue;

			const [id, file, lineNum, severity, ...descParts] = cells;
			const description = descParts.join(" ").trim();

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

	public prioritize(findings: AuditFinding[]): TestSuggestion[] {
		return findings
			.map((f) => {
				const symbolMatch = f.description.match(/(?:function|class|method|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
				const symbol = symbolMatch ? symbolMatch[1] : path.basename(f.file, path.extname(f.file));
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
