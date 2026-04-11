import { describe, it, expect } from "bun:test";
import { extractTypes } from "../src/parser.js";
import { generateDhiSchema } from "../src/generator.js";

describe("Integration: end-to-end", () => {
  it("should parse and generate complete schema", () => {
    const source = `
      export interface User {
        id: number;
        name: string;
        email: string;
        age?: number;
        role: "admin" | "user" | "guest";
        isActive: boolean;
        tags: string[];
      }
    `;
    
    const types = extractTypes(source);
    const output = generateDhiSchema(types);
    
    expect(output).toContain("export const UserSchema = z.object({");
    expect(output).toContain("id: z.number(),");
    expect(output).toContain("name: z.string(),");
    expect(output).toContain("email: z.string(),");
    expect(output).toContain("age: z.number().optional(),");
    expect(output).toContain('role: z.enum(["admin", "user", "guest"]),');
    expect(output).toContain("isActive: z.boolean(),");
    expect(output).toContain("tags: z.array(z.string()),");
    expect(output).toContain("export type User = z.infer<typeof UserSchema>;");
  });

  it("should handle complex real-world types", () => {
    const source = `
      export interface ApiResponse<T> {
        success: boolean;
        data: T;
        error?: string | null;
      }
      
      export type Point = [number, number];
      
      export interface WithTimestamp {
        createdAt: Date;
        updatedAt: Date;
      }
    `;
    
    const types = extractTypes(source);
    expect(types.length).toBe(3);
    
    const output = generateDhiSchema(types);
    expect(output).toContain("ApiResponseSchema");
    expect(output).toContain("PointSchema");
    expect(output).toContain("WithTimestampSchema");
    expect(output).toContain("z.tuple([z.number(), z.number()])");
  });

  it("should handle method-heavy interfaces", () => {
    const source = `
      export interface ApiClient {
        baseUrl: string;
        get<T>(url: string): Promise<T>;
        post(url: string, body: unknown): Promise<void>;
      }
    `;
    
    const types = extractTypes(source);
    const output = generateDhiSchema(types);
    
    // Should include the property
    expect(output).toContain("baseUrl: z.string(),");
    // Methods should be commented
    expect(output).toContain("// get:");
    expect(output).toContain("// post:");
    expect(output).toContain("(method - validation skipped)");
  });
});
