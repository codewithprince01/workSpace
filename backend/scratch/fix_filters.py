import os

file_path = r'd:\Rohit\hehe\worklenz\frontend\src\components\task-management\improved-task-filters.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Imports
old_imports = """  setTaskAssigneeSelection,
  setLabelSelection,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';"""

new_imports = """  setTaskAssigneeSelection,
  setLabelSelection,
  fetchEnhancedKanbanLabels,
  fetchEnhancedKanbanTaskAssignees,
  resetState as resetKanbanState,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';"""

if old_imports in content:
    content = content.replace(old_imports, new_imports)
    print("Updated imports.")
else:
    # Try with different indentation or line endings
    print("Could not find imports block verbatim. Trying fallback...")
    content = content.replace("setLabelSelection,\n} from '@/features/enhanced-kanban/enhanced-kanban.slice';", 
                              "setLabelSelection,\n  fetchEnhancedKanbanLabels,\n  fetchEnhancedKanbanTaskAssignees,\n  resetState as resetKanbanState,\n} from '@/features/enhanced-kanban/enhanced-kanban.slice';")

# 2. Add useEffect for Board data fetching
old_effect_anchor = """    return () => {
      debouncedFilterChangeRef.current?.cancel();
      debouncedSearchChangeRef.current?.cancel();
    };
  }, [dispatch, projectView]);"""

new_effect = """    return () => {
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
  }, [projectId, position, dispatch]);"""

if old_effect_anchor in content:
    content = content.replace(old_effect_anchor, new_effect)
    print("Updated useEffect.")
else:
    print("Could not find useEffect anchor.")

# 3. Update clearAllFilters
old_clear_all_anchor = """      // Execute Redux updates
      reduxUpdates();

      // Use a short timeout to batch Redux state updates before API call
      // This ensures all filter state is updated before the API call
      setTimeout(() => {
        if (projectId) {
          dispatch(fetchTasksV3(projectId));
        }
        // Reset loading state after API call is initiated"""

new_clear_all = """      // Execute Redux updates
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
        // Reset loading state after API call is initiated"""

if old_clear_all_anchor in content:
    content = content.replace(old_clear_all_anchor, new_clear_all)
    print("Updated clearAllFilters.")
else:
    print("Could not find clearAllFilters anchor.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
