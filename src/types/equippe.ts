import { Timestamp } from 'firebase/firestore';

// Verification Types
export type VerificationStatus = 
  | 'pending'      // In attesa di verifica (nuovo utente)
  | 'approved'     // Verificato e abilitato
  | 'rejected'     // Verifica fallita, serve nuova documentazione
  | 'suspended';   // Sospeso (per violazioni, ecc.)

export interface VerificationInfo {
  status: VerificationStatus;
  submittedAt: Timestamp;          // Quando ha inviato la documentazione
  lastCheckedAt?: Timestamp;       // Ultima verifica da parte di admin
  checkedBy?: string;              // UID dell'admin che ha verificato
  rejectionReason?: string;        // Motivo del rifiuto
  notes?: string;                  // Note interne per admin
}

// User Profile Types
export interface Location {
  lat: number;
  lng: number;
  città: string;
  provincia?: string;
  indirizzo?: string;
  zonaRoma?: string;
}

export interface Studio {
  indirizzo: string;
  città: string;
  provincia: string;
  remoto: boolean;
  coordinate?: { lat: number; lng: number }; // Coordinate geografiche dello studio
  raggioKm?: number; // Raggio di copertura in km
}

// Esperienze professionali, formazione e certificazioni
export interface EsperienzaProfessionale {
  id: string;
  titolo: string; // es. "Psicologa /Psicoterapeuta"
  organizzazione: string; // es. "Studio Privato Dott.ssa D'Auria Graziella"
  indirizzo?: string; // es. "Via Trieste 19 Villanova PE"
  descrizione?: string;
  dataInizio: string; // formato YYYY-MM
  dataFine?: string; // formato YYYY-MM, vuoto se attuale
  attuale: boolean;
}

export interface Formazione {
  id: string;
  titolo: string; // es. "LAUREA MAGISTRALE IN PSICOLOGIA"
  istituzione: string; // es. "Università 'Gabriele d'Annunzio'"
  annoConseguimento: string; // es. "2013"
}

export interface Certificazione {
  id: string;
  titolo: string; // es. "CORSO PROPEDEUTICO PER L'ABILITAZIONE ALL'USO DEL BIOFEEDBACK"
  istituzione: string; // es. "CENTRO DI PSICOLOGIA CLINICA"
  anno: string; // es. "2021"
}

// Documenti e informazioni di verifica per ogni professione
export interface DocumentoVerifica {
  tipo: 'albo' | 'certificato' | 'altro';
  nome: string;
  valore: string; // Il valore inserito dall'utente (numero albo, ecc.)
  fileURL?: string; // URL del file caricato su Firebase Storage (opzionale)
}

export interface ProfessioneConDocumenti {
  professione: string; // Nome della professione
  documenti: DocumentoVerifica[]; // Documenti richiesti per questa professione
  note?: string; // Note aggiuntive dell'utente
  tematiche?: string[]; // Tematiche specifiche per questa professione
  anniEsperienza?: string; // Anni di esperienza in questa professione
}

export type LivelloLingua = 'Madrelingua' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface LinguaParlata {
  lingua: string;
  livello: LivelloLingua;
}

export interface UserProfile {
  nome: string;
  albo: string; // @deprecated - mantenuto per retrocompatibilità
  specializzazioni: string[]; // @deprecated - usare professioniConDocumenti
  professioniConDocumenti?: ProfessioneConDocumenti[]; // Lista professioni approvate con relativi documenti
  professioniPending?: ProfessioneConDocumenti[]; // Professioni in attesa di approvazione admin
  tematiche: string[];
  esperienza: string;
  location: Location; // Mantengo per compatibilità
  studi: Studio[]; // Nuovi studi multipli
  disponibilità: string;
  verified: boolean; // @deprecated - usare verificationInfo.status === 'approved'
  verificationInfo?: VerificationInfo; // Sistema di verifica avanzato
  bio?: string;
  telefono?: string;
  linkedin?: string;
  website?: string;
  photoURL?: string;
  dataNascita?: string;
  esperienze?: EsperienzaProfessionale[];
  formazione?: Formazione[];
  certificazioni?: Certificazione[];
  lingue?: LinguaParlata[];
}

export interface UserStats {
  referralsSent: number;
  referralsReceived: number;
  referralsCompleted?: number;
}

// ─── Booking / Calendar ────────────────────────────────────────────────────

export interface TimeRange {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface WeeklySchedule {
  lun: TimeRange[];
  mar: TimeRange[];
  mer: TimeRange[];
  gio: TimeRange[];
  ven: TimeRange[];
  sab: TimeRange[];
  dom: TimeRange[];
}

export interface TipoVisita {
  id: string;
  nome: string;          // "Prima visita", "Visita di controllo"
  durata: number;        // minuti
  prezzo?: number;       // EUR, opzionale
  descrizione?: string;
}

export type TipoLocazione = 'presenziale' | 'online' | 'entrambi';

export interface LocationVisita {
  tipo: TipoLocazione;
  indirizzo?: string;   // per presenziale / entrambi
  linkOnline?: string;  // per online / entrambi (es. link Meet/Zoom)
}

export interface Availability {
  uid: string;
  isPublic: boolean;                  // opt-in visibilità paziente
  slotDurationMinutes: number;        // 30 | 45 | 60
  bufferMinutes: number;              // pausa tra slot: 0 | 10 | 15
  bookingWindowDays: number;          // quanti giorni avanti: 14 | 30 | 60 | 90
  schedule: WeeklySchedule;
  tipiVisita: TipoVisita[];
  exceptDates?: string[];             // YYYY-MM-DD date bloccate
  locationVisita?: LocationVisita;    // dove avviene la visita
  updatedAt: Timestamp;
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id?: string;
  professionalUid: string;
  professionalName: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:MM
  endTime: string;        // HH:MM
  tipoVisita: string;
  status: AppointmentStatus;
  notes?: string;
  locazioneTipo?: 'presenziale' | 'online'; // modalità scelta dal paziente
  locazioneDettaglio?: string;              // indirizzo o link
  cancellationToken?: string;              // UUID per link di annullamento
  pazienteUid?: string;                    // UID paziente se ha un account su tuaequipe.it
  createdAt: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  profile: UserProfile;
  teams: string[];
  stats: UserStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fcmToken?: string;
  fcmTokenUpdatedAt?: Timestamp;
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

// Ruolo cercato per l'equipe
export interface RoleCercato {
  specializzazione: string; // es: "Psichiatra", "Fisioterapista"
  numero: number; // quanti ne servono
  descrizione?: string; // cosa si cerca in questa figura
  occupati: number; // quanti già trovati (legacy)
  postiTotali?: number; // Totale posti disponibili (nuovo)
  postiOccupati?: number; // Posti occupati (nuovo)
}

export interface Team {
  id?: string; // ID del documento Firestore
  teamId: string;
  nome: string;
  name?: string; // Alias per compatibilità
  description?: string;
  photoURL?: string; // Foto dell'equipe
  adminUid: string;
  createdBy?: string; // Alias per compatibilità
  members: TeamMember[];
  membersWithData?: any[]; // Membri con dati utente caricati (runtime only)
  memberIds?: string[]; // Lista semplice di UID per query veloci
  settings: TeamSettings;
  status?: 'active' | 'inactive';
  specializations?: string[];
  ruoliCercati?: RoleCercato[]; // Nuovi ruoli che si stanno cercando
  completato?: boolean; // true se tutti i ruoli sono occupati
  città?: string; // Città dove opera l'equipe
  provincia?: string; // Provincia
  zona?: string; // Zona specifica (quartiere, municipio)
  locationMode?: 'zone' | 'address' | 'map'; // Modalità di definizione area
  indirizzo?: string; // Indirizzo sede principale (per modalità address)
  coordinate?: { lat: number; lng: number }; // Coordinate centro area
  raggioKm?: number; // Raggio di copertura in km
  remoto?: boolean; // Se l'equipe lavora anche da remoto
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

// Chat/Messaging Types
export type ConversationType = 'private' | 'team';

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string; // MIME type
  url: string; // Firebase Storage URL
  downloadURL: string;
  uploadedAt: Timestamp;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  receiverId?: string; // Solo per chat private
  content: string;
  attachments?: FileAttachment[];
  read: boolean;
  createdAt: Timestamp;
}

export interface Conversation {
  id: string;
  type: ConversationType; // 'private' o 'team'
  participants: string[]; // Array di userId
  participantsData: {
    [userId: string]: {
      name: string;
      photoURL?: string;
    };
  };
  // Per chat di team
  teamId?: string;
  teamName?: string;
  teamPhotoURL?: string;
  // Per chat private
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  unreadCount: {
    [userId: string]: number;
  };
  createdAt: Timestamp;
}

// Notification Types
export type NotificationType = 
  | 'team_request'           // Richiesta adesione equipe
  | 'message'                // Nuovo messaggio
  | 'team_request_accepted'  // Richiesta adesione accettata
  | 'team_removed'           // Rimosso da equipe
  | 'team_admin'             // Promosso ad admin
  | 'team_invite_response'   // Invito accettato/rifiutato
  | 'team_invite_received'   // Invito ricevuto
  | 'referral_received'      // Referral ricevuta
  | 'referral_accepted'      // Referral accettata
  | 'profession_verification_request' // Nuova richiesta verifica professione (admin)
  | 'profession_approved'    // Professione approvata (utente)
  | 'profession_rejected'    // Professione rifiutata (utente)
  | 'marketplace_offer_received'  // Nuova offerta ricevuta sul proprio annuncio
  | 'marketplace_offer_accepted'  // La tua offerta è stata accettata
  | 'marketplace_offer_rejected'  // La tua offerta è stata rifiutata
  | 'mention'                     // Qualcuno ti ha menzionato in una chat
  | 'soglia_forfettario_80'        // Fatturato al 80% del limite €85.000
  | 'soglia_forfettario_100'       // Fatturato ha superato il limite €85.000
  | 'new_appointment'              // Nuova prenotazione da paziente
  | 'appointment_cancelled';       // Appuntamento annullato dal paziente

export interface Notification {
  id: string;
  userId: string;              // Destinatario della notifica
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
  
  // Dati specifici per tipo di notifica
  teamId?: string;             // Per notifiche legate a team
  teamName?: string;
  requestId?: string;          // Per team_request
  messageId?: string;          // Per message
  conversationId?: string;     // Per message
  senderId?: string;           // Chi ha generato la notifica
  senderName?: string;
  senderPhotoURL?: string;     // Foto profilo di chi ha generato la notifica
  referralId?: string;         // Per referral
  inviteId?: string;           // Per team_invite_response
  accepted?: boolean;          // Per team_invite_response e referral_accepted
  listingId?: string;          // Per notifiche marketplace
  offerId?: string;            // Per notifiche marketplace
}

// ===== MARKETPLACE TYPES =====

export type DayOfWeek = 'lunedi' | 'martedi' | 'mercoledi' | 'giovedi' | 'venerdi' | 'sabato' | 'domenica';

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'lunedi', label: 'Lunedì' },
  { value: 'martedi', label: 'Martedì' },
  { value: 'mercoledi', label: 'Mercoledì' },
  { value: 'giovedi', label: 'Giovedì' },
  { value: 'venerdi', label: 'Venerdì' },
  { value: 'sabato', label: 'Sabato' },
  { value: 'domenica', label: 'Domenica' },
];

export interface DayAvailability {
  day: DayOfWeek;
  startTime: string; // "08:00"
  endTime: string;   // "20:00"
}

export type MarketplaceListingStatus = 'active' | 'paused' | 'closed';
export type MarketplacePriceType = 'orario' | 'mezza_giornata' | 'giornaliero' | 'mensile';
export type MarketplacePropertyType = 'studio' | 'locale_intero';

export interface PriceOption {
  amount: number;
  type: MarketplacePriceType;
  label?: string; // etichetta personalizzata opzionale
}

export const PRICE_TYPE_LABELS: Record<MarketplacePriceType, string> = {
  orario: 'ora',
  mezza_giornata: 'mezza giornata a settimana',
  giornaliero: 'giorno a settimana',
  mensile: 'mese',
};

export interface MarketplaceListing {
  id?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string;
  title: string;
  description: string;
  /** @deprecated usa prices[] */
  price?: number;
  /** @deprecated usa prices[] */ 
  priceType?: MarketplacePriceType;
  prices: PriceOption[];
  address: string;
  city: string;
  cap: string;
  provincia: string;
  coordinate?: { lat: number; lng: number };
  features: string[];
  photos: string[];
  rooms: number;
  bathrooms: number;
  area: number; // m²
  propertyType: MarketplacePropertyType;
  availability: DayAvailability[];
  status: MarketplaceListingStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MarketplaceOfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface RequestedSlot {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface MarketplaceOffer {
  id?: string;
  listingId: string;
  listingTitle: string;
  authorId: string;       // proprietario annuncio
  authorName: string;
  offererId: string;      // chi fa l'offerta
  offererName: string;
  offererPhotoURL?: string;
  requestedSlots: RequestedSlot[];
  message: string;
  offerAmount: number;    // €
  status: MarketplaceOfferStatus;
  responseMessage?: string;
  createdAt: Timestamp;
  respondedAt?: Timestamp;
}
