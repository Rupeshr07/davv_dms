import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(nodeScrypt)

const KEY_LENGTH = 64

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt:${salt}:${derivedKey.toString('hex')}`
}

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash.startsWith('scrypt:')) {
    return storedHash === password
  }

  const [, salt, hash] = storedHash.split(':')
  if (!salt || !hash) {
    return false
  }

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  const storedBuffer = Buffer.from(hash, 'hex')

  if (derivedKey.length !== storedBuffer.length) {
    return false
  }

  return timingSafeEqual(derivedKey, storedBuffer)
}
