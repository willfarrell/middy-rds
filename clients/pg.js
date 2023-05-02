import { canPrefetch, getInternal, processCache, clearCache } from '@middy/util'

import iamToken from '../lib/iam-token.js'
import ssl from '../lib/ssl.js'

const defaults = {
  client: undefined,
  config: {
    application_name: process.env.AWS_LAMBDA_FUNCTION_NAME
  },
  internalData: undefined,
  contextKey: 'sql', // TODO change to rds
  disablePrefetch: false,
  cacheKey: 'rds',
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
      console.time('iamToken')
      options.config.password = await iamToken(options.config)
      console.timeEnd('iamToken')
    }

    const Client = options.client
    const pool = new Client(options.config)

    // cache the connection, not the credentials as they change over time
    const forceConnection = await pool
      .connect()
      .catch((e) => {
        // Connection failed for some reason
        // log and clear cache, force re-connect
        clearCache([options.cacheKey])
        prefetch = undefined
        throw new Error(e.message) // createError(500, e.message)
      })
      .finally(() => {
        options.config.password = undefined
      })
    forceConnection.release()
    return pool
  }

  let prefetch
  if (canPrefetch(options)) {
    prefetch = processCache(options, fetch)
  }

  const rdsMiddlewareBefore = async (request) => {
    const { value } = prefetch ?? processCache(options, fetch, request)
    const pool = await value // await due to fetch being a promise
    Object.assign(request.context, {
      [options.contextKey]: await pool.connect(), // for serial single connection
      [options.contextKey + 'Pool']: pool // for parallel connections
    })

    console.log(pool)
  }
  const rdsMiddlewareAfter = async (request) => {
    // try/catch for if an error is thrown after this ran the first time
    try {
      request.context[options.contextKey].release()
      if (options.cacheExpiry === 0) {
        await request.context[options.contextKey + 'Pool'].end()
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
