export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  managerId?: string;
  managerName?: string;
  managerAvatar?: string;
  parentDepartmentId?: string | null;
  parentDepartmentName?: string | null;
  memberCount?: number;
  budget?: number;
  kpiStatus?: "On Track" | "At Risk" | "Behind";
  createdAt?: Date;
  updatedAt?: Date;
}
