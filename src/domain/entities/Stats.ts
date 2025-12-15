export interface DashboardStats {
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  totalDepartments: number;
  activeProjects: number;
  completedTasks: number;
  pendingTasks: number;
  totalForumPosts: number;
  totalNewsArticles: number;
  upcomingEvents: number;
}

export interface RecentActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: string;
  content: string;
  target: string | null;
  createdAt: Date;
}

export interface ProjectProgress {
  id: string;
  code: string;
  name: string;
  status: string;
  priority: string;
  progress: number;
  managerName: string;
  budget: number;
  startDate: string;
  endDate: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  projectName: string;
  status: string;
  priority: string;
  dueDate: string;
  assigneeName: string;
}
