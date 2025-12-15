export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  managerId?: string;
  managerName?: string;
  workflowId?: string;
  workflowName?: string;
  status: "Planning" | "In Progress" | "Review" | "Done";
  priority: "Low" | "Medium" | "High" | "Critical";
  progress: number;
  budget?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ProjectWithDetails extends Project {
  departments?: ProjectDepartment[];
  memberCount?: number;
  taskCount?: number;
  completedTaskCount?: number;
}

export interface ProjectDepartment {
  id: string;
  projectId: string;
  departmentId: string;
  departmentName: string;
  role?: string;
  assignedAt: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  statuses?: WorkflowStatus[];
}

export interface WorkflowStatus {
  id: string;
  workflowId: string;
  name: string;
  color?: string;
  order: number;
}

export interface TaskSettings {
  priorities: Priority[];
  tags: Tag[];
  statuses: string[];
}

export interface Priority {
  name: string;
  color: string;
  slaHours: number;
}

export interface Tag {
  name: string;
  color: string;
  usageCount: number;
}
