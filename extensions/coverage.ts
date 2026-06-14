// CoverageAnalyzer: Parses Jest coverage reports and identifies gaps.

import * as fs from "node:fs";
import { CoverageGap } from "./types";

export class CoverageAnalyzer {
	/**
	 * Find the coverage summary file in the cwd.
	 */
	public findCoverageReport(cwd: string = process.cwd()): string | null {
		const candidates = [
			`${cwd}/coverage/coverage-summary.json`,
			`${cwd}/coverage/lcov.info`,
		];
		for (const path of candidates) {
			if (fs.existsSync(path)) return path;
		}
		return null;
	}

	/**
	 * Parse Jest's coverage-summary.json.
	 */
	public parseJsonCoverage(reportPath: string): CoverageGap[] {
		try {
			const content = fs.readFileSync(reportPath, "utf8");
			const data = JSON.parse(content);
			const gaps: CoverageGap[] = [];

			// First entry is the total; skip it, process per-file entries
			for (const key of Object.keys(data)) {
				if (key === "total") continue;
				const entry = data[key];
				if (!entry.lines || !entry.branches || !entry.functions) continue;
				gaps.push({
					file: key,
					lines: { covered: entry.lines.covered, total: entry.lines.total, pct: entry.lines.pct },
					branches: { covered: entry.branches.covered, total: entry.branches.total, pct: entry.branches.pct },
					functions: { covered: entry.functions.covered, total: entry.functions.total, pct: entry.functions.pct },
				});
			}
			return gaps;
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to parse coverage JSON: ${(err as Error).message}`);
			return [];
		}
	}

	/**
	 * Parse LCOV format (simplified).
	 */
	public parseLcovCoverage(reportPath: string): CoverageGap[] {
		try {
			const content = fs.readFileSync(reportPath, "utf8");
			const gaps: CoverageGap[] = [];
			const lines = content.split("\n");
			let current: Partial<CoverageGap> | null = null;

			for (const line of lines) {
				if (line.startsWith("SF:")) {
					current = {
						file: line.substring(3).trim(),
						lines: { covered: 0, total: 0, pct: 0 },
						branches: { covered: 0, total: 0, pct: 0 },
						functions: { covered: 0, total: 0, pct: 0 },
					};
				} else if (line === "end_of_record" && current) {
					gaps.push(current as CoverageGap);
					current = null;
				} else if (current) {
					if (line.startsWith("LF:")) current.lines!.total = parseInt(line.substring(3), 10);
					else if (line.startsWith("LH:")) current.lines!.covered = parseInt(line.substring(3), 10);
					else if (line.startsWith("BRF:")) current.branches!.total = parseInt(line.substring(4), 10);
					else if (line.startsWith("BRH:")) current.branches!.covered = parseInt(line.substring(4), 10);
					else if (line.startsWith("FNF:")) current.functions!.total = parseInt(line.substring(4), 10);
					else if (line.startsWith("FNH:")) current.functions!.covered = parseInt(line.substring(4), 10);
				}
			}
			// Compute percentages
			for (const gap of gaps) {
				if (gap.lines.total > 0) gap.lines.pct = Math.round((gap.lines.covered / gap.lines.total) * 100);
				if (gap.branches.total > 0) gap.branches.pct = Math.round((gap.branches.covered / gap.branches.total) * 100);
				if (gap.functions.total > 0) gap.functions.pct = Math.round((gap.functions.covered / gap.functions.total) * 100);
			}
			return gaps;
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to parse LCOV: ${(err as Error).message}`);
			return [];
		}
	}

	/**
	 * Get gaps below a threshold.
	 */
	public getGaps(gaps: CoverageGap[], threshold: number = 80): CoverageGap[] {
		return gaps.filter((g) => g.lines.pct < threshold || g.branches.pct < threshold || g.functions.pct < threshold);
	}
}
