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
import MarketplacePage from './pages/MarketplacePage'
import MarketplaceCreatePage from './pages/MarketplaceCreatePage'
import MarketplaceDetailPage from './pages/MarketplaceDetailPage'
import MarketplaceMyPage from './pages/MarketplaceMyPage'
import MarketplaceEditPage from './pages/MarketplaceEditPage'
import AvailabilityPage from './pages/AvailabilityPage'
import AppointmentsPage from './pages/AppointmentsPage'
import PublicProfilePage from './pages/PublicProfilePage'
import CancelAppointmentPage from './pages/CancelAppointmentPage'
import TrovaPage from './pages/TrovaPage'
import PazienteLoginPage from './pages/PazienteLoginPage'
import PazienteRegistratiPage from './pages/PazienteRegistratiPage'
import PazienteAppuntamentiPage from './pages/PazienteAppuntamentiPage'
import PatientRoute from './components/PatientRoute'

// Fatturazione
import ElencoFatturePage from './pages/ElencoFatturePage'
import FatturazioneSetupPage from './pages/FatturazioneSetupPage'
import ClientiPage from './pages/ClientiPage'
import NuovaFatturaPage from './pages/NuovaFatturaPage'
import ReportPage from './pages/ReportPage'

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
  // In dev mode, bypassa la verifica email per testing locale
  if (!user.emailVerified && !import.meta.env.DEV) {
    return <Navigate to="/verify-email" replace />
  }
  
  return <>{children}</>
}

// Admin emails (same list as AdminVerificationsPage)
const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

// Admin-only Route: redirects non-admins to dashboard
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Caricamento...</div>
      </div>
    )
  }

  if (!user || !user.email || !ADMIN_EMAILS.includes(user.email)) {
    return <Navigate to="/dashboard" replace />
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
        <Route path="/invites" element={<Navigate to="/teams" replace />} />
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
        
        {/* Fatturazione Routes - admin only */}
        <Route path="/fatturazione" element={
          <AdminRoute>
            <ElencoFatturePage />
          </AdminRoute>
        } />
        <Route path="/fatturazione/setup" element={
          <AdminRoute>
            <FatturazioneSetupPage />
          </AdminRoute>
        } />
        <Route path="/fatturazione/clienti" element={
          <AdminRoute>
            <ClientiPage />
          </AdminRoute>
        } />
        <Route path="/fatturazione/nuova" element={
          <AdminRoute>
            <NuovaFatturaPage />
          </AdminRoute>
        } />
        <Route path="/fatturazione/report" element={
          <AdminRoute>
            <ReportPage />
          </AdminRoute>
        } />
        
        {/* Marketplace Routes */}
        <Route path="/marketplace" element={
          <ProtectedRoute>
            <MarketplacePage />
          </ProtectedRoute>
        } />
        <Route path="/marketplace/create" element={
          <ProtectedRoute>
            <MarketplaceCreatePage />
          </ProtectedRoute>
        } />
        <Route path="/marketplace/my" element={
          <ProtectedRoute>
            <MarketplaceMyPage />
          </ProtectedRoute>
        } />
        <Route path="/marketplace/:id/edit" element={
          <ProtectedRoute>
            <MarketplaceEditPage />
          </ProtectedRoute>
        } />
        <Route path="/marketplace/:id" element={
          <ProtectedRoute>
            <MarketplaceDetailPage />
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
        
        {/* Public professional profile (no auth required) */}
        <Route path="/p/:uid" element={<PublicProfilePage />} />

        {/* Patient appointment cancellation (no auth required) */}
        <Route path="/cancella" element={<CancelAppointmentPage />} />

        {/* Patient-facing directory and area riservata */}
        <Route path="/trova" element={<TrovaPage />} />
        <Route path="/paziente/login" element={<PazienteLoginPage />} />
        <Route path="/paziente/registrati" element={<PazienteRegistratiPage />} />
        <Route path="/paziente/appuntamenti" element={
          <PatientRoute>
            <PazienteAppuntamentiPage />
          </PatientRoute>
        } />

        {/* Booking / Agenda Routes */}
        <Route path="/disponibilita" element={
          <ProtectedRoute>
            <AvailabilityPage />
          </ProtectedRoute>
        } />
        <Route path="/appuntamenti" element={
          <ProtectedRoute>
            <AppointmentsPage />
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
