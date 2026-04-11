import { parse } from "yuku-parser";

// Try all TS modes
const code = "const x: number = 1;";

for (const lang of ["js", "ts", "tsx"]) {
  const result = parse(code, { lang: lang as any });
  console.log(`lang="${lang}": ${result.diagnostics.length} errors`);
}
