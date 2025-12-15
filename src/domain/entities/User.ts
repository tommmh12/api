export interface User {
  id: string;
  employee_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  department_id: string | null;
  position: string | null;
  role: "Admin" | "Manager" | "Employee";
  status: "Active" | "Blocked" | "Pending";
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithDepartment extends User {
  department_name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, "password_hash">;
  tokens: AuthTokens;
}
