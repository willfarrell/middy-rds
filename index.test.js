import { equal } from "node:assert/strict";
import test from "node:test";
import middyRds, {
	knexRDSMiddleware,
	pgRDSMiddleware,
	postgresRDSMiddleware,
} from "./index.mjs";

test("index.mjs should export knexRDSMiddleware as a function", () => {
	equal(typeof knexRDSMiddleware, "function");
});

test("index.mjs should export pgRDSMiddleware as a function", () => {
	equal(typeof pgRDSMiddleware, "function");
});

test("index.mjs should export postgresRDSMiddleware as a function", () => {
	equal(typeof postgresRDSMiddleware, "function");
});

test("index.mjs default export should contain all middlewares", () => {
	equal(typeof middyRds.knexRDSMiddleware, "function");
	equal(typeof middyRds.pgRDSMiddleware, "function");
	equal(typeof middyRds.postgresRDSMiddleware, "function");
});
