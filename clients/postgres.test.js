import assert from "node:assert/strict";
import { beforeEach, describe, it, mock } from "node:test";

// Mock @aws-sdk/rds-signer
mock.module("@aws-sdk/rds-signer", {
	namedExports: {
		Signer: class MockSigner {
			constructor(params) {
				this.params = params;
			}

			getAuthToken() {
				return Promise.resolve(
					"host.rds.amazonaws.com:5432/?Action=connect&DBUser=admin&X-Amz-Security-Token=token123",
				);
			}
		},
	},
});

// Mock @middy/util
mock.module("@middy/util", {
	namedExports: {
		canPrefetch: () => false,
		getInternal: () => Promise.resolve({}),
		processCache: (_options, fetch, request) => {
			const value = fetch(request);
			return { value };
		},
	},
});

const { default: postgresMiddleware } = await import("../clients/postgres.js");

describe("postgres middleware", () => {
	let mockSql;

	beforeEach(() => {
		mockSql = Object.assign(
			mock.fn(() => Promise.resolve([{ "?column?": 1 }])),
			{ end: mock.fn(() => Promise.resolve()) },
		);
	});

	it("should throw if client option is missing", () => {
		assert.throws(() => postgresMiddleware(), {
			message: "client option missing",
		});
	});

	it("should create sql instance and attach to context", async () => {
		const mockClient = mock.fn(() => mockSql);
		const middleware = postgresMiddleware({
			client: mockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.ok(request.context.rds);
		assert.equal(mockClient.mock.calls.length, 1);
	});

	it("should use IAM token when no password provided", async () => {
		let capturedConfig;
		const mockClient = mock.fn((config) => {
			capturedConfig = { ...config };
			return mockSql;
		});
		const middleware = postgresMiddleware({
			client: mockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.ok(capturedConfig.password.includes("X-Amz-Security-Token="));
	});

	it("should end connection on after when cacheExpiry is 0", async () => {
		const mockClient = mock.fn(() => mockSql);
		const middleware = postgresMiddleware({
			client: mockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			cacheExpiry: 0,
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.after(request);

		assert.equal(mockSql.end.mock.calls.length, 1);
	});

	it("should not end connection on after when cacheExpiry is not 0", async () => {
		const mockClient = mock.fn(() => mockSql);
		const middleware = postgresMiddleware({
			client: mockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.after(request);

		assert.equal(mockSql.end.mock.calls.length, 0);
	});

	it("should use custom contextKey", async () => {
		const mockClient = mock.fn(() => mockSql);
		const middleware = postgresMiddleware({
			client: mockClient,
			config: {
				host: "host.rds.amazonaws.com",
				user: "admin",
				port: 5432,
				password: "pass",
			},
			contextKey: "sql",
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.ok(request.context.sql);
		assert.equal(request.context.rds, undefined);
	});
});
