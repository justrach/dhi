#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname, basename, extname } from "path";
import { extractTypes } from "./parser.js";
import { generateDhiSchema } from "./generator.js";

interface CliOptions {
  input: string;
  output?: string;
  watch?: boolean;
}

function printHelp(): void {
  console.log(`
ts-to-dhi: Generate dhi schemas from TypeScript types

Usage:
  ts-to-dhi <input-file> [options]

Options:
  -o, --output <file>    Output file (default: <input>.schemas.ts)
  -w, --watch           Watch for changes and regenerate
  -h, --help            Show this help

Examples:
  ts-to-dhi types.ts                    # Generate types.schemas.ts
  ts-to-dhi models/user.ts -o schemas.ts # Custom output file
  ts-to-dhi types.ts -w                 # Watch mode
`);
}

function parseArgs(args: string[]): CliOptions | null {
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    printHelp();
    return null;
  }

  const input = args[0];
  let output: string | undefined;
  let watch = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      output = args[++i];
    } else if (arg === "-w" || arg === "--watch") {
      watch = true;
    }
  }

  // Default output: types.ts → types.schemas.ts
  if (!output) {
    const dir = dirname(input);
    const name = basename(input, extname(input));
    output = resolve(dir, `${name}.schemas.ts`);
  }

  return { input: resolve(input), output: resolve(output), watch };
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
  try {
    types = extractTypes(source, inputFile);
  } catch (err) {
    console.error(`❌ Parse error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
  
  if (types.length === 0) {
    console.log("⚠️  No types found to generate (looking for interfaces and type aliases)");
    return false;
  }
  
  console.log(`✅ Found ${types.length} type definition(s)`);
  
  console.log("📝 Generating dhi schemas...");
  const output = generateDhiSchema(types);
  
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
