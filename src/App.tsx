import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/auth-store'
import SplashPage from '@/pages/SplashPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import RecordFormPage from '@/pages/RecordFormPage'
import RecordWorkspacePage from '@/pages/RecordWorkspacePage'
import SearchRecordsPage from '@/pages/SearchRecordsPage'
import ViewRecordPage from '@/pages/ViewRecordPage'
import BulkUploadPage from '@/pages/BulkUploadPage'
import LogoutPage from '@/pages/LogoutPage'
import NotFoundPage from '@/pages/NotFoundPage'

function SessionBootstrap() {
  const initialized = useAuthStore((state) => state.initialized)
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    if (!initialized) {
      void initialize()
    }
  }, [initialize, initialized])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap />
      <Routes>
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/records/new" element={<RecordFormPage />} />
            <Route path="/records/:recordId/workspace" element={<RecordWorkspacePage />} />
            <Route path="/records/search" element={<SearchRecordsPage />} />
            <Route path="/records/:recordId/edit" element={<RecordFormPage />} />
            <Route path="/records/:recordId/view" element={<ViewRecordPage />} />
            <Route path="/bulk-upload" element={<BulkUploadPage />} />
            <Route path="/logout" element={<LogoutPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/home" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
