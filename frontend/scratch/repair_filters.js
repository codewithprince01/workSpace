const fs = require('fs');
const path = 'd:\\Rohit\\hehe\\worklenz\\frontend\\src\\components\\task-management\\improved-task-filters.tsx';
let content = fs.readFileSync(path, 'utf8');

const startMarker = 'const handleSelectionChange = useCallback(';
const endMarker = '[dispatch, projectId, position, currentTaskAssignees, currentTaskLabels, kanbanState]';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newFunction = `const handleSelectionChange = useCallback(
    (sectionId: string, values: string[]) => {
      if (!projectId) return;

      if (position === 'board') {
        // Enhanced Kanban logic
        if (sectionId === 'groupBy' && values.length > 0) {
          dispatch(setKanbanGroupBy(values[0] as any));
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'priority') {
          dispatch(setKanbanPriorities(values));
          dispatch(setPriorities(values));
          dispatch(fetchEnhancedKanbanGroups(projectId));
          return;
        }
        if (sectionId === 'assignees') {
          // Update individual assignee selections
          const currentAssignees = kanbanState.taskAssignees || [];
          
          currentAssignees.forEach((assignee: any) => {
            if (assignee.selected) {
              dispatch(setTaskAssigneeSelection({ id: assignee.id, selected: false }));
            }
          });

          values.forEach(id => {
            dispatch(setTaskAssigneeSelection({ id, selected: true }));
          });

          dispatch(fetchEnhancedKanbanGroups(projectId));

          // Also update taskReducer state
          const updatedAssignees = currentTaskAssignees.map(member => ({
            ...member,
            selected: values.includes(String(member.id || member._id || '')),
          }));
          dispatch(setMembers(updatedAssignees));

          return;
        }
        if (sectionId === 'labels') {
          // Update individual label selections
          const currentLabels = kanbanState.labels || [];

          currentLabels.forEach((label: any) => {
            if (label.selected) {
              dispatch(setLabelSelection({ id: label.id, selected: false }));
            }
          });

          values.forEach(id => {
            dispatch(setLabelSelection({ id, selected: true }));
          });

          dispatch(fetchEnhancedKanbanGroups(projectId));

          // Also update taskReducer state
          const updatedLabels = currentTaskLabels.map(label => ({
            ...label,
            selected: values.includes(String(label.id || label._id || '')),
          }));
          dispatch(setLabels(updatedLabels));

          return;
        }
      } else {
        // List view logic
        if (sectionId === 'groupBy' && values.length > 0) {
          dispatch(setCurrentGrouping(values[0] as 'status' | 'priority' | 'phase'));
          dispatch(fetchTasksV3(projectId));
          return;
        }
        if (sectionId === 'priority') {
          dispatch(setPriorities(values));
          dispatch(fetchTasksV3(projectId));
          return;
        }
        if (sectionId === 'assignees') {
          const updatedAssignees = currentTaskAssignees.map(member => ({
            ...member,
            selected: values.includes(member.id || ''),
          }));
          dispatch(setMembers(updatedAssignees));
          dispatch(fetchTasksV3(projectId));
          return;
        }
        if (sectionId === 'labels') {
          const updatedLabels = currentTaskLabels.map(label => ({
            ...label,
            selected: values.includes(label.id || ''),
          }));
          dispatch(setLabels(updatedLabels));
          dispatch(fetchTasksV3(projectId));
          return;
        }
      }
    },
    `;

 content = content.substring(0, startIndex) + newFunction + content.substring(endIndex);
 fs.writeFileSync(path, content, 'utf8');
 console.log('Successfully repaired handleSelectionChange');
} else {
 console.log('Could not find function markers', startIndex, endIndex);
}
