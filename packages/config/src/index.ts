// Shared configuration helpers.
// Each app reads its own env vars; this package provides shared utilities.

export const isDevelopment = () => process.env["NODE_ENV"] === "development";
export const isProduction = () => process.env["NODE_ENV"] === "production";
export const isTest = () => process.env["NODE_ENV"] === "test";
