"""
Fair Single-Item Validation Benchmark: dhi vs msgspec vs Pydantic V2

This benchmark tests the REALISTIC use case: validating ONE item at a time,
as would happen in a typical HTTP API endpoint (one request = one validation).

Key differences from batch benchmarks:
  - Single item validation (not batch)
  - ALL fields validated equally across all libraries
  - Measures per-validation overhead accurately
  - No batch amortization tricks

Author: Fair benchmark addressing feedback about batch-vs-single comparisons
"""

import time
import sys
from typing import Annotated

# ============================================================================
# Setup: Import all libraries
# ============================================================================

# dhi BaseModel
try:
    from dhi import BaseModel as DhiBaseModel, Field as DhiField, EmailStr as DhiEmailStr
    HAS_DHI = True
except Exception as e:
    print(f"dhi BaseModel not available: {e}")
    HAS_DHI = False

# dhi Struct (high-performance, msgspec-like)
try:
    from dhi import Struct as DhiStruct
    HAS_DHI_STRUCT = True
except Exception as e:
    print(f"dhi Struct not available: {e}")
    HAS_DHI_STRUCT = False

# Also try the native module for comparison
try:
    from dhi import _dhi_native
    HAS_DHI_NATIVE = True
except Exception as e:
    print(f"dhi native not available: {e}")
    HAS_DHI_NATIVE = False

# msgspec
try:
    import msgspec
    from msgspec import Struct, Meta
    HAS_MSGSPEC = True
except Exception:
    HAS_MSGSPEC = False
    print("msgspec not installed")

# Pydantic V2
try:
    from pydantic import BaseModel as PydanticBaseModel, Field as PydanticField, EmailStr
    import pydantic
    HAS_PYDANTIC = True
except Exception:
    HAS_PYDANTIC = False
    print("pydantic not installed")


# ============================================================================
# Schema Definitions - IDENTICAL constraints across all libraries
# ============================================================================

# Test 1: Simple User (3 fields)
if HAS_DHI:
    class DhiSimpleUser(DhiBaseModel):
        name: Annotated[str, DhiField(min_length=2, max_length=100)]
        email: DhiEmailStr
        age: Annotated[int, DhiField(ge=18, le=120)]

if HAS_MSGSPEC:
    class MsgspecSimpleUser(Struct):
        name: Annotated[str, Meta(min_length=2, max_length=100)]
        email: str  # msgspec has no built-in email validator
        age: Annotated[int, Meta(ge=18, le=120)]

if HAS_PYDANTIC:
    class PydanticSimpleUser(PydanticBaseModel):
        name: str = PydanticField(min_length=2, max_length=100)
        email: EmailStr
        age: int = PydanticField(ge=18, le=120)

# dhi Struct (high-performance, msgspec-like)
if HAS_DHI_STRUCT:
    class DhiStructSimpleUser(DhiStruct):
        name: Annotated[str, DhiField(min_length=2, max_length=100)]
        email: str  # Struct doesn't have EmailStr yet, matching msgspec
        age: Annotated[int, DhiField(ge=18, le=120)]


# Test 2: Complex User (5 fields with all types)
if HAS_DHI:
    class DhiComplexUser(DhiBaseModel):
        name: Annotated[str, DhiField(min_length=2, max_length=100)]
        email: DhiEmailStr
        age: Annotated[int, DhiField(ge=18, le=120)]
        score: Annotated[float, DhiField(ge=0.0, le=100.0)]
        active: bool

if HAS_MSGSPEC:
    class MsgspecComplexUser(Struct):
        name: Annotated[str, Meta(min_length=2, max_length=100)]
        email: str
        age: Annotated[int, Meta(ge=18, le=120)]
        score: Annotated[float, Meta(ge=0.0, le=100.0)]
        active: bool

if HAS_PYDANTIC:
    class PydanticComplexUser(PydanticBaseModel):
        name: str = PydanticField(min_length=2, max_length=100)
        email: EmailStr
        age: int = PydanticField(ge=18, le=120)
        score: float = PydanticField(ge=0.0, le=100.0)
        active: bool

if HAS_DHI_STRUCT:
    class DhiStructComplexUser(DhiStruct):
        name: Annotated[str, DhiField(min_length=2, max_length=100)]
        email: str
        age: Annotated[int, DhiField(ge=18, le=120)]
        score: Annotated[float, DhiField(ge=0.0, le=100.0)]
        active: bool


# ============================================================================
# Test Data
# ============================================================================

SIMPLE_USER = {"name": "John Doe", "email": "john@example.com", "age": 30}
COMPLEX_USER = {"name": "John Doe", "email": "john@example.com", "age": 30, "score": 85.5, "active": True}
INVALID_USER = {"name": "A", "email": "not-an-email", "age": 200}


# ============================================================================
# Benchmark Functions
# ============================================================================

def bench_single_item(name: str, fn, iterations: int = 100_000, warmup: int = 1000) -> tuple:
    """
    Benchmark single-item validation.
    Returns (total_time, per_item_ns, throughput)
    """
    # Warmup
    for _ in range(warmup):
        fn()

    # Benchmark
    start = time.perf_counter()
    for _ in range(iterations):
        fn()
    elapsed = time.perf_counter() - start

    per_item_ns = (elapsed / iterations) * 1_000_000_000
    throughput = iterations / elapsed

    return elapsed, per_item_ns, throughput


def format_result(per_item_ns: float, throughput: float) -> str:
    if throughput >= 1_000_000:
        return f"{per_item_ns:>8.0f} ns  ({throughput/1_000_000:.2f}M/sec)"
    elif throughput >= 1_000:
        return f"{per_item_ns:>8.0f} ns  ({throughput/1_000:.0f}K/sec)"
    else:
        return f"{per_item_ns:>8.0f} ns  ({throughput:.0f}/sec)"


# ============================================================================
# Run Benchmarks
# ============================================================================

ITERATIONS = 100_000

print("=" * 80)
print("  FAIR SINGLE-ITEM VALIDATION BENCHMARK")
print("  Testing realistic per-request validation (one item at a time)")
print("=" * 80)
print(f"  Iterations per test: {ITERATIONS:,}")
print(f"  Python: {sys.version.split()[0]}")
if HAS_MSGSPEC: print(f"  msgspec: {msgspec.__version__}")
if HAS_PYDANTIC: print(f"  pydantic: {pydantic.__version__}")
print("=" * 80)
print()

results = {}

# ============================================================================
# TEST 1: Simple User (3 fields: name, email, age)
# ============================================================================
print("─" * 80)
print("TEST 1: Simple User - Single Item Validation")
print("  Fields: name (str[2,100]), email, age (int[18,120])")
print("─" * 80)

if HAS_DHI:
    _, ns, tp = bench_single_item("dhi", lambda: DhiSimpleUser(**SIMPLE_USER), ITERATIONS)
    results.setdefault("simple", {})["dhi"] = (ns, tp)
    print(f"  dhi (BaseModel):     {format_result(ns, tp)}")

if HAS_DHI_STRUCT:
    _, ns, tp = bench_single_item("dhi_struct", lambda: DhiStructSimpleUser(**SIMPLE_USER), ITERATIONS)
    results.setdefault("simple", {})["dhi_struct"] = (ns, tp)
    print(f"  dhi (Struct):        {format_result(ns, tp)}")

if HAS_MSGSPEC:
    _, ns, tp = bench_single_item("msgspec", lambda: msgspec.convert(SIMPLE_USER, MsgspecSimpleUser), ITERATIONS)
    results.setdefault("simple", {})["msgspec"] = (ns, tp)
    print(f"  msgspec (convert):   {format_result(ns, tp)}")

if HAS_PYDANTIC:
    _, ns, tp = bench_single_item("pydantic", lambda: PydanticSimpleUser.model_validate(SIMPLE_USER), ITERATIONS)
    results.setdefault("simple", {})["pydantic"] = (ns, tp)
    print(f"  Pydantic V2:         {format_result(ns, tp)}")

print()

# ============================================================================
# TEST 2: Complex User (5 fields: name, email, age, score, active)
# ============================================================================
print("─" * 80)
print("TEST 2: Complex User - Single Item Validation")
print("  Fields: name, email, age, score (float[0,100]), active (bool)")
print("─" * 80)

if HAS_DHI:
    _, ns, tp = bench_single_item("dhi", lambda: DhiComplexUser(**COMPLEX_USER), ITERATIONS)
    results.setdefault("complex", {})["dhi"] = (ns, tp)
    print(f"  dhi (BaseModel):     {format_result(ns, tp)}")

if HAS_DHI_STRUCT:
    _, ns, tp = bench_single_item("dhi_struct", lambda: DhiStructComplexUser(**COMPLEX_USER), ITERATIONS)
    results.setdefault("complex", {})["dhi_struct"] = (ns, tp)
    print(f"  dhi (Struct):        {format_result(ns, tp)}")

if HAS_MSGSPEC:
    _, ns, tp = bench_single_item("msgspec", lambda: msgspec.convert(COMPLEX_USER, MsgspecComplexUser), ITERATIONS)
    results.setdefault("complex", {})["msgspec"] = (ns, tp)
    print(f"  msgspec (convert):   {format_result(ns, tp)}")

if HAS_PYDANTIC:
    _, ns, tp = bench_single_item("pydantic", lambda: PydanticComplexUser.model_validate(COMPLEX_USER), ITERATIONS)
    results.setdefault("complex", {})["pydantic"] = (ns, tp)
    print(f"  Pydantic V2:         {format_result(ns, tp)}")

print()

# ============================================================================
# TEST 3: Invalid Data (error path)
# ============================================================================
print("─" * 80)
print("TEST 3: Invalid Data - Error Path Performance")
print("  All fields invalid: name too short, bad email, age out of range")
print("─" * 80)

if HAS_DHI:
    def dhi_invalid():
        try:
            DhiSimpleUser(**INVALID_USER)
        except Exception:
            pass
    _, ns, tp = bench_single_item("dhi", dhi_invalid, ITERATIONS)
    results.setdefault("invalid", {})["dhi"] = (ns, tp)
    print(f"  dhi (BaseModel):     {format_result(ns, tp)}")

if HAS_MSGSPEC:
    def msgspec_invalid():
        try:
            msgspec.convert(INVALID_USER, MsgspecSimpleUser)
        except Exception:
            pass
    _, ns, tp = bench_single_item("msgspec", msgspec_invalid, ITERATIONS)
    results.setdefault("invalid", {})["msgspec"] = (ns, tp)
    print(f"  msgspec (convert):   {format_result(ns, tp)}")

if HAS_PYDANTIC:
    def pydantic_invalid():
        try:
            PydanticSimpleUser.model_validate(INVALID_USER)
        except Exception:
            pass
    _, ns, tp = bench_single_item("pydantic", pydantic_invalid, ITERATIONS)
    results.setdefault("invalid", {})["pydantic"] = (ns, tp)
    print(f"  Pydantic V2:         {format_result(ns, tp)}")

print()

# ============================================================================
# TEST 4: JSON String -> Validated Object (realistic API scenario)
# ============================================================================
print("─" * 80)
print("TEST 4: JSON String -> Validated Object (API endpoint scenario)")
print("  Parse JSON + validate in one call")
print("─" * 80)

import json
SIMPLE_JSON = json.dumps(SIMPLE_USER)
SIMPLE_JSON_BYTES = SIMPLE_JSON.encode()

if HAS_DHI:
    def dhi_json():
        data = json.loads(SIMPLE_JSON)
        return DhiSimpleUser(**data)
    _, ns, tp = bench_single_item("dhi", dhi_json, ITERATIONS)
    results.setdefault("json", {})["dhi"] = (ns, tp)
    print(f"  dhi (json+validate): {format_result(ns, tp)}")

if HAS_MSGSPEC:
    def msgspec_json():
        return msgspec.json.decode(SIMPLE_JSON_BYTES, type=MsgspecSimpleUser)
    _, ns, tp = bench_single_item("msgspec", msgspec_json, ITERATIONS)
    results.setdefault("json", {})["msgspec"] = (ns, tp)
    print(f"  msgspec (integrated):{format_result(ns, tp)}")

if HAS_PYDANTIC:
    def pydantic_json():
        return PydanticSimpleUser.model_validate_json(SIMPLE_JSON_BYTES)
    _, ns, tp = bench_single_item("pydantic", pydantic_json, ITERATIONS)
    results.setdefault("json", {})["pydantic"] = (ns, tp)
    print(f"  Pydantic V2 (json):  {format_result(ns, tp)}")

print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 80)
print("  SUMMARY: Per-Item Latency (lower is better)")
print("=" * 80)
print()
print(f"  {'Test':<20} {'dhi':>10} {'dhi_struct':>12} {'msgspec':>10} {'pydantic':>10}  {'Fastest':<12}")
print(f"  {'─'*20} {'─'*10} {'─'*12} {'─'*10} {'─'*10}  {'─'*12}")

test_names = {
    "simple": "Simple User",
    "complex": "Complex User",
    "invalid": "Invalid Data",
    "json": "JSON + Validate",
}

for test_key, test_name in test_names.items():
    if test_key not in results:
        continue
    row = results[test_key]

    # Find fastest (lowest ns)
    fastest = min((k for k in row if k in ["dhi", "dhi_struct", "msgspec", "pydantic"]),
                  key=lambda k: row[k][0], default=None)

    cells = []
    for lib in ["dhi", "dhi_struct", "msgspec", "pydantic"]:
        if lib in row:
            ns = row[lib][0]
            cells.append(f"{ns:.0f}ns")
        else:
            cells.append("—")

    print(f"  {test_name:<20} {cells[0]:>10} {cells[1]:>12} {cells[2]:>10} {cells[3]:>10}  {fastest.upper():<12}")

print()

# Speedup comparisons
print("─" * 80)
print("  SPEEDUP COMPARISONS (for single-item validation)")
print("─" * 80)

if "simple" in results:
    row = results["simple"]

    # dhi Struct vs msgspec (the key comparison!)
    if "dhi_struct" in row and "msgspec" in row:
        ratio = row["dhi_struct"][0] / row["msgspec"][0]
        if ratio > 1:
            print(f"  msgspec is {ratio:.1f}x faster than dhi Struct (Simple User)")
        else:
            print(f"  dhi Struct is {1/ratio:.1f}x faster than msgspec (Simple User)")

    # dhi Struct vs dhi BaseModel (improvement from optimization)
    if "dhi_struct" in row and "dhi" in row:
        ratio = row["dhi"][0] / row["dhi_struct"][0]
        print(f"  dhi Struct is {ratio:.1f}x faster than dhi BaseModel (Simple User)")

    if "msgspec" in row and "dhi" in row:
        ratio = row["dhi"][0] / row["msgspec"][0]
        if ratio > 1:
            print(f"  msgspec is {ratio:.1f}x faster than dhi BaseModel (Simple User)")
        else:
            print(f"  dhi BaseModel is {1/ratio:.1f}x faster than msgspec (Simple User)")

    if "pydantic" in row and "dhi_struct" in row:
        ratio = row["pydantic"][0] / row["dhi_struct"][0]
        if ratio > 1:
            print(f"  dhi Struct is {ratio:.1f}x faster than Pydantic (Simple User)")
        else:
            print(f"  Pydantic is {1/ratio:.1f}x faster than dhi Struct (Simple User)")

    if "msgspec" in row and "pydantic" in row:
        ratio = row["pydantic"][0] / row["msgspec"][0]
        if ratio > 1:
            print(f"  msgspec is {ratio:.1f}x faster than Pydantic (Simple User)")
        else:
            print(f"  Pydantic is {1/ratio:.1f}x faster than msgspec (Simple User)")

print()
print("=" * 80)
print("  NOTES")
print("=" * 80)
print("  - This benchmark tests SINGLE-ITEM validation (realistic API scenario)")
print("  - All libraries validate the SAME fields with SAME constraints")
print("  - msgspec does NOT have built-in email validation (only type check)")
print("  - Lower latency (ns) = better for per-request validation")
print("  - Batch validation results may differ significantly")
print("=" * 80)
