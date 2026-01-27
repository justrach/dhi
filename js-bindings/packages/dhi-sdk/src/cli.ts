#!/usr/bin/env node
/**
 * dhi-sdk CLI
 *
 * Generate TypeScript SDKs from Hono + dhi apps
 *
 * Usage:
 *   dhi-sdk generate ./src/api.ts --output ./sdk
 *   dhi-sdk generate ./src/api.ts --output ./sdk --openapi
 */

import { Command } from 'commander';
import { resolve, dirname, join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { RouteExtractor } from './extractor';
import { SDKGenerator } from './generator';
import type { GenerateOptions } from './types';

const program = new Command();

program
  .name('dhi-sdk')
  .description('Generate TypeScript SDKs from Hono + dhi apps')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate SDK from a Hono app file')
  .argument('<input>', 'Path to Hono app file (e.g., ./src/api.ts)')
  .option('-o, --output <dir>', 'Output directory', './sdk')
  .option('-n, --name <name>', 'SDK name', 'api')
  .option('--openapi', 'Generate OpenAPI spec', false)
  .option('--base-url <url>', 'Base URL for the client')
  .action(async (input: string, opts) => {
    try {
      await generateSDK({
        input: resolve(input),
        output: resolve(opts.output),
        name: opts.name,
        openapi: opts.openapi,
        baseUrl: opts.baseUrl,
      });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

async function generateSDK(options: GenerateOptions) {
  console.log('');
  console.log('  dhi-sdk - Generate TypeScript SDK from Hono + dhi');
  console.log('  ─'.repeat(25));
  console.log('');

  // Check input file exists
  if (!existsSync(options.input)) {
    throw new Error(`Input file not found: ${options.input}`);
  }

  console.log(`  Input:  ${options.input}`);
  console.log(`  Output: ${options.output}`);
  console.log('');

  // Extract routes
  console.log('  [1/3] Extracting routes from Hono app...');
  const extractor = new RouteExtractor();
  const api = await extractor.extract(options.input);

  console.log(`        Found ${api.routes.length} routes`);
  for (const route of api.routes) {
    console.log(`        - ${route.method.padEnd(6)} ${route.path}`);
  }
  console.log('');

  // Generate SDK
  console.log('  [2/3] Generating SDK...');
  const generator = new SDKGenerator(api, options);
  const sdk = generator.generate();
  console.log('');

  // Write files
  console.log('  [3/3] Writing files...');

  // Create output directory
  await mkdir(options.output, { recursive: true });

  // Write types.ts
  const typesPath = join(options.output, 'types.ts');
  await writeFile(typesPath, sdk.types);
  console.log(`        ✓ ${typesPath}`);

  // Write client.ts
  const clientPath = join(options.output, 'client.ts');
  await writeFile(clientPath, sdk.client);
  console.log(`        ✓ ${clientPath}`);

  // Write index.ts
  const indexPath = join(options.output, 'index.ts');
  await writeFile(indexPath, sdk.index);
  console.log(`        ✓ ${indexPath}`);

  // Write OpenAPI spec if requested
  if (sdk.openapi) {
    const openapiPath = join(options.output, 'openapi.json');
    await writeFile(openapiPath, JSON.stringify(sdk.openapi, null, 2));
    console.log(`        ✓ ${openapiPath}`);
  }

  console.log('');
  console.log('  ✅ SDK generated successfully!');
  console.log('');
  console.log('  Usage:');
  console.log('');
  console.log('    import { createClient } from \'' + options.output + '\';');
  console.log('');
  console.log('    const api = createClient({');
  console.log('      baseUrl: \'https://api.example.com\',');
  console.log('    });');
  console.log('');
  console.log('    // Fully typed!');
  console.log('    const result = await api.users.create({ name: \'Alice\' });');
  console.log('');
}

// Run CLI
program.parse();
