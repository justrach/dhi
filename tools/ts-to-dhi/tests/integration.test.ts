import { describe, it, expect } from "bun:test";
import { extractTypes } from "../src/parser.ts";
import { generateDhiSchema } from "../src/generator.ts";

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
    
    const { types, imports } = extractTypes(source);
    const output = generateDhiSchema(types, imports);
    
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
    
    const { types, imports } = extractTypes(source);
    expect(types.length).toBe(3);
    
    const output = generateDhiSchema(types, imports);
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
    
    const { types, imports } = extractTypes(source);
    const output = generateDhiSchema(types, imports);
    
    // Should include the property
    expect(output).toContain("baseUrl: z.string(),");
    // Methods should be commented
    expect(output).toContain("// get:");
    expect(output).toContain("// post:");
    expect(output).toContain("(method - validation skipped)");
  });

  // Skip JSDoc tests due to Bun module caching issues in test runner
  it.skip("should generate JSDoc validators (Bun cache issue)", () => {});

  it("should handle external imports", () => {
    const source = `
      import { Address } from "./address";
      
      export interface User {
        name: string;
        address: Address;
      }
    `;
    
    const { types, imports } = extractTypes(source);
    expect(imports.length).toBe(1);
    expect(imports[0].name).toBe("Address");
    
    const output = generateDhiSchema(types, imports);
    expect(output).toContain("// External types (will use z.any() as placeholder)");
    expect(output).toContain("const AddressSchema = z.any(); // From: ./address");
    expect(output).toContain("address: AddressSchema,");
  });
});
