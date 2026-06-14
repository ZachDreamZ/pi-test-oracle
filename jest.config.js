const { createDefaultPreset } = require("ts-jest");
const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} */
module.exports = {
	testEnvironment: "node",
	transform: {
		...tsJestTransformCfg,
	},
	testMatch: ["<rootDir>/tests/**/*.test.ts"],
	moduleFileExtensions: ["ts", "js", "json"],
	transformIgnorePatterns: ["node_modules/(?!.*\.mjs$)"],
};
