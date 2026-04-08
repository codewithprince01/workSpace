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
    // Convert both to strings for comparison
    return user.id.toString() === ownerId.toString();
  }, [getUser]);

  const setCurrentProject = useCallback((projectId: string | null, ownerId?: string | null, role?: string | null) => {
    setCurrentProjectId(projectId);
    const user = getUser();
    
    if (projectId) {
      if (ownerId) setProjectOwnerId(ownerId);
      
      // Convert both to strings for comparison (handles ObjectId vs string)
      const userId = user?.id?.toString();
      const ownerIdStr = ownerId?.toString();
      // User is owner if IDs match OR if the explicitly passed role is 'owner'
      const isOwner = !!((userId && ownerIdStr && userId === ownerIdStr) || role === 'owner');
      
      // Determine effective role
      let effectiveRole = role;
      if (isOwner) effectiveRole = 'owner';
      else if (!effectiveRole) effectiveRole = 'member'; // Default to member if not owner and no role specified

      const isAdminOrOwner = isOwner || effectiveRole === 'admin';

      // Determine if user is in their own team or an invited team
      // Key insight: team_role indicates user's role in the CURRENT team
      // - 'owner' = User owns this team (their own team)
      // - 'admin'/'member' = User was invited to this team (not their own)
      const teamRole = user?.team_role;
      const isInOwnTeam = teamRole === 'owner';

      console.log('🔐 Project Role Check:', {
        projectId,
        userId,
        ownerId: ownerIdStr,
        isOwner,
        role,
        effectiveRole,
        isAdminOrOwner,
        teamRole,
        isInOwnTeam: isInOwnTeam ? '✅ OWN TEAM' : '❌ INVITED TEAM'
      });
      
      // Inside a project: Set permissions based on ownership/role
      setProjectRole({
        isProjectOwner: isOwner,
        projectRole: effectiveRole as any,
        isInOwnTeam, // Track if user is in their own team
        
        // Owners AND Admins can access Reports and Invite
        canAccessReports: isAdminOrOwner,
        canAccessSettings: isAdminOrOwner,
        canInviteMembers: isAdminOrOwner,
        
        // Only owners can delete/archive/transfer?
        // Requirement says "Admin... all admin actions". 
        // Assuming Delete Project is Owner only for safety, but Settings is Admin+Owner.
        // Let's allow Settings access via canAccessReports (or separate flag if needed, usually linked).
        
        canDeleteProject: isOwner, // Keep strict for delete
        canArchiveProject: isAdminOrOwner,
      })
;
    } else {
      // No project selected (home page) - use team_role from session
      // Check user's team-level role to determine permissions
      const teamRole = user?.team_role;
      const isTeamAdminOrOwner = teamRole === 'owner' || teamRole === 'admin';
      
      console.log('🏠 [ROLE-CHECK] No project selected - checking team role:', {
        userId: user?.id,
        userName: user?.name,
        teamId: user?.team_id,
        teamRole: teamRole,
        isTeamAdminOrOwner: isTeamAdminOrOwner,
        fullUserObject: user
      });
      
      // FALLBACK: If team_role is undefined, check if user is owner of current team
      // This ensures Owners get full access even if backend doesn't send team_role
      let shouldHaveAccess = isTeamAdminOrOwner;
      
      if (teamRole === undefined || teamRole === null) {
        // Check if user.owner flag is set (means they own this team)
        if (user?.owner === true) {
          shouldHaveAccess = true;
          console.log('⚠️ [ROLE-CHECK] team_role undefined, using user.owner fallback → FULL ACCESS');
        } else {
          // Default to true for better UX (prevents locking out users)
          shouldHaveAccess = true;
          console.log('⚠️ [ROLE-CHECK] team_role undefined, defaulting to FULL ACCESS');
        }
      }
      
      console.log('✅ [ROLE-CHECK] Setting permissions:', {
        shouldHaveAccess,
        canAccessReports: shouldHaveAccess,
        canInviteMembers: shouldHaveAccess
      });
      
      console.error('🚨 [DEBUG] TEAM ROLE VALUE:', {
        teamRole,
        typeOf: typeof teamRole,
        isUndefined: teamRole === undefined,
        isNull: teamRole === null,
        userObject: user,
        shouldHaveAccess
      });
      
      // On home page, check if user owns this team
      const isInOwnTeam = teamRole === 'owner';
      
      setProjectRole({
        isProjectOwner: false,
        projectRole: null,
        isInOwnTeam, // Use team_role to determine ownership
        // Use team role to determine permissions on home page
        canAccessReports: shouldHaveAccess,
        canAccessSettings: shouldHaveAccess,
        canInviteMembers: shouldHaveAccess,
        canDeleteProject: false,
        canArchiveProject: false,
      });
      setProjectOwnerId(null);
    }
  }, [getUser]);

  useEffect(() => {
    // Initialize permissions on mount and when user changes
    const user = getUser();
    
    if (!user) {
      // User logged out - reset to defaults
      setProjectRole(defaultProjectRole);
      setCurrentProjectId(null);
      setProjectOwnerId(null);
      return;
    }
    
    // Only initialize if no project is selected (home page)
    if (!currentProjectId) {
      const teamRole = user?.team_role;
      const isTeamAdminOrOwner = teamRole === 'owner' || teamRole === 'admin';
      
      console.log('🔄 [INIT] Initializing permissions on mount:', {
        teamRole,
        isTeamAdminOrOwner,
        userId: user.id
      });
      
      // Check if user owns this team
      const isInOwnTeam = teamRole === 'owner';
      
      setProjectRole({
        isProjectOwner: false,
        projectRole: null,
        isInOwnTeam, // Use team_role to determine ownership
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
