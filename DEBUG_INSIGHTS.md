## Debug Steps for Project Insights

The backend now has detailed logging enabled. Follow these steps to diagnose the issue:

### Step 1: Check Backend Console Logs

1. Open the terminal where `node server.js` is running
2. Navigate to any project in the frontend
3. Click on the "Insights" tab
4. Watch the backend console for debug output

You should see logs like:
```
=== PROJECT INSIGHTS DEBUG ===
Project ID: 67a1234567890abcdef12345
Include Archived: false
Query: {"project_id":"67a1234567890abcdef12345","is_archived":false}
Done Status IDs: []
Todo Status IDs: []
Total Tasks: 10
Completed Tasks: 0
Todo Tasks: 0
...
```

### Step 2: Analyze the Output

**If "Total Tasks: 0":**
- The project has no tasks created yet
- Solution: Create some tasks in the project first

**If "Total Tasks: 10" but "Completed Tasks: 0" and "Todo Tasks: 0":**
- The issue is with task statuses
- The tasks don't have statuses matching "done" or "todo" categories
- Solution: Check the TaskStatus collection

**If "Done Status IDs: []" or "Todo Status IDs: []":**
- Task statuses are not properly categorized
- Solution: Update task statuses to have proper categories

### Step 3: Check Task Statuses

The default task statuses created should have categories:
- "To Do" → category: "todo"
- "In Progress" → category: "doing" or "in_progress"  
- "Done" → category: "done"

### Step 4: Verify in MongoDB

If you have MongoDB access, run these queries:

```javascript
// Check if project has tasks
db.tasks.countDocuments({ project_id: ObjectId("YOUR_PROJECT_ID"), is_archived: false })

// Check task statuses
db.taskstatuses.find({ project_id: ObjectId("YOUR_PROJECT_ID") })

// Check tasks with their statuses
db.tasks.find({ project_id: ObjectId("YOUR_PROJECT_ID") }).limit(5)
```

### Step 5: Common Issues & Solutions

**Issue: All counts are zero**
- **Cause**: No tasks exist OR tasks don't have proper status_id
- **Solution**: 
  1. Create tasks in the project
  2. Ensure each task has a valid status_id

**Issue: Status/Priority charts are empty**
- **Cause**: Tasks exist but statuses aren't properly categorized
- **Solution**: Update TaskStatus documents to have proper `category` field

**Issue: "Include Archived Tasks" doesn't work**
- **Cause**: The archived query parameter isn't being passed correctly
- **Solution**: Check frontend API calls in Network tab

### Next Steps

1. **Refresh the Insights page** and check the backend console
2. **Copy the debug output** and share it
3. Based on the output, we can identify the exact issue

The logs will show exactly where the problem is!
