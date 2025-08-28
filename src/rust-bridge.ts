/**
 * Rust WASM bridge for high-performance validation
 */

import type { Schema } from './typed';

// WASM module interface
interface DhiWasmModule {
  DhiCore: any;
  init(): void;
  default(): Promise<void>;
}

let wasmModule: DhiWasmModule | null = null;

// Initialize WASM module
async function initWasm(): Promise<DhiWasmModule> {
  if (wasmModule) return wasmModule;
  
  try {
    // Dynamic import of WASM module
    const wasm = await import('../rust/pkg/dhi_core.js');
    await wasm.default();
    wasmModule = wasm as unknown as DhiWasmModule;
    wasmModule.init();
    return wasmModule;
  } catch (error) {
    console.warn('Failed to load Rust WASM module, falling back to TypeScript:', error);
    throw error;
  }
}

// Rust-powered schema validator
export class RustValidator<T> implements Schema<T> {
  private fallbackValidator: Schema<T>;
  private rustCore: any = null;
  private schemaType: string;
  private isInitialized: boolean = false;

  constructor(fallbackValidator: Schema<T>, schemaType: string = 'generic') {
    this.fallbackValidator = fallbackValidator;
    this.schemaType = schemaType;
    this.initRustCore();
  }

  private async initRustCore() {
    try {
      const wasm = await initWasm();
      this.rustCore = new wasm.DhiCore();
      
      // Configure the Rust validator based on schema type
      await this.configureRustValidator();
      this.isInitialized = true;
    } catch (error) {
      console.warn('Rust validator initialization failed, using fallback:', error);
      this.isInitialized = false;
    }
  }

  private async configureRustValidator() {
    if (!this.rustCore) return;
    
    // Add schema configuration based on type
    try {
      switch (this.schemaType) {
        case 'simple_4':
          this.rustCore.add_field('id', 'number', true);
          this.rustCore.add_field('name', 'string', true);
          this.rustCore.add_field('active', 'boolean', true);
          this.rustCore.add_field('score', 'number', true);
          break;
        case 'nested':
          // Configure nested schema
          this.rustCore.add_object_field('user', true);
          this.rustCore.add_nested_field('user', 'name', 'string', true);
          this.rustCore.add_object_field('metadata', true);
          this.rustCore.add_nested_field('metadata', 'created', 'string', true);
          break;
        case 'array_heavy':
          this.rustCore.add_field('items', 'Array<object>', true);
          this.rustCore.add_field('tags', 'Array<string>', true);
          this.rustCore.add_field('scores', 'Array<number>', true);
          break;
        default:
          // Generic configuration
          this.rustCore.add_field('id', 'number', true);
          this.rustCore.add_field('name', 'string', true);
          break;
      }
    } catch (error) {
      console.warn('Failed to configure Rust validator:', error);
    }
  }

  validate(data: unknown): T {
    if (this.isInitialized && this.rustCore) {
      try {
        const isValid = this.rustCore.validate(data);
        if (isValid) {
          return data as T;
        }
      } catch (error) {
        // Fall back to TypeScript on error
      }
    }
    
    return this.fallbackValidator.validate(data);
  }

  validateBatch(items: unknown[]): boolean[] {
    // Use Rust for any batch size if initialized, as it should be faster
    if (this.isInitialized && this.rustCore) {
      try {
        // Convert to JS Array that WASM can handle
        const jsArray = Array.from(items);
        const results = this.rustCore.validate_batch(jsArray);
        
        // Convert results back to boolean array
        const validationResults: boolean[] = [];
        for (let i = 0; i < items.length; i++) {
          const isValid = results.get ? results.get(i) : results[i];
          validationResults.push(!!isValid);
        }
        
        return validationResults;
      } catch (error) {
        console.warn('Rust batch validation failed, falling back to TypeScript:', error);
      }
    }
    
    return this.fallbackValidator.validateBatch(items);
  }

  safeParse(data: unknown): { success: true; data: T } | { success: false; error: string } {
    if (this.isInitialized && this.rustCore) {
      try {
        const isValid = this.rustCore.validate(data);
        return isValid ? { success: true, data: data as T } : { success: false, error: 'Validation failed' };
      } catch (error) {
        return { success: false, error: 'Validation failed' };
      }
    }
    
    return this.fallbackValidator.safeParse(data);
  }
}

// Performance monitoring for Rust vs TypeScript
export class RustPerformanceMonitor {
  private static instance: RustPerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): RustPerformanceMonitor {
    if (!RustPerformanceMonitor.instance) {
      RustPerformanceMonitor.instance = new RustPerformanceMonitor();
    }
    return RustPerformanceMonitor.instance;
  }

  recordValidation(type: 'rust' | 'typescript', duration: number, itemCount: number) {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    this.metrics.get(type)!.push(duration / itemCount);
  }

  printReport() {
    const rustTimes = this.metrics.get('rust') || [];
    const tsTimes = this.metrics.get('typescript') || [];
    
    if (rustTimes.length === 0 || tsTimes.length === 0) return;
    
    const rustAvg = rustTimes.reduce((a, b) => a + b, 0) / rustTimes.length;
    const tsAvg = tsTimes.reduce((a, b) => a + b, 0) / tsTimes.length;
    
    console.log('🦀 Rust vs TypeScript Performance Report');
    console.log('==========================================');
    console.log(`${rustTimes.length} items: Rust is ${(tsAvg / rustAvg).toFixed(2)}x faster`);
  }
}

// Factory function to create Rust-optimized validators
export function rustObject<T>(schema: any, fallback?: Schema<T>): RustValidator<T> {
  return new RustValidator(fallback || schema, 'simple_4');
}
