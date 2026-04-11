import { describe, it, expect } from "bun:test";
import { extractTypes } from "../src/parser.js";

describe("extractTypes", () => {
  it("should extract simple interface", () => {
    const source = `interface User { name: string; age: number; }`;
    const types = extractTypes(source);
    
    expect(types.length).toBe(1);
    expect(types[0].name).toBe("User");
    expect(types[0].kind).toBe("interface");
    expect(types[0].properties.length).toBe(2);
    expect(types[0].properties[0].name).toBe("name");
    expect(types[0].properties[0].type).toBe("string");
  });

  it("should extract type alias", () => {
    const source = `type User = { name: string; age: number; };`;
    const types = extractTypes(source);
    
    expect(types.length).toBe(1);
    expect(types[0].name).toBe("User");
    expect(types[0].kind).toBe("type-alias");
  });

  it("should handle optional properties", () => {
    const source = `interface User { name: string; age?: number; }`;
    const types = extractTypes(source);
    
    expect(types[0].properties[1].optional).toBe(true);
  });

  it("should handle nullable types", () => {
    const source = `interface User { name: string | null; }`;
    const types = extractTypes(source);
    
    expect(types[0].properties[0].nullable).toBe(true);
  });

  it("should handle array types", () => {
    const source = `interface User { tags: string[]; }`;
    const types = extractTypes(source);
    
    expect(types[0].properties[0].type).toBe("string[]");
  });

  it("should handle tuple types", () => {
    const source = `type Point = [number, number];`;
    const types = extractTypes(source);
    
    expect(types.length).toBe(1);
    expect(types[0].name).toBe("Point");
    expect(types[0].rawType).toBe("[number, number]");
  });

  it("should handle intersection types", () => {
    const source = `type A = { a: string } & { b: number };`;
    const types = extractTypes(source);
    
    expect(types.length).toBe(1);
    expect(types[0].rawType).toContain("&");
  });

  it("should handle method signatures", () => {
    const source = `interface Api { get(): Promise<string>; }`;
    const types = extractTypes(source);
    
    expect(types[0].properties.length).toBe(1);
    expect(types[0].properties[0].name).toBe("get");
    expect(types[0].properties[0].type).toContain("=>");
  });

  it("should handle exported types", () => {
    const source = `export interface User { name: string; }`;
    const types = extractTypes(source);
    
    expect(types.length).toBe(1);
    expect(types[0].name).toBe("User");
  });

  it("should handle multiple types", () => {
    const source = `
      interface User { name: string; }
      type Address = { street: string; };
    `;
    const types = extractTypes(source);
    
    expect(types.length).toBe(2);
    expect(types[0].name).toBe("User");
    expect(types[1].name).toBe("Address");
  });

  it("should handle string literal unions", () => {
    const source = `interface User { role: "admin" | "user"; }`;
    const types = extractTypes(source);
    
    expect(types[0].properties[0].type).toBe('"admin" | "user"');
  });

  it("should handle Record types", () => {
    const source = `interface User { settings: Record<string, number>; }`;
    const types = extractTypes(source);
    
    expect(types[0].properties[0].type).toBe("Record<string, number>");
  });

  it("should handle empty source", () => {
    const types = extractTypes("");
    expect(types.length).toBe(0);
  });
});
