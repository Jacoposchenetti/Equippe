'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  deleteUser as firebaseDeleteUser,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, SubscriptionPlan } from '@/types/equippe';

const ADMIN_EMAILS = ['admin@tuaequipe.it', 'jschenetti@gmail.com', 'udemyteam2025@gmail.com', 'martinamaccara@icloud.com', 'martinamaccarana@icloud.com'];

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  currentPlan: SubscriptionPlan;
  isAdmin: boolean;
  isAdminViewActive: boolean; // false when simulating user view
  simulateUserView: boolean;
  setSimulateUserView: (v: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<FirebaseUser>;
  signInWithGoogle: () => Promise<{ user: FirebaseUser; isNewUser: boolean }>;
  signOut: () => Promise<void>;
  deleteCurrentUser: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulateUserView, setSimulateUserViewState] = useState<boolean>(
    () => localStorage.getItem('equippe_simulate_user_view') === 'true'
  );

  const setSimulateUserView = (v: boolean) => {
    setSimulateUserViewState(v);
    localStorage.setItem('equippe_simulate_user_view', String(v));
  };

  const fetchUserProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setUserProfile(userDoc.data() as User);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Rimetti loading a true per evitare che ProtectedRoute
        // veda utente senza profilo durante il caricamento
        setLoading(true);
        try {
          await firebaseUser.getIdToken();
          setUser(firebaseUser);
          await fetchUserProfile(firebaseUser.uid);
        } catch (error) {
          console.error('Error getting ID token:', error);
          setUser(null);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<FirebaseUser> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
    // Email di verifica inviata successivamente tramite Cloud Function Resend
    return userCredential.user;
  };

  const signInWithGoogle = async (): Promise<{ user: FirebaseUser; isNewUser: boolean }> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Verifica se esiste già un profilo Firestore
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    const isNewUser = !userDoc.exists();
    if (!isNewUser) {
      setUserProfile(userDoc.data() as User);
    }
    return { user: result.user, isNewUser };
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const deleteCurrentUser = async () => {
    if (!auth.currentUser) {
      throw new Error('Nessun utente autenticato');
    }
    await firebaseDeleteUser(auth.currentUser);
  };

  const refreshUserProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  };

  const currentPlan: SubscriptionPlan = userProfile?.plan ?? 'base';
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  const isAdminViewActive = isAdmin && !simulateUserView;

  const value = {
    user,
    userProfile,
    loading,
    currentPlan,
    isAdmin,
    isAdminViewActive,
    simulateUserView,
    setSimulateUserView,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    deleteCurrentUser,
    refreshUserProfile,
    refreshProfile: refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
