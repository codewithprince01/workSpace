import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { getUserSession } from '@/utils/session-helper';
import { ILocalSession } from '@/types/auth/local-session.types';

export interface ProjectRole {
  isProjectOwner: boolean;
  projectRole: 'owner' | 'admin' | 'member' | 'viewer' | null;
  
  // Team ownership context - for settings access control
  isInOwnTeam: boolean;            // True if viewing own team's project, false if invited to another team
  
  // Core restrictions: only Reports and Invites
  canAccessReports: boolean;      // Owner only
  canAccessSettings: boolean;
  canInviteMembers: boolean;       // Owner/Admin only
  
  // Critical admin actions
  canDeleteProject: boolean;       // Owner only
  canArchiveProject: boolean;      // Owner only
  
  // Note: All members CAN:
  // - View project
  // - Edit project details  
  // - Access all tabs (Tasks, Board, Insights, Files, Members, Updates)
  // - Create/edit/delete tasks
  // - View members
  // - Use filters and search
}

interface ProjectRoleContextType {
  projectRole: ProjectRole;
  setCurrentProject: (projectId: string | null, ownerId?: string | null, role?: string | null) => void;
  checkProjectOwnership: (projectId: string, ownerId: string) => boolean;
}

const defaultProjectRole: ProjectRole = {
  isProjectOwner: false,
  projectRole: null,
  isInOwnTeam: true, // Default to true (user is in their own team)
  // Default to true so team admins can access these when no project is selected (home page)
  // These will be set to false only when inside a project the user doesn't own
  canAccessReports: true,
  canAccessSettings: true,
  canInviteMembers: true,
  canDeleteProject: false,
  canArchiveProject: false,
};

const ProjectRoleContext = createContext<ProjectRoleContextType | undefined>(undefined);

export const ProjectRoleProvider = ({ children }: { children: ReactNode }) => {
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole>(defaultProjectRole);

  const getUser = useCallback((): ILocalSession | null => {
    return getUserSession();
  }, []);

  const checkProjectOwnership = useCallback((projectId: string, ownerId: string): boolean => {
    const user = getUser();
    if (!user?.id) return false;
    return user.id.toString() === ownerId.toString();
  }, [getUser]);

  const setCurrentProject = useCallback((projectId: string | null, ownerId?: string | null, role?: string | null) => {
    setCurrentProjectId(projectId);
    const user = getUser();
    
    if (projectId) {
      if (ownerId) setProjectOwnerId(ownerId);
      
      const userId = user?.id?.toString();
      const ownerIdStr = ownerId?.toString();
      const isOwner = !!((userId && ownerIdStr && userId === ownerIdStr) || role === 'owner');
      
      const teamRole = user?.team_role;
      const isAdminFlag = user?.is_admin;
      const isOwnerFlag = user?.owner;
      const isSuperAdminMode = teamRole === 'super_admin' || user?.is_super_admin;
      
      // Robust check for team-level admin/owner status
      const isTeamAdminOrOwner = 
        teamRole === 'owner' || 
        teamRole === 'admin' || 
        isAdminFlag === true || 
        isOwnerFlag === true || 
        isSuperAdminMode;
        
      const isInOwnTeam = isTeamAdminOrOwner;

      let effectiveRole = role;
      if (isOwner) effectiveRole = 'owner';
      else if (isSuperAdminMode) effectiveRole = 'owner';
      else if (!effectiveRole) effectiveRole = 'member';

      // BUG FIX: team-level admin role ALWAYS preserves admin permissions even inside projects
      // where the user was invited as a project "member". Team admin > project member.
      const isAdminOrOwner = isOwner || effectiveRole === 'admin' || isSuperAdminMode || isTeamAdminOrOwner;

      console.log('🛡️ [PROJECT-ROLE] Setting role:', {
        projectId,
        projectRole: effectiveRole,
        teamRole,
        isTeamAdminOrOwner,
        isAdminOrOwner,
        isInOwnTeam
      });

      setProjectRole({
        isProjectOwner: isOwner || isSuperAdminMode,
        projectRole: effectiveRole as any,
        isInOwnTeam,
        canAccessReports: isAdminOrOwner,
        canAccessSettings: isAdminOrOwner,
        canInviteMembers: isAdminOrOwner,
        canDeleteProject: isOwner || isSuperAdminMode,
        canArchiveProject: isAdminOrOwner,
      });
    } else {
      const teamRole = user?.team_role;
      const isSuperAdminMode = teamRole === 'super_admin' || user?.is_super_admin;
      const isTeamAdminOrOwner = 
        teamRole === 'owner' || 
        teamRole === 'admin' || 
        user?.is_admin === true || 
        user?.owner === true || 
        isSuperAdminMode;
        
      const isInOwnTeam = isTeamAdminOrOwner;

      console.log('🛡️ [PROJECT-ROLE] Clearing project (No Project Context):', {
        teamRole,
        isTeamAdminOrOwner,
        isInOwnTeam
      });

      setProjectRole({
        isProjectOwner: false,
        projectRole: null,
        isInOwnTeam,
        canAccessReports: isTeamAdminOrOwner,
        canAccessSettings: isTeamAdminOrOwner,
        canInviteMembers: isTeamAdminOrOwner,
        canDeleteProject: false,
        canArchiveProject: false,
      });
      setProjectOwnerId(null);
    }
  }, [getUser]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      setProjectRole(defaultProjectRole);
      setCurrentProjectId(null);
      setProjectOwnerId(null);
      return;
    }
    
    if (!currentProjectId) {
      const teamRole = user?.team_role;
      const isSuperAdminMode = teamRole === 'super_admin' || user?.is_super_admin;
      const isTeamAdminOrOwner = 
        teamRole === 'owner' || 
        teamRole === 'admin' || 
        user?.is_admin === true || 
        user?.owner === true || 
        isSuperAdminMode;
        
      const isInOwnTeam = isTeamAdminOrOwner;

      setProjectRole({
        isProjectOwner: false,
        projectRole: null,
        isInOwnTeam,
        canAccessReports: isTeamAdminOrOwner,
        canAccessSettings: isTeamAdminOrOwner,
        canInviteMembers: isTeamAdminOrOwner,
        canDeleteProject: false,
        canArchiveProject: false,
      });
    }
  }, [getUser, currentProjectId]);

  const contextValue: ProjectRoleContextType = {
    projectRole,
    setCurrentProject,
    checkProjectOwnership,
  };

  return (
    <ProjectRoleContext.Provider value={contextValue}>
      {children}
    </ProjectRoleContext.Provider>
  );
};

export const useProjectRole = (): ProjectRoleContextType => {
  const context = useContext(ProjectRoleContext);
  if (!context) {
    throw new Error('useProjectRole must be used within a ProjectRoleProvider');
  }
  return context;
};
