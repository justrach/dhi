'use client';

import { useState } from 'react';
import { z } from 'dhi';

// Define schema with dhi - 1.78x faster than Zod!
const UserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().positive().int(),
  role: z.enum(['admin', 'user', 'guest']),
}).strict();

type User = {
  name: string;
  email: string;
  age: number;
  role: 'admin' | 'user' | 'guest';
};

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    role: 'user',
  });
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const data = {
        name: formData.name,
        email: formData.email,
        age: parseInt(formData.age, 10),
        role: formData.role as 'admin' | 'user' | 'guest',
      };

      // Validate with dhi (async - loads WASM on first call)
      const validatedUser = await UserSchema.parse(data);
      
      setResult({
        type: 'success',
        message: `✅ Valid user:\n${JSON.stringify(validatedUser, null, 2)}`,
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: `❌ Validation failed:\n${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            dhi + Next.js 15
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Fastest TypeScript validation library - <strong>1.78x faster than Zod</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Name (2-100 characters)
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
              placeholder="john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Age (positive integer)
            </label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
              placeholder="25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="guest">Guest</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? 'Validating...' : 'Validate with dhi 🚀'}
          </button>
        </form>

        {result && (
          <div
            className={`mt-6 p-6 rounded-lg border-2 ${
              result.type === 'success'
                ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
                : 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
            }`}
          >
            <pre className={`text-sm whitespace-pre-wrap font-mono ${
              result.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {result.message}
            </pre>
          </div>
        )}

        <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3 text-lg">
            ⚡ Performance Comparison
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex justify-between">
              <span>parseSafe:</span>
              <span className="font-mono">7.02M ops/s (3.37x faster) 🔥</span>
            </div>
            <div className="flex justify-between">
              <span>parseStrict:</span>
              <span className="font-mono">1.46M ops/s (1.11x faster)</span>
            </div>
            <div className="flex justify-between">
              <span>Average:</span>
              <span className="font-mono font-bold">1.78x faster than Zod!</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <a 
            href="https://github.com/justrach/satya-zig"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition underline"
          >
            View on GitHub
          </a>
          {' • '}
          <a 
            href="https://www.npmjs.com/package/dhi"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition underline"
          >
            npm package
          </a>
        </div>
      </div>
    </main>
  );
}
