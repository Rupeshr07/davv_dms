import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import type { BranchOption, RecordEntity, SessionUser, SubjectOption } from '../../shared/types.js'

type SeedUser = SessionUser & {
  password: string
}

type FileDatabase = {
  branches: BranchOption[]
  subjects: SubjectOption[]
  users: SeedUser[]
  records: RecordEntity[]
  counters: {
    record: number
    file: number
  }
}

const seedDatabase = (): FileDatabase => ({
  branches: [
    { id: 1, name: 'Administration' },
    { id: 2, name: 'Examination' },
    { id: 3, name: 'Accounts' },
    { id: 4, name: 'Affiliation' },
  ],
  subjects: [
    { id: 1, name: 'Circular' },
    { id: 2, name: 'Academic Order' },
    { id: 3, name: 'Finance Approval' },
    { id: 4, name: 'Student Services' },
  ],
  users: [
    {
      staffId: 'DAVV-1001',
      username: 'admin',
      displayName: 'DAVV Records Officer',
      password: 'Welcome@123',
    },
  ],
  records: [],
  counters: {
    record: 1,
    file: 1,
  },
})

class FileDatabaseStore {
  private dbPath = path.resolve(env.fileDbPath)

  private cache: FileDatabase | null = null

  async read(): Promise<FileDatabase> {
    if (this.cache) {
      return this.cache
    }

    await mkdir(path.dirname(this.dbPath), { recursive: true })

    try {
      const content = await readFile(this.dbPath, 'utf-8')
      this.cache = JSON.parse(content) as FileDatabase
      return this.cache
    } catch {
      const seeded = seedDatabase()
      await this.write(seeded)
      return seeded
    }
  }

  async write(data: FileDatabase): Promise<void> {
    this.cache = data
    await mkdir(path.dirname(this.dbPath), { recursive: true })
    await writeFile(this.dbPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  async getUsers(): Promise<SeedUser[]> {
    const db = await this.read()
    return db.users
  }

  async getBranches(): Promise<BranchOption[]> {
    const db = await this.read()
    return db.branches
  }

  async getSubjects(): Promise<SubjectOption[]> {
    const db = await this.read()
    return db.subjects
  }
}

export const fileDatabaseStore = new FileDatabaseStore()
export type { FileDatabase, SeedUser }
