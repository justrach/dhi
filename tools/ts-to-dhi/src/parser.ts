import { parseSync } from "oxc-parser";

export interface ParsedProperty {
  name: string;
  type: string;
  optional: boolean;
  nullable: boolean;
  jsDoc?: JSDocInfo; // JSDoc annotations
}

export interface ParsedType {
  name: string;
  kind: "interface" | "type-alias";
  properties: ParsedProperty[];
  rawType?: string; // For non-object types like tuples, intersections
}

/**
 * Extract type definitions from TypeScript source using oxc-parser
 */
/**
 * Extract type definitions from TypeScript source using oxc-parser
 */
/**
 * JSDoc validation info
 */
export interface JSDocInfo {
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  format?: string;
  pattern?: string;
  default?: string | number | boolean;
  description?: string;
}

/**
 * Import tracking
 */
export interface ImportInfo {
  name: string;
  source: string;
  isTypeOnly: boolean;
}

/**
 * Extract type definitions from TypeScript source using oxc-parser
 */
export function extractTypes(source: string, filename = "types.ts"): { types: ParsedType[]; imports: ImportInfo[] } {
  const result = parseSync(filename, source);
  const ast = result.program;
  const types: ParsedType[] = [];
  const imports: ImportInfo[] = [];

  // Collect imports first
  for (const node of ast.body || []) {
    if (node.type === "ImportDeclaration") {
      const sourcePath = node.source?.value;
      const isTypeOnly = node.importKind === "type";
      
      for (const spec of node.specifiers || []) {
        if (spec.type === "ImportSpecifier" && spec.local?.name) {
          imports.push({
            name: spec.local.name,
            source: sourcePath,
            isTypeOnly,
          });
        }
      }
    }
  }

  // Extract types with JSDoc
  for (const node of ast.body || []) {
    // Unwrap export declarations: export interface Foo { ... }
    const actualNode = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (!actualNode) continue;

    // TSInterfaceDeclaration: interface User { ... }
    if (actualNode.type === "TSInterfaceDeclaration") {
      const properties = extractInterfaceProperties(actualNode, result.comments || []);
      types.push({
        name: actualNode.id?.name || "Unknown",
        kind: "interface",
        properties,
      });
    }

    // TSTypeAliasDeclaration: type User = { ... }
    if (actualNode.type === "TSTypeAliasDeclaration") {
      let properties: ParsedProperty[] = [];
      let rawType: string | undefined;
      
      // Handle object literal types
      if (actualNode.typeAnnotation?.type === "TSTypeLiteral") {
        properties = extractTypeLiteralProperties(actualNode.typeAnnotation, result.comments || []);
      } else {
        // Capture raw type for tuples, intersections, etc.
        rawType = getTypeString(actualNode.typeAnnotation);
      }

      types.push({
        name: actualNode.id?.name || "Unknown",
        kind: "type-alias",
        properties,
        rawType,
      });
    }
  }

  return { types, imports };
}

function extractInterfaceProperties(node: any, comments: any[]): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const members = node.body?.body || [];

  for (const member of members) {
    // Get JSDoc for this member
    const jsDoc = extractJSDoc(member, comments);
    
    // Regular property: foo: type
    if (member.type === "TSPropertySignature" && member.key?.name) {
      const typeAnnotation = member.typeAnnotation?.typeAnnotation;
      const tsType = typeAnnotation ? getTypeString(typeAnnotation) : "unknown";
      
      properties.push({
        name: member.key.name,
        type: tsType,
        optional: !!member.optional,
        nullable: tsType.includes("null"),
        jsDoc,
      });
    }
    
    // Method signature: foo(): type
    if (member.type === "TSMethodSignature" && member.key?.name) {
      const returnType = member.typeAnnotation?.typeAnnotation;
      const returnTypeStr = returnType ? getTypeString(returnType) : "void";
      
      // Convert params to a simplified string representation
      const params = member.parameters?.map((p: any) => {
        const paramType = p.typeAnnotation?.typeAnnotation;
        return paramType ? getTypeString(paramType) : "any";
      }) || [];
      
      const paramsStr = params.join(", ");
      const methodType = `(${paramsStr}) => ${returnTypeStr}`;
      
      properties.push({
        name: member.key.name,
        type: methodType,
        optional: !!member.optional,
        nullable: false,
        jsDoc,
      });
    }
    
    // Index signature: [key: string]: type
    if (member.type === "TSIndexSignature") {
      const keyType = member.parameters?.[0]?.typeAnnotation?.typeAnnotation;
      const valueType = member.typeAnnotation?.typeAnnotation;
      
      if (keyType && valueType) {
        const keyTypeStr = getTypeString(keyType);
        const valueTypeStr = getTypeString(valueType);
        
        // Only string/number keys supported
        if (keyTypeStr === "string" || keyTypeStr === "number") {
          properties.push({
            name: `[key: ${keyTypeStr}]`,
            type: `Record<${keyTypeStr}, ${valueTypeStr}>`,
            optional: false,
            nullable: valueTypeStr.includes("null"),
          });
        }
      }
    }
  }

  return properties;
}

/**
 * Extract JSDoc info from comments preceding a node
 */
function extractJSDoc(node: any, comments: any[]): JSDocInfo | undefined {
  // Find the comment that ends just before this node starts
  const relevantComment = comments.find(c => 
    c.type === "Block" && 
    c.end <= node.start &&
    c.value.startsWith("*") &&
    (node.start - c.end) < 5 // Close proximity
  );
  
  if (!relevantComment) return undefined;
  
  const commentText = relevantComment.value;
  const jsDoc: JSDocInfo = {};
  
  // Parse @minimum
  const minimumMatch = commentText.match(/@minimum\s+(\d+)/);
  if (minimumMatch) jsDoc.minimum = parseInt(minimumMatch[1], 10);
  
  // Parse @maximum
  const maximumMatch = commentText.match(/@maximum\s+(\d+)/);
  if (maximumMatch) jsDoc.maximum = parseInt(maximumMatch[1], 10);
  
  // Parse @minLength
  const minLengthMatch = commentText.match(/@minLength\s+(\d+)/);
  if (minLengthMatch) jsDoc.minLength = parseInt(minLengthMatch[1], 10);
  
  // Parse @maxLength
  const maxLengthMatch = commentText.match(/@maxLength\s+(\d+)/);
  if (maxLengthMatch) jsDoc.maxLength = parseInt(maxLengthMatch[1], 10);
  
  // Parse @format
  const formatMatch = commentText.match(/@format\s+(\w+)/);
  if (formatMatch) jsDoc.format = formatMatch[1];
  
  // Parse @pattern
  const patternMatch = commentText.match(/@pattern\s+(\S+)/);
  if (patternMatch) jsDoc.pattern = patternMatch[1];
  
  // Parse @default
  const defaultMatch = commentText.match(/@default\s+(\S+)/);
  if (defaultMatch) {
    const val = defaultMatch[1];
    if (val === "true") jsDoc.default = true;
    else if (val === "false") jsDoc.default = false;
    else if (/^\d+$/.test(val)) jsDoc.default = parseInt(val, 10);
    else jsDoc.default = val.replace(/^["']|["']$/g, "");
  }
  
  // Parse description (first line after /** that's not a tag)
  const descMatch = commentText.match(/\*\s*\n\s*\*\s+([^@\n]+)/);
  if (descMatch) jsDoc.description = descMatch[1].trim();
  
  return Object.keys(jsDoc).length > 0 ? jsDoc : undefined;
}

function extractTypeLiteralProperties(node: any, comments: any[]): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const members = node.members || [];

  for (const member of members) {
    // Get JSDoc for this member
    const jsDoc = extractJSDoc(member, comments);
    
    if (member.type === "TSPropertySignature" && member.key?.name) {
      const typeAnnotation = member.typeAnnotation?.typeAnnotation;
      const tsType = typeAnnotation ? getTypeString(typeAnnotation) : "unknown";
      
      properties.push({
        name: member.key.name,
        type: tsType,
        optional: !!member.optional,
        nullable: tsType.includes("null"),
        jsDoc,
      });
    }
  }


  return properties;
}

function getTypeString(node: any): string {
  if (!node) return "unknown";

  switch (node.type) {
    case "TSNumberKeyword": return "number";
    case "TSStringKeyword": return "string";
    case "TSBooleanKeyword": return "boolean";
    case "TSBigIntKeyword": return "bigint";
    case "TSAnyKeyword": return "any";
    case "TSUnknownKeyword": return "unknown";
    case "TSVoidKeyword": return "void";
    case "TSNullKeyword": return "null";
    case "TSUndefinedKeyword": return "undefined";
    case "TSArrayType":
      return `${getTypeString(node.elementType)}[]`;
    case "TSTupleType":
      const elements = node.elementTypes?.map(getTypeString).join(", ") || "";
      return `[${elements}]`;
    case "TSUnionType":
      return node.types?.map(getTypeString).join(" | ") || "unknown";
    case "TSIntersectionType":
      return node.types?.map(getTypeString).join(" & ") || "unknown";
    case "TSLiteralType":
      return JSON.stringify(node.literal?.value);
    case "TSTypeReference":
      const typeName = node.typeName?.name || "unknown";
      if (node.typeArguments?.params?.length > 0) {
        const args = node.typeArguments.params.map(getTypeString).join(", ");
        return `${typeName}<${args}>`;
      }
      return typeName;
    default:
      return node.type;
  }
}
