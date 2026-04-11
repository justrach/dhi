import { describe, it, expect } from "bun:test";
import { extractTypes } from "../src/parser.js";

describe("Nested objects", () => {
  it("should handle nested object types", () => {
    const source = `
      interface Company {
        name: string;
        address: {
          street: string;
          city: string;
        };
      }
    `;
    const types = extractTypes(source);
    
    console.log("Properties:", JSON.stringify(types[0].properties, null, 2));
    expect(types[0].properties[1].type).toContain("street");
  });
});
