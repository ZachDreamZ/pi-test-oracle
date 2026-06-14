// CoverageAnalyzer: Parses Jest coverage reports and identifies gaps.
// Includes size limits and retry logic for transient I/O errors.

import * as fs from "node:fs";
import { CoverageGap } from "./types";
import { readFileWithRetry, isTransientIoError } from "./util";

const MAX_COVERAGE_SIZE = 5_242_880; // 5MB cap for LCOV files (can be large).

export class CoverageAnalyzer {
	/**
	 * Find the coverage summary file in the given directory.
	 */
	public findCoverageReport(cwd: string = process.cwd()): string | null {
		try {
			const candidates = [
				`${cwd}/coverage/coverage-summary.json`,
				`${cwd}/coverage/lcov.info`,
			];
			for (const p of candidates) {
				if (fs.existsSync(p)) {
					// Size check before returning
					const stat = fs.statSync(p);
					if (stat.size > MAX_COVERAGE_SIZE) {
						console.warn(`[pi-test-oracle] Coverage report too large: ${stat.size} bytes. Skipping.`);
						return null;
					}
					return p;
				}
			}
		} catch {
			// Ignore
		}
		return null;
	}

	/**
	 * Parse Jest's coverage-summary.json.
	 * Uses retry for transient I/O errors.
	 */
	public parseJsonCoverage(reportPath: string): CoverageGap[] {
		const content = readFileWithRetry(reportPath, 2, 30);
		if (content === null) return [];

		let data: any;
		try {
			data = JSON.parse(content);
		} catch (err) {
			console.error(`[pi-test-oracle] Failed to parse coverage JSON: ${(err as Error).message}`);
			return [];
		}

		const gaps: CoverageGap[] = [];
		for (const key of Object.keys(data)) {
			if (key === "total") continue;
			const entry = data[key];
			if (!entry || !entry.lines || !entry.branches || !entry.functions) continue;
			gaps.push({
				file: key,
				lines: { covered: entry.lines.covered ?? 0, total: entry.lines.total ?? 0, pct: entry.lines.pct ?? 0 },
				branches: { covered: entry.branches.covered ?? 0, total: entry.branches.total ?? 0, pct: entry.branches.pct ?? 0 },
				functions: { covered: entry.functions.covered ?? 0, total: entry.functions.total ?? 0, pct: entry.functions.pct ?? 0 },
			});
		}
		return gaps;
	}

	/**
	 * Parse LCOV format (simplified).
	 */
	public parseLcovCoverage(reportPath: string): CoverageGap[] {
		const content = readFileWithRetry(reportPath, 2, 30);
		if (content === null) return [];

		const gaps: CoverageGap[] = [];
		const lines = content.split("\n").slice(0, 50_000); // Line cap
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
				if (line.startsWith("LF:")) current.lines!.total = parseInt(line.substring(3), 10) || 0;
				else if (line.startsWith("LH:")) current.lines!.covered = parseInt(line.substring(3), 10) || 0;
				else if (line.startsWith("BRF:")) current.branches!.total = parseInt(line.substring(4), 10) || 0;
				else if (line.startsWith("BRH:")) current.branches!.covered = parseInt(line.substring(4), 10) || 0;
				else if (line.startsWith("FNF:")) current.functions!.total = parseInt(line.substring(4), 10) || 0;
				else if (line.startsWith("FNH:")) current.functions!.covered = parseInt(line.substring(4), 10) || 0;
			}
		}
		// Compute percentages
		for (const gap of gaps) {
			if (gap.lines.total > 0) gap.lines.pct = Math.round((gap.lines.covered / gap.lines.total) * 100);
			if (gap.branches.total > 0) gap.branches.pct = Math.round((gap.branches.covered / gap.branches.total) * 100);
			if (gap.functions.total > 0) gap.functions.pct = Math.round((gap.functions.covered / gap.functions.total) * 100);
		}
		return gaps;
	}

	/**
	 * Get gaps below a threshold.
	 */
	public getGaps(gaps: CoverageGap[], threshold: number = 80): CoverageGap[] {
		return gaps.filter((g) => g.lines.pct < threshold || g.branches.pct < threshold || g.functions.pct < threshold);
	}
}
