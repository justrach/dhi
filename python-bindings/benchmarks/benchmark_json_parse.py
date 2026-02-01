"""
Benchmark: dhi Struct.from_json() vs msgspec vs json.loads + Struct()

This benchmark compares the performance of:
1. dhi Struct.from_json() - SIMD-accelerated JSON parsing with direct validation
2. msgspec.json.decode() - msgspec's optimized JSON decoder
3. json.loads() + Struct() - Current dhi approach (intermediate dict)

The goal is to demonstrate 2-4x speedup over msgspec for JSON → validated struct.
"""

import time
import json
import sys
from typing import Annotated

# Import dhi Struct and Decoder
from dhi import Struct, Field, Decoder

# Try to import msgspec
try:
    import msgspec
    HAS_MSGSPEC = True
except ImportError:
    HAS_MSGSPEC = False
    print("⚠️  msgspec not installed - pip install msgspec")

print("=" * 80)
print("🚀 BENCHMARK: JSON → Struct Performance")
print("=" * 80)
print()

# ============================================================================
# Define test schemas
# ============================================================================

# dhi Struct
class UserStruct(Struct):
    name: Annotated[str, Field(min_length=1, max_length=100)]
    email: str
    age: Annotated[int, Field(ge=0, le=150)]


# msgspec Struct (if available)
if HAS_MSGSPEC:
    class UserMsgspec(msgspec.Struct):
        name: str
        email: str
        age: int

    msgspec_decoder = msgspec.json.Decoder(UserMsgspec)
    msgspec_array_decoder = msgspec.json.Decoder(list[UserMsgspec])

# ============================================================================
# Generate test data
# ============================================================================

def generate_user_json(n: int) -> bytes:
    """Generate JSON array of user objects."""
    users = [
        {"name": f"User{i}", "email": f"user{i}@example.com", "age": 20 + (i % 100)}
        for i in range(n)
    ]
    return json.dumps(users).encode()


def generate_single_user_json() -> bytes:
    """Generate a single user JSON object."""
    return b'{"name": "John Doe", "email": "john@example.com", "age": 30}'


# Test data
SINGLE_USER = generate_single_user_json()
BATCH_SIZES = [100, 1000, 10000]

print("Test Data:")
print(f"  Single user JSON: {len(SINGLE_USER)} bytes")
for size in BATCH_SIZES:
    data = generate_user_json(size)
    print(f"  {size:,} users: {len(data):,} bytes ({len(data)/1024:.1f} KB)")
print()

# ============================================================================
# Benchmark: Single Object Parsing
# ============================================================================

print("=" * 80)
print("📊 Single Object Parsing (smaller is better)")
print("=" * 80)
print()

ITERATIONS = 100000

# 1. dhi Struct.from_json()
print("1. dhi Struct.from_json() - SIMD-accelerated native parser")
times = []
for _ in range(3):
    start = time.perf_counter()
    for _ in range(ITERATIONS):
        user = UserStruct.from_json(SINGLE_USER)
    elapsed = time.perf_counter() - start
    times.append(elapsed)
dhi_native_time = min(times)
dhi_native_ns = (dhi_native_time / ITERATIONS) * 1e9
print(f"   Best: {dhi_native_ns:.0f} ns/op ({ITERATIONS/dhi_native_time:,.0f} ops/sec)")

# 1b. dhi Decoder (fastest - no dict lookup)
print("\n1b. dhi Decoder.decode() - Fastest path (cached specs)")
dhi_decoder = Decoder(UserStruct)
times = []
for _ in range(3):
    start = time.perf_counter()
    for _ in range(ITERATIONS):
        user = dhi_decoder.decode(SINGLE_USER)
    elapsed = time.perf_counter() - start
    times.append(elapsed)
dhi_decoder_time = min(times)
dhi_decoder_ns = (dhi_decoder_time / ITERATIONS) * 1e9
print(f"   Best: {dhi_decoder_ns:.0f} ns/op ({ITERATIONS/dhi_decoder_time:,.0f} ops/sec)")

# 2. dhi json.loads() + Struct() (current approach)
print("\n2. dhi json.loads() + Struct() - Current approach")
times = []
for _ in range(3):
    start = time.perf_counter()
    for _ in range(ITERATIONS):
        data = json.loads(SINGLE_USER)
        user = UserStruct(**data)
    elapsed = time.perf_counter() - start
    times.append(elapsed)
dhi_dict_time = min(times)
dhi_dict_ns = (dhi_dict_time / ITERATIONS) * 1e9
print(f"   Best: {dhi_dict_ns:.0f} ns/op ({ITERATIONS/dhi_dict_time:,.0f} ops/sec)")

# 3. msgspec
if HAS_MSGSPEC:
    print("\n3. msgspec.json.decode() - msgspec native decoder")
    times = []
    for _ in range(3):
        start = time.perf_counter()
        for _ in range(ITERATIONS):
            user = msgspec_decoder.decode(SINGLE_USER)
        elapsed = time.perf_counter() - start
        times.append(elapsed)
    msgspec_time = min(times)
    msgspec_ns = (msgspec_time / ITERATIONS) * 1e9
    print(f"   Best: {msgspec_ns:.0f} ns/op ({ITERATIONS/msgspec_time:,.0f} ops/sec)")

print()
print("-" * 40)
print("Summary (Single Object):")
print(f"  dhi from_json():        {dhi_native_ns:>7.0f} ns")
print(f"  dhi Decoder.decode():   {dhi_decoder_ns:>7.0f} ns")
print(f"  dhi json.loads+Struct: {dhi_dict_ns:>7.0f} ns")
if HAS_MSGSPEC:
    print(f"  msgspec:                {msgspec_ns:>7.0f} ns")
    if dhi_decoder_ns < msgspec_ns:
        speedup = msgspec_ns / dhi_decoder_ns
        print(f"\n✅ dhi Decoder is {speedup:.1f}x FASTER than msgspec!")
    elif dhi_native_ns < msgspec_ns:
        speedup = msgspec_ns / dhi_native_ns
        print(f"\n✅ dhi from_json() is {speedup:.1f}x FASTER than msgspec!")
    else:
        ratio = dhi_decoder_ns / msgspec_ns
        print(f"\n⚠️ dhi Decoder is {ratio:.1f}x slower than msgspec")
else:
    speedup = dhi_native_ns / dhi_decoder_ns
    print(f"\n📊 Decoder is {speedup:.1f}x faster than from_json()")
print()

# ============================================================================
# Benchmark: Batch Parsing
# ============================================================================

print("=" * 80)
print("📊 Batch Parsing (array of objects)")
print("=" * 80)
print()

for batch_size in BATCH_SIZES:
    print(f"\n--- {batch_size:,} objects ---")

    batch_json = generate_user_json(batch_size)
    BATCH_ITERS = max(10, 10000 // batch_size)

    # 1. dhi Struct.from_json_batch()
    print(f"1. dhi from_json_batch() [{BATCH_ITERS} iterations]")
    times = []
    for _ in range(3):
        start = time.perf_counter()
        for _ in range(BATCH_ITERS):
            users = UserStruct.from_json_batch(batch_json)
        elapsed = time.perf_counter() - start
        times.append(elapsed)
    dhi_batch_time = min(times)
    dhi_batch_throughput = (batch_size * BATCH_ITERS) / dhi_batch_time
    print(f"   {dhi_batch_throughput:,.0f} objects/sec")

    # 2. dhi json.loads() + list comprehension
    print(f"2. dhi json.loads + [Struct(**x) for x] [{BATCH_ITERS} iterations]")
    times = []
    for _ in range(3):
        start = time.perf_counter()
        for _ in range(BATCH_ITERS):
            data = json.loads(batch_json)
            users = [UserStruct(**x) for x in data]
        elapsed = time.perf_counter() - start
        times.append(elapsed)
    dhi_list_time = min(times)
    dhi_list_throughput = (batch_size * BATCH_ITERS) / dhi_list_time
    print(f"   {dhi_list_throughput:,.0f} objects/sec")

    # 3. msgspec
    if HAS_MSGSPEC:
        print(f"3. msgspec.json.decode(list[T]) [{BATCH_ITERS} iterations]")
        times = []
        for _ in range(3):
            start = time.perf_counter()
            for _ in range(BATCH_ITERS):
                users = msgspec_array_decoder.decode(batch_json)
            elapsed = time.perf_counter() - start
            times.append(elapsed)
        msgspec_batch_time = min(times)
        msgspec_batch_throughput = (batch_size * BATCH_ITERS) / msgspec_batch_time
        print(f"   {msgspec_batch_throughput:,.0f} objects/sec")

        # Comparison
        if dhi_batch_throughput > msgspec_batch_throughput:
            speedup = dhi_batch_throughput / msgspec_batch_throughput
            print(f"   ✅ dhi is {speedup:.1f}x faster")
        else:
            ratio = msgspec_batch_throughput / dhi_batch_throughput
            print(f"   ⚠️ msgspec is {ratio:.1f}x faster")

print()
print("=" * 80)
print("🏁 Benchmark Complete")
print("=" * 80)
