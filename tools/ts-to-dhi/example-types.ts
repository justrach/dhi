// Example types for testing ts-to-dhi

export interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  role: "admin" | "user" | "guest";
  isActive: boolean;
  metadata: any;
  tags: string[];
  settings: Record<string, string>;
}

export type CreateUserRequest = {
  name: string;
  email: string;
  age?: number;
  role: "admin" | "user";
};

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | null;
}
