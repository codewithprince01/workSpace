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

// 1. Update Assignees options in isBoard case
const assigneesRegex = /id:\s+'assignees',.*?options:\s+filterData\.kanbanTaskAssignees\.map/s;
const newAssigneesOptions = `id: 'assignees',
          label: t('membersText'),
          icon: TeamOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentAssignees
            .filter((m: any) => m.selected && getSafeId(m))
            .map((m: any) => getSafeId(m)),
          options: filterData.taskAssignees.map`;

replaceBlock(assigneesRegex, newAssigneesOptions, 'assignees data source');

// 2. Update Labels options in isBoard case
const labelsRegex = /id:\s+'labels',.*?options:\s+filterData\.kanbanLabels\.map/s;
const newLabelsOptions = `id: 'labels',
          label: t('labelsText'),
          icon: TagOutlined,
          multiSelect: true,
          searchable: true,
          selectedValues: currentLabels
            .filter((l: any) => l.selected && getSafeId(l))
            .map((l: any) => getSafeId(l)),
          options: filterData.taskLabels.map`;

replaceBlock(labelsRegex, newLabelsOptions, 'labels data source');

fs.writeFileSync(filePath, content, 'utf8');
console.log('File written successfully.');
