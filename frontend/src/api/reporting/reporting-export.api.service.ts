import { toQueryString } from '@/utils/toQueryString';
import { API_BASE_URL } from '@/shared/constants';
import { ITimeLogBreakdownReq } from '@/types/reporting/reporting.types';
import apiClient from '@/api/api-client';

const rootUrl = `${import.meta.env.VITE_API_URL}${API_BASE_URL}/reporting-export`;

// Helper function to handle downloads with authentication headers
const downloadReport = async (url: string, filename: string): Promise<void> => {
  try {
    const fullUrl = `${rootUrl}${url}`;
    const response = await apiClient.get(fullUrl, {
      responseType: 'blob',
      headers: {
        'X-Skip-Error-Alert': 'true',
      },
    });
    
    // Create a link element, hide it, direct it to the blob, and click it
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Download failed:', error);
    throw error; // Re-throw error so caller can handle it
  }
};

export const reportingExportApiService = {
  exportOverviewProjectsByTeam(teamId: string, teamName: string) {
    const params = toQueryString({
      team_id: teamId,
      team_name: teamName,
    });
    void downloadReport(`/reporting-export/overview/projects${params}`, `Projects_Report_${teamName}.xlsx`);
  },

  exportOverviewMembersByTeam(teamId: string, teamName: string) {
    const params = toQueryString({
      team_id: teamId,
      team_name: teamName,
    });
    void downloadReport(`/reporting-export/overview/members${params}`, `Members_Summary_${teamName}.xlsx`);
  },

  exportAllocation(
    archived: boolean,
    teams: string[],
    projects: string[],
    duration: string | undefined,
    date_range: string[],
    billable = true,
    nonBillable = true
  ) {
    const teamsString = teams?.join(',');
    const projectsString = projects.join(',');
    const params = toQueryString({
      teams: teamsString,
      projects: projectsString,
      duration: duration,
      date_range: date_range,
      include_archived: archived,
      billable,
      nonBillable,
    });
    void downloadReport(`/reporting-export/allocation/export${params}`, `Allocation_Report.xlsx`);
  },

  exportProjects(teamName: string | undefined) {
    const params = toQueryString({
      team_name: teamName,
    });
    void downloadReport(`/reporting-export/projects/export${params}`, `Projects_Detailed_${teamName}.xlsx`);
  },

  async exportMembers(
    teamName: string | undefined,
    duration: string | null | undefined,
    date_range: string[] | null,
    archived: boolean
  ) {
    const params = toQueryString({
      team_name: teamName,
      duration: duration,
      date_range: date_range,
      archived: archived,
    });
    await downloadReport(`/members/export${params}`, `Members_Report_${teamName || 'All'}.xlsx`);
  },

  exportProjectMembers(
    projectId: string,
    projectName: string,
    teamName: string | null | undefined
  ) {
    const params = toQueryString({
      project_id: projectId,
      project_name: projectName,
      team_name: teamName ? teamName : null,
    });
    void downloadReport(`/reporting-export/project-members/export${params}`, `Project_Members_${projectName}.xlsx`);
  },

  exportProjectTasks(projectId: string, projectName: string, teamName: string | null | undefined) {
    const params = toQueryString({
      project_id: projectId,
      project_name: projectName,
      team_name: teamName ? teamName : null,
    });
    void downloadReport(`/reporting-export/project-tasks/export${params}`, `Project_Tasks_${projectName}.xlsx`);
  },

  exportMemberProjects(
    memberId: string,
    teamId: string | null,
    memberName: string,
    teamName: string | null | undefined,
    archived: boolean
  ) {
    const params = toQueryString({
      team_member_id: memberId,
      team_id: teamId,
      team_member_name: memberName,
      team_name: teamName ? teamName : null,
      archived: archived,
    });
    void downloadReport(`/reporting-export/member-projects/export${params}`, `Member_Projects_${memberName}.xlsx`);
  },

  exportMemberTasks(
    memberId: string,
    memberName: string,
    teamName: string | null | undefined,
    body: any | null
  ) {
    const params = toQueryString({
      team_member_id: memberId,
      team_member_name: memberName,
      team_name: teamName ? teamName : null,
      duration: body.duration,
      date_range: body.date_range,
      only_single_member: body.only_single_member ? body.only_single_member : false,
      archived: body.archived ? body.archived : false,
    });
    void downloadReport(`/reporting-export/member-tasks/export${params}`, `Member_Tasks_${memberName}.xlsx`);
  },

  exportFlatTasks(
    memberId: string,
    memberName: string,
    projectId: string | null,
    projectName: string | null
  ) {
    const params = toQueryString({
      team_member_id: memberId,
      team_member_name: memberName,
      project_id: projectId,
      project_name: projectName,
    });
    void downloadReport(`/reporting-export/flat-tasks/export${params}`, `Flat_Tasks_${memberName}.xlsx`);
  },

  exportProjectTimeLogs(body: ITimeLogBreakdownReq, projectName: string) {
    const params = toQueryString({
      id: body.id,
      duration: body.duration,
      date_range: body.date_range,
      project_name: projectName,
    });
    void downloadReport(`/reporting-export/projects-time-log-breakdown/export${params}`, `TimeLogs_${projectName}.xlsx`);
  },

  exportMemberTimeLogs(body: any | null) {
    const params = toQueryString({
      team_member_id: body.team_member_id,
      team_id: body.team_id,
      duration: body.duration,
      date_range: body.date_range,
      member_name: body.member_name,
      team_name: body.team_name,
      archived: body.archived ? body.archived : false,
    });
    void downloadReport(`/reporting-export/member-time-log-breakdown/export${params}`, `TimeLogs_${body.member_name}.xlsx`);
  },

  exportMemberActivityLogs(body: any | null) {
    const params = toQueryString({
      team_member_id: body.team_member_id,
      team_id: body.team_id,
      duration: body.duration,
      date_range: body.date_range,
      member_name: body.member_name,
      team_name: body.team_name,
      archived: body.archived ? body.archived : false,
    });
    void downloadReport(`/reporting-export/member-activity-log-breakdown/export${params}`, `ActivityLogs_${body.member_name}.xlsx`);
  },
};
