export type ApiMode = 'mock' | 'remote'

export type DocumentType = 'PDF' | 'PNG' | 'JPEG' | 'MIXED'

export type RecordStatus = 'ACTIVE' | 'ARCHIVED'

export type BranchOption = {
  id: number
  name: string
}

export type SubjectOption = {
  id: number
  name: string
}

export type SessionUser = {
  staffId: string
  username: string
  displayName: string
}

export type RegistrationStatusResponse = {
  success: boolean
  message: string
  mode: ApiMode
}

export type LoginRequest = {
  username: string
  password: string
}

export type RecordFile = {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  sizeBytes: number
  relativePath: string
  pageCount: number | null
  categoryLabel: string | null
  createdAt: string
  updatedAt: string
}

export type RecordEntity = {
  id: string
  referenceNumber: string
  branchId: number
  branchName: string
  subjectId: number
  subjectName: string
  recordDate: string
  remark: string
  staffId: string
  recordStatus: RecordStatus
  totalPages: number
  documentType: DocumentType
  documentSizeBytes: number
  directoryName: string
  createdAt: string
  updatedAt: string
  files: RecordFile[]
}

export type RecordSearchParams = {
  branchId?: number
  subjectId?: number
  referenceNumber?: string
  remarkKeywords?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
}

export type RecordListItem = {
  id: string
  referenceNumber: string
  branchName: string
  subjectName: string
  recordDate: string
  recordFileSummary: string
  uploadedAt: string
  modifiedAt: string
}

export type RecordSearchResponse = {
  items: RecordListItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  sort: {
    field: 'recordDate'
    direction: 'desc'
  }
}

export type ViewerCategory = {
  id: string
  label: string
  files: RecordFile[]
}

export type RecordViewerResponse = {
  record: RecordEntity
  categories: ViewerCategory[]
}

export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}
