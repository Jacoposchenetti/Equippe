import { Timestamp } from 'firebase/firestore';

// User Profile Types
export interface Location {
  lat: number;
  lng: number;
  città: string;
  provincia?: string;
}

export interface Studio {
  indirizzo: string;
  città: string;
  provincia: string;
  remoto: boolean;
}

export interface UserProfile {
  nome: string;
  albo: string;
  specializzazioni: string[];
  tematiche: string[];
  esperienza: string;
  location: Location; // Mantengo per compatibilità
  studi: Studio[]; // Nuovi studi multipli
  disponibilità: string;
  verified: boolean;
  bio?: string;
  telefono?: string;
  linkedin?: string;
  website?: string;
}

export interface UserStats {
  referralsSent: number;
  referralsReceived: number;
  referralsCompleted?: number;
}

export interface User {
  uid: string;
  email: string;
  profile: UserProfile;
  teams: string[];
  stats: UserStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Team Types
export type TeamMemberRole = 'admin' | 'referrer' | 'receiver';

export interface TeamMember {
  uid: string;
  userId?: string; // Alias per compatibilità
  ruolo: TeamMemberRole;
  role?: TeamMemberRole; // Alias per compatibilità
  joinedAt: Timestamp;
}

export interface TeamSettings {
  slaRisposta: '24h' | '48h' | '72h';
  regole: string;
  tematiche: string[];
}

// Ruolo cercato per l'équipe
export interface RoleCercato {
  specializzazione: string; // es: "Psichiatra", "Fisioterapista"
  numero: number; // quanti ne servono
  descrizione?: string; // cosa si cerca in questa figura
  occupati: number; // quanti già trovati
}

export interface Team {
  id?: string; // ID del documento Firestore
  teamId: string;
  nome: string;
  name?: string; // Alias per compatibilità
  description?: string;
  adminUid: string;
  createdBy?: string; // Alias per compatibilità
  members: TeamMember[];
  memberIds?: string[]; // Lista semplice di UID per query veloci
  settings: TeamSettings;
  status?: 'active' | 'inactive';
  specializations?: string[];
  ruoliCercati?: RoleCercato[]; // Nuovi ruoli che si stanno cercando
  completato?: boolean; // true se tutti i ruoli sono occupati
  città?: string; // Città dove opera l'equipé
  provincia?: string; // Provincia
  zona?: string; // Zona specifica (quartiere, municipio)
  locationMode?: 'zone' | 'address' | 'map'; // Modalità di definizione area
  indirizzo?: string; // Indirizzo sede principale (per modalità address)
  coordinate?: { lat: number; lng: number }; // Coordinate centro area
  raggioKm?: number; // Raggio di copertura in km
  remoto?: boolean; // Se l'equipé lavora anche da remoto
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Referral Types
export type ReferralStatus = 'draft' | 'sent' | 'accepted' | 'closed';
export type ReferralUrgency = 'bassa' | 'media' | 'alta';

export interface ReferralData {
  quesito: string;
  urgenza: ReferralUrgency;
  phiEncrypted?: string;
  allegati?: string[];
  note?: string;
}

export interface ReferralTimelineEntry {
  timestamp: Timestamp;
  action: 'created' | 'sent' | 'accepted' | 'rejected' | 'closed' | 'updated';
  actor: string;
  note?: string;
}

export interface Referral {
  refId: string;
  teamId: string;
  senderUid: string;
  receiverUid: string;
  status: ReferralStatus;
  data: ReferralData;
  timeline: ReferralTimelineEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  closedAt?: Timestamp;
}

// Search/Filter Types
export interface ProfessionistFilter {
  specializzazioni?: string[];
  tematiche?: string[];
  città?: string;
  disponibilità?: string;
  searchQuery?: string;
}

// Team Invite Types
export type InviteType = 'invite' | 'request';
export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface TeamInvite {
  id: string;
  teamId: string;
  type: InviteType; // 'invite' = admin invita utente, 'request' = utente chiede di unirsi
  fromUserId: string; // Chi ha iniziato l'azione (admin per invite, user per request)
  toUserId: string; // Chi deve confermare (user per invite, admin per request)
  status: InviteStatus;
  message?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  respondedAt?: Timestamp;
}

// Common Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'referral_received' | 'referral_accepted' | 'team_invite' | 'system';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Timestamp;
}

// Chat/Messaging Types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface Conversation {
  id: string;
  participants: string[]; // Array di userId
  participantsData: {
    [userId: string]: {
      name: string;
    };
  };
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  unreadCount: {
    [userId: string]: number;
  };
  createdAt: Timestamp;
}
