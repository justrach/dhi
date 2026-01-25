/**
 * API Tests for Hono + dhi Example
 *
 * Run with: bun run test.ts
 */

const BASE_URL = 'http://localhost:3000';

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (e: any) {
    console.log(`❌ ${name}`);
    console.log(`   ${e.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log('\n🧪 Testing Hono + dhi API\n');
  console.log('='.repeat(60));

  // Test: Health check
  await test('GET / returns API info', async () => {
    const res = await fetch(`${BASE_URL}/`);
    const data = await res.json();
    assert(res.status === 200, 'Expected 200');
    assert(data.message.includes('dhi'), 'Should mention dhi');
  });

  // Test: Create user with valid data
  let userId: string;
  await test('POST /api/users creates user with valid data', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Smith',
        email: 'alice@example.com',
        age: 28,
        role: 'admin',
      }),
    });
    const data = await res.json();
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(data.data.id, 'Should return user with id');
    assert(data.data.name === 'Alice Smith', 'Name should match');
    userId = data.data.id;
  });

  // Test: Create user with invalid email
  await test('POST /api/users rejects invalid email', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob',
        email: 'not-an-email',
      }),
    });
    const data = await res.json();
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(data.error === 'Validation failed', 'Should have validation error');
  });

  // Test: Create user with missing name
  await test('POST /api/users rejects empty name', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'test@example.com',
      }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // Test: Get user by ID
  await test('GET /api/users/:id returns user', async () => {
    const res = await fetch(`${BASE_URL}/api/users/${userId}`);
    const data = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(data.data.email === 'alice@example.com', 'Email should match');
  });

  // Test: Update user
  await test('PUT /api/users/:id updates user', async () => {
    const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Johnson',
      }),
    });
    const data = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(data.data.name === 'Alice Johnson', 'Name should be updated');
  });

  // Test: List users with query params
  await test('GET /api/users with query params works', async () => {
    const res = await fetch(`${BASE_URL}/api/users?page=1&limit=5&role=admin`);
    const data = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(data.data), 'Should return array');
    assert(data.pagination.page === 1, 'Page should be 1');
  });

  // Test: Create product
  await test('POST /api/products creates product', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Laptop',
        price: 999.99,
        quantity: 50,
        tags: ['electronics', 'computers'],
      }),
    });
    const data = await res.json();
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(data.data.name === 'Laptop', 'Name should match');
  });

  // Test: Create product with invalid price
  await test('POST /api/products rejects negative price', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Product',
        price: -10,
        quantity: 5,
      }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // Test: Create order with nested validation
  await test('POST /api/orders validates nested objects', async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        items: [
          { productId: 'prod-1', quantity: 2 },
          { productId: 'prod-2', quantity: 1 },
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          zipCode: '94102',
          country: 'US',
        },
      }),
    });
    const data = await res.json();
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(data.data.status === 'pending', 'Order should be pending');
  });

  // Test: Order with invalid zip code
  await test('POST /api/orders rejects invalid zip code', async () => {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        items: [{ productId: 'prod-1', quantity: 1 }],
        shippingAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          zipCode: 'INVALID',
          country: 'US',
        },
      }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // Test: Get JSON Schema
  await test('GET /api/schema/create-user returns JSON Schema', async () => {
    const res = await fetch(`${BASE_URL}/api/schema/create-user`);
    const schema = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(schema.type === 'object', 'Should be object schema');
    assert(schema.properties.email, 'Should have email property');
  });

  // Test: Get all schemas
  await test('GET /api/schemas returns all schemas', async () => {
    const res = await fetch(`${BASE_URL}/api/schemas`);
    const schemas = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(schemas['create-user'], 'Should have create-user schema');
    assert(schemas['order'], 'Should have order schema');
  });

  // Test: Delete user
  await test('DELETE /api/users/:id deletes user', async () => {
    const res = await fetch(`${BASE_URL}/api/users/${userId}`, {
      method: 'DELETE',
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // Test: Get deleted user returns 404
  await test('GET /api/users/:id returns 404 for deleted user', async () => {
    const res = await fetch(`${BASE_URL}/api/users/${userId}`);
    assert(res.status === 404, `Expected 404, got ${res.status}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✨ Tests complete!\n');
}

runTests().catch(console.error);
