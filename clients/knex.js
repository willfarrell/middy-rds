import { canPrefetch, getInternal, processCache } from '@middy/util'

import iamToken from '../lib/iam-token.js'
import ssl from '../lib/ssl.js'

const defaults = {
  client: undefined,
  config: {},
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
    options.config.connection = {
      ...defaultConnection,
      ...options.config.connection,
      ...values
    }
    if (!options.config.port) {
      throw new Error('port missing')
    }
    if (!options.config.connection.password) {
      options.config.connection.password = await iamToken(options.config)
    }

    const db = options.client(options.config)
    options.config.password = undefined
    // cache the connection, not the credentials as they may change over time
    return db
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
      await request.context[options.contextKey].destroy()
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
