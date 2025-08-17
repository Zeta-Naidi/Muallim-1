import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().min(2),
  role: z.enum(['admin', 'teacher', 'student']),
  classId: z.string().optional(),
  createdAt: z.date()
});

export const homeworkSchema = z.object({
  id: z.string(),
  title: z.string().min(3),
  description: z.string().min(10),
  classId: z.string(),
  className: z.string().optional(),
  dueDate: z.date(),
  attachmentUrls: z.array(z.string()).optional(),
  createdBy: z.string(),
  teacherName: z.string().optional(),
  createdAt: z.date(),
  status: z.enum(['active', 'completed'])
});

export const attendanceSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  classId: z.string(),
  date: z.date(),
  status: z.enum(['present', 'absent', 'justified']),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.date()
});

export type User = z.infer<typeof userSchema>;
export type Homework = z.infer<typeof homeworkSchema>;
export type Attendance = z.infer<typeof attendanceSchema>;