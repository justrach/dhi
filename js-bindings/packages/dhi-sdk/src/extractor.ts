/**
 * Route Extractor - Parses Hono apps to extract route definitions
 *
 * Uses ts-morph for AST analysis to find:
 * - Route definitions (.get, .post, .put, .patch, .delete)
 * - dhi/zod validation schemas
 * - Response types
 */

import { Project, SyntaxKind, CallExpression, Node } from 'ts-morph';
import type {
  ExtractedRoute,
  ExtractedAPI,
  ExtractedSchema,
  HttpMethod,
  SchemaType,
} from './types';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

export class RouteExtractor {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        declaration: false,
        esModuleInterop: true,
      },
    });
  }

  /**
   * Extract API definition from a Hono app file
   */
  async extract(filePath: string): Promise<ExtractedAPI> {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const routes: ExtractedRoute[] = [];
    const schemas = new Map<string, ExtractedSchema>();

    // Find all call expressions that look like route definitions
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const route = this.extractRoute(call);
      if (route) {
        routes.push(route);
      }
    }

    // Also look for exported schema definitions
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();
      if (initializer && this.isSchemaDefinition(initializer)) {
        const schema = this.extractSchema(initializer);
        if (schema) {
          schemas.set(name, schema);
        }
      }
    }

    return {
      basePath: '',
      routes,
      schemas,
    };
  }

  /**
   * Extract route from a call expression
   */
  private extractRoute(call: CallExpression): ExtractedRoute | null {
    const expression = call.getExpression();
    const expressionText = expression.getText();

    // Check if this is a route method call (e.g., app.get, app.post)
    for (const method of HTTP_METHODS) {
      if (expressionText.endsWith(`.${method}`)) {
        return this.parseRouteCall(call, method.toUpperCase() as HttpMethod);
      }
    }

    return null;
  }

  /**
   * Parse a route call expression
   */
  private parseRouteCall(call: CallExpression, method: HttpMethod): ExtractedRoute | null {
    const args = call.getArguments();
    if (args.length < 1) return null;

    // First argument is the path
    const pathArg = args[0];
    let path = this.extractStringLiteral(pathArg);
    if (!path) return null;

    // Path must start with '/' to be a valid route (filters out middleware)
    if (!path.startsWith('/')) return null;

    // Extract path parameters
    const pathParams = this.extractPathParams(path);

    // Look for validator middleware and handler
    let bodySchema: ExtractedSchema | undefined;
    let querySchema: ExtractedSchema | undefined;
    let responseSchema: ExtractedSchema | undefined;

    // Check remaining arguments for validators and handlers
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const argText = arg.getText();

      // Look for dhiValidator or zValidator calls
      if (argText.includes('Validator(')) {
        const validatorType = this.extractValidatorType(arg);
        const schema = this.extractValidatorSchema(arg);

        if (validatorType === 'json' && schema) {
          bodySchema = schema;
        } else if (validatorType === 'query' && schema) {
          querySchema = schema;
        }
      }

      // Look for c.json() calls in handlers to infer response type
      if (arg.getKind() === SyntaxKind.ArrowFunction || arg.getKind() === SyntaxKind.FunctionExpression) {
        responseSchema = this.extractResponseSchema(arg);
      }
    }

    return {
      method,
      path,
      pathParams,
      bodySchema,
      querySchema,
      responseSchema,
    };
  }

  /**
   * Extract path parameters from route path
   */
  private extractPathParams(path: string): string[] {
    const params: string[] = [];
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = regex.exec(path)) !== null) {
      params.push(match[1]);
    }
    return params;
  }

  /**
   * Extract validator type (json, query, param, etc.)
   */
  private extractValidatorType(node: Node): string | null {
    const text = node.getText();
    const match = text.match(/Validator\s*\(\s*['"](\w+)['"]/);
    return match ? match[1] : null;
  }

  /**
   * Extract schema from validator call
   */
  private extractValidatorSchema(node: Node): ExtractedSchema | null {
    // Find the schema argument in the validator call
    if (node.getKind() === SyntaxKind.CallExpression) {
      const call = node as CallExpression;
      const args = call.getArguments();

      // Schema is usually the second argument
      if (args.length >= 2) {
        return this.extractSchema(args[1]);
      }
    }
    return null;
  }

  /**
   * Extract schema definition from AST node
   */
  private extractSchema(node: Node): ExtractedSchema | null {
    const text = node.getText();

    // Detect schema type from the code
    if (text.includes('z.object(') || text.includes('dhi.object(')) {
      return this.extractObjectSchema(node);
    }
    if (text.includes('z.string(') || text.includes('dhi.string(')) {
      return { code: text, type: 'string', tsType: 'string' };
    }
    if (text.includes('z.number(') || text.includes('dhi.number(')) {
      return { code: text, type: 'number', tsType: 'number' };
    }
    if (text.includes('z.boolean(') || text.includes('dhi.boolean(')) {
      return { code: text, type: 'boolean', tsType: 'boolean' };
    }
    if (text.includes('z.enum(') || text.includes('dhi.enum(')) {
      return this.extractEnumSchema(node);
    }
    if (text.includes('z.array(') || text.includes('dhi.array(')) {
      return this.extractArraySchema(node);
    }
    if (text.includes('discriminatedUnion(')) {
      return this.extractDiscriminatedUnionSchema(node);
    }
    if (text.includes('z.union(') || text.includes('dhi.union(')) {
      return this.extractUnionSchema(node);
    }

    return { code: text, type: 'unknown' };
  }

  /**
   * Extract object schema properties
   */
  private extractObjectSchema(node: Node): ExtractedSchema {
    const text = node.getText();
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Simple regex-based extraction (for demo - production would use full AST)
    // Match property definitions like: name: z.string().min(1)
    const propRegex = /(\w+)\s*:\s*(z\.|dhi\.)([\w().]+)/g;
    let match;

    while ((match = propRegex.exec(text)) !== null) {
      const [, propName, , chain] = match;
      const isOptional = chain.includes('.optional()');
      const propType = this.inferTypeFromChain(chain);

      properties[propName] = {
        type: propType,
        optional: isOptional,
      };

      if (!isOptional) {
        required.push(propName);
      }
    }

    return {
      code: text,
      type: 'object',
      properties,
      required,
      tsType: this.generateObjectTsType(properties),
    };
  }

  /**
   * Extract enum schema values
   */
  private extractEnumSchema(node: Node): ExtractedSchema {
    const text = node.getText();
    const enumValues: string[] = [];

    // Extract enum values from array literal
    const match = text.match(/\.enum\s*\(\s*\[([\s\S]*?)\]/);
    if (match) {
      const valuesStr = match[1];
      const valueMatches = valuesStr.match(/['"]([^'"]+)['"]/g);
      if (valueMatches) {
        for (const v of valueMatches) {
          enumValues.push(v.replace(/['"]/g, ''));
        }
      }
    }

    return {
      code: text,
      type: 'enum',
      enumValues,
      tsType: enumValues.map(v => `'${v}'`).join(' | '),
    };
  }

  /**
   * Extract array schema
   */
  private extractArraySchema(node: Node): ExtractedSchema {
    const text = node.getText();

    // Extract inner type
    const match = text.match(/\.array\s*\(([\s\S]*?)\)/);
    let itemType = 'unknown';

    if (match) {
      const innerText = match[1];
      if (innerText.includes('string')) itemType = 'string';
      else if (innerText.includes('number')) itemType = 'number';
      else if (innerText.includes('boolean')) itemType = 'boolean';
    }

    return {
      code: text,
      type: 'array',
      tsType: `${itemType}[]`,
    };
  }

  /**
   * Extract discriminated union schema
   */
  private extractDiscriminatedUnionSchema(node: Node): ExtractedSchema {
    const text = node.getText();

    // Extract discriminator key
    const discMatch = text.match(/discriminatedUnion\s*\(\s*['"](\w+)['"]/);
    const discriminator = discMatch ? discMatch[1] : undefined;

    return {
      code: text,
      type: 'discriminatedUnion',
      discriminator,
      tsType: 'unknown', // Would need deeper analysis
    };
  }

  /**
   * Extract union schema
   */
  private extractUnionSchema(node: Node): ExtractedSchema {
    const text = node.getText();

    return {
      code: text,
      type: 'union',
      tsType: 'unknown', // Would need deeper analysis
    };
  }

  /**
   * Extract response schema from handler function
   */
  private extractResponseSchema(node: Node): ExtractedSchema | undefined {
    const text = node.getText();

    // Look for c.json() calls
    const jsonMatch = text.match(/c\.json\s*\(\s*(\{[\s\S]*?\})\s*\)/);
    if (jsonMatch) {
      // Simple inference from the response object
      return {
        code: jsonMatch[1],
        type: 'object',
        tsType: 'unknown', // Would need type inference
      };
    }

    return undefined;
  }

  /**
   * Check if node is a schema definition
   */
  private isSchemaDefinition(node: Node): boolean {
    const text = node.getText();
    return text.includes('z.') || text.includes('dhi.');
  }

  /**
   * Extract string literal value
   */
  private extractStringLiteral(node: Node): string | null {
    const text = node.getText();
    const match = text.match(/^['"`](.*)['"`]$/);
    return match ? match[1] : null;
  }

  /**
   * Infer TypeScript type from method chain
   */
  private inferTypeFromChain(chain: string): SchemaType {
    if (chain.startsWith('string')) return 'string';
    if (chain.startsWith('number')) return 'number';
    if (chain.startsWith('boolean')) return 'boolean';
    if (chain.startsWith('array')) return 'array';
    if (chain.startsWith('enum')) return 'enum';
    if (chain.startsWith('object')) return 'object';
    return 'unknown';
  }

  /**
   * Generate TypeScript type for object properties
   */
  private generateObjectTsType(properties: Record<string, any>): string {
    const lines: string[] = [];
    for (const [name, prop] of Object.entries(properties)) {
      const optional = prop.optional ? '?' : '';
      const type = prop.type === 'unknown' ? 'unknown' : prop.type;
      lines.push(`  ${name}${optional}: ${type};`);
    }
    return `{\n${lines.join('\n')}\n}`;
  }
}
