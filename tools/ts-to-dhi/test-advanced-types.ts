// Comprehensive test types for ts-to-dhi

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

// Tuple types
export type Point = [number, number];
export type NamedPoint = [string, number, number];

// Intersection types
export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export type TimestampedUser = User & Timestamped;

// Index signatures
export interface Dict {
  [key: string]: number;
}

export interface NestedDict {
  [key: string]: { value: number; label: string };
}
