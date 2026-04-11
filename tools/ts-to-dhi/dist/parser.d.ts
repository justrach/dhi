export interface JSDocInfo {
    description?: string;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    default?: string | number | boolean;
}
export interface ParsedProperty {
    name: string;
    type: string;
    optional: boolean;
    nullable: boolean;
    jsdoc?: JSDocInfo;
}
export interface ParsedType {
    name: string;
    kind: "interface" | "type-alias";
    properties: ParsedProperty[];
    rawType?: string;
}
/**
 * Extract type definitions from TypeScript source using oxc-parser
 */
/**
 * Extract type definitions from TypeScript source using oxc-parser
 */
export declare function extractTypes(source: string, filename?: string): ParsedType[];
//# sourceMappingURL=parser.d.ts.map