// (removed unused Timestamp import)

export type UserRole = 'admin' | 'teacher' | 'student' | 'parent';

export type TeacherType = 'insegnante_regolare' | 'insegnante_volontario' | 'assistente';

export type SubstitutionStatus = 'assigned' | 'pending' | 'approved' | 'rejected' | 'completed';

export interface Substitution {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  originalTeacherId?: string;
  originalTeacherName?: string;
  date: Date;
  startTime: string;
  endTime: string;
  reason: string;
  status: SubstitutionStatus;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  classId?: string;
  createdAt: Date;
  // Enrollment status
  isEnrolled?: boolean;
  enrollmentDate?: Date;
  // Payment status
  paymentStatus?: 'pending' | 'paid';
  paymentDate?: Date;
  paymentExempted?: boolean; // New field for payment exemption
  // Teacher specific fields
  hasAssistant?: boolean;
  assistantName?: string;
  teacherType?: TeacherType;
  assistantId?: string; // ID of assigned assistant
  assignedClassId?: string; // Class where teacher is assigned (different from classId for students)
  // Substitution management
  availableForSubstitution?: boolean; // Teacher opt-in for substitution availability
  attendanceRate?: number;
  // Parent specific fields
  children?: Array<{
    name: string;
    codiceFiscale: string;
    email: string;
  }>; // For parents - references to their children
  // Additional fields for all users
  age?: number;
  gender?: 'M' | 'F';
  address?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  notes?: string;
  birthDate?: Date;
  codiceFiscale?: string;
  city?: string;
  postalCode?: string;
  temporaryClasses?: string[]; // IDs of classes where teacher is substituting
  // Account activation status
  accountStatus?: 'active' | 'pending_approval';
  tempId?: string; // Temporary ID for pre-created accounts
  // Notification meta
  pendingNotified?: boolean; // Whether admins have been notified about this pending teacher
  // Registration metadata
  registrationDate?: Date;
  // Student-specific properties (for backward compatibility when using User type for students)
  parentName?: string;
  parentContact?: string;
  firstName?: string;
  lastName?: string;
}

export interface Student {
  id: string;
  parentId: string; // Reference to parent in users collection
  // Personal information
  firstName: string;
  lastName: string;
  displayName: string;
  codiceFiscale: string;
  birthDate: Date;
  gender: 'M' | 'F';
  // Contact information
  phoneNumber?: string;
  address: string;
  city: string;
  postalCode: string;
  emergencyContact?: string;
  // Academic information
  attendanceMode: 'in_presenza' | 'online';
  enrollmentType: 'nuova_iscrizione' | 'rinnovo';
  previousYearClass?: string;
  currentClass: string;
  italianSchoolClass: string; // Italian school class (e.g., "1A", "2B", "3C")
  selectedTurni: string[]; // For presence mode students
  // Special needs
  hasDisability: boolean;
  // Registration metadata
  registrationDate: Date;
  isEnrolled: boolean;
  enrollmentDate?: Date;
  // Account status
  accountStatus: 'active' | 'pending_approval';
  // Authentication (students will have accounts in users collection too)
  email: string; // Generated email for student account
  createdAt: Date;
}

// Extended Student interface with parent data for UI display
export interface StudentWithParent extends Omit<Student, 'gender'> {
  role: UserRole; // Added for compatibility with User type
  gender?: 'M' | 'F'; // Override to match User type
  parentName?: string;
  parentCodiceFiscale?: string;
  parentContact?: string;
  parentEmail?: string;
  parentAddress?: string;
  parentCity?: string;
  parentPostalCode?: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: Date;
  month: string; // Format: "YYYY-MM"
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod?: 'cash' | 'bank_transfer' | 'stripe' | 'other';
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  dueDate?: Date;
  receiptNumber?: string;
  stripePaymentId?: string;
}

export interface TeacherPayment {
  id: string;
  teacherId: string;
  teacherName: string;
  amount: number;
  date: Date;
  month: string; // Format: "YYYY-MM"
  paymentType: 'salary' | 'bonus' | 'reimbursement' | 'other';
  description?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PaymentRecord {
  id: string;
  parentContact: string;
  parentName: string;
  amount: number;
  date: Date;
  notes: string;
  createdBy: string;
  createdAt: Date;
}

export interface Class {
  id: string;
  name: string;
  description: string;
  turno?: 'sabato pomeriggio' | 'sabato sera' | 'domenica mattina' | 'domenica pomeriggio';
  teacherId?: string;
  students: string[];
  createdAt: Date;
  // UI helper to indicate that this class is being shown due to a substitution
  isTemporary?: boolean;
}

export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: Date;
  status: 'present' | 'absent' | 'justified';
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  classId: string;
  className?: string;
  lessonId?: string; // Link homework to specific lesson
  dueDate: Date;
  attachmentUrls?: string[];
  createdBy: string;
  createdAt: Date;
  status: 'active' | 'completed';
  teacherName?: string;
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  submissionUrls: string[]; // Photos, audio files, documents
  submissionText?: string;
  submittedAt: Date;
  status: 'submitted' | 'graded';
  grade?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: Date;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  classId: string;
  date: Date;
  topics: string[];
  materials?: string[]; // Array of material IDs
  homeworks?: string[]; // Array of homework IDs
  createdBy: string;
  createdAt: Date;
  teacherName?: string;
}

export interface LessonMaterial {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  classId: string;
  lessonId?: string; // Link material to specific lesson
  createdBy: string;
  createdAt: Date;
  teacherName?: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error';

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: Date;
  updatedAt?: Date;
  status: MessageStatus;
  readBy?: {
    [userId: string]: Date;
  };
  attachments?: Array<{
    url: string;
    name: string;
    type: 'image' | 'document' | 'audio' | 'video' | 'other';
    size: number;
  }>;
  reactions?: {
    [emoji: string]: string[]; // emoji -> array of user IDs who reacted
  };
  replyTo?: string; // ID of the message being replied to
  threadId?: string; // For thread support
  isEdited?: boolean;
  deleted?: boolean;
  deletedBy?: string; // ID of user who deleted the message
  deletedByAdmin?: boolean; // Flag to indicate admin deletion
  metadata?: {
    [key: string]: any;
  };
}