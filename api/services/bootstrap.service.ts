import type { DatabaseRow } from '../db/mysql.js'
import { pool, withTransaction } from '../db/mysql.js'
import { hashPassword } from '../lib/password.js'

const defaultBranches = ['Administration', 'Examination', 'Accounts', 'Affiliation'] as const

const defaultSubjects = [
  { branchId: 1, subjectName: 'Circular' },
  { branchId: 2, subjectName: 'Academic Order' },
  { branchId: 3, subjectName: 'Finance Approval' },
  { branchId: 4, subjectName: 'Student Services' },
] as const

type CountRow = DatabaseRow & {
  total: number
}

type BranchIdRow = DatabaseRow & {
  id: number
}

const getTableCount = async (tableName: 'tb_account' | 'tb_branches' | 'tb_subject'): Promise<number> => {
  const [rows] = await pool.query<CountRow[]>(`SELECT COUNT(*) AS total FROM ${tableName}`)
  return Number(rows[0]?.total ?? 0)
}

export const ensureDatabaseReady = async (): Promise<void> => {
  const [accountCount, branchCount, subjectCount] = await Promise.all([
    getTableCount('tb_account'),
    getTableCount('tb_branches'),
    getTableCount('tb_subject'),
  ])

  if (accountCount > 0 && branchCount > 0 && subjectCount > 0) {
    return
  }

  await withTransaction(async (connection) => {
    if (branchCount === 0) {
      for (const branchName of defaultBranches) {
        await connection.query(
          `INSERT INTO tb_branches (branch_name, branch_code, is_active, status)
           VALUES (?, ?, 1, 'Active')`,
          [branchName, branchName.slice(0, 3).toUpperCase()],
        )
      }
    }

    if (subjectCount === 0) {
      const [branchRows] = await connection.query<BranchIdRow[]>(
        `SELECT id
         FROM tb_branches
         ORDER BY id ASC`,
      )
      const availableBranchIds = branchRows.map((row) => row.id)

      for (let index = 0; index < defaultSubjects.length; index += 1) {
        const subject = defaultSubjects[index]
        const branchId =
          availableBranchIds[index] ??
          availableBranchIds[availableBranchIds.length - 1] ??
          subject.branchId

        await connection.query(
          `INSERT INTO tb_subject (branch_id, subject_name, is_active, status)
           VALUES (?, ?, 1, 1)`,
          [branchId, subject.subjectName],
        )
      }
    }

    if (accountCount === 0) {
      const passwordHash = await hashPassword('Welcome@123')
      await connection.query(
        `INSERT INTO tb_account (
          staff_id,
          name,
          email,
          password,
          role,
          is_active,
          status
        ) VALUES (?, ?, ?, ?, ?, 1, 1)`,
        ['DAVV-1001', 'DAVV Records Officer', 'admin', passwordHash, 1],
      )
    }
  })
}
