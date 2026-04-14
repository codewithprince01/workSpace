const fs = require('fs');
const path = require('path');

const filePath = 'd:\\Rohit\\hehe\\worklenz\\frontend\\src\\components\\task-management\\improved-task-filters.tsx';
let content = fs.readFileSync(filePath, 'utf8');

console.log('File length:', content.length);

// Helper to replace block using fuzzy regex
function replaceBlock(regex, replacement, label) {
    if (regex.test(content)) {
        content = content.replace(regex, replacement);
        console.log(`Updated ${label}.`);
        return true;
    } else {
        console.log(`Could not find ${label} block.`);
        return false;
    }
}

// 1. Update Imports
// Match the imports from enhanced-kanban.slice
const importsRegex = /setTaskAssigneeSelection,\s+setLabelSelection,\s+\} from '@\/features\/enhanced-kanban\/enhanced-kanban\.slice';/s;
const newImports = `setTaskAssigneeSelection,
  setLabelSelection,
  fetchEnhancedKanbanLabels,
  fetchEnhancedKanbanTaskAssignees,
  resetState as resetKanbanState,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';`;

replaceBlock(importsRegex, newImports, 'imports');

// 2. Add useEffect for Board data fetching
const effectRegex = /return\s+\(\)\s+=>\s+\{\s+debouncedFilterChangeRef\.current\?\.cancel\(\);\s+debouncedSearchChangeRef\.current\?\.cancel\(\);\s+\};\s+\},\s+\[dispatch,\s+projectView\]\);/s;
const newEffect = `return () => {
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

replaceBlock(effectRegex, newEffect, 'useEffect');

// 3. Update clearAllFilters
const clearAllRegex = /\/\/ Execute Redux updates\s+reduxUpdates\(\);\s+\/\/ Use a short timeout to batch Redux state updates before API call.*?if\s+\(projectId\)\s+\{\s+dispatch\(fetchTasksV3\(projectId\)\);\s+\}/s;
const newClearAll = `// Execute Redux updates
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

// Note: The clearAllRegex needs to be careful. I'll use a slightly different approach for clearAll.
const clearAllExactRegex = /\/\/ Execute Redux updates\s+reduxUpdates\(\);\s+\/\/ Use a short timeout to batch Redux state updates before API call\s+\/\/ This ensures all filter state is updated before the API call\s+setTimeout\(\(\) => \{\s+if \(projectId\) \{\s+dispatch\(fetchTasksV3\(projectId\)\);\s+\}/s;

replaceBlock(clearAllExactRegex, newClearAll, 'clearAllFilters');

fs.writeFileSync(filePath, content, 'utf8');
console.log('File written successfully.');
