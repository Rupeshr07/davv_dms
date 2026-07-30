import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  sessionSecret: process.env.SESSION_SECRET ?? 'davv-dms-phase1-session-secret',
  uploadRoot: process.env.UPLOAD_ROOT ?? 'storage/uploads',
  fileDbPath: process.env.FILE_DB_PATH ?? 'storage/data/runtime-db.json',
  nextinMode: (process.env.NEXTIN_API_MODE ?? 'mock') as 'mock' | 'remote',
  nextinRegistrationUrl: process.env.NEXTIN_REGISTRATION_API_URL ?? '',
  nextinRegistrationApiKey: process.env.NEXTIN_REGISTRATION_API_KEY ?? '',
  legacyLoginMode: (process.env.LEGACY_LOGIN_MODE ?? 'mock') as 'mock' | 'remote',
  legacyLoginUrl: process.env.LEGACY_LOGIN_API_URL ?? '',
  mysql: {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    database: process.env.MYSQL_DATABASE ?? 'davv_dms',
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
  },
}
