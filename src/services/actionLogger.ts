import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface ActionLog {
  id?: string;
  userId: string;
  userEmail: string;
  userRole: string;
  action: string;
  targetType?: string; // 'user', 'student', 'class', 'payment', etc.
  targetId?: string;
  targetName?: string;
  details?: Record<string, any>;
  timestamp: Timestamp | Date;
  ipAddress?: string;
  userAgent?: string;
}

export type ActionType = 
  // User management actions
  | 'user_created'
  | 'user_updated' 
  | 'user_deleted'
  | 'user_approved'
  | 'user_rejected'
  | 'user_role_changed'
  | 'user_status_changed'
  // Student management actions
  | 'student_created'
  | 'student_updated'
  | 'student_deleted'
  | 'student_enrolled'
  | 'student_unenrolled'
  // Class management actions
  | 'class_created'
  | 'class_updated'
  | 'class_deleted'
  | 'class_assigned'
  | 'class_unassigned'
  // Payment actions
  | 'payment_created'
  | 'payment_updated'
  | 'payment_deleted'
  | 'payment_processed'
  // Authentication actions
  | 'login'
  | 'logout'
  | 'password_reset'
  // System actions
  | 'data_export'
  | 'settings_changed'
  | 'backup_created';

class ActionLogger {
  private static instance: ActionLogger;
  
  private constructor() {}
  
  public static getInstance(): ActionLogger {
    if (!ActionLogger.instance) {
      ActionLogger.instance = new ActionLogger();
    }
    return ActionLogger.instance;
  }

  /**
   * Log a user action to the database
   */
  async logAction(
    userId: string,
    userEmail: string,
    userRole: string,
    action: ActionType,
    options?: {
      targetType?: string;
      targetId?: string;
      targetName?: string;
      details?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const logData: any = {
        userId,
        userEmail,
        userRole,
        action,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
      };

      // Only add optional fields if they have values (not undefined)
      const clientIP = await this.getClientIP();
      if (clientIP !== undefined) {
        logData.ipAddress = clientIP;
      }
      
      if (options?.targetType !== undefined) {
        logData.targetType = options.targetType;
      }
      if (options?.targetId !== undefined) {
        logData.targetId = options.targetId;
      }
      if (options?.targetName !== undefined) {
        logData.targetName = options.targetName;
      }
      if (options?.details !== undefined) {
        logData.details = options.details;
      }

      await addDoc(collection(db, 'actionLogs'), logData);
    } catch (error) {
      console.error('Error logging action:', error);
      // Don't throw error to avoid breaking the main functionality
    }
  }

  /**
   * Get action logs with filtering and pagination
   */
  async getActionLogs(options?: {
    userId?: string;
    action?: ActionType;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    limitCount?: number;
  }): Promise<ActionLog[]> {
    try {
      let q = query(collection(db, 'actionLogs'));

      // Apply filters
      if (options?.userId) {
        q = query(q, where('userId', '==', options.userId));
      }
      if (options?.action) {
        q = query(q, where('action', '==', options.action));
      }
      if (options?.targetType) {
        q = query(q, where('targetType', '==', options.targetType));
      }
      if (options?.startDate) {
        q = query(q, where('timestamp', '>=', options.startDate));
      }
      if (options?.endDate) {
        q = query(q, where('timestamp', '<=', options.endDate));
      }

      // Order by timestamp (most recent first)
      q = query(q, orderBy('timestamp', 'desc'));

      // Apply limit
      if (options?.limitCount) {
        q = query(q, limit(options.limitCount));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActionLog));
    } catch (error) {
      console.error('Error fetching action logs:', error);
      return [];
    }
  }

  /**
   * Get action statistics
   */
  async getActionStats(options?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'user' | 'action' | 'day';
  }): Promise<Record<string, number>> {
    try {
      const logs = await this.getActionLogs({
        startDate: options?.startDate,
        endDate: options?.endDate,
        limitCount: 1000 // Reasonable limit for stats
      });

      const stats: Record<string, number> = {};

      logs.forEach(log => {
        let key: string;
        
        switch (options?.groupBy) {
          case 'user':
            key = `${log.userEmail} (${log.userRole})`;
            break;
          case 'action':
            key = log.action;
            break;
          case 'day':
            const date = log.timestamp instanceof Timestamp 
              ? log.timestamp.toDate() 
              : new Date(log.timestamp);
            key = date.toISOString().split('T')[0];
            break;
          default:
            key = log.action;
        }

        stats[key] = (stats[key] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching action stats:', error);
      return {};
    }
  }

  /**
   * Get client IP address (simplified version)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      // In a real application, you might want to use a service to get the real IP
      // For now, we'll return undefined and handle it gracefully
      return undefined;
    } catch {
      return undefined;
    }
  }
}

// Export singleton instance
export const actionLogger = ActionLogger.getInstance();

// Convenience function for easy logging
export const logUserAction = (
  userId: string,
  userEmail: string,
  userRole: string,
  action: ActionType,
  options?: {
    targetType?: string;
    targetId?: string;
    targetName?: string;
    details?: Record<string, any>;
  }
) => {
  return actionLogger.logAction(userId, userEmail, userRole, action, options);
};
