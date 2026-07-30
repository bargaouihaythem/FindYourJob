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
  jobOfferId: number;
  jobOfferTitle: string;
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
  type: 'PHONE_SCREENING' | 'TECHNICAL' | 'HR' | 'MANAGER' | 'FINAL' | 'GROUP';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  notes?: string;
  jobOfferTitle?: string;
  jobOfferId?: number;
  feedback?: string;
  rating?: number;
  feedbacksCount?: number;
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

