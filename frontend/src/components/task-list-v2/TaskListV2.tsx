import ImprovedTaskFilters from "../task-management/improved-task-filters";
import TaskListV2Section from "./TaskListV2Table";

const TaskListV2: React.FC = () => {

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Task Filters */}
      <div className="flex-none" style={{ minHeight: '54px', height: 'auto', flexShrink: 0, paddingBottom: '8px' }}>
        <ImprovedTaskFilters position="list" />
      </div>
      <div className="flex-1 min-h-0">
        <TaskListV2Section />
      </div>
    </div>
  );
};

export default TaskListV2;
