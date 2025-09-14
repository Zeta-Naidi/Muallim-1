import { UserRole } from '../types';

export interface Permission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
}

export interface RolePermissions {
  users: Permission;
  students: Permission;
  teachers: Permission;
  classes: Permission;
  payments: Permission;
  receipts: Permission;
  homework: Permission;
  lessons: Permission;
  materials: Permission;
  attendance: Permission;
  grades: Permission;
}

// Define permissions for each role
const rolePermissions: Record<UserRole, RolePermissions> = {
  admin: {
    users: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    students: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    teachers: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    classes: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    payments: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    receipts: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    homework: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    lessons: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    materials: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    attendance: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    grades: { canView: true, canEdit: true, canDelete: true, canCreate: true },
  },
  operatore: {
    users: { canView: true, canEdit: true, canDelete: false, canCreate: false },
    students: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    teachers: { canView: true, canEdit: true, canDelete: false, canCreate: false },
    classes: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    payments: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    receipts: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    homework: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    lessons: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    materials: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    attendance: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    grades: { canView: true, canEdit: true, canDelete: false, canCreate: true },
  },
  teacher: {
    users: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    students: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    teachers: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    classes: { canView: true, canEdit: true, canDelete: false, canCreate: false },
    payments: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    receipts: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    homework: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    lessons: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    materials: { canView: true, canEdit: true, canDelete: true, canCreate: true },
    attendance: { canView: true, canEdit: true, canDelete: false, canCreate: true },
    grades: { canView: true, canEdit: true, canDelete: false, canCreate: true },
  },
  student: {
    users: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    students: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    teachers: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    classes: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    payments: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    receipts: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    homework: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    lessons: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    materials: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    attendance: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    grades: { canView: true, canEdit: false, canDelete: false, canCreate: false },
  },
  parent: {
    users: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    students: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    teachers: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    classes: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    payments: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    receipts: { canView: false, canEdit: false, canDelete: false, canCreate: false },
    homework: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    lessons: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    materials: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    attendance: { canView: true, canEdit: false, canDelete: false, canCreate: false },
    grades: { canView: true, canEdit: false, canDelete: false, canCreate: false },
  },
};

// Utility functions to check permissions
export const hasPermission = (
  userRole: UserRole,
  resource: keyof RolePermissions,
  action: keyof Permission
): boolean => {
  return rolePermissions[userRole]?.[resource]?.[action] || false;
};

export const canViewResource = (userRole: UserRole, resource: keyof RolePermissions): boolean => {
  return hasPermission(userRole, resource, 'canView');
};

export const canEditResource = (userRole: UserRole, resource: keyof RolePermissions): boolean => {
  return hasPermission(userRole, resource, 'canEdit');
};

export const canDeleteResource = (userRole: UserRole, resource: keyof RolePermissions): boolean => {
  return hasPermission(userRole, resource, 'canDelete');
};

export const canCreateResource = (userRole: UserRole, resource: keyof RolePermissions): boolean => {
  return hasPermission(userRole, resource, 'canCreate');
};

// Check if user has admin-like permissions (admin or operatore)
export const hasAdminAccess = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'operatore';
};

// Get all permissions for a role
export const getRolePermissions = (userRole: UserRole): RolePermissions => {
  return rolePermissions[userRole];
};
