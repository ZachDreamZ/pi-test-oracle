// Shared types for pi-test-oracle

export type TddState = "RED" | "GREEN" | "REFACTOR" | "UNKNOWN";

export interface TestRecord {
	path: string;
	symbol: string;
	state: TddState;
	createdAt: number;
	lastRunAt: number | null;
	lastRunOutput: string;
	history: Array<{ state: TddState; at: number }>;
}

export interface TddStateFile {
	version: 1;
	tests: Record<string, TestRecord>;
}

export interface ParsedSignature {
	name: string;
	params: Array<{ name: string; type: string }>;
	returnType: string;
	isAsync: boolean;
	isExported: boolean;
}

export interface GeneratedTest {
	filePath: string;
	content: string;
	importPath: string;
	symbol: string;
}

export interface CoverageGap {
	file: string;
	lines: { covered: number; total: number; pct: number };
	branches: { covered: number; total: number; pct: number };
	functions: { covered: number; total: number; pct: number };
}

export interface AuditFinding {
	id: string;
	file: string;
	line: number;
	severity: string;
	description: string;
	symbol?: string;
}

export interface TestSuggestion {
	symbol: string;
	file: string;
	reason: string;
	priority: number;
}
