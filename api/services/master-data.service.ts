import type { DatabaseRow } from '../db/mysql.js'
import { pool } from '../db/mysql.js'
import type { BranchOption, SubjectOption } from '../../shared/types.js'

type NamedOptionRow = DatabaseRow & {
  id: number
  name: string
}

export const getBranches = async (): Promise<BranchOption[]> => {
  const [rows] = await pool.query<NamedOptionRow[]>(
    `SELECT id, branch_name AS name
     FROM tb_branches
     WHERE is_active = 1
       AND status = 'Active'
     ORDER BY branch_name ASC`,
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }))
}

export const getSubjects = async (): Promise<SubjectOption[]> => {
  const [rows] = await pool.query<NamedOptionRow[]>(
    `SELECT id, subject_name AS name
     FROM tb_subject
     WHERE is_active = 1
       AND status = 1
     ORDER BY subject_name ASC`,
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }))
}
