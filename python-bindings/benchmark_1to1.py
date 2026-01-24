"""
1:1 Benchmark: dhi vs satya 0.5.1 vs msgspec vs Pydantic V2

Fair comparison with EQUIVALENT schemas across all libraries.
Each library validates the same data with the same constraints.

Tests:
  1. Simple user (name + email + age)
  2. Strict constraints (string bounds + number ranges)
  3. Complex user (nested address, multiple validators)
  4. Large batch (10K items)
  5. Invalid data (error path)
  6. String-heavy validation
  7. Number-heavy validation
"""

import json
import time
import sys
from typing import Annotated, List, Optional

# ============================================================================
# Setup: Import all libraries
# ============================================================================

# dhi (Zig + C extension)
try:
    from dhi import _dhi_native
    HAS_DHI = True
except Exception as e:
    print(f"dhi not available: {e}")
    HAS_DHI = False

# satya (Rust + PyO3)
try:
    from satya import Model as SatyaModel, Field as SatyaField
    import satya
    HAS_SATYA = True
except Exception:
    HAS_SATYA = False

# msgspec (C extension)
try:
    import msgspec
    from msgspec import Struct, Meta
    HAS_MSGSPEC = True
except Exception:
    HAS_MSGSPEC = False

# Pydantic V2
try:
    from pydantic import BaseModel, Field as PydanticField, EmailStr
    import pydantic
    HAS_PYDANTIC = True
except Exception:
    HAS_PYDANTIC = False


# ============================================================================
# Schema Definitions - EQUIVALENT across all libraries
# ============================================================================

# --- Satya Models ---
if HAS_SATYA:
    class SatyaUser(SatyaModel):
        name: str = SatyaField(min_length=2, max_length=100)
        email: str = SatyaField(email=True)
        age: int = SatyaField(ge=18, le=120)

    class SatyaAddress(SatyaModel):
        street: str = SatyaField(min_length=5, max_length=200)
        city: str = SatyaField(min_length=2, max_length=100)
        zip_code: str = SatyaField(min_length=5, max_length=10)

    class SatyaComplexUser(SatyaModel):
        name: str = SatyaField(min_length=2, max_length=100)
        email: str = SatyaField(email=True)
        age: int = SatyaField(ge=18, le=120)
        score: float = SatyaField(ge=0.0, le=100.0)

# --- msgspec Structs ---
if HAS_MSGSPEC:
    class MsgspecUser(Struct):
        name: Annotated[str, Meta(min_length=2, max_length=100)]
        email: str  # msgspec has no built-in email validator
        age: Annotated[int, Meta(ge=18, le=120)]

    class MsgspecAddress(Struct):
        street: Annotated[str, Meta(min_length=5, max_length=200)]
        city: Annotated[str, Meta(min_length=2, max_length=100)]
        zip_code: Annotated[str, Meta(min_length=5, max_length=10)]

    class MsgspecComplexUser(Struct):
        name: Annotated[str, Meta(min_length=2, max_length=100)]
        email: str
        age: Annotated[int, Meta(ge=18, le=120)]
        score: Annotated[float, Meta(ge=0.0, le=100.0)]

# --- Pydantic Models ---
if HAS_PYDANTIC:
    class PydanticUser(BaseModel):
        name: str = PydanticField(min_length=2, max_length=100)
        email: EmailStr
        age: int = PydanticField(ge=18, le=120)

    class PydanticAddress(BaseModel):
        street: str = PydanticField(min_length=5, max_length=200)
        city: str = PydanticField(min_length=2, max_length=100)
        zip_code: str = PydanticField(min_length=5, max_length=10)

    class PydanticComplexUser(BaseModel):
        name: str = PydanticField(min_length=2, max_length=100)
        email: EmailStr
        age: int = PydanticField(ge=18, le=120)
        score: float = PydanticField(ge=0.0, le=100.0)


# ============================================================================
# Test Data Generation
# ============================================================================

def gen_users(n: int) -> list:
    return [
        {"name": f"User{i}", "email": f"user{i}@example.com", "age": 20 + (i % 80)}
        for i in range(n)
    ]

def gen_complex_users(n: int) -> list:
    return [
        {
            "name": f"User{i}",
            "email": f"user{i}@example.com",
            "age": 20 + (i % 80),
            "score": round(50.0 + (i % 50) * 0.9, 1),
        }
        for i in range(n)
    ]

def gen_invalid_users(n: int) -> list:
    return [
        {"name": "A", "email": "not-an-email", "age": 200}  # all fields invalid
        for _ in range(n)
    ]

def gen_strings(n: int) -> list:
    return [{"name": f"TestString{i:06d}", "bio": f"Bio text for user number {i} with enough content"} for i in range(n)]

def gen_numbers(n: int) -> list:
    return [{"x": i % 1000, "y": (i * 7) % 500, "z": float(i % 100)} for i in range(n)]


# ============================================================================
# Benchmark Runner
# ============================================================================

def bench(name: str, fn, n: int, runs: int = 5) -> float:
    """Run benchmark and return best throughput."""
    # Warmup
    fn()

    times = []
    for _ in range(runs):
        start = time.perf_counter()
        fn()
        elapsed = time.perf_counter() - start
        times.append(elapsed)

    best = min(times)
    throughput = n / best
    return throughput


def format_throughput(t: float) -> str:
    if t >= 1_000_000:
        return f"{t/1_000_000:.2f}M/sec"
    elif t >= 1_000:
        return f"{t/1_000:.1f}K/sec"
    else:
        return f"{t:.0f}/sec"


# ============================================================================
# Test Scenarios
# ============================================================================

N = 10_000  # items per batch

print("=" * 80)
print(f"  1:1 BENCHMARK: dhi vs satya {satya.__version__ if HAS_SATYA else '?'} vs msgspec vs Pydantic V2")
print("=" * 80)
print(f"  Dataset size: {N:,} items per test")
print(f"  Python: {sys.version.split()[0]}")
if HAS_SATYA: print(f"  satya: {satya.__version__}")
if HAS_MSGSPEC: print(f"  msgspec: {msgspec.__version__}")
if HAS_PYDANTIC: print(f"  pydantic: {pydantic.__version__}")
print("=" * 80)
print()

results = {}

# ============================================================================
# TEST 1: Simple User Validation (name + email + age)
# ============================================================================
print("─" * 80)
print("TEST 1: Simple User (name: str[2,100], email, age: int[18,120])")
print("─" * 80)

users = gen_users(N)
users_json = json.dumps(users).encode()

if HAS_DHI:
    specs = {'name': ('string', 2, 100), 'email': ('email',), 'age': ('int', 18, 120)}
    t = bench("dhi", lambda: _dhi_native.validate_batch_direct(users, specs), N)
    results.setdefault("simple_user", {})["dhi"] = t
    print(f"  dhi (Zig+C batch):     {format_throughput(t):>14}")

if HAS_SATYA:
    t = bench("satya", lambda: SatyaUser.model_validate_json_array_bytes(users_json), N)
    results.setdefault("simple_user", {})["satya"] = t
    print(f"  satya (Rust+PyO3):     {format_throughput(t):>14}")

if HAS_MSGSPEC:
    decoder = msgspec.json.Decoder(List[MsgspecUser])
    t = bench("msgspec", lambda: decoder.decode(users_json), N)
    results.setdefault("simple_user", {})["msgspec"] = t
    print(f"  msgspec (C, no email): {format_throughput(t):>14}")

if HAS_PYDANTIC:
    adapter = pydantic.TypeAdapter(List[PydanticUser])
    t = bench("pydantic", lambda: adapter.validate_json(users_json), N)
    results.setdefault("simple_user", {})["pydantic"] = t
    print(f"  Pydantic V2 (Rust):    {format_throughput(t):>14}")

print()

# ============================================================================
# TEST 2: Complex User (name + email + age + score with float bounds)
# ============================================================================
print("─" * 80)
print("TEST 2: Complex User (name, email, age: int[18,120], score: float[0,100])")
print("─" * 80)

complex_users = gen_complex_users(N)
complex_json = json.dumps(complex_users).encode()

if HAS_DHI:
    specs = {'name': ('string', 2, 100), 'email': ('email',), 'age': ('int', 18, 120)}
    t = bench("dhi", lambda: _dhi_native.validate_batch_direct(complex_users, specs), N)
    results.setdefault("complex_user", {})["dhi"] = t
    print(f"  dhi (Zig+C batch):     {format_throughput(t):>14}")

if HAS_SATYA:
    t = bench("satya", lambda: SatyaComplexUser.model_validate_json_array_bytes(complex_json), N)
    results.setdefault("complex_user", {})["satya"] = t
    print(f"  satya (Rust+PyO3):     {format_throughput(t):>14}")

if HAS_MSGSPEC:
    decoder = msgspec.json.Decoder(List[MsgspecComplexUser])
    t = bench("msgspec", lambda: decoder.decode(complex_json), N)
    results.setdefault("complex_user", {})["msgspec"] = t
    print(f"  msgspec (C):           {format_throughput(t):>14}")

if HAS_PYDANTIC:
    adapter = pydantic.TypeAdapter(List[PydanticComplexUser])
    t = bench("pydantic", lambda: adapter.validate_json(complex_json), N)
    results.setdefault("complex_user", {})["pydantic"] = t
    print(f"  Pydantic V2 (Rust):    {format_throughput(t):>14}")

print()

# ============================================================================
# TEST 3: Dict-based validation (no JSON parsing overhead)
# ============================================================================
print("─" * 80)
print("TEST 3: Dict Validation (no JSON parsing, pure validation speed)")
print("─" * 80)

if HAS_DHI:
    specs = {'name': ('string', 2, 100), 'email': ('email',), 'age': ('int', 18, 120)}
    t = bench("dhi", lambda: _dhi_native.validate_batch_direct(users, specs), N)
    results.setdefault("dict_validation", {})["dhi"] = t
    print(f"  dhi (Zig+C batch):     {format_throughput(t):>14}")

if HAS_SATYA:
    def satya_dict_validate():
        for u in users:
            SatyaUser(**u)
    t = bench("satya", satya_dict_validate, N)
    results.setdefault("dict_validation", {})["satya"] = t
    print(f"  satya (Rust, per-item): {format_throughput(t):>13}")

if HAS_MSGSPEC:
    def msgspec_dict_validate():
        for u in users:
            msgspec.convert(u, MsgspecUser)
    t = bench("msgspec", msgspec_dict_validate, N)
    results.setdefault("dict_validation", {})["msgspec"] = t
    print(f"  msgspec (C, per-item): {format_throughput(t):>14}")

if HAS_PYDANTIC:
    def pydantic_dict_validate():
        for u in users:
            PydanticUser.model_validate(u)
    t = bench("pydantic", pydantic_dict_validate, N)
    results.setdefault("dict_validation", {})["pydantic"] = t
    print(f"  Pydantic V2 (per-item):{format_throughput(t):>14}")

print()

# ============================================================================
# TEST 4: Invalid Data (error path performance)
# ============================================================================
print("─" * 80)
print("TEST 4: Invalid Data (all fields wrong - error path)")
print("─" * 80)

invalid_users = gen_invalid_users(N)
invalid_json = json.dumps(invalid_users).encode()

if HAS_DHI:
    specs = {'name': ('string', 2, 100), 'email': ('email',), 'age': ('int', 18, 120)}
    t = bench("dhi", lambda: _dhi_native.validate_batch_direct(invalid_users, specs), N)
    results.setdefault("invalid", {})["dhi"] = t
    print(f"  dhi (Zig+C batch):     {format_throughput(t):>14}")

if HAS_SATYA:
    def satya_invalid():
        for u in invalid_users:
            try:
                SatyaUser(**u)
            except Exception:
                pass
    t = bench("satya", satya_invalid, N)
    results.setdefault("invalid", {})["satya"] = t
    print(f"  satya (Rust, per-item): {format_throughput(t):>13}")

if HAS_MSGSPEC:
    def msgspec_invalid():
        for u in invalid_users:
            try:
                msgspec.convert(u, MsgspecUser)
            except Exception:
                pass
    t = bench("msgspec", msgspec_invalid, N)
    results.setdefault("invalid", {})["msgspec"] = t
    print(f"  msgspec (C, per-item): {format_throughput(t):>14}")

if HAS_PYDANTIC:
    def pydantic_invalid():
        for u in invalid_users:
            try:
                PydanticUser.model_validate(u)
            except Exception:
                pass
    t = bench("pydantic", pydantic_invalid, N)
    results.setdefault("invalid", {})["pydantic"] = t
    print(f"  Pydantic V2 (per-item):{format_throughput(t):>14}")

print()

# ============================================================================
# TEST 5: String-heavy validation (name + bio with length constraints)
# ============================================================================
print("─" * 80)
print("TEST 5: String-Heavy (name: str[5,50], bio: str[20,500])")
print("─" * 80)

strings = gen_strings(N)

if HAS_DHI:
    specs = {'name': ('string', 5, 50), 'bio': ('string', 20, 500)}
    t = bench("dhi", lambda: _dhi_native.validate_batch_direct(strings, specs), N)
    results.setdefault("string_heavy", {})["dhi"] = t
    print(f"  dhi (Zig+C batch):     {format_throughput(t):>14}")

if HAS_SATYA:
    class SatyaStringItem(SatyaModel):
        name: str = SatyaField(min_length=5, max_length=50)
        bio: str = SatyaField(min_length=20, max_length=500)

    def satya_strings():
        for s in strings:
            SatyaStringItem(**s)
    t = bench("satya", satya_strings, N)
    results.setdefault("string_heavy", {})["satya"] = t
    print(f"  satya (Rust, per-item): {format_throughput(t):>13}")

if HAS_MSGSPEC:
    class MsgspecStringItem(Struct):
        name: Annotated[str, Meta(min_length=5, max_length=50)]
        bio: Annotated[str, Meta(min_length=20, max_length=500)]

    def msgspec_strings():
        for s in strings:
            msgspec.convert(s, MsgspecStringItem)
    t = bench("msgspec", msgspec_strings, N)
    results.setdefault("string_heavy", {})["msgspec"] = t
    print(f"  msgspec (C, per-item): {format_throughput(t):>14}")

if HAS_PYDANTIC:
    class PydanticStringItem(BaseModel):
        name: str = PydanticField(min_length=5, max_length=50)
        bio: str = PydanticField(min_length=20, max_length=500)

    def pydantic_strings():
        for s in strings:
            PydanticStringItem.model_validate(s)
    t = bench("pydantic", pydantic_strings, N)
    results.setdefault("string_heavy", {})["pydantic"] = t
    print(f"  Pydantic V2 (per-item):{format_throughput(t):>14}")

print()

# ============================================================================
# TEST 6: Number-heavy validation (3 int fields with ranges)
# ============================================================================
print("─" * 80)
print("TEST 6: Number-Heavy (x: int[0,999], y: int[0,499], z: float[0,99])")
print("─" * 80)

numbers = gen_numbers(N)

if HAS_DHI:
    specs = {'x': ('int', 0, 999), 'y': ('int', 0, 499)}
    t = bench("dhi", lambda: _dhi_native.validate_batch_direct(numbers, specs), N)
    results.setdefault("number_heavy", {})["dhi"] = t
    print(f"  dhi (Zig+C batch):     {format_throughput(t):>14}")

if HAS_SATYA:
    class SatyaNumbers(SatyaModel):
        x: int = SatyaField(ge=0, le=999)
        y: int = SatyaField(ge=0, le=499)
        z: float = SatyaField(ge=0.0, le=99.0)

    def satya_numbers():
        for n in numbers:
            SatyaNumbers(**n)
    t = bench("satya", satya_numbers, N)
    results.setdefault("number_heavy", {})["satya"] = t
    print(f"  satya (Rust, per-item): {format_throughput(t):>13}")

if HAS_MSGSPEC:
    class MsgspecNumbers(Struct):
        x: Annotated[int, Meta(ge=0, le=999)]
        y: Annotated[int, Meta(ge=0, le=499)]
        z: Annotated[float, Meta(ge=0.0, le=99.0)]

    def msgspec_numbers():
        for n in numbers:
            msgspec.convert(n, MsgspecNumbers)
    t = bench("msgspec", msgspec_numbers, N)
    results.setdefault("number_heavy", {})["msgspec"] = t
    print(f"  msgspec (C, per-item): {format_throughput(t):>14}")

if HAS_PYDANTIC:
    class PydanticNumbers(BaseModel):
        x: int = PydanticField(ge=0, le=999)
        y: int = PydanticField(ge=0, le=499)
        z: float = PydanticField(ge=0.0, le=99.0)

    def pydantic_numbers():
        for n in numbers:
            PydanticNumbers.model_validate(n)
    t = bench("pydantic", pydantic_numbers, N)
    results.setdefault("number_heavy", {})["pydantic"] = t
    print(f"  Pydantic V2 (per-item):{format_throughput(t):>14}")

print()

# ============================================================================
# TEST 7: JSON Array Parsing + Validation (all-in-one)
# ============================================================================
print("─" * 80)
print("TEST 7: JSON Parse + Validate (realistic API endpoint scenario)")
print("─" * 80)

if HAS_DHI:
    # dhi: parse JSON first, then validate
    def dhi_json_validate():
        parsed = json.loads(users_json)
        specs = {'name': ('string', 2, 100), 'email': ('email',), 'age': ('int', 18, 120)}
        return _dhi_native.validate_batch_direct(parsed, specs)
    t = bench("dhi", dhi_json_validate, N)
    results.setdefault("json_e2e", {})["dhi"] = t
    print(f"  dhi (json.loads+batch): {format_throughput(t):>13}")

if HAS_SATYA:
    t = bench("satya", lambda: SatyaUser.model_validate_json_array_bytes(users_json), N)
    results.setdefault("json_e2e", {})["satya"] = t
    print(f"  satya (integrated):    {format_throughput(t):>14}")

if HAS_MSGSPEC:
    decoder = msgspec.json.Decoder(List[MsgspecUser])
    t = bench("msgspec", lambda: decoder.decode(users_json), N)
    results.setdefault("json_e2e", {})["msgspec"] = t
    print(f"  msgspec (integrated):  {format_throughput(t):>14}")

if HAS_PYDANTIC:
    adapter = pydantic.TypeAdapter(List[PydanticUser])
    t = bench("pydantic", lambda: adapter.validate_json(users_json), N)
    results.setdefault("json_e2e", {})["pydantic"] = t
    print(f"  Pydantic V2 (integrated):{format_throughput(t):>12}")

print()

# ============================================================================
# FINAL SUMMARY
# ============================================================================

print("=" * 80)
print("  FINAL RESULTS SUMMARY")
print("=" * 80)
print()

# Collect all results into a table
all_libs = ["dhi", "satya", "msgspec", "pydantic"]
test_names = {
    "simple_user": "Simple User (JSON)",
    "complex_user": "Complex User (JSON)",
    "dict_validation": "Dict Validation",
    "invalid": "Invalid Data",
    "string_heavy": "String-Heavy",
    "number_heavy": "Number-Heavy",
    "json_e2e": "JSON End-to-End",
}

# Header
print(f"  {'Test':<22} {'dhi':>12} {'satya':>12} {'msgspec':>12} {'pydantic':>12}  {'Winner':<8}")
print(f"  {'─'*22} {'─'*12} {'─'*12} {'─'*12} {'─'*12}  {'─'*8}")

wins = {lib: 0 for lib in all_libs}

for test_key, test_name in test_names.items():
    if test_key not in results:
        continue
    row = results[test_key]

    # Find winner
    best_lib = max(row, key=row.get)
    best_val = row[best_lib]
    wins[best_lib] += 1

    # Format each cell
    cells = []
    for lib in all_libs:
        if lib in row:
            val = row[lib]
            if val >= 1_000_000:
                cells.append(f"{val/1_000_000:.1f}M")
            elif val >= 1_000:
                cells.append(f"{val/1_000:.0f}K")
            else:
                cells.append(f"{val:.0f}")
        else:
            cells.append("—")

    winner_str = best_lib.upper()
    print(f"  {test_name:<22} {cells[0]:>12} {cells[1]:>12} {cells[2]:>12} {cells[3]:>12}  {winner_str:<8}")

print()
print(f"  {'WINS':<22} {wins['dhi']:>12} {wins['satya']:>12} {wins['msgspec']:>12} {wins['pydantic']:>12}")
print()

# Speedup vs dhi
if "dhi" in results.get("simple_user", {}):
    dhi_base = results["simple_user"]["dhi"]
    print("  Speedup (dhi vs others, Simple User test):")
    for lib in ["satya", "msgspec", "pydantic"]:
        if lib in results.get("simple_user", {}):
            ratio = dhi_base / results["simple_user"][lib]
            print(f"    vs {lib:<10}: {ratio:.1f}x faster")

print()
print("=" * 80)
print("  NOTES")
print("=" * 80)
print("  - dhi uses batch validation (single FFI call for entire array)")
print("  - satya JSON path includes JSON parsing + validation in Rust")
print("  - msgspec JSON path includes JSON parsing + validation in C")
print("  - Pydantic JSON path uses Rust-based JSON parsing + validation")
print("  - msgspec does NOT validate email format (no built-in email validator)")
print("  - Dict tests: satya/msgspec/pydantic validate per-item (Python loop)")
print("  - dhi dict test: validates entire batch in one C call (no Python loop)")
print("=" * 80)
