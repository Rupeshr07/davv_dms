import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import archiver from 'archiver'
import type { Response } from 'express'
import { env } from '../config/env.js'

export const uploadsRoot = path.resolve(env.uploadRoot)
export const tempUploadRoot = path.join(uploadsRoot, '_temp')

export const ensureUploadRoots = async (): Promise<void> => {
  await mkdir(tempUploadRoot, { recursive: true })
}

export const buildRecordDirectoryName = (referenceNumber: string): string =>
  referenceNumber.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()

export const moveUploadToRecordFolder = async (
  sourcePath: string,
  directoryName: string,
  storedName: string,
): Promise<string> => {
  const recordDir = path.join(uploadsRoot, directoryName)
  await mkdir(recordDir, { recursive: true })
  const targetPath = path.join(recordDir, storedName)
  await rename(sourcePath, targetPath)
  return path.relative(uploadsRoot, targetPath).replace(/\\/g, '/')
}

export const deleteRecordFolder = async (directoryName: string): Promise<void> => {
  const recordDir = path.join(uploadsRoot, directoryName)
  await rm(recordDir, { recursive: true, force: true })
}

export const deleteStoredFile = async (relativePath: string): Promise<void> => {
  const absolutePath = path.join(uploadsRoot, relativePath)
  await rm(absolutePath, { force: true })
}

export const streamRecordFolderZip = async (
  directoryName: string,
  referenceNumber: string,
  res: Response,
): Promise<void> => {
  const recordDir = path.join(uploadsRoot, directoryName)
  await mkdir(recordDir, { recursive: true })

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${referenceNumber.replace(/\//g, '-')}.zip"`,
  )

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', (error) => {
    throw error
  })

  archive.directory(recordDir, false)
  archive.pipe(res)
  await archive.finalize()
}

export const createZipWriteStream = (targetPath: string) => createWriteStream(targetPath)
