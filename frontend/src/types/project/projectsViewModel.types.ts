import { IProjectViewModel } from './projectViewModel.types';

export interface IProjectsViewModel {
  total?: number;
  data?: IProjectViewModel[];
  counts?: {
    all: number;
    favorites: number;
    archived: number;
  };
}

export interface IProjectOverviewStats {
  done_task_count?: string;
  pending_task_count?: string;
}
