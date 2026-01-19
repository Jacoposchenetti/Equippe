import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import OnboardingPage from './pages/OnboardingPage'
import TeamsPage from './pages/TeamsPage'
import TeamDetailPage from './pages/TeamDetailPage'
import TeamEditPage from './pages/TeamEditPage'
import TeamCreatePage from './pages/TeamCreatePage'
import MessagesPage from './pages/Messages'
import ProfilePage from './pages/ProfilePage'
import ProfileEditPage from './pages/ProfileEditPage'
import InvitesPage from './pages/Invites'
import ReferralsPage from './pages/Referrals'
import ReferralDetailPage from './pages/ReferralDetailPage'
import ReferralCreatePage from './pages/ReferralCreatePage'
import LegalPage from './pages/LegalPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TerminiServizioPage from './pages/TerminiServizioPage'
import CookiePolicyPage from './pages/CookiePolicyPage'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// Public Route Component (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    )
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />
        
        {/* Legal Pages (accessible to everyone) */}
        <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/legal/termini" element={<TerminiServizioPage />} />
        <Route path="/legal/cookie" element={<CookiePolicyPage />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />
        <Route path="/teams" element={
          <ProtectedRoute>
            <TeamsPage />
          </ProtectedRoute>
        } />
        <Route path="/teams/create" element={
          <ProtectedRoute>
            <TeamCreatePage />
          </ProtectedRoute>
        } />
        <Route path="/teams/:id" element={
          <ProtectedRoute>
            <TeamDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/teams/:id/edit" element={
          <ProtectedRoute>
            <TeamEditPage />
          </ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        } />
        <Route path="/profile/:uid" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/profile/edit" element={
          <ProtectedRoute>
            <ProfileEditPage />
          </ProtectedRoute>
        } />
        <Route path="/invites" element={
          <ProtectedRoute>
            <InvitesPage />
          </ProtectedRoute>
        } />
        <Route path="/referrals" element={
          <ProtectedRoute>
            <ReferralsPage />
          </ProtectedRoute>
        } />
        <Route path="/referrals/create" element={
          <ProtectedRoute>
            <ReferralCreatePage />
          </ProtectedRoute>
        } />
        <Route path="/referrals/:id" element={
          <ProtectedRoute>
            <ReferralDetailPage />
          </ProtectedRoute>
        } />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  )
}

export default App
