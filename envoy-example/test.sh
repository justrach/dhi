#!/usr/bin/env bash
set -euo pipefail

ENVOY="${ENVOY_URL:-http://localhost:8000}"

echo "=== Envoy WASM Filter: dhi Validation Tests ==="
echo

# Test 1: Valid email + uuid + name + age
echo "1. Valid request (all fields pass)"
curl -s -w "\n  HTTP %{http_code}\n" \
  -X POST "$ENVOY/post" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","uuid":"550e8400-e29b-41d4-a716-446655440000","name":"Alice","age":30}'
echo

# Test 2: Invalid email
echo "2. Invalid email"
curl -s -w "\n  HTTP %{http_code}\n" \
  -X POST "$ENVOY/post" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","uuid":"550e8400-e29b-41d4-a716-446655440000","name":"Alice","age":30}'
echo

# Test 3: Missing field (no email)
echo "3. Missing required email field"
curl -s -w "\n  HTTP %{http_code}\n" \
  -X POST "$ENVOY/post" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","age":30}'
echo

# Test 4: Invalid UUID format
echo "4. Invalid UUID"
curl -s -w "\n  HTTP %{http_code}\n" \
  -X POST "$ENVOY/post" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","uuid":"not-a-uuid","name":"Alice","age":30}'
echo

# Test 5: Age out of range
echo "5. Age out of range (200 is not 0-150)"
curl -s -w "\n  HTTP %{http_code}\n" \
  -X POST "$ENVOY/post" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","uuid":"550e8400-e29b-41d4-a716-446655440000","name":"Alice","age":200}'
echo

# Test 6: GET request (should pass through)
echo "6. GET request (no validation)"
curl -s -w "\n  HTTP %{http_code}\n" "$ENVOY/get"
echo

echo "=== All tests complete ==="
