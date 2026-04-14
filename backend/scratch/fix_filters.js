const fs = require('fs');
const path = require('path');

const filePath = 'd:\\Rohit\\hehe\\worklenz\\frontend\\src\\components\\task-management\\improved-task-filters.tsx';
let content = fs.readFileSync(filePath, 'utf8');

console.log('File length:', content.length);

// 1. Update Imports
const oldImports = `  setTaskAssigneeSelection,
  setLabelSelection,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';`;

const newImports = `  setTaskAssigneeSelection,
  setLabelSelection,
  fetchEnhancedKanbanLabels,
  fetchEnhancedKanbanTaskAssignees,
  resetState as resetKanbanState,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';`;

if (content.includes(oldImports)) {
    content = content.replace(oldImports, newImports);
    console.log('Updated imports.');
} else {
    console.log('Could not find imports block verbatim.');
}

// 2. Add useEffect for Board data fetching
const oldEffectAnchor = `    return () => {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();
    };
  }, [dispatch, projectView]);`;

const newEffect = `    return () => {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();
    };
  }, [dispatch, projectView]);

  // Fetch Board-specific data (labels, members) when project changes
  useEffect(() => {
    if (projectId && position === 'board') {
      dispatch(fetchEnhancedKanbanLabels(projectId));
      dispatch(fetchEnhancedKanbanTaskAssignees(projectId));
    }
  }, [projectId, position, dispatch]);`;

if (content.includes(oldEffectAnchor)) {
    content = content.replace(oldEffectAnchor, newEffect);
    console.log('Updated useEffect.');
} else {
    console.log('Could not find useEffect anchor.');
}

// 3. Update clearAllFilters
const oldClearAllAnchor = `      // Execute Redux updates
      reduxUpdates();

      // Use a short timeout to batch Redux state updates before API call
      // This ensures all filter state is updated before the API call
      setTimeout(() => {
        if (projectId) {
          dispatch(fetchTasksV3(projectId));
        }
        // Reset loading state after API call is initiated`;

const newClearAll = `      // Execute Redux updates
      reduxUpdates();

      // Board view specific clearing
      if (position === 'board') {
        dispatch(setKanbanSearch(''));
        dispatch(resetKanbanState());
      }

      // Use a short timeout to batch Redux state updates before API call
      // This ensures all filter state is updated before the API call
      setTimeout(() => {
        if (projectId) {
          if (position === 'board') {
            dispatch(fetchEnhancedKanbanGroups(projectId));
            // Re-fetch labels and assignees to ensure clean state
            dispatch(fetchEnhancedKanbanLabels(projectId));
            dispatch(fetchEnhancedKanbanTaskAssignees(projectId));
          } else {
            dispatch(fetchTasksV3(projectId));
          }
        }
        // Reset loading state after API call is initiated`;

if (content.includes(oldClearAllAnchor)) {
    content = content.replace(oldClearAllAnchor, newClearAll);
    console.log('Updated clearAllFilters.');
} else {
    console.log('Could not find clearAllFilters anchor.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('File written successfully.');
