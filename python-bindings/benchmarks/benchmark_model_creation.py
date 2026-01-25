"""
Benchmark: dhi vs Pydantic V2 - Model Creation Performance

Tests the specific operations where Pydantic v2's Rust core was faster:
1. Basic model creation (simple fields)
2. Nested model validation
3. model_construct (no validation)
4. model_dump_json
"""

import time
import sys
from typing import Annotated, Optional

# dhi
from dhi import BaseModel as DhiModel, Field as DhiField
from dhi import HAS_NATIVE_EXT
print(f"dhi native extension: {'ENABLED' if HAS_NATIVE_EXT else 'DISABLED (pure Python)'}")

# Pydantic V2
from pydantic import BaseModel as PydanticModel, Field as PydanticField
import pydantic

print(f"Pydantic version: {pydantic.__version__}")
print(f"Python: {sys.version.split()[0]}")
print()

# ============================================================================
# Model Definitions
# ============================================================================

# --- dhi Models ---
class DhiUser(DhiModel):
    name: Annotated[str, DhiField(min_length=1, max_length=100)]
    age: Annotated[int, DhiField(ge=0, le=120)]
    score: float = 0.0

class DhiAddress(DhiModel):
    street: str
    city: str
    zip_code: str

class DhiUserWithAddress(DhiModel):
    name: str
    age: int
    address: DhiAddress

# --- Pydantic Models ---
class PydanticUser(PydanticModel):
    name: str = PydanticField(min_length=1, max_length=100)
    age: int = PydanticField(ge=0, le=120)
    score: float = 0.0

class PydanticAddress(PydanticModel):
    street: str
    city: str
    zip_code: str

class PydanticUserWithAddress(PydanticModel):
    name: str
    age: int
    address: PydanticAddress


# ============================================================================
# Benchmark Functions
# ============================================================================

def bench(name: str, fn, iterations: int = 100_000, warmup: int = 1000) -> float:
    """Run benchmark and return operations per second."""
    # Warmup
    for _ in range(warmup):
        fn()

    # Timed run
    start = time.perf_counter()
    for _ in range(iterations):
        fn()
    elapsed = time.perf_counter() - start

    ops_per_sec = iterations / elapsed
    return ops_per_sec


def format_ops(ops: float) -> str:
    if ops >= 1_000_000:
        return f"{ops/1_000_000:.2f}M/sec"
    elif ops >= 1_000:
        return f"{ops/1_000:.1f}K/sec"
    else:
        return f"{ops:.0f}/sec"


# ============================================================================
# Tests
# ============================================================================

print("=" * 70)
print("  MODEL CREATION BENCHMARK: dhi vs Pydantic V2")
print("=" * 70)
print()

results = {}

# Test 1: Basic Model Creation
print("─" * 70)
print("TEST 1: Basic Model Creation (name, age, score)")
print("─" * 70)

dhi_basic = bench("dhi", lambda: DhiUser(name="Alice", age=25, score=95.5))
pyd_basic = bench("pydantic", lambda: PydanticUser(name="Alice", age=25, score=95.5))

results["basic"] = {"dhi": dhi_basic, "pydantic": pyd_basic}
ratio = dhi_basic / pyd_basic
print(f"  dhi:      {format_ops(dhi_basic):>14}")
print(f"  Pydantic: {format_ops(pyd_basic):>14}")
print(f"  Ratio:    {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# Test 2: Nested Model Creation
print("─" * 70)
print("TEST 2: Nested Model Creation (user with address)")
print("─" * 70)

# Pre-create address objects to isolate nested validation cost
dhi_addr = DhiAddress(street="123 Main St", city="Springfield", zip_code="12345")
pyd_addr = PydanticAddress(street="123 Main St", city="Springfield", zip_code="12345")

dhi_nested_prebuilt = bench("dhi (pre-built)", lambda: DhiUserWithAddress(name="Bob", age=30, address=dhi_addr))
pyd_nested_prebuilt = bench("pydantic (pre-built)", lambda: PydanticUserWithAddress(name="Bob", age=30, address=pyd_addr))

results["nested_prebuilt"] = {"dhi": dhi_nested_prebuilt, "pydantic": pyd_nested_prebuilt}
ratio = dhi_nested_prebuilt / pyd_nested_prebuilt
print(f"  dhi (pre-built addr):      {format_ops(dhi_nested_prebuilt):>14}")
print(f"  Pydantic (pre-built addr): {format_ops(pyd_nested_prebuilt):>14}")
print(f"  Ratio:                     {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# Nested with dict (includes dict-to-model coercion)
dhi_nested_dict = bench("dhi (dict)", lambda: DhiUserWithAddress(
    name="Bob", age=30, address={"street": "123 Main St", "city": "Springfield", "zip_code": "12345"}
))
pyd_nested_dict = bench("pydantic (dict)", lambda: PydanticUserWithAddress(
    name="Bob", age=30, address={"street": "123 Main St", "city": "Springfield", "zip_code": "12345"}
))

results["nested_dict"] = {"dhi": dhi_nested_dict, "pydantic": pyd_nested_dict}
ratio = dhi_nested_dict / pyd_nested_dict
print(f"  dhi (dict->model):      {format_ops(dhi_nested_dict):>14}")
print(f"  Pydantic (dict->model): {format_ops(pyd_nested_dict):>14}")
print(f"  Ratio:                  {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# Test 3: model_construct (no validation)
print("─" * 70)
print("TEST 3: model_construct (skip validation)")
print("─" * 70)

dhi_construct = bench("dhi", lambda: DhiUser.model_construct(name="Alice", age=25, score=95.5))
pyd_construct = bench("pydantic", lambda: PydanticUser.model_construct(name="Alice", age=25, score=95.5))

results["construct"] = {"dhi": dhi_construct, "pydantic": pyd_construct}
ratio = dhi_construct / pyd_construct
print(f"  dhi:      {format_ops(dhi_construct):>14}")
print(f"  Pydantic: {format_ops(pyd_construct):>14}")
print(f"  Ratio:    {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# Test 4: model_dump_json
print("─" * 70)
print("TEST 4: model_dump_json")
print("─" * 70)

dhi_user = DhiUser(name="Alice", age=25, score=95.5)
pyd_user = PydanticUser(name="Alice", age=25, score=95.5)

dhi_dump_json = bench("dhi", lambda: dhi_user.model_dump_json())
pyd_dump_json = bench("pydantic", lambda: pyd_user.model_dump_json())

results["dump_json"] = {"dhi": dhi_dump_json, "pydantic": pyd_dump_json}
ratio = dhi_dump_json / pyd_dump_json
print(f"  dhi:      {format_ops(dhi_dump_json):>14}")
print(f"  Pydantic: {format_ops(pyd_dump_json):>14}")
print(f"  Ratio:    {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# Test 5: model_dump (dict)
print("─" * 70)
print("TEST 5: model_dump (to dict)")
print("─" * 70)

dhi_dump = bench("dhi", lambda: dhi_user.model_dump())
pyd_dump = bench("pydantic", lambda: pyd_user.model_dump())

results["dump"] = {"dhi": dhi_dump, "pydantic": pyd_dump}
ratio = dhi_dump / pyd_dump
print(f"  dhi:      {format_ops(dhi_dump):>14}")
print(f"  Pydantic: {format_ops(pyd_dump):>14}")
print(f"  Ratio:    {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# Test 6: model_validate (from dict)
print("─" * 70)
print("TEST 6: model_validate (from dict)")
print("─" * 70)

data = {"name": "Alice", "age": 25, "score": 95.5}
dhi_validate = bench("dhi", lambda: DhiUser.model_validate(data))
pyd_validate = bench("pydantic", lambda: PydanticUser.model_validate(data))

results["validate"] = {"dhi": dhi_validate, "pydantic": pyd_validate}
ratio = dhi_validate / pyd_validate
print(f"  dhi:      {format_ops(dhi_validate):>14}")
print(f"  Pydantic: {format_ops(pyd_validate):>14}")
print(f"  Ratio:    {ratio:.2f}x {'(dhi faster)' if ratio > 1 else '(Pydantic faster)'}")
print()

# ============================================================================
# Summary
# ============================================================================

print("=" * 70)
print("  SUMMARY")
print("=" * 70)
print()
print(f"  {'Operation':<30} {'dhi':>12} {'Pydantic':>12} {'Ratio':>10}")
print(f"  {'─'*30} {'─'*12} {'─'*12} {'─'*10}")

for test, data in results.items():
    dhi_ops = data["dhi"]
    pyd_ops = data["pydantic"]
    ratio = dhi_ops / pyd_ops

    dhi_str = format_ops(dhi_ops).replace("/sec", "")
    pyd_str = format_ops(pyd_ops).replace("/sec", "")

    status = "✓" if ratio >= 1.0 else "✗"
    print(f"  {test:<30} {dhi_str:>12} {pyd_str:>12} {ratio:>8.2f}x {status}")

wins = sum(1 for data in results.values() if data["dhi"] >= data["pydantic"])
total = len(results)
print()
print(f"  dhi wins: {wins}/{total}")
print("=" * 70)
