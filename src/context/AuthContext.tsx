import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { SEED_USERS, storage } from '../services/storage';

interface AuthContextType {
  currentUser: User;
  switchUser: (userId: string) => void;
  switchRole: (role: Role) => void;
  users: User[];
  canRegisterInstrument: boolean;
  canExecuteTest: boolean;
  canSubmitTest: boolean;
  canReviewTest: boolean;
  canApproveTest: boolean;
  canFinalizeReport: boolean;
  canViewAuditTrail: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('nawi_active_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = SEED_USERS.find((u) => u.id === parsed.id);
        if (match) return match;
      }
    } catch {}
    return SEED_USERS[0]; // Default to Vikram Mehta (Tester)
  });

  const switchUser = (userId: string) => {
    const found = SEED_USERS.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      localStorage.setItem('nawi_active_user', JSON.stringify(found));
      storage.addAuditLog({
        userId: found.id,
        userName: found.name,
        userRole: found.role,
        action: 'LOGIN',
        recordId: found.id,
        details: `Authenticated as ${found.name} (${found.designation}) with [${found.role.toUpperCase()}] privileges`,
      });
    }
  };

  const switchRole = (role: Role) => {
    const userForRole = SEED_USERS.find((u) => u.role === role) || SEED_USERS[0];
    switchUser(userForRole.id);
  };

  // Enforce Permissions strictly as mandated by Section 1:
  const role = currentUser.role;
  const canRegisterInstrument = role === 'tester' || role === 'admin';
  const canExecuteTest = role === 'tester' || role === 'admin';
  const canSubmitTest = role === 'tester' || role === 'admin';
  const canReviewTest = role === 'reviewer' || role === 'admin';
  const canApproveTest = role === 'approver' || role === 'admin';
  const canFinalizeReport = role === 'approver' || role === 'admin';
  const canViewAuditTrail = role === 'admin' || role === 'reviewer' || role === 'approver';
  const canManageUsers = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        switchUser,
        switchRole,
        users: SEED_USERS,
        canRegisterInstrument,
        canExecuteTest,
        canSubmitTest,
        canReviewTest,
        canApproveTest,
        canFinalizeReport,
        canViewAuditTrail,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
