#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname, basename, extname } from "path";
import { extractTypes } from "./parser.js";
import { generateDhiSchema } from "./generator.js";

interface Config {
  input?: string;
  output?: string;
}

interface CliOptions {
  input: string;
  output?: string;
  watch?: boolean;
  config?: string;
}

function printHelp(): void {
  console.log(`
ts-to-dhi: Generate dhi schemas from TypeScript types

Usage:
  ts-to-dhi <input-file> [options]

Options:
  -o, --output <file>    Output file (default: <input>.schemas.ts)
  -w, --watch           Watch for changes and regenerate
  -c, --config <file>   Config file path (default: ts-to-dhi.json)
  -h, --help            Show this help

Config file (ts-to-dhi.json):
  {
    "input": "types.ts",
    "output": "schemas.ts"
  }

Examples:
  ts-to-dhi types.ts                    # Generate types.schemas.ts
  ts-to-dhi models/user.ts -o schemas.ts # Custom output file
  ts-to-dhi types.ts -w                 # Watch mode
  ts-to-dhi -c ts-to-dhi.json           # Use config file
`);
}

function loadConfig(configPath?: string): Config | null {
  const paths = configPath 
    ? [resolve(configPath)]
    : [resolve("ts-to-dhi.json"), resolve(".ts-to-dhi.json")];
  
  for (const path of paths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        return JSON.parse(content) as Config;
      } catch (err) {
        console.warn(`⚠️  Warning: Could not load config from ${path}`);
      }
    }
  }
  
  return null;
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return null;
  }

  let input: string | undefined;
  let output: string | undefined;
  let watch = false;
  let config: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      output = args[++i];
    } else if (arg === "-w" || arg === "--watch") {
      watch = true;
    } else if (arg === "-c" || arg === "--config") {
      config = args[++i];
    } else if (!arg.startsWith("-") && !input) {
      input = arg;
    }
  }

  // Load config if available
  const cfg = loadConfig(config);
  if (cfg) {
    console.log("📄 Using config file");
    if (!input && cfg.input) input = cfg.input;
    if (!output && cfg.output) output = cfg.output;
  }

  // Must have input
  if (!input) {
    console.error("❌ Error: No input file specified");
    printHelp();
    return null;
  }

  // Default output: types.ts → types.schemas.ts
  if (!output) {
    const dir = dirname(input);
    const name = basename(input, extname(input));
    output = resolve(dir, `${name}.schemas.ts`);
  }

  return { input: resolve(input), output: resolve(output), watch, config };
}

function generate(inputFile: string, outputFile: string): boolean {
  if (!existsSync(inputFile)) {
    console.error(`❌ Error: File not found: ${inputFile}`);
    return false;
  }

  console.log(`📖 Reading ${inputFile}...`);
  let source: string;
  try {
    source = readFileSync(inputFile, "utf-8");
  } catch (err) {
    console.error(`❌ Error reading file: ${err instanceof Error ? err.message : err}`);
    return false;
  }
  
  console.log("🔍 Parsing TypeScript...");
  let types: ParsedType[];
  let imports: { name: string; source: string; isTypeOnly: boolean }[];
  try {
    const result = extractTypes(source, inputFile);
    types = result.types;
    imports = result.imports;
  } catch (err) {
    console.error(`❌ Parse error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
  
  if (types.length === 0) {
    console.log("⚠️  No types found to generate (looking for interfaces and type aliases)");
    return false;
  }
  
  console.log(`✅ Found ${types.length} type definition(s)`);
  if (imports.length > 0) {
    console.log(`📦 Found ${imports.length} import(s)`);
  }
  
  console.log("📝 Generating dhi schemas...");
  const output = generateDhiSchema(types, imports);
  
  try {
    writeFileSync(outputFile, output);
    console.log(`✨ Written to ${outputFile}`);
  } catch (err) {
    console.error(`❌ Error writing file: ${err instanceof Error ? err.message : err}`);
    return false;
  }
  
  // Print summary
  console.log("\n📦 Generated schemas:");
  for (const type of types) {
    const icon = type.kind === "interface" ? "🔹" : "🔸";
    console.log(`  ${icon} ${type.name}Schema (${type.properties.length} properties)`);
  }
  
  return true;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;

  const { input, output, watch } = options;

  // Initial generation
  generate(input, output);

  // Watch mode
  if (watch) {
    console.log(`\n👀 Watching ${input} for changes...`);
    
    const { watchFile } = await import("fs");
    watchFile(input, { interval: 500 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        console.log("\n🔄 File changed, regenerating...");
        try {
          generate(input, output);
        } catch (err) {
          console.error("❌ Error:", err instanceof Error ? err.message : err);
        }
        console.log("\n👀 Watching for changes...");
      }
    });
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
