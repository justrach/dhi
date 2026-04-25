# dhi Envoy Proxy WASM Middleware

Validate HTTP request bodies at the Envoy proxy level using dhi's ultra-fast SIMD validators. Bad requests are rejected before reaching your API server.

## Quick Start

```bash
cd envoy-example

# Build the WASM filter
zig build envoy -Doptimize=ReleaseFast
cp zig-out/bin/dhi-envoy.wasm envoy-example/

# Start Envoy + httpbin
docker compose up --build

# Test in another terminal
bash envoy-example/test.sh
```

## Configuration

The filter is configured via Envoy's WASM plugin configuration string:

```
field_name:validator_type:min:max,field2:validator_type:...
```

### Supported Validator Types

| Type | Description | Example |
|------|-------------|---------|
| `email` | Validates email format | `user@example.com` |
| `uuid` | Validates UUID v4 format | `550e8400-e29b-41d4-a716-446655440000` |
| `ipv4` | Validates IPv4 address | `192.168.1.1` |
| `url` | Validates HTTP/HTTPS URL | `https://example.com` |
| `str_len` | String length range | `name:str_len:1:100` |
| `int` | Integer range | `age:int:0:150` |

### Example Config

```yaml
configuration:
  "@type": type.googleapis.com/google.protobuf.StringValue
  value: "email:email,uuid:uuid,name:str_len:1:100,age:int:0:150"
```

This validates:
- `email` must be a valid email
- `uuid` must be a valid UUID v4
- `name` must be 1-100 characters
- `age` must be 0-150

## Architecture

```
Client → Envoy → [dhi WASM Filter] → API Server
                    ↓
              Valid? → Yes: forward
              Invalid? → 400 Bad Request (rejected at proxy)
```

## Build

```bash
# Production (faster validation, larger binary)
zig build envoy -Doptimize=ReleaseFast

# Minimal size (ReleaseSmall)
# Note: validators may be dead-stripped; use ReleaseFast for full coverage
zig build envoy -Doptimize=ReleaseSmall
```

## WASM Properties

- **5.2 KB** (ReleaseSmall) — minimal footprint
- **663 KB** (ReleaseFast) — full validator coverage
- **Zero-copy** field extraction from JSON body
- **SIMD-accelerated** string/number validation
- No runtime allocations per request
- Works with any Envoy version that supports proxy-wasm (v8 runtime)
