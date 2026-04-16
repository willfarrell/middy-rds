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

const { default: knexMiddleware } = await import("../clients/knex.js");

describe("knex middleware", () => {
	let mockKnex;

	beforeEach(() => {
		mockKnex = {
			raw: mock.fn(() => Promise.resolve()),
			destroy: mock.fn(() => Promise.resolve()),
		};
	});

	it("should throw if client option is missing", () => {
		assert.throws(() => knexMiddleware(), {
			message: "client option missing",
		});
	});

	it("should default port to 5432 if not provided", async () => {
		const mockClient = mock.fn((config) => {
			capturedConfig = { ...config, connection: { ...config.connection } };
			return mockKnex;
		});
		let capturedConfig;
		const middleware = knexMiddleware({
			client: mockClient,
			config: {
				connection: {
					host: "host.rds.amazonaws.com",
					user: "admin",
					password: "pass",
				},
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.equal(capturedConfig.connection.port, 5432);
	});

	it("should create knex instance and attach to context", async () => {
		const mockClient = mock.fn(() => mockKnex);
		const middleware = knexMiddleware({
			client: mockClient,
			config: {
				connection: {
					host: "host.rds.amazonaws.com",
					user: "admin",
					port: 5432,
					password: "pass",
				},
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
			capturedConfig = { ...config, connection: { ...config.connection } };
			return mockKnex;
		});
		const middleware = knexMiddleware({
			client: mockClient,
			config: {
				connection: {
					host: "host.rds.amazonaws.com",
					user: "admin",
					port: 5432,
				},
			},
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.ok(
			capturedConfig.connection.password.includes("X-Amz-Security-Token="),
		);
	});

	it("should force connection when forceConnection is true", async () => {
		const mockClient = mock.fn(() => mockKnex);
		const middleware = knexMiddleware({
			client: mockClient,
			config: {
				connection: {
					host: "host.rds.amazonaws.com",
					user: "admin",
					port: 5432,
					password: "pass",
				},
			},
			forceConnection: true,
		});

		const request = { context: {} };
		await middleware.before(request);

		assert.equal(mockKnex.raw.mock.calls.length, 1);
	});

	it("should destroy knex on after when cacheExpiry is 0", async () => {
		const mockClient = mock.fn(() => mockKnex);
		const middleware = knexMiddleware({
			client: mockClient,
			config: {
				connection: {
					host: "host.rds.amazonaws.com",
					user: "admin",
					port: 5432,
					password: "pass",
				},
			},
			cacheExpiry: 0,
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.after(request);

		assert.equal(mockKnex.destroy.mock.calls.length, 1);
	});

	it("should not destroy knex on after when cacheExpiry is not 0", async () => {
		const mockClient = mock.fn(() => mockKnex);
		const middleware = knexMiddleware({
			client: mockClient,
			config: {
				connection: {
					host: "host.rds.amazonaws.com",
					user: "admin",
					port: 5432,
					password: "pass",
				},
			},
		});

		const request = { context: {} };
		await middleware.before(request);
		await middleware.after(request);

		assert.equal(mockKnex.destroy.mock.calls.length, 0);
	});
});
