import knexRDS from './clients/knex.js'
import pgRDS from './clients/pg.js'
import postgresRDS from './clients/postgres.js'

export const knexRDSMiddleware = knexRDS
export const pgRDSMiddleware = pgRDS
export const postgresRDSMiddleware = postgresRDS

export default {
  knexRDSMiddleware,
  pgRDSMiddleware,
  postgresRDSMiddleware
}
