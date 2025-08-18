// (removed unused Timestamp import)

export type UserRole = 'admin' | 'teacher' | 'student';

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
  // Additional student details
  parentName?: string;
  parentContact?: string;
  age?: number;
  gender?: 'male' | 'female';
  address?: string;
  phoneNumber?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  notes?: string;
  birthDate?: Date;
  temporaryClasses?: string[]; // IDs of classes where teacher is substituting
  // Account activation status
  accountStatus?: 'active' | 'pending_approval';
  tempId?: string; // Temporary ID for pre-created accounts
  // Notification meta
  pendingNotified?: boolean; // Whether admins have been notified about this pending teacher
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

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Date;
  attachments?: string[];
}