import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import VerifyEmailPage from './pages/VerifyEmailPage'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import WaitlistPage from './pages/WaitlistPage'

const WAITLIST_MODE = import.meta.env.VITE_WAITLIST_MODE === 'true'

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

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
import AdminVerificationsPage from './pages/AdminVerificationsPage'
import AdminMailingListPage from './pages/AdminMailingListPage'
import AdminWaitlistEmailPage from './pages/AdminWaitlistEmailPage'
import ECMSearchPage from './pages/ECMSearchPage'

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  
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

  // Se l'utente non ha un profilo Firestore, deve completare la registrazione
  if (!userProfile) {
    return <Navigate to="/register?provider=google" replace />
  }

  // Se l'utente ha un profilo Firestore con status approved, lascialo passare
  // (backward compatibility con utenti creati prima del sistema di verifica email)
  if (userProfile?.profile?.verificationInfo?.status === 'approved') {
    return <>{children}</>
  }

  // Altrimenti, se l'email non è verificata, reindirizza alla pagina di verifica
  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />
  }
  
  return <>{children}</>
}

// Public Route Component (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth()
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    )
  }
  
  // Allow authenticated users to access the verify page
  if (user && location.pathname !== '/verify-email') {
    // Se l'utente non ha un profilo Firestore (es. registrazione Google incompleta),
    // lascialo accedere alla pagina di login normalmente
    if (!userProfile) {
      return <>{children}</>
    }
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <div className="App">
      <ScrollToTop />
      <PWAInstallPrompt />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
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
        
        {/* ECM Route */}
        <Route path="/ecm" element={
          <ProtectedRoute>
            <ECMSearchPage />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin/verifications" element={
          <ProtectedRoute>
            <AdminVerificationsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/mailing-list" element={
          <ProtectedRoute>
            <AdminMailingListPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/waitlist-email" element={
          <ProtectedRoute>
            <AdminWaitlistEmailPage />
          </ProtectedRoute>
        } />
        
        {/* Waitlist / Default redirect */}
        <Route path="/" element={
          WAITLIST_MODE ? <WaitlistPage /> : <Navigate to="/dashboard" replace />
        } />
        <Route path="/waitlist" element={<WaitlistPage />} />
        
        {/* 404 fallback */}
        <Route path="*" element={
          WAITLIST_MODE ? <Navigate to="/" replace /> : <Navigate to="/dashboard" replace />
        } />
      </Routes>
    </div>
  )
}

export default App
