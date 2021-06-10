const tls = require('tls')
const { promisify } = require('util')
const { getInternal, processCache, clearCache } = require('@middy/util')

const ssl = require('./ssl')

const defaults = {
  client: undefined,
  config: {},
  internalData: {},
  cacheKey: 'rds',
  cachePasswordKey: 'rds',
  cacheExpiry: -1
}

const defaultConnection = { ssl }

const rdsMiddleware = (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  if (!options.client) throw new Error('client option missing')

  const fetch = async (request) => {
    const values = await getInternal(options.internalData, request)
    options.config.connection = Object.assign({}, defaultConnection, options.config.connection, values)
    const db = options.client(options.config)
    db.raw('SELECT 1') // don't await, used to force open connection
      .catch(e => {
        // Connection failed for some reason
        // log and clear cache, force re-connect
        console.error('middy-rds SELECT 1', e.message)
        clearCache([options.cachePasswordKey])
        clearCache([options.cacheKey])
      })

    // cache the connection, not the credentials as they may change over time
    return db
  }

  const rdsMiddlewareBefore = async (request) => {
    const {value}  = processCache(options, fetch, request)

    Object.assign(request.context, { db: await value }) // await due to fetch being a promise
  }
  const rdsMiddlewareAfter = async (request) => {
    if (options.cacheExpiry === 0) {
      await promisify(request.context.db.destroy)()
    }
  }
  const rdsMiddlewareOnError = rdsMiddlewareAfter

  return {
    before: rdsMiddlewareBefore,
    after: rdsMiddlewareAfter,
    onError: rdsMiddlewareOnError
  }
}

module.exports = rdsMiddleware
