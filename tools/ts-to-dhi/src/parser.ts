import { parseSync } from "oxc-parser";

export interface ParsedProperty {
  name: string;
  type: string;
  optional: boolean;
  nullable: boolean;
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
export function extractTypes(source: string, filename = "types.ts"): ParsedType[] {
  const result = parseSync(filename, source);
  const ast = result.program;
  const types: ParsedType[] = [];

  for (const node of ast.body || []) {
    // Unwrap export declarations: export interface Foo { ... }
    const actualNode = node.type === "ExportNamedDeclaration" ? node.declaration : node;
    if (!actualNode) continue;

    // TSInterfaceDeclaration: interface User { ... }
    if (actualNode.type === "TSInterfaceDeclaration") {
      const properties = extractInterfaceProperties(actualNode);
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
        properties = extractTypeLiteralProperties(actualNode.typeAnnotation);
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

  return types;
}

function extractInterfaceProperties(node: any): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const members = node.body?.body || [];

  for (const member of members) {
    // Regular property: foo: type
    if (member.type === "TSPropertySignature" && member.key?.name) {
      const typeAnnotation = member.typeAnnotation?.typeAnnotation;
      const tsType = typeAnnotation ? getTypeString(typeAnnotation) : "unknown";
      
      properties.push({
        name: member.key.name,
        type: tsType,
        optional: !!member.optional,
        nullable: tsType.includes("null"),
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

function extractTypeLiteralProperties(node: any): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const members = node.members || [];

  for (const member of members) {
    if (member.type === "TSPropertySignature" && member.key?.name) {
      const typeAnnotation = member.typeAnnotation?.typeAnnotation;
      const tsType = typeAnnotation ? getTypeString(typeAnnotation) : "unknown";
      
      properties.push({
        name: member.key.name,
        type: tsType,
        optional: !!member.optional,
        nullable: tsType.includes("null"),
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
