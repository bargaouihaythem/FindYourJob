export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
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
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'EXPIRED';
  deadline: string; // Added for backend compatibility
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
  status: 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'EXPIRED'; // Added for backend compatibility
  deadline: string; // Added for backend compatibility
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
  status: 'APPLIED' | 'CV_REVIEWED' | 'PHONE_SCREENING' | 'TECHNICAL_TEST' | 'INTERVIEW' | 'FINAL_INTERVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
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
  type: 'INTERVIEW' | 'CV_REVIEW' | 'TECHNICAL_TEST' | 'FINAL_DECISION' | 'GENERAL'; // Ajouté
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  createdBy: string;
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


export interface InterviewRequest {
  candidateId: number;
  jobOfferId?: number;
  interviewerId: number;
  interviewDate: Date;
  duration?: number;
  location: string;
  type: 'PHONE_SCREENING' | 'TECHNICAL' | 'HR' | 'MANAGER' | 'FINAL' | 'GROUP';
  notes?: string;
}

