import { canPrefetch, getInternal, processCache } from '@middy/util'

import iamToken from '../lib/iam-token.js'
import ssl from '../lib/ssl.js'

const defaults = {
  client: undefined,
  config: {
    application_name: process.env.AWS_LAMBDA_FUNCTION_NAME
  },
  forceConnection: false,
  internalData: undefined,
  contextKey: 'rds',
  disablePrefetch: false,
  cacheKey: 'rds',
  cacheExpiry: 15 * 60 * 1000 - 1 // IAM token lasts for 15min
}

const defaultConnection = { ssl }

const rdsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  if (!options.client) throw new Error('client option missing')

  const fetch = async (request) => {
    const values = await getInternal(options.internalData, request)
    options.config = { ...defaultConnection, ...options.config, ...values }

    options.config.port ??= Number.parseInt(process.env.PGPORT ?? 5432)
    options.config.password ??= await iamToken(options.config)

    const Client = options.client
    const pool = new Client(options.config)
    options.config.password = undefined
    if (options.forceConnection) {
      await pool.query('SELECT 1')
    }
    return pool
  }

  if (canPrefetch(options)) {
    processCache(options, fetch)
  }

  const rdsMiddlewareBefore = async (request) => {
    const { value } = processCache(options, fetch, request)
    Object.assign(request.context, {
      [options.contextKey]: await value // for transactions, use `client = await pool.connect(); client.release()`
    })
  }
  const rdsMiddlewareAfter = async (request) => {
    // try/catch for if an error is thrown after this ran the first time
    try {
      if (options.cacheExpiry === 0) {
        await request.context[options.contextKey].end()
      }
    } catch (e) {}
  }
  const rdsMiddlewareOnError = rdsMiddlewareAfter

  return {
    before: rdsMiddlewareBefore,
    after: rdsMiddlewareAfter,
    onError: rdsMiddlewareOnError
  }
}

export default rdsMiddleware
