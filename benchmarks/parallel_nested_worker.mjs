import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { object, string, number } = require('../dist/index.js');

function makeDeepSchema() {
  return object({
    a: object({ b: object({ c: object({ d: object({ e: object({ name: string(), score: number() }) }) }) }) })
  });
}

const { id, data } = workerData;
const schema = makeDeepSchema();

// Warmup a little
schema.validateBatch(data.slice(0, Math.min(1000, data.length)));

const start = performance.now();
schema.validateBatch(data);
const end = performance.now();

parentPort.postMessage(data.length);
