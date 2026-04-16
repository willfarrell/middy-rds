// Copyright 2026 will Farrell, and middy-rds contributors.
// SPDX-License-Identifier: MIT
import { canPrefetch, getInternal, processCache } from "@middy/util";

import iamToken from "../lib/iam-token.js";
import ssl from "../lib/ssl.js";

const defaults = {
	client: undefined,
	config: {},
	forceConnection: false,
	internalData: undefined,
	contextKey: "rds",
	disablePrefetch: false,
	cacheKey: "rds",
	cacheExpiry: 15 * 60 * 1000 - 1, // IAM token lasts for 15min
};

const defaultConnection = {
	ssl,
	application_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
};

const rdsMiddleware = (opts = {}) => {
	const options = { ...defaults, ...opts };
	if (!options.client) throw new Error("client option missing");

	const sslConfig = ssl(options.ssl);

	const fetch = async (request) => {
		const values = await getInternal(options.internalData, request);
		options.config.connection = {
			...defaultConnection,
			...options.config.connection,
			...values,
			ssl: {
				...sslConfig,
				...options.config.connection.ssl,
			},
		};
		options.config.connection.port ??= Number.parseInt(
			process.env.PGPORT ?? 5432,
			10,
		);
		options.config.connection.password ??= await iamToken(options.config);

		const knex = options.client(options.config);
		options.config.connection.password = undefined;
		// cache the connection, not the credentials as they may change over time
		if (options.forceConnection) {
			await knex.raw("SELECT 1");
		}
		return knex;
	};

	let prefetch;
	if (canPrefetch(options)) {
		prefetch = processCache(options, fetch);
	}

	const rdsMiddlewareBefore = async (request) => {
		const { value } = prefetch ?? processCache(options, fetch, request);

		Object.assign(request.context, { [options.contextKey]: await value }); // await due to fetch being a promise
	};
	const rdsMiddlewareAfter = async (request) => {
		try {
			if (options.cacheExpiry === 0) {
				await request.context[options.contextKey].destroy();
			}
		} catch (e) {
			console.error("middy-rds: cleanup error", e);
		}
	};
	const rdsMiddlewareOnError = rdsMiddlewareAfter;

	return {
		before: rdsMiddlewareBefore,
		after: rdsMiddlewareAfter,
		onError: rdsMiddlewareOnError,
	};
};

export default rdsMiddleware;
