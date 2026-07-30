import axios from 'axios'
import type {
  ApiResponse,
  BranchOption,
  LoginRequest,
  RecordEntity,
  RecordSearchResponse,
  RecordViewerResponse,
  RegistrationStatusResponse,
  SessionUser,
  SubjectOption,
} from '../../shared/types'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data?.message === 'string') {
      return error.response.data.message
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

const unwrap = async <T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> => {
  const response = await request
  return response.data.data
}

export const appApi = {
  getRegistrationStatus: () =>
    unwrap<RegistrationStatusResponse>(api.get('/app/registration-status')),
  getSession: () => unwrap<SessionUser | null>(api.get('/auth/me')),
  login: (payload: LoginRequest) => unwrap<SessionUser>(api.post('/auth/login', payload)),
  logout: () => unwrap<null>(api.post('/auth/logout')),
  getBranches: () => unwrap<BranchOption[]>(api.get('/branches')),
  getSubjects: () => unwrap<SubjectOption[]>(api.get('/subjects')),
  getReferenceNumber: () =>
    unwrap<{ referenceNumber: string }>(api.get('/records/reference-number')),
  searchRecords: (params: Record<string, string | number | undefined>) =>
    unwrap<RecordSearchResponse>(api.get('/records', { params })),
  getRecord: (recordId: string) => unwrap<RecordEntity>(api.get(`/records/${recordId}`)),
  getViewer: (recordId: string) =>
    unwrap<RecordViewerResponse>(api.get(`/records/${recordId}/viewer`)),
  createRecord: (payload: FormData) => unwrap<RecordEntity>(api.post('/records', payload)),
  updateRecord: (recordId: string, payload: FormData) =>
    unwrap<RecordEntity>(api.put(`/records/${recordId}`, payload)),
  deleteRecord: (recordId: string) => unwrap<null>(api.delete(`/records/${recordId}`)),
  buildDownloadUrl: (recordId: string) => `/api/records/${recordId}/download`,
}

export { api }
