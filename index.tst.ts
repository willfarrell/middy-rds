// Copyright 2026 will Farrell, and middy-rds contributors.
// SPDX-License-Identifier: MIT

import { describe, expect, test } from "tstyche";
import knexRDS from "./clients/knex.js";
import pgRDS from "./clients/pg.js";
import postgresRDS from "./clients/postgres.js";
import middy from "./index.js";

describe("index", () => {
	test("default export has all middleware", () => {
		expect(middy).type.toHaveProperty("knexRDSMiddleware");
		expect(middy).type.toHaveProperty("pgRDSMiddleware");
		expect(middy).type.toHaveProperty("postgresRDSMiddleware");
	});
});

describe("knexRDS", () => {
	test("returns middleware object", () => {
		const middleware = knexRDS({ client: {} as any });
		expect(middleware).type.toHaveProperty("before");
		expect(middleware).type.toHaveProperty("after");
		expect(middleware).type.toHaveProperty("onError");
	});
});

describe("pgRDS", () => {
	test("returns middleware object", () => {
		const middleware = pgRDS({ client: {} as any });
		expect(middleware).type.toHaveProperty("before");
		expect(middleware).type.toHaveProperty("after");
		expect(middleware).type.toHaveProperty("onError");
	});
});

describe("postgresRDS", () => {
	test("returns middleware object", () => {
		const middleware = postgresRDS({ client: {} as any });
		expect(middleware).type.toHaveProperty("before");
		expect(middleware).type.toHaveProperty("after");
		expect(middleware).type.toHaveProperty("onError");
	});
});
