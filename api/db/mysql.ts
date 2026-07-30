import mysql, { type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { env } from '../config/env.js'

export const pool = mysql.createPool({
  host: env.mysql.host,
  port: env.mysql.port,
  database: env.mysql.database,
  user: env.mysql.user,
  password: env.mysql.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: false,
})

export const withTransaction = async <T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> => {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export type DatabaseRow = RowDataPacket
export type DatabaseWriteResult = ResultSetHeader
