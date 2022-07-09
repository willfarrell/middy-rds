import { canPrefetch, getInternal, processCache, clearCache } from '@middy/util'

import iamToken from '../lib/iam-token.js'
import ssl from '../lib/ssl.js'

const defaults = {
  client: undefined,
  config: {},
  internalData: undefined,
  contextKey: 'db',
  disablePrefetch: false,
  cacheKey: 'rds',
  cachePasswordKey: 'rds',
  cacheExpiry: -1
}

const defaultConnection = { ssl }

const rdsMiddleware = (opts = {}) => {
  const options = { ...defaults, ...opts }
  if (!options.client) throw new Error('client option missing')

  const fetch = async (request) => {
    const values = await getInternal(options.internalData, request)
    options.config = { ...defaultConnection, ...options.config, ...values }
    if (!options.config.port) {
      options.config.port = Number.parseInt(process.env.PGPORT ?? 5432)
    }
    if (!options.config.password) {
      options.config.password = await iamToken(options.config)
    }

    const Client = options.client
    const pool = new Client(options.config)

    // cache the connection, not the credentials as they change over time
    return pool
      .connect()
      .catch((e) => {
        // Connection failed for some reason
        // log and clear cache, force re-connect
        clearCache([options.cachePasswordKey])
        clearCache([options.cacheKey])
        prefetch = undefined
        throw new Error(e.message) // createError(500, e.message)
      })
      .finally(() => {
        options.config.password = undefined
      })
  }

  let prefetch
  if (canPrefetch(options)) {
    prefetch = processCache(options, fetch)
  }

  const rdsMiddlewareBefore = async (request) => {
    const { value } = prefetch ?? processCache(options, fetch, request)
    Object.assign(request.context, { [options.contextKey]: await value }) // await due to fetch being a promise
  }
  const rdsMiddlewareAfter = async (request) => {
    if (options.cacheExpiry === 0) {
      await request.context[options.contextKey].end()
    }
  }
  const rdsMiddlewareOnError = rdsMiddlewareAfter

  return {
    before: rdsMiddlewareBefore,
    after: rdsMiddlewareAfter,
    onError: rdsMiddlewareOnError
  }
}

export default rdsMiddleware
