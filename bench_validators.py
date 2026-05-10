"""Validator microbenchmark: dhi C-extension hot paths."""
import time
import sys
sys.path.insert(0, 'python-bindings')
from dhi import _dhi_native

def bench_batch(name, users, specs, iters=200):
    for _ in range(3):
        _dhi_native.validate_batch_direct(users, specs)
    t = time.perf_counter()
    for _ in range(iters):
        _dhi_native.validate_batch_direct(users, specs)
    dt = time.perf_counter() - t
    rows = len(users) * iters
    print(f"  {name:35s} {rows/dt/1e6:8.2f} M rows/s  ({dt/iters*1e3:.2f} ms/batch)")

users = [
    {
        "name": f"User{i}",
        "email": f"user{i}@example.com",
        "age": 25 + (i % 50),
        "website": f"https://user{i}.com",
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "ipv4": "192.168.1.1",
    }
    for i in range(10_000)
]

print(f"Dataset: {len(users):,} dicts\n")

print("Batch validate (10k items):")
bench_batch("name+age",
            users,
            {'name': ('string', 1, 100), 'age': ('int_positive',)})
bench_batch("name+email+age",
            users,
            {'name': ('string', 1, 100), 'email': ('email',), 'age': ('int_positive',)})
bench_batch("name+email+age+url",
            users,
            {'name': ('string', 1, 100), 'email': ('email',),
             'age': ('int_positive',), 'website': ('url',)})
bench_batch("name+email+age+url+uuid",
            users,
            {'name': ('string', 1, 100), 'email': ('email',),
             'age': ('int_positive',), 'website': ('url',),
             'uuid': ('uuid',)})
bench_batch("all 6 (+ ipv4)",
            users,
            {'name': ('string', 1, 100), 'email': ('email',),
             'age': ('int_positive',), 'website': ('url',),
             'uuid': ('uuid',), 'ipv4': ('ipv4',)})
bench_batch("uuid only",
            users,
            {'uuid': ('uuid',)})
bench_batch("ipv4 only",
            users,
            {'ipv4': ('ipv4',)})

ints = [25 + (i % 50) for i in range(1_000_000)]
def bench_int_range(name, values, min_val, max_val, iters=20):
    for _ in range(3):
        _dhi_native.validate_int_range_batch_direct(values, min_val, max_val)
    t = time.perf_counter()
    for _ in range(iters):
        _dhi_native.validate_int_range_batch_direct(values, min_val, max_val)
    dt = time.perf_counter() - t
    rows = len(values) * iters
    print(f"  {name:35s} {rows/dt/1e6:8.2f} M ints/s  ({dt/iters*1e3:.2f} ms/batch)")

print("\nDirect list batch:")
bench_int_range("int range list", ints, 1, 100)

print("\nSingle-call (Python-call dominated):")
def bench(name, fn, n=500_000):
    for _ in range(1000):
        fn()
    t = time.perf_counter()
    for _ in range(n):
        fn()
    dt = time.perf_counter() - t
    print(f"  {name:35s} {n/dt/1e6:8.2f} M ops/s  ({dt*1e9/n:.1f} ns/op)")

bench("validate_email valid", lambda: _dhi_native.validate_email("alice@example.com"))
bench("validate_email invalid", lambda: _dhi_native.validate_email("notanemail"))
bench("validate_int", lambda: _dhi_native.validate_int(42, 0, 100))
bench("validate_string_length", lambda: _dhi_native.validate_string_length("hello world", 1, 100))
