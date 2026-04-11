// Test types with method signatures and other edge cases

export interface ApiClient {
  // Properties
  baseUrl: string;
  timeout: number;
  
  // Method signatures
  get<T>(url: string): Promise<T>;
  post<T>(url: string, body: unknown): Promise<T>;
  delete(url: string): Promise<void>;
}

export interface EventEmitter {
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
  emit(event: string): boolean;
}

// Mixed interface with properties and methods
export interface Logger {
  level: "debug" | "info" | "warn" | "error";
  prefix?: string;
  log(message: string): void;
  error(err: Error): void;
}
