export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  displayName?: string;
  departmentId?: number;
  departmentName?: string;
  jobFamily?: 'CS' | 'PRODOPS' | 'RSD' | 'OTHER';
}

export interface Department {
  id: number;
  name: string;
  code: string;
}

export interface InternalNote {
  id: number;
  content: string;
  candidateId: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

export interface JobMatch {
  jobOfferId: number;
  title: string;
  location: string;
  contractType: string;
  requiredSkills: string;
  matchScore: number;
  source: 'COHERE' | 'SIMULATED';
}

export interface Reminder {
  id: number;
  title: string;
  reminderDate: string;
  relatedType: string;
  relatedId: number;
  sent: boolean;
  sentAt?: string;
  recipientEmail: string;
}

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  oldValue?: string;
  newValue?: string;
  performedBy?: string;
  performedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string[];
}

export interface JwtResponse {
  token: string;
  type: string;
  id: number;
  username: string;
  email: string;
  roles: string[];
}

export interface MessageResponse {
  message: string;
}

export interface ChatbotAskResponse {
  answer: string;
}

export interface ChatbotGreetingResponse {
  greeting: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
}

export interface JobOffer {
  id: number;
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string; // Added for backend compatibility
  location: string;
  company?: string;
  salary?: number;
  salaryRange: string; // Added for backend compatibility
  contractType: string;
  experienceLevel: string; // Added for backend compatibility
  jobFamily?: 'CS' | 'PRODOPS' | 'RSD' | 'OTHER';
  seniorityLevel?: 'JUNIOR' | 'MID' | 'SENIOR';
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'EXPIRED';
  deadline: string; // Added for backend compatibility
  managerEmail?: string;
  departmentId?: number;
  departmentName?: string;
  hiringManagerId?: number;
  hiringManagerName?: string;
  hiringManagerEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface JobOfferRequest {
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string; // Added for backend compatibility
  location: string;
  salary?: number;
  salaryRange: string; // Added for backend compatibility
  contractType: string;
  experienceLevel: string; // Added for backend compatibility
  jobFamily?: 'CS' | 'PRODOPS' | 'RSD' | 'OTHER';
  seniorityLevel?: 'JUNIOR' | 'MID' | 'SENIOR';
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'EXPIRED'; // Added for backend compatibility
  deadline: string; // Added for backend compatibility
  managerEmail?: string;
  departmentId?: number;
  hiringManagerId?: number;
  allowManagerDepartmentMismatch?: boolean;
}

/**
 * Chaîne de résolution du destinataire côté backend (ManagerRoutingService) :
 * manager recruteur désigné sur l'offre, managers du département, de la famille
 * de métier, puis e-mail libre. Le score IA n'intervient jamais dans l'aiguillage.
 */
export interface RoutedManager {
  id?: number | null;
  fullName: string;
  email: string;
}

export interface RoutingPreview {
  managers: RoutedManager[];
  basis?: 'OFFER_MANAGER' | 'DEPARTMENT' | 'JOB_FAMILY' | 'LEGACY_EMAIL' | 'UNRESOLVED' | null;
}

/** État de notification d'un destinataire, lu dans l'outbox n8n. */
export interface RoutingRecipientStatus {
  email: string;
  fullName: string;
  /** NOT_ENQUEUED : webhook non configuré ; PENDING : en file ou en reprise ;
   *  SENT : accepté par n8n ; FAILED : tentatives épuisées. */
  notificationStatus: 'NOT_ENQUEUED' | 'PENDING' | 'SENT' | 'FAILED';
  attempts?: number | null;
  sentAt?: string | null;
  nextAttemptAt?: string | null;
  lastError?: string | null;
  /** Relances déjà demandées par le RH sur ce destinataire. */
  retries?: number | null;
}

/** Traçabilité RH de la transmission, relisible après coup dans la fiche candidat. */
export interface RoutingStatus {
  candidateId: number;
  candidateStatus: string;
  routedAt?: string | null;
  routingBasis?: RoutingPreview['basis'];
  routingBasisLabel?: string | null;
  transmitted?: boolean | null;
  recipients: RoutingRecipientStatus[];
}

/** Manager mobilisable dans le formulaire d'offre. */
export interface ManagerOption {
  id: number;
  fullName: string;
  email: string;
  departmentId?: number | null;
  departmentName?: string | null;
}

/** Proposition lexicale de rattachement d'une offre sans département, à confirmer par le RH. */
export interface DepartmentProposal {
  departmentId: number;
  departmentName: string;
  departmentCode?: string;
  score: number;
  matchedTerms: string[];
}
/** Pondération du score IA (technique/communication/séniorité) pour une
 * combinaison famille de métier × niveau de séniorité, paramétrable par le RH. */
export interface ScoringWeightProfile {
  id: number;
  jobFamily: 'CS' | 'PRODOPS' | 'RSD' | 'OTHER';
  seniorityLevel: 'JUNIOR' | 'MID' | 'SENIOR';
  weightTechnical: number;
  weightCommunication: number;
  weightSeniority: number;
  updatedBy?: string;
  updatedAt?: Date;
}

export interface ScoringWeightProfileRequest {
  weightTechnical: number;
  weightCommunication: number;
  weightSeniority: number;
}

export interface Candidate {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  linkedinProfile?: string;
  coverLetter?: string;
  cvUrl?: string;
  cvId?: number;
  cv?: {
    id: number;
    originalFilename: string;
    fileUrl: string; // URL locale
    fileSize: number;
    uploadDate: Date;
  };
  // Ces champs sont conservés pour la compatibilité mais ne sont plus dans le DTO
  experience?: string;
  skills?: string;
  education?: string;
  applicationDate: Date;
  status: 'APPLIED' | 'CV_REVIEWED' | 'PHONE_SCREENING' | 'TECHNICAL_TEST' | 'INTERVIEW' | 'FINAL_INTERVIEW' | 'ACCEPTED' | 'REJECTED' | 'AUTO_REJECTED' | 'MANAGER_REJECTED' | 'INTERVIEW_SCHEDULED' | 'HIRED' | 'WITHDRAWN';
  statusReason?: string;
  statusChangedBy?: string;
  statusChangedAt?: Date;
  presentationDate?: Date;
  aiScore?: number;
  aiScoreTechnical?: number;
  aiScoreCommunication?: number;
  aiScoreSeniorityMatch?: number;
  aiScoreSource?: string;
  manualScore?: number;
  manualScoreReason?: string;
  manualScoreBy?: string;
  manualScoreDate?: Date;
  effectiveScore?: number;
  aiSummary?: string;
  aiRecommendation?: string;
  matchedSkills?: string;
  missingSkills?: string;
  needsHumanReview?: boolean;
  humanReviewReason?: string;
  jobOfferId: number;
  jobOfferTitle: string;
  jobFamily?: 'CS' | 'PRODOPS' | 'RSD' | 'OTHER';
  departmentName?: string;
  /** Destinataire(s) réel(aux) du dossier, figés par le backend au moment du routage. */
  routedManagerName?: string;
  routedManagerEmails?: string;
  routedAt?: Date;
  routingBasis?: 'OFFER_MANAGER' | 'DEPARTMENT' | 'JOB_FAMILY' | 'LEGACY_EMAIL' | 'UNRESOLVED';
  jobOffers?: JobOffer[];
}

export interface ApplicationRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  jobOfferId: number;
  coverLetter?: string;
}

export interface Interview {
  id: number;
  candidateId: number;
  candidateName?: string;
  candidateEmail?: string;
  interviewerId?: number;
  interviewerName?: string;
  interviewerEmail?: string;
  interviewDate: Date;
  durationMinutes?: number;
  location?: string;
  meetLink?: string;
  type: 'PHONE_SCREENING' | 'TECHNICAL' | 'HR' | 'MANAGER' | 'FINAL' | 'GROUP';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  notes?: string;
  jobOfferTitle?: string;
  jobOfferId?: number;
  feedback?: string;
  rating?: number;
  feedbacksCount?: number;
  candidateStatus?: string;
  advicePossible?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Feedback {
  id: number;
  candidateId: number;
  interviewId?: number;
  rating: number;
  content: string; // Correction ici
  type: 'INTERVIEW' | 'CV_REVIEW' | 'PHONE_SCREENING' | 'TECHNICAL_TEST' | 'FINAL_DECISION' | 'GENERAL'; // Ajouté
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'ARCHIVED';
  createdAt: Date;
  authorId?: number;
  authorName?: string;
}

export interface NotificationTemplate {
  id: number;
  name: string;
  subject: string;
  content: string;
  type: 'APPLICATION_CONFIRMATION' | 'INTERVIEW_INVITATION' | 'FEEDBACK_NOTIFICATION';
}

export interface EmailNotification {
  id: number;
  to: string;
  subject: string;
  content: string;
  sentAt: Date;
  status: 'SENT' | 'FAILED' | 'PENDING';
  type: string;
  candidateId?: number;
  interviewId?: number;
  feedbackId?: number;
}

