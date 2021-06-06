const { getInternal, processCache, clearCache/*, createError*/ } = require('@middy/util')

const ssl = require('./ssl')

const defaults = {
  client: undefined,
  config: {},
  internalData: {},
  cacheKey: 'rds',
  cachePasswordKey: 'rds',
  cacheExpiry: -1
}

const defaultConnection = { ssl, port: 5432 }

const rdsMiddleware = (opts = {}) => {
  const options = Object.assign({}, defaults, opts)
  if (!options.client) throw new Error('client option missing')

  const fetch = async (request) => {
    const values = await getInternal(options.internalData, request)

    options.config = Object.assign({}, defaultConnection, options.config, values)

    let pool = new options.client(options.config)

    let db
    try {
      db = await pool.connect()

    } catch(e) {
      // Connection failed for some reason
      // log and clear cache, force re-connect
      clearCache([options.cachePasswordKey])
      clearCache([options.cacheKey])
      throw new Error(e.message) //createError(500, e.message)
    }

    // const query = async (sql, params) => {
    //   return db.query(escape(sql, params))
    // }

    // cache the connection, not the credentials as they may change over time
    return db
  }

  const rdsMiddlewareBefore = async (request) => {
    const {value}  = processCache(options, fetch, request)

    Object.assign(request.context, { db: await value }) // await due to fetch being a promise
  }
  const rdsMiddlewareAfter = async (request) => {
    if (options.cacheExpiry === 0) {
      request.context.db.end()
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