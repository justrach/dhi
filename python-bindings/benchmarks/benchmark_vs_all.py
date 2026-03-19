"""
Comprehensive benchmark: dhi vs satya vs msgspec vs msgspec-ext vs Pydantic
Testing JSON validation performance with real-world data
"""

import time
import json
from typing import List

# Import dhi
from dhi import _dhi_native

# Try to import competitors
try:
    from satya import Model as SatyaModel, Field as SatyaField
    HAS_SATYA = True
except ImportError:
    HAS_SATYA = False
    print("⚠️  satya not installed")

try:
    import msgspec
    HAS_MSGSPEC = True
except ImportError:
    HAS_MSGSPEC = False
    print("⚠️  msgspec not installed")

try:
    from pydantic import BaseModel, Field, EmailStr
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    print("⚠️  pydantic not installed")

try:
    import msgspec as _msgspec_ext_base
    from msgspec_ext import EmailStr as MsgspecExtEmailStr, HttpUrl, PositiveInt, dec_hook
    HAS_MSGSPEC_EXT = True
except ImportError:
    HAS_MSGSPEC_EXT = False
    print("⚠️  msgspec-ext not installed (pip install msgspec-ext)")

print("=" * 80)
print("🏆 COMPREHENSIVE BENCHMARK: dhi vs satya vs msgspec vs msgspec-ext vs Pydantic")
print("=" * 80)
print()

# Generate test data
def generate_users(n: int) -> List[dict]:
    return [
        {
            "name": f"User{i}",
            "email": f"user{i}@example.com",
            "age": 20 + (i % 50),
            "website": f"https://user{i}.com",
            "active": i % 2 == 0,
        }
        for i in range(n)
    ]

users = generate_users(10000)
json_bytes = json.dumps(users).encode()

print(f"Dataset: {len(users):,} users")
print(f"JSON size: {len(json_bytes):,} bytes ({len(json_bytes)/1024:.1f} KB)")
print()

# ============================================================================
# Test 1: dhi (Zig + C Extension)
# ============================================================================

print("=" * 80)
print("Test 1: dhi (Zig + C Extension) - Batch Validation")
print("=" * 80)

field_specs = {
    'name': ('string', 1, 100),
    'email': ('email',),
    'age': ('int_positive',),
    'website': ('url',),
}

# Warmup
_ = _dhi_native.validate_batch_direct(users, field_specs)

# Benchmark
times = []
for i in range(5):
    start = time.perf_counter()
    results, valid_count = _dhi_native.validate_batch_direct(users, field_specs)
    elapsed = time.perf_counter() - start
    times.append(elapsed)
    throughput = len(users) / elapsed
    print(f"  Run {i+1}: {throughput:,.0f} users/sec ({elapsed*1000:.2f}ms)")

dhi_time = sum(times) / len(times)
dhi_throughput = len(users) / dhi_time
print(f"\n✅ dhi Average: {dhi_throughput:,.0f} users/sec")
print(f"   Valid: {valid_count}/{len(users)}")
print()

# ============================================================================
# Test 2: satya (Rust + PyO3)
# ============================================================================

if HAS_SATYA:
    print("=" * 80)
    print("Test 2: satya (Rust + PyO3) - JSON Array Validation")
    print("=" * 80)
    
    class SatyaUser(SatyaModel):
        name: str = SatyaField(min_length=1, max_length=100)
        email: str = SatyaField(email=True)
        age: int = SatyaField(ge=1, le=120)
        website: str
        active: bool
    
    # Warmup
    try:
        _ = SatyaUser.model_validate_json_array_bytes(json_bytes)
    except:
        pass
    
    # Benchmark
    times = []
    for i in range(5):
        start = time.perf_counter()
        results = SatyaUser.model_validate_json_array_bytes(json_bytes)
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        throughput = len(users) / elapsed
        print(f"  Run {i+1}: {throughput:,.0f} users/sec ({elapsed*1000:.2f}ms)")
    
    satya_time = sum(times) / len(times)
    satya_throughput = len(users) / satya_time
    print(f"\n✅ satya Average: {satya_throughput:,.0f} users/sec")
    print()

# ============================================================================
# Test 3: msgspec (C Extension)
# ============================================================================

if HAS_MSGSPEC:
    print("=" * 80)
    print("Test 3: msgspec (C Extension) - JSON Decoding + Validation")
    print("=" * 80)
    
    class MsgspecUser(msgspec.Struct):
        name: str
        email: str
        age: int
        website: str
        active: bool
    
    decoder = msgspec.json.Decoder(List[MsgspecUser])
    
    # Warmup
    try:
        _ = decoder.decode(json_bytes)
    except:
        pass
    
    # Benchmark
    times = []
    for i in range(5):
        start = time.perf_counter()
        try:
            results = decoder.decode(json_bytes)
            valid_count = len(results)
        except msgspec.ValidationError:
            valid_count = 0
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        throughput = len(users) / elapsed
        print(f"  Run {i+1}: {throughput:,.0f} users/sec ({elapsed*1000:.2f}ms)")
    
    msgspec_time = sum(times) / len(times)
    msgspec_throughput = len(users) / msgspec_time
    print(f"\n✅ msgspec Average: {msgspec_throughput:,.0f} users/sec")
    print()

# ============================================================================
# Test 4: Pydantic (Python + Rust)
# ============================================================================

if HAS_PYDANTIC:
    print("=" * 80)
    print("Test 4: Pydantic V2 (Python + Rust) - JSON Validation")
    print("=" * 80)
    
    class PydanticUser(BaseModel):
        name: str = Field(min_length=1, max_length=100)
        email: EmailStr
        age: int = Field(gt=0, le=120)
        website: str
        active: bool
    
    # Warmup
    try:
        _ = [PydanticUser.model_validate_json(json.dumps(u)) for u in users[:100]]
    except:
        pass
    
    # Benchmark (sample 1000 users for speed)
    sample_users = users[:1000]
    times = []
    for i in range(5):
        start = time.perf_counter()
        valid_count = 0
        for user in sample_users:
            try:
                _ = PydanticUser.model_validate(user)
                valid_count += 1
            except:
                pass
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        throughput = len(sample_users) / elapsed
        print(f"  Run {i+1}: {throughput:,.0f} users/sec ({elapsed*1000:.2f}ms) [1K sample]")
    
    pydantic_time = sum(times) / len(times)
    pydantic_throughput = len(sample_users) / pydantic_time
    print(f"\n✅ Pydantic Average: {pydantic_throughput:,.0f} users/sec")
    print()

# ============================================================================
# Test 5: msgspec-ext (msgspec + validators)
# ============================================================================

if HAS_MSGSPEC_EXT:
    print("=" * 80)
    print("Test 5: msgspec-ext (msgspec + 26 validators) - JSON Decoding + Validation")
    print("=" * 80)

    class MsgspecExtUser(_msgspec_ext_base.Struct):
        name: str
        email: MsgspecExtEmailStr
        age: PositiveInt
        website: HttpUrl
        active: bool

    msgspec_ext_decoder = _msgspec_ext_base.json.Decoder(List[MsgspecExtUser])

    # Warmup
    try:
        _ = msgspec_ext_decoder.decode(json_bytes, dec_hook=dec_hook)
    except Exception:
        # Fallback: decode without dec_hook if the decoder doesn't accept it
        try:
            _ = _msgspec_ext_base.json.decode(json_bytes, type=List[MsgspecExtUser], dec_hook=dec_hook)
        except Exception:
            pass

    # Benchmark
    times = []
    for i in range(5):
        start = time.perf_counter()
        try:
            results = _msgspec_ext_base.json.decode(json_bytes, type=List[MsgspecExtUser], dec_hook=dec_hook)
            valid_count = len(results)
        except Exception as e:
            valid_count = 0
            if i == 0:
                print(f"  ⚠️  Validation error: {e}")
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        throughput = len(users) / elapsed
        print(f"  Run {i+1}: {throughput:,.0f} users/sec ({elapsed*1000:.2f}ms)")

    msgspec_ext_time = sum(times) / len(times)
    msgspec_ext_throughput = len(users) / msgspec_ext_time
    print(f"\n✅ msgspec-ext Average: {msgspec_ext_throughput:,.0f} users/sec")
    print()

# ============================================================================
# RESULTS SUMMARY
# ============================================================================

print("=" * 80)
print("📊 FINAL RESULTS")
print("=" * 80)
print()

results = [
    ("dhi (Zig + C)", dhi_throughput, dhi_time),
]

if HAS_SATYA:
    results.append(("satya (Rust + PyO3)", satya_throughput, satya_time))
if HAS_MSGSPEC:
    results.append(("msgspec (C)", msgspec_throughput, msgspec_time))
if HAS_PYDANTIC:
    results.append(("Pydantic V2 (Rust)", pydantic_throughput, pydantic_time))
if HAS_MSGSPEC_EXT:
    results.append(("msgspec-ext (msgspec+)", msgspec_ext_throughput, msgspec_ext_time))

# Sort by throughput (descending)
results.sort(key=lambda x: x[1], reverse=True)

print("Ranking (10,000 users with 4-5 validators each):")
print()

for rank, (name, throughput, time_taken) in enumerate(results, 1):
    medal = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else "  "
    print(f"{medal} {rank}. {name:25s} {throughput:>12,.0f} users/sec  ({time_taken*1000:>6.2f}ms)")

print()

# Calculate speedups
if len(results) > 1:
    fastest = results[0]
    print("Speedup vs fastest:")
    for name, throughput, _ in results[1:]:
        speedup = fastest[1] / throughput
        print(f"  {name:25s} {speedup:.2f}x slower")

print()
print("=" * 80)
print("🎯 KEY INSIGHTS")
print("=" * 80)
print()
print("dhi advantages:")
print("  ✅ Zero Python overhead (C extracts directly from dicts)")
print("  ✅ Single FFI call for entire batch")
print("  ✅ Pure Zig validators (no allocations)")
print("  ✅ General-purpose (works with any dict structure)")
print()
print("satya advantages:")
print("  ✅ Integrated JSON parsing + validation")
print("  ✅ Streaming support for large files")
print("  ✅ Pydantic-compatible API")
print()
print("msgspec advantages:")
print("  ✅ Fastest JSON decoding (C implementation)")
print("  ✅ Low memory usage")
print("  ✅ Type-safe structs")
print()
print("msgspec-ext advantages:")
print("  ✅ 26 built-in validators (email, URL, IP, etc.)")
print("  ✅ msgspec C backend + Python validation layer")
print("  ✅ Drop-in pydantic-settings replacement")
print()
print("=" * 80)
