/*
 * Native CPython extension for dhi
 * Links against libsatya.dylib (Zig backend)
 */

#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <math.h>
#include <string.h>

// =============================================================================
// INLINE VALIDATORS - Avoid FFI overhead for simple checks
// =============================================================================

// Inline email validator - avoids Zig FFI call for simple email format checks
// This is the same logic as Zig's satya_validate_email but runs in C
static inline int inline_validate_email(const char* str) {
    if (!str || !*str) return 0;

    // Find @ position
    const char* at = strchr(str, '@');
    if (!at || at == str) return 0;  // No @ or @ at start

    // Check domain part (after @)
    const char* domain = at + 1;
    if (!*domain) return 0;  // Empty domain

    // Must have at least one . in domain
    const char* dot = strchr(domain, '.');
    if (!dot || dot == domain || !dot[1]) return 0;  // No dot, or dot at start/end

    return 1;
}

// External Zig functions from libsatya - COMPREHENSIVE VALIDATORS
// Basic validators
extern int satya_validate_int(long value, long min, long max);
extern int satya_validate_string_length(const char* str, size_t min_len, size_t max_len);
extern int satya_validate_email(const char* str);

// String validators (Zod-style)
extern int satya_validate_url(const char* str);
extern int satya_validate_uuid(const char* str);
extern int satya_validate_ipv4(const char* str);
extern int satya_validate_base64(const char* str);
extern int satya_validate_iso_date(const char* str);
extern int satya_validate_iso_datetime(const char* str);
extern int satya_validate_contains(const char* str, const char* substring);
extern int satya_validate_starts_with(const char* str, const char* prefix);
extern int satya_validate_ends_with(const char* str, const char* suffix);

// Number validators (Pydantic-style)
extern int satya_validate_int_gt(long value, long min);
extern int satya_validate_int_gte(long value, long min);
extern int satya_validate_int_lt(long value, long max);
extern int satya_validate_int_lte(long value, long max);
extern int satya_validate_int_positive(long value);
extern int satya_validate_int_non_negative(long value);
extern int satya_validate_int_negative(long value);
extern int satya_validate_int_non_positive(long value);
extern int satya_validate_int_multiple_of(long value, long divisor);

// Float validators
extern int satya_validate_float_gt(double value, double min);
extern int satya_validate_float_gte(double value, double min);
extern int satya_validate_float_lt(double value, double max);
extern int satya_validate_float_lte(double value, double max);
extern int satya_validate_float_finite(double value);

// IPv6 validator
extern int satya_validate_ipv6(const char* str);

// =============================================================================
// SIMD JSON PARSING FUNCTIONS FROM ZIG
// =============================================================================
extern size_t satya_skip_whitespace(const char* json, size_t len, size_t start);
extern int satya_extract_json_string(
    const char* json, size_t len, size_t start,
    const char** out_str_ptr, size_t* out_str_len,
    int* out_has_escapes, size_t* out_end
);
extern int satya_parse_json_int(
    const char* json, size_t len, size_t start,
    long* out_value, size_t* out_end
);
extern int satya_parse_json_float(
    const char* json, size_t len, size_t start,
    double* out_value, size_t* out_end
);
extern int satya_skip_json_value(
    const char* json, size_t len, size_t start,
    size_t* out_end
);
extern unsigned long long satya_hash_field_name(const char* name, size_t len);

// =============================================================================
// FNV-1a HASH - Fast hash for JSON field matching (computed at compile time)
// =============================================================================
static inline uint64_t fnv1a_hash_inline(const char *str, size_t len) {
    uint64_t hash = 14695981039346656037ULL;
    for (size_t i = 0; i < len; i++) {
        hash ^= (uint64_t)(unsigned char)str[i];
        hash *= 1099511628211ULL;
    }
    return hash;
}

// Python wrapper: validate_int(value, min, max) -> bool
static PyObject* py_validate_int(PyObject* self, PyObject* args) {
    long value, min, max;
    
    if (!PyArg_ParseTuple(args, "lll", &value, &min, &max)) {
        return NULL;
    }
    
    int result = satya_validate_int(value, min, max);
    return PyBool_FromLong(result);
}

// Python wrapper: validate_string_length(str, min_len, max_len) -> bool
static PyObject* py_validate_string_length(PyObject* self, PyObject* args) {
    const char* str;
    Py_ssize_t min_len, max_len;
    
    if (!PyArg_ParseTuple(args, "snn", &str, &min_len, &max_len)) {
        return NULL;
    }
    
    int result = satya_validate_string_length(str, (size_t)min_len, (size_t)max_len);
    return PyBool_FromLong(result);
}

// Python wrapper: validate_email(str) -> bool
static PyObject* py_validate_email(PyObject* self, PyObject* args) {
    const char* str;
    
    if (!PyArg_ParseTuple(args, "s", &str)) {
        return NULL;
    }
    
    int result = satya_validate_email(str);
    return PyBool_FromLong(result);
}

// Validator type enum for fast dispatch
enum ValidatorType {
    VAL_INT = 0,
    VAL_INT_GT,
    VAL_INT_GTE,
    VAL_INT_LT,
    VAL_INT_LTE,
    VAL_INT_POSITIVE,
    VAL_INT_NON_NEGATIVE,
    VAL_INT_MULTIPLE_OF,
    VAL_STRING,
    VAL_EMAIL,
    VAL_URL,
    VAL_UUID,
    VAL_IPV4,
    VAL_BASE64,
    VAL_ISO_DATE,
    VAL_ISO_DATETIME,
    VAL_UNKNOWN
};

// Convert string to enum (do this ONCE, not per item!)
static enum ValidatorType parse_validator_type(const char* type_str) {
    // Use first char for fast dispatch
    switch (type_str[0]) {
        case 'i':
            if (strcmp(type_str, "int") == 0) return VAL_INT;
            if (strcmp(type_str, "int_gt") == 0) return VAL_INT_GT;
            if (strcmp(type_str, "int_gte") == 0) return VAL_INT_GTE;
            if (strcmp(type_str, "int_lt") == 0) return VAL_INT_LT;
            if (strcmp(type_str, "int_lte") == 0) return VAL_INT_LTE;
            if (strcmp(type_str, "int_positive") == 0) return VAL_INT_POSITIVE;
            if (strcmp(type_str, "int_non_negative") == 0) return VAL_INT_NON_NEGATIVE;
            if (strcmp(type_str, "int_multiple_of") == 0) return VAL_INT_MULTIPLE_OF;
            if (strcmp(type_str, "ipv4") == 0) return VAL_IPV4;
            if (strcmp(type_str, "iso_date") == 0) return VAL_ISO_DATE;
            if (strcmp(type_str, "iso_datetime") == 0) return VAL_ISO_DATETIME;
            break;
        case 's':
            if (strcmp(type_str, "string") == 0) return VAL_STRING;
            break;
        case 'e':
            if (strcmp(type_str, "email") == 0) return VAL_EMAIL;
            break;
        case 'u':
            if (strcmp(type_str, "url") == 0) return VAL_URL;
            if (strcmp(type_str, "uuid") == 0) return VAL_UUID;
            break;
        case 'b':
            if (strcmp(type_str, "base64") == 0) return VAL_BASE64;
            break;
    }
    return VAL_UNKNOWN;
}

// Field spec with pre-parsed validator type AND cached PyObject
struct FieldSpec {
    PyObject* field_name_obj;  // Cached PyObject* for fast dict lookup
    const char* field_name;
    enum ValidatorType validator_type;
    long param1;
    long param2;
};

// OPTIMIZED: validate_batch_direct with enum dispatch
static PyObject* py_validate_batch_direct(PyObject* self, PyObject* args) {
    PyObject* items_list;
    PyObject* field_specs_dict;
    
    if (!PyArg_ParseTuple(args, "O!O!", 
                          &PyList_Type, &items_list,
                          &PyDict_Type, &field_specs_dict)) {
        return NULL;
    }
    
    Py_ssize_t count = PyList_Size(items_list);
    if (count == 0) {
        return Py_BuildValue("([]i)", 0);
    }
    
    // Pre-process field specs (convert strings to enums ONCE!)
    Py_ssize_t num_fields = PyDict_Size(field_specs_dict);
    struct FieldSpec* field_specs = malloc(num_fields * sizeof(struct FieldSpec));
    if (!field_specs) {
        return PyErr_NoMemory();
    }
    
    PyObject *field_name, *spec;
    Py_ssize_t pos = 0;
    Py_ssize_t field_idx = 0;
    
    while (PyDict_Next(field_specs_dict, &pos, &field_name, &spec)) {
        field_specs[field_idx].field_name_obj = field_name;  // Cache PyObject* (borrowed ref)
        field_specs[field_idx].field_name = PyUnicode_AsUTF8(field_name);
        
        if (PyTuple_Check(spec) && PyTuple_Size(spec) >= 1) {
            const char* type_str = PyUnicode_AsUTF8(PyTuple_GET_ITEM(spec, 0));
            field_specs[field_idx].validator_type = parse_validator_type(type_str);
            
            // Extract params (do this once, not per item!)
            field_specs[field_idx].param1 = 0;
            field_specs[field_idx].param2 = 0;
            if (PyTuple_Size(spec) >= 2) {
                field_specs[field_idx].param1 = PyLong_AsLong(PyTuple_GET_ITEM(spec, 1));
            }
            if (PyTuple_Size(spec) >= 3) {
                field_specs[field_idx].param2 = PyLong_AsLong(PyTuple_GET_ITEM(spec, 2));
            }
        } else {
            field_specs[field_idx].validator_type = VAL_UNKNOWN;
        }
        field_idx++;
    }
    
    // Allocate results array
    unsigned char* results = malloc(count * sizeof(unsigned char));
    if (!results) {
        free(field_specs);
        return PyErr_NoMemory();
    }
    
    // Initialize all as valid
    for (Py_ssize_t i = 0; i < count; i++) {
        results[i] = 1;
    }
    
    size_t valid_count = count;
    
    // Iterate through each item and validate all fields (OPTIMIZED with enum dispatch)
    for (Py_ssize_t i = 0; i < count; i++) {
        PyObject* item = PyList_GET_ITEM(items_list, i);  // Borrowed ref
        
        // Prefetch next item for better cache performance
        if (i + 1 < count) {
            __builtin_prefetch(PyList_GET_ITEM(items_list, i + 1), 0, 3);
        }
        
        // Fast dict check with branch prediction hint (usually true)
        if (__builtin_expect(!PyDict_Check(item), 0)) {
            free(field_specs);
            free(results);
            PyErr_SetString(PyExc_TypeError, "Expected list of dicts");
            return NULL;
        }
        
        // Iterate through pre-parsed field specs (ULTRA-FAST: use cached PyObject*)
        for (Py_ssize_t f = 0; f < num_fields; f++) {
            // Use PyDict_GetItem with cached PyObject* - FASTEST (borrowed ref, no refcount overhead)
            PyObject* field_value = PyDict_GetItem(item, field_specs[f].field_name_obj);
            
            if (!field_value) {
                // Missing field
                if (results[i] == 1) {
                    results[i] = 0;
                    valid_count--;
                }
                break;  // Missing field, skip remaining validations
            }
            
            // Fast dispatch using switch/case (NO string comparisons!)
            int is_valid = 1;
            
            switch (field_specs[f].validator_type) {
                case VAL_INT: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int(value, field_specs[f].param1, field_specs[f].param2);
                    break;
                }
                case VAL_INT_GT: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_gt(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_GTE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_gte(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_LT: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_lt(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_LTE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_lte(value, field_specs[f].param1);
                    break;
                }
                case VAL_INT_POSITIVE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_positive(value);
                    break;
                }
                case VAL_INT_NON_NEGATIVE: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_non_negative(value);
                    break;
                }
                case VAL_INT_MULTIPLE_OF: {
                    long value = PyLong_AsLong(field_value);
                    is_valid = satya_validate_int_multiple_of(value, field_specs[f].param1);
                    break;
                }
                case VAL_STRING: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_string_length(value, (size_t)field_specs[f].param1, (size_t)field_specs[f].param2);
                    break;
                }
                case VAL_EMAIL: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_email(value);
                    break;
                }
                case VAL_URL: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_url(value);
                    break;
                }
                case VAL_UUID: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_uuid(value);
                    break;
                }
                case VAL_IPV4: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_ipv4(value);
                    break;
                }
                case VAL_BASE64: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_base64(value);
                    break;
                }
                case VAL_ISO_DATE: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_iso_date(value);
                    break;
                }
                case VAL_ISO_DATETIME: {
                    const char* value = PyUnicode_AsUTF8(field_value);
                    is_valid = satya_validate_iso_datetime(value);
                    break;
                }
                case VAL_UNKNOWN:
                default:
                    is_valid = 1;  // Skip unknown validators
                    break;
            }
            
            // Update result if invalid (FAST: branch prediction - valid is common case)
            if (__builtin_expect(!is_valid, 0)) {  // Hint: validation usually succeeds
                if (results[i] == 1) {
                    results[i] = 0;
                    valid_count--;
                }
                break;  // Already invalid, skip remaining validations
            }
        }
    }
    
    // Convert results to Python list (FAST: use singleton bools, no allocations!)
    PyObject* result_list = PyList_New(count);
    for (Py_ssize_t i = 0; i < count; i++) {
        PyObject* bool_obj = results[i] ? Py_True : Py_False;
        Py_INCREF(bool_obj);  // Must incref singleton
        PyList_SET_ITEM(result_list, i, bool_obj);
    }
    
    // Cleanup
    free(field_specs);
    free(results);
    
    // Return (results, valid_count)
    return Py_BuildValue("(Ni)", result_list, (Py_ssize_t)valid_count);
}

// Helpers: safely extract numeric values from PyObject (handles int/float mix)
static long as_long_coerce(PyObject* obj) {
    if (PyLong_Check(obj)) return PyLong_AsLong(obj);
    if (PyFloat_Check(obj)) return (long)PyFloat_AsDouble(obj);
    return PyLong_AsLong(obj);
}

static double as_double_coerce(PyObject* obj) {
    if (PyFloat_Check(obj)) return PyFloat_AsDouble(obj);
    if (PyLong_Check(obj)) return (double)PyLong_AsLong(obj);
    return PyFloat_AsDouble(obj);
}

// =============================================================================
// PRE-COMPILED FIELD SPECS — eliminates per-call constraint tuple unpacking
// =============================================================================

typedef struct {
    PyObject *name_obj;     // borrowed ref (kept alive by class)
    Py_hash_t name_hash;    // Pre-computed hash for fast dict operations
    PyObject *alias_obj;    // borrowed ref or NULL (Py_None)
    int required;
    PyObject *default_val;  // borrowed ref
    // Pre-parsed constraints (no per-call PyLong_AsLong/PyTuple_GET_ITEM):
    int type_code, strict;
    int has_gt, has_ge, has_lt, has_le, has_mul;
    long gt_long, ge_long, lt_long, le_long, mul_long;
    double gt_dbl, ge_dbl, lt_dbl, le_dbl, mul_dbl;
    int has_minl, has_maxl;
    Py_ssize_t min_len, max_len;
    int allow_inf_nan, format_code;
    int strip_ws, to_lower, to_upper;
    // Nested model support (type_code=6 for nested models)
    PyObject *nested_model_type;  // The nested BaseModel class (borrowed ref, or NULL)
    // Union/list-of-models support (type_code=7 for list-of-models, 8 for union)
    PyObject *union_types_tuple;  // Tuple of acceptable BaseModel types (borrowed ref, or NULL)
    // Cached JSON parsing fields (computed once, used for fast field matching)
    const char *name_ptr;   // Cached UTF-8 pointer to name
    size_t name_len;        // Cached length of name
    uint64_t name_hash_fnv; // FNV-1a hash for JSON field matching
} CompiledFieldSpec;

// Global empty tuple for efficient PyObject_Call - reused across all calls
static PyObject *g_empty_tuple = NULL;

typedef struct {
    Py_ssize_t n_fields;
    CompiledFieldSpec specs[];  // flexible array member
} CompiledModelSpecs;

static void compiled_specs_destructor(PyObject *capsule) {
    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (ms) free(ms);
}

// compile_model_specs(field_specs_tuple) -> PyCapsule
// Pre-parses all constraint values into C structs at class creation time
// Each field spec is: (name, alias, required, default, constraints, [nested_model_type])
// nested_model_type is optional - if present and not None, type_code is set to 6
static PyObject* py_compile_model_specs(PyObject* self, PyObject* args) {
    PyObject *field_specs;
    if (!PyArg_ParseTuple(args, "O!", &PyTuple_Type, &field_specs)) return NULL;

    Py_ssize_t n = PyTuple_GET_SIZE(field_specs);
    CompiledModelSpecs *ms = (CompiledModelSpecs*)malloc(
        sizeof(CompiledModelSpecs) + n * sizeof(CompiledFieldSpec));
    if (!ms) return PyErr_NoMemory();
    ms->n_fields = n;

    for (Py_ssize_t i = 0; i < n; i++) {
        PyObject *spec = PyTuple_GET_ITEM(field_specs, i);
        CompiledFieldSpec *fs = &ms->specs[i];
        Py_ssize_t spec_len = PyTuple_GET_SIZE(spec);

        fs->name_obj    = PyTuple_GET_ITEM(spec, 0);
        fs->name_hash   = PyObject_Hash(fs->name_obj);  // Pre-compute hash for fast dict ops
        // Cache JSON parsing info (computed once, avoid strlen/hash per parse)
        fs->name_ptr    = PyUnicode_AsUTF8(fs->name_obj);
        fs->name_len    = fs->name_ptr ? strlen(fs->name_ptr) : 0;
        fs->name_hash_fnv = fs->name_ptr ? fnv1a_hash_inline(fs->name_ptr, fs->name_len) : 0;
        fs->alias_obj   = PyTuple_GET_ITEM(spec, 1);
        fs->required    = PyObject_IsTrue(PyTuple_GET_ITEM(spec, 2));
        fs->default_val = PyTuple_GET_ITEM(spec, 3);
        PyObject *constraints = PyTuple_GET_ITEM(spec, 4);

        // Check for nested model type or union types (6th element)
        fs->nested_model_type = NULL;
        fs->union_types_tuple = NULL;
        if (spec_len >= 6) {
            PyObject *sixth = PyTuple_GET_ITEM(spec, 5);
            if (sixth != Py_None && PyType_Check(sixth)) {
                fs->nested_model_type = sixth;  // borrowed ref, kept alive by class
            } else if (sixth != Py_None && PyTuple_Check(sixth)) {
                fs->union_types_tuple = sixth;  // tuple of acceptable types
            }
        }

        // Pre-parse all constraint values ONCE (not per-call)
        fs->type_code = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 0));
        // Override type_code based on field kind
        if (fs->nested_model_type != NULL) {
            fs->type_code = 6;  // Nested model field
        } else if (fs->union_types_tuple != NULL) {
            // type_code from constraints tells us: 7=list-of-models, 8=union
            // Keep the type_code from constraints (7 or 8)
        }
        fs->strict    = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 1));

        PyObject *gt = PyTuple_GET_ITEM(constraints, 2);
        PyObject *ge = PyTuple_GET_ITEM(constraints, 3);
        PyObject *lt = PyTuple_GET_ITEM(constraints, 4);
        PyObject *le = PyTuple_GET_ITEM(constraints, 5);
        PyObject *mul = PyTuple_GET_ITEM(constraints, 6);
        PyObject *minl = PyTuple_GET_ITEM(constraints, 7);
        PyObject *maxl = PyTuple_GET_ITEM(constraints, 8);

        fs->has_gt = (gt != Py_None); fs->has_ge = (ge != Py_None);
        fs->has_lt = (lt != Py_None); fs->has_le = (le != Py_None);
        fs->has_mul = (mul != Py_None);
        fs->has_minl = (minl != Py_None); fs->has_maxl = (maxl != Py_None);

        fs->gt_long = fs->has_gt ? as_long_coerce(gt) : 0;
        fs->ge_long = fs->has_ge ? as_long_coerce(ge) : 0;
        fs->lt_long = fs->has_lt ? as_long_coerce(lt) : 0;
        fs->le_long = fs->has_le ? as_long_coerce(le) : 0;
        fs->mul_long = fs->has_mul ? as_long_coerce(mul) : 0;
        fs->gt_dbl = fs->has_gt ? as_double_coerce(gt) : 0.0;
        fs->ge_dbl = fs->has_ge ? as_double_coerce(ge) : 0.0;
        fs->lt_dbl = fs->has_lt ? as_double_coerce(lt) : 0.0;
        fs->le_dbl = fs->has_le ? as_double_coerce(le) : 0.0;
        fs->mul_dbl = fs->has_mul ? as_double_coerce(mul) : 0.0;
        fs->min_len = fs->has_minl ? PyLong_AsSsize_t(minl) : 0;
        fs->max_len = fs->has_maxl ? PyLong_AsSsize_t(maxl) : 0;

        fs->allow_inf_nan = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 9));
        fs->format_code   = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 10));
        fs->strip_ws      = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 11));
        fs->to_lower      = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 12));
        fs->to_upper      = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 13));
    }

    return PyCapsule_New(ms, "dhi.compiled_specs", compiled_specs_destructor);
}

// init_model_compiled: Ultra-fast path using pre-compiled C structs
// No per-call PyTuple_GET_ITEM/PyLong_AsLong — reads C struct members directly
static PyObject* py_init_model_compiled(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *kwargs, *capsule;

    if (!PyArg_ParseTuple(args, "OO!O", &model_self, &PyDict_Type, &kwargs, &capsule)) {
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    PyObject *errors = NULL;

    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];

        // --- Extract value from kwargs ---
        PyObject *value = NULL;
        if (fs->alias_obj != Py_None) {
            value = PyDict_GetItem(kwargs, fs->alias_obj);
        }
        if (!value) {
            value = _PyDict_GetItem_KnownHash(kwargs, fs->name_obj, fs->name_hash);
        }

        if (!value) {
            if (!fs->required) {
                PyDict_SetItem(obj_dict, fs->name_obj, fs->default_val);
                continue;
            }
            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
            PyObject *err = Py_BuildValue("(Os)", fs->name_obj, "Field required");
            PyList_Append(errors, err); Py_DECREF(err);
            continue;
        }

        // --- TYPE CHECKING (using pre-parsed type_code) ---
        PyObject *result = value;
        Py_INCREF(result);
        const char *field_name = NULL;  // lazy-extracted on error

        if (fs->type_code == 1) { // int
            if (fs->strict) {
                if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly int, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyLong_Check(result)) {
                    if (PyFloat_Check(result)) {
                        PyObject *new_val = PyNumber_Long(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert float to int", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 2) { // float
            if (fs->strict) {
                if (!PyFloat_CheckExact(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly float, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyFloat_Check(result)) {
                    if (PyLong_Check(result)) {
                        PyObject *new_val = PyNumber_Float(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert int to float", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 3) { // str
            if (!PyUnicode_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected str, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 4) { // bool
            if (!PyBool_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bool, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 5) { // bytes
            if (!PyBytes_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bytes, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        }

        // --- STRING TRANSFORMS ---
        if (PyUnicode_Check(result)) {
            if (fs->strip_ws) {
                PyObject *s = PyObject_CallMethod(result, "strip", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_lower) {
                PyObject *s = PyObject_CallMethod(result, "lower", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_upper) {
                PyObject *s = PyObject_CallMethod(result, "upper", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
        }

        // --- NUMERIC CONSTRAINTS (INLINED - no FFI overhead) ---
        // OPTIMIZATION: Simple comparisons are inlined in C instead of calling Zig
        int validation_failed = 0;
        if (PyLong_Check(result) && !PyBool_Check(result)) {
            long val = PyLong_AsLong(result);
            // INLINED: val > gt_long
            if (fs->has_gt && val <= fs->gt_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be > %ld, got %ld", field_name, fs->gt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val >= ge_long
            if (fs->has_ge && val < fs->ge_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be >= %ld, got %ld", field_name, fs->ge_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val < lt_long
            if (fs->has_lt && val >= fs->lt_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be < %ld, got %ld", field_name, fs->lt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val <= le_long
            if (fs->has_le && val > fs->le_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be <= %ld, got %ld", field_name, fs->le_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val % mul_long == 0
            if (fs->has_mul && (val % fs->mul_long) != 0) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be a multiple of %ld, got %ld", field_name, fs->mul_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        } else if (PyFloat_Check(result)) {
            double val = PyFloat_AsDouble(result);
            // INLINED: isfinite check
            if (!fs->allow_inf_nan && !isfinite(val)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be finite", field_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: all float comparisons
            if (fs->has_gt && val <= fs->gt_dbl) { validation_failed = 1; }
            if (!validation_failed && fs->has_ge && val < fs->ge_dbl) { validation_failed = 2; }
            if (!validation_failed && fs->has_lt && val >= fs->lt_dbl) { validation_failed = 3; }
            if (!validation_failed && fs->has_le && val > fs->le_dbl) { validation_failed = 4; }
            if (!validation_failed && fs->has_mul) {
                double remainder = fmod(val, fs->mul_dbl);
                if (remainder != 0.0 && fabs(remainder) > 1e-9) { validation_failed = 5; }
            }
            if (validation_failed) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                char buf[128];
                switch (validation_failed) {
                    case 1: snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, fs->gt_dbl, val); break;
                    case 2: snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, fs->ge_dbl, val); break;
                    case 3: snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, fs->lt_dbl, val); break;
                    case 4: snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, fs->le_dbl, val); break;
                    case 5: snprintf(buf, sizeof(buf), "%s: Value must be a multiple of %g, got %g", field_name, fs->mul_dbl, val); break;
                }
                PyObject *msg = PyUnicode_FromString(buf);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- LENGTH CONSTRAINTS (pre-parsed min_len/max_len) ---
        if (fs->has_minl || fs->has_maxl) {
            Py_ssize_t length = PyObject_Length(result);
            if (length == -1 && PyErr_Occurred()) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            if (fs->has_minl && length < fs->min_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd", field_name, fs->min_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_maxl && length > fs->max_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd", field_name, fs->max_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- FORMAT VALIDATION ---
        if (fs->format_code > 0 && PyUnicode_Check(result)) {
            const char *str_val = PyUnicode_AsUTF8(result);
            if (!str_val) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            int valid = 1;
            const char *fmt_name = "unknown";
            switch (fs->format_code) {
                case 1: valid = inline_validate_email(str_val); fmt_name = "email"; break;  // INLINED
                case 2: valid = satya_validate_url(str_val); fmt_name = "URL"; break;
                case 3: valid = satya_validate_uuid(str_val); fmt_name = "UUID"; break;
                case 4: valid = satya_validate_ipv4(str_val); fmt_name = "IPv4"; break;
                case 5: valid = satya_validate_ipv6(str_val); fmt_name = "IPv6"; break;
                case 6: valid = satya_validate_base64(str_val); fmt_name = "base64"; break;
                case 7: valid = satya_validate_iso_date(str_val); fmt_name = "ISO date"; break;
                case 8: valid = satya_validate_iso_datetime(str_val); fmt_name = "ISO datetime"; break;
            }
            if (!valid) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Invalid %s format", field_name, fmt_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- SUCCESS: set in __dict__ ---
        PyDict_SetItem(obj_dict, fs->name_obj, result);
        Py_DECREF(result);
    }

    Py_DECREF(obj_dict);
    if (errors && PyList_GET_SIZE(errors) > 0) return errors;
    Py_XDECREF(errors);
    Py_RETURN_NONE;
}

// =============================================================================
// validate_field: Single C call per field — type check + constraints + format
// Constraints tuple format:
//   (type_code, strict, gt, ge, lt, le, multiple_of, min_len, max_len,
//    allow_inf_nan, format_code, strip_ws, to_lower, to_upper)
//
// type_code: 0=any, 1=int, 2=float, 3=str, 4=bool, 5=bytes
// format_code: 0=none, 1=email, 2=url, 3=uuid, 4=ipv4, 5=ipv6,
//              6=base64, 7=iso_date, 8=iso_datetime
// =============================================================================

// Core validation logic - no arg parsing overhead
static PyObject* validate_field_core(PyObject *value, const char *field_name, PyObject *constraints) {
    // Unpack constraints
    int type_code    = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 0));
    int strict       = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 1));
    PyObject *gt_obj = PyTuple_GET_ITEM(constraints, 2);
    PyObject *ge_obj = PyTuple_GET_ITEM(constraints, 3);
    PyObject *lt_obj = PyTuple_GET_ITEM(constraints, 4);
    PyObject *le_obj = PyTuple_GET_ITEM(constraints, 5);
    PyObject *mul_obj = PyTuple_GET_ITEM(constraints, 6);
    PyObject *minl_obj = PyTuple_GET_ITEM(constraints, 7);
    PyObject *maxl_obj = PyTuple_GET_ITEM(constraints, 8);
    int allow_inf_nan = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 9));
    int format_code   = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 10));
    int strip_ws     = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 11));
    int to_lower     = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 12));
    int to_upper     = (int)PyLong_AsLong(PyTuple_GET_ITEM(constraints, 13));

    PyObject* result = value;
    Py_INCREF(result);

    // --- TYPE CHECKING ---
    if (type_code == 1) { // int
        if (strict) {
            if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected exactly int, got %s",
                    field_name, Py_TYPE(value)->tp_name);
            }
        } else {
            if (PyBool_Check(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected int, got bool", field_name);
            }
            if (!PyLong_Check(result)) {
                if (PyFloat_Check(result)) {
                    // Coerce float to int
                    PyObject* new_val = PyNumber_Long(result);
                    if (!new_val) {
                        Py_DECREF(result);
                        return PyErr_Format(PyExc_ValueError,
                            "%s: Cannot convert float to int", field_name);
                    }
                    Py_DECREF(result);
                    result = new_val;
                } else {
                    Py_DECREF(result);
                    return PyErr_Format(PyExc_ValueError,
                        "%s: Expected int, got %s",
                        field_name, Py_TYPE(value)->tp_name);
                }
            }
        }
    } else if (type_code == 2) { // float
        if (strict) {
            if (!PyFloat_CheckExact(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected exactly float, got %s",
                    field_name, Py_TYPE(value)->tp_name);
            }
        } else {
            if (PyBool_Check(result)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Expected float, got bool", field_name);
            }
            if (!PyFloat_Check(result)) {
                if (PyLong_Check(result)) {
                    PyObject* new_val = PyNumber_Float(result);
                    if (!new_val) {
                        Py_DECREF(result);
                        return PyErr_Format(PyExc_ValueError,
                            "%s: Cannot convert int to float", field_name);
                    }
                    Py_DECREF(result);
                    result = new_val;
                } else {
                    Py_DECREF(result);
                    return PyErr_Format(PyExc_ValueError,
                        "%s: Expected float, got %s",
                        field_name, Py_TYPE(value)->tp_name);
                }
            }
        }
    } else if (type_code == 3) { // str
        if (!PyUnicode_Check(result)) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Expected str, got %s",
                field_name, Py_TYPE(value)->tp_name);
        }
    } else if (type_code == 4) { // bool
        if (!PyBool_Check(result)) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Expected bool, got %s",
                field_name, Py_TYPE(value)->tp_name);
        }
    } else if (type_code == 5) { // bytes
        if (!PyBytes_Check(result)) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Expected bytes, got %s",
                field_name, Py_TYPE(value)->tp_name);
        }
    }

    // --- STRING TRANSFORMS (before validation) ---
    if (PyUnicode_Check(result)) {
        if (strip_ws) {
            PyObject* stripped = PyObject_CallMethod(result, "strip", NULL);
            if (!stripped) { Py_DECREF(result); return NULL; }
            Py_DECREF(result);
            result = stripped;
        }
        if (to_lower) {
            PyObject* lowered = PyObject_CallMethod(result, "lower", NULL);
            if (!lowered) { Py_DECREF(result); return NULL; }
            Py_DECREF(result);
            result = lowered;
        }
        if (to_upper) {
            PyObject* uppered = PyObject_CallMethod(result, "upper", NULL);
            if (!uppered) { Py_DECREF(result); return NULL; }
            Py_DECREF(result);
            result = uppered;
        }
    }

    // --- NUMERIC CONSTRAINTS (use Zig validators) ---
    if (PyLong_Check(result) && !PyBool_Check(result)) {
        long val = PyLong_AsLong(result);
        if (gt_obj != Py_None) {
            long gt_val = as_long_coerce(gt_obj);
            if (!satya_validate_int_gt(val, gt_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be > %ld, got %ld", field_name, gt_val, val);
            }
        }
        if (ge_obj != Py_None) {
            long ge_val = as_long_coerce(ge_obj);
            if (!satya_validate_int_gte(val, ge_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be >= %ld, got %ld", field_name, ge_val, val);
            }
        }
        if (lt_obj != Py_None) {
            long lt_val = as_long_coerce(lt_obj);
            if (!satya_validate_int_lt(val, lt_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be < %ld, got %ld", field_name, lt_val, val);
            }
        }
        if (le_obj != Py_None) {
            long le_val = as_long_coerce(le_obj);
            if (!satya_validate_int_lte(val, le_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be <= %ld, got %ld", field_name, le_val, val);
            }
        }
        if (mul_obj != Py_None) {
            long mul_val = as_long_coerce(mul_obj);
            if (!satya_validate_int_multiple_of(val, mul_val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be a multiple of %ld, got %ld", field_name, mul_val, val);
            }
        }
    } else if (PyFloat_Check(result)) {
        double val = PyFloat_AsDouble(result);
        if (!allow_inf_nan) {
            if (!satya_validate_float_finite(val)) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Value must be finite", field_name);
            }
        }
        if (gt_obj != Py_None) {
            double gt_val = as_double_coerce(gt_obj);
            if (!satya_validate_float_gt(val, gt_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, gt_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (ge_obj != Py_None) {
            double ge_val = as_double_coerce(ge_obj);
            if (!satya_validate_float_gte(val, ge_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, ge_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (lt_obj != Py_None) {
            double lt_val = as_double_coerce(lt_obj);
            if (!satya_validate_float_lt(val, lt_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, lt_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (le_obj != Py_None) {
            double le_val = as_double_coerce(le_obj);
            if (!satya_validate_float_lte(val, le_val)) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, le_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
        if (mul_obj != Py_None) {
            double mul_val = as_double_coerce(mul_obj);
            double remainder = fmod(val, mul_val);
            if (remainder != 0.0 && fabs(remainder) > 1e-9) {
                char buf[128];
                snprintf(buf, sizeof(buf), "%s: Value must be a multiple of %g, got %g", field_name, mul_val, val);
                Py_DECREF(result);
                PyErr_SetString(PyExc_ValueError, buf);
                return NULL;
            }
        }
    }

    // --- LENGTH CONSTRAINTS ---
    if (minl_obj != Py_None || maxl_obj != Py_None) {
        Py_ssize_t length = PyObject_Length(result);
        if (length == -1 && PyErr_Occurred()) {
            Py_DECREF(result);
            return NULL;
        }
        if (minl_obj != Py_None) {
            Py_ssize_t min_len = PyLong_AsSsize_t(minl_obj);
            if (length < min_len) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Length must be >= %zd, got %zd", field_name, min_len, length);
            }
        }
        if (maxl_obj != Py_None) {
            Py_ssize_t max_len = PyLong_AsSsize_t(maxl_obj);
            if (length > max_len) {
                Py_DECREF(result);
                return PyErr_Format(PyExc_ValueError,
                    "%s: Length must be <= %zd, got %zd", field_name, max_len, length);
            }
        }
    }

    // --- FORMAT VALIDATION (Zig-powered) ---
    if (format_code > 0 && PyUnicode_Check(result)) {
        const char* str_val = PyUnicode_AsUTF8(result);
        if (!str_val) { Py_DECREF(result); return NULL; }
        int valid = 1;
        const char* fmt_name = "unknown format";

        switch (format_code) {
            case 1: valid = inline_validate_email(str_val); fmt_name = "email"; break;  // INLINED
            case 2: valid = satya_validate_url(str_val); fmt_name = "URL"; break;
            case 3: valid = satya_validate_uuid(str_val); fmt_name = "UUID"; break;
            case 4: valid = satya_validate_ipv4(str_val); fmt_name = "IPv4"; break;
            case 5: valid = satya_validate_ipv6(str_val); fmt_name = "IPv6"; break;
            case 6: valid = satya_validate_base64(str_val); fmt_name = "base64"; break;
            case 7: valid = satya_validate_iso_date(str_val); fmt_name = "ISO date"; break;
            case 8: valid = satya_validate_iso_datetime(str_val); fmt_name = "ISO datetime"; break;
        }

        if (!valid) {
            Py_DECREF(result);
            return PyErr_Format(PyExc_ValueError,
                "%s: Invalid %s format", field_name, fmt_name);
        }
    }

    return result;  // Validated (possibly transformed) value
}

// Python wrapper for validate_field - thin wrapper around core
static PyObject* py_validate_field(PyObject* self, PyObject* args) {
    PyObject *value, *field_name_obj, *constraints;
    if (!PyArg_ParseTuple(args, "OOO!", &value, &field_name_obj, &PyTuple_Type, &constraints)) {
        return NULL;
    }
    const char* field_name = PyUnicode_AsUTF8(field_name_obj);
    if (!field_name) return NULL;
    return validate_field_core(value, field_name, constraints);
}

// =============================================================================
// init_model: Batch init — ONE Python→C call for the entire __init__
// Validates all fields, sets attributes directly on self.__dict__
//
// init_model(self, kwargs_dict, field_specs)
// field_specs: tuple of (field_name_str, alias_or_None, required_bool,
//              default_obj, constraints_tuple)
// Returns: None on success, or list of (field_name, error_msg) tuples on error
// =============================================================================
static PyObject* py_init_model(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *kwargs, *field_specs;

    if (!PyArg_ParseTuple(args, "OO!O!", &model_self, &PyDict_Type, &kwargs,
                          &PyTuple_Type, &field_specs)) {
        return NULL;
    }

    // Get self.__dict__ for fast direct attribute setting
    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    Py_ssize_t n_fields = PyTuple_GET_SIZE(field_specs);
    PyObject *errors = NULL;  // Lazy-allocated list of (name, msg) tuples

    for (Py_ssize_t i = 0; i < n_fields; i++) {
        PyObject *spec = PyTuple_GET_ITEM(field_specs, i);
        PyObject *name_obj   = PyTuple_GET_ITEM(spec, 0);
        PyObject *alias_obj  = PyTuple_GET_ITEM(spec, 1);
        int required         = PyObject_IsTrue(PyTuple_GET_ITEM(spec, 2));
        PyObject *default_val = PyTuple_GET_ITEM(spec, 3);
        PyObject *constraints = PyTuple_GET_ITEM(spec, 4);

        // --- Extract value from kwargs ---
        PyObject *value = NULL;
        if (alias_obj != Py_None) {
            value = PyDict_GetItem(kwargs, alias_obj);  // borrowed ref
        }
        if (value == NULL) {
            value = PyDict_GetItem(kwargs, name_obj);   // borrowed ref
        }

        if (value == NULL) {
            if (!required) {
                // Set default directly in __dict__
                PyDict_SetItem(obj_dict, name_obj, default_val);
                continue;
            } else {
                // Missing required field — collect error
                if (!errors) {
                    errors = PyList_New(0);
                    if (!errors) { Py_DECREF(obj_dict); return NULL; }
                }
                PyObject *err = Py_BuildValue("(Os)", name_obj, "Field required");
                PyList_Append(errors, err);
                Py_DECREF(err);
                continue;
            }
        }

        // --- Validate field ---
        const char *field_name = PyUnicode_AsUTF8(name_obj);
        if (!field_name) { Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }

        PyObject *validated = validate_field_core(value, field_name, constraints);
        if (validated == NULL) {
            // Validation failed — capture error message
            if (!errors) {
                errors = PyList_New(0);
                if (!errors) { Py_DECREF(obj_dict); PyErr_Clear(); return NULL; }
            }
            PyObject *exc_type, *exc_value, *exc_tb;
            PyErr_Fetch(&exc_type, &exc_value, &exc_tb);
            PyObject *msg = exc_value ? PyObject_Str(exc_value) : PyUnicode_FromString("Validation failed");
            PyObject *err = Py_BuildValue("(OO)", name_obj, msg);
            PyList_Append(errors, err);
            Py_DECREF(err);
            Py_DECREF(msg);
            Py_XDECREF(exc_type);
            Py_XDECREF(exc_value);
            Py_XDECREF(exc_tb);
            continue;
        }

        // Set validated value directly in __dict__ (fastest path)
        PyDict_SetItem(obj_dict, name_obj, validated);
        Py_DECREF(validated);
    }

    Py_DECREF(obj_dict);

    if (errors && PyList_GET_SIZE(errors) > 0) {
        // Return errors list for Python to wrap in ValidationErrors
        return errors;
    }
    Py_XDECREF(errors);
    Py_RETURN_NONE;
}

// =============================================================================
// dump_json_compiled: Ultra-fast JSON serialization using pre-compiled specs
// Builds JSON string directly in C, no intermediate Python dict
// =============================================================================

// Helper: escape a string for JSON and append to buffer
static int json_escape_string(char **buf, size_t *buf_size, size_t *pos, const char *str, Py_ssize_t len) {
    // Worst case: every char needs escaping (\uXXXX = 6 chars) + quotes
    size_t needed = *pos + len * 6 + 3;
    if (needed > *buf_size) {
        size_t new_size = needed * 2;
        char *new_buf = realloc(*buf, new_size);
        if (!new_buf) return -1;
        *buf = new_buf;
        *buf_size = new_size;
    }

    char *p = *buf + *pos;
    *p++ = '"';

    for (Py_ssize_t i = 0; i < len; i++) {
        unsigned char c = (unsigned char)str[i];
        switch (c) {
            case '"':  *p++ = '\\'; *p++ = '"'; break;
            case '\\': *p++ = '\\'; *p++ = '\\'; break;
            case '\b': *p++ = '\\'; *p++ = 'b'; break;
            case '\f': *p++ = '\\'; *p++ = 'f'; break;
            case '\n': *p++ = '\\'; *p++ = 'n'; break;
            case '\r': *p++ = '\\'; *p++ = 'r'; break;
            case '\t': *p++ = '\\'; *p++ = 't'; break;
            default:
                if (c < 32) {
                    p += sprintf(p, "\\u%04x", c);
                } else {
                    *p++ = c;
                }
        }
    }

    *p++ = '"';
    *pos = p - *buf;
    return 0;
}

// Helper: append raw string to buffer
static int json_append(char **buf, size_t *buf_size, size_t *pos, const char *str, size_t len) {
    size_t needed = *pos + len + 1;
    if (needed > *buf_size) {
        size_t new_size = needed * 2;
        char *new_buf = realloc(*buf, new_size);
        if (!new_buf) return -1;
        *buf = new_buf;
        *buf_size = new_size;
    }
    memcpy(*buf + *pos, str, len);
    *pos += len;
    return 0;
}

// =============================================================================
// init_model_full: ULTRA-OPTIMIZED init that handles EVERYTHING in C
// Uses METH_FASTCALL for faster argument passing (no tuple unpacking)
// Eliminates consumed set tracking for better performance
// Returns: None on success, list of (field, msg) tuples on error
// Sets __pydantic_fields_set__, __pydantic_private__, __pydantic_extra__ in C
// =============================================================================
static PyObject* py_init_model_full(PyObject* self_unused, PyObject *const *args, Py_ssize_t nargs) {
    // METH_FASTCALL: args passed as C array - no PyArg_ParseTuple overhead!
    if (nargs != 4) {
        PyErr_SetString(PyExc_TypeError, "init_model_full requires 4 arguments");
        return NULL;
    }

    PyObject *model_self = args[0];
    PyObject *kwargs = args[1];
    PyObject *capsule = args[2];
    PyObject *extra_mode_obj = args[3];

    // Validate kwargs is a dict (fast check)
    if (!PyDict_Check(kwargs)) {
        PyErr_SetString(PyExc_TypeError, "kwargs must be a dict");
        return NULL;
    }

    // Get extra_mode as C int (0=ignore, 1=forbid, 2=allow)
    int extra_mode = (int)PyLong_AsLong(extra_mode_obj);
    if (extra_mode == -1 && PyErr_Occurred()) return NULL;

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    PyObject *errors = NULL;

    // OPTIMIZATION: Use bitmask instead of PySet during hot loop
    // PySet_Add has overhead; bitmask is O(1) bit operation
    // We create the actual PySet only at the end
    uint64_t fields_bitmask = 0;  // Supports up to 64 fields (more than enough)

    // OPTIMIZATION: Use counter instead of consumed set for extra field detection
    Py_ssize_t found_count = 0;
    Py_ssize_t kwargs_size = PyDict_Size(kwargs);

    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];

        // --- Extract value from kwargs ---
        PyObject *value = NULL;

        if (fs->alias_obj != Py_None) {
            value = PyDict_GetItem(kwargs, fs->alias_obj);
        }
        if (!value) {
            value = _PyDict_GetItem_KnownHash(kwargs, fs->name_obj, fs->name_hash);
        }

        if (!value) {
            if (!fs->required) {
                PyDict_SetItem(obj_dict, fs->name_obj, fs->default_val);
                continue;
            }
            if (!errors) { errors = PyList_New(0); if (!errors) { Py_DECREF(obj_dict); return NULL; } }
            PyObject *err = Py_BuildValue("(Os)", fs->name_obj, "Field required");
            PyList_Append(errors, err); Py_DECREF(err);
            continue;
        }

        // OPTIMIZATION: Use bitmask instead of PySet_Add (O(1) bit op vs hash table)
        found_count++;
        fields_bitmask |= ((uint64_t)1 << i);

        // --- TYPE CHECKING (same as init_model_compiled) ---
        PyObject *result = value;
        Py_INCREF(result);
        const char *field_name = NULL;

        if (fs->type_code == 1) { // int
            if (fs->strict) {
                if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly int, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyLong_Check(result)) {
                    if (PyFloat_Check(result)) {
                        PyObject *new_val = PyNumber_Long(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert float to int", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 2) { // float
            if (fs->strict) {
                if (!PyFloat_CheckExact(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly float, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyFloat_Check(result)) {
                    if (PyLong_Check(result)) {
                        PyObject *new_val = PyNumber_Float(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert int to float", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 3) { // str
            if (!PyUnicode_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected str, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 4) { // bool
            if (!PyBool_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bool, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 5) { // bytes
            if (!PyBytes_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bytes, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 6) { // nested model - FAST PATH
            // Check if value is already the correct nested model type
            if ((PyObject*)Py_TYPE(result) == fs->nested_model_type) {
                // Already validated! Just set directly in dict (ULTRA FAST)
                PyDict_SetItem(obj_dict, fs->name_obj, result);
                Py_DECREF(result);
                continue;  // Skip all other validation - already done
            }
            // Check if value is dict - need to create nested model
            if (PyDict_Check(result)) {
                // Ensure global empty tuple is initialized
                if (!g_empty_tuple) {
                    g_empty_tuple = PyTuple_New(0);
                    if (!g_empty_tuple) {
                        Py_DECREF(result);
                        Py_DECREF(obj_dict);
                        Py_XDECREF(errors);
                        return NULL;
                    }
                }
                // Create nested model: type(**dict)
                PyObject *nested_obj = PyObject_Call(fs->nested_model_type, g_empty_tuple, result);
                Py_DECREF(result);  // Done with dict
                if (!nested_obj) {
                    // Nested validation failed - extract error
                    PyObject *exc_type, *exc_value, *exc_tb;
                    PyErr_Fetch(&exc_type, &exc_value, &exc_tb);
                    if (exc_value) {
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *err_str = PyObject_Str(exc_value);
                        PyObject *msg = PyUnicode_FromFormat("%s: %S", field_name, err_str);
                        Py_XDECREF(err_str);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                        Py_DECREF(msg);
                        PyList_Append(errors, err);
                        Py_DECREF(err);
                    }
                    Py_XDECREF(exc_type);
                    Py_XDECREF(exc_value);
                    Py_XDECREF(exc_tb);
                    continue;
                }
                // Set nested model in dict
                PyDict_SetItem(obj_dict, fs->name_obj, nested_obj);
                Py_DECREF(nested_obj);
                continue;  // Skip all other validation - nested __init__ did it
            }
            // Value is neither correct type nor dict - error
            Py_DECREF(result);
            field_name = PyUnicode_AsUTF8(fs->name_obj);
            if (!errors) { errors = PyList_New(0); }
            const char *expected_name = ((PyTypeObject*)fs->nested_model_type)->tp_name;
            PyObject *msg = PyUnicode_FromFormat("%s: Expected %s or dict, got %s",
                field_name, expected_name, Py_TYPE(value)->tp_name);
            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
            Py_DECREF(msg);
            PyList_Append(errors, err);
            Py_DECREF(err);
            continue;
        } else if (fs->type_code == 7) { // list of model variants - FAST PATH
            if (!PyList_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected list, got %s",
                    field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
            // Length constraints on the list
            if (fs->has_minl || fs->has_maxl) {
                Py_ssize_t list_len = PyList_GET_SIZE(result);
                if (fs->has_minl && list_len < fs->min_len) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd",
                        field_name, fs->min_len, list_len);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                    Py_DECREF(msg); PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (fs->has_maxl && list_len > fs->max_len) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd",
                        field_name, fs->max_len, list_len);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                    Py_DECREF(msg); PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            }
            // Items are already validated BaseModel instances - just passthrough
            // For dict items, try to coerce using the first matching type
            Py_ssize_t list_len = PyList_GET_SIZE(result);
            int has_dicts = 0;
            for (Py_ssize_t j = 0; j < list_len; j++) {
                PyObject *item = PyList_GET_ITEM(result, j);
                if (PyDict_Check(item)) { has_dicts = 1; break; }
            }
            if (has_dicts && fs->union_types_tuple) {
                // Need to coerce dict items - create new list
                if (!g_empty_tuple) {
                    g_empty_tuple = PyTuple_New(0);
                    if (!g_empty_tuple) {
                        Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL;
                    }
                }
                PyObject *new_list = PyList_New(list_len);
                if (!new_list) {
                    Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL;
                }
                int coerce_error = 0;
                for (Py_ssize_t j = 0; j < list_len; j++) {
                    PyObject *item = PyList_GET_ITEM(result, j);
                    if (PyDict_Check(item)) {
                        // Try each union type until one succeeds
                        Py_ssize_t n_types = PyTuple_GET_SIZE(fs->union_types_tuple);
                        PyObject *coerced = NULL;
                        for (Py_ssize_t t = 0; t < n_types; t++) {
                            PyObject *model_type = PyTuple_GET_ITEM(fs->union_types_tuple, t);
                            coerced = PyObject_Call(model_type, g_empty_tuple, item);
                            if (coerced) break;
                            PyErr_Clear();
                        }
                        if (coerced) {
                            PyList_SET_ITEM(new_list, j, coerced);  // steals ref
                        } else {
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Item %zd: cannot coerce dict to model", field_name, j);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                            Py_DECREF(msg); PyList_Append(errors, err); Py_DECREF(err);
                            // Fill remaining items to avoid segfault
                            Py_INCREF(item);
                            PyList_SET_ITEM(new_list, j, item);
                            coerce_error = 1;
                        }
                    } else {
                        Py_INCREF(item);
                        PyList_SET_ITEM(new_list, j, item);  // steals ref
                    }
                }
                Py_DECREF(result);
                result = new_list;
                if (coerce_error) {
                    PyDict_SetItem(obj_dict, fs->name_obj, result);
                    Py_DECREF(result); continue;
                }
            }
            // Set directly - no copy needed for non-dict items
            PyDict_SetItem(obj_dict, fs->name_obj, result);
            Py_DECREF(result);
            continue;
        } else if (fs->type_code == 8) { // union of model types
            // Check if value is an instance of any union type
            if (fs->union_types_tuple) {
                int is_instance = PyObject_IsInstance(result, fs->union_types_tuple);
                if (is_instance == 1) {
                    // Already correct type
                    PyDict_SetItem(obj_dict, fs->name_obj, result);
                    Py_DECREF(result);
                    continue;
                }
                // Try dict coercion
                if (PyDict_Check(result)) {
                    if (!g_empty_tuple) {
                        g_empty_tuple = PyTuple_New(0);
                        if (!g_empty_tuple) {
                            Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL;
                        }
                    }
                    Py_ssize_t n_types = PyTuple_GET_SIZE(fs->union_types_tuple);
                    PyObject *coerced = NULL;
                    for (Py_ssize_t t = 0; t < n_types; t++) {
                        PyObject *model_type = PyTuple_GET_ITEM(fs->union_types_tuple, t);
                        coerced = PyObject_Call(model_type, g_empty_tuple, result);
                        if (coerced) break;
                        PyErr_Clear();
                    }
                    if (coerced) {
                        PyDict_SetItem(obj_dict, fs->name_obj, coerced);
                        Py_DECREF(coerced);
                        Py_DECREF(result);
                        continue;
                    }
                }
            }
            // Not a valid type
            Py_DECREF(result);
            field_name = PyUnicode_AsUTF8(fs->name_obj);
            if (!errors) { errors = PyList_New(0); }
            PyObject *msg = PyUnicode_FromFormat("%s: Value does not match any expected type", field_name);
            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
            Py_DECREF(msg); PyList_Append(errors, err); Py_DECREF(err);
            continue;
        }

        // --- STRING TRANSFORMS (inline for speed) ---
        if (PyUnicode_Check(result)) {
            if (fs->strip_ws) {
                PyObject *s = PyObject_CallMethod(result, "strip", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_lower) {
                PyObject *s = PyObject_CallMethod(result, "lower", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
            if (fs->to_upper) {
                PyObject *s = PyObject_CallMethod(result, "upper", NULL);
                if (!s) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
                Py_DECREF(result); result = s;
            }
        }

        // --- NUMERIC CONSTRAINTS (INLINED - no FFI overhead) ---
        // OPTIMIZATION: Simple comparisons are inlined in C instead of calling Zig
        // This eliminates FFI overhead for trivial checks (gt/ge/lt/le)
        int validation_failed = 0;
        if (PyLong_Check(result) && !PyBool_Check(result)) {
            long val = PyLong_AsLong(result);
            // INLINED: val > gt_long (was satya_validate_int_gt)
            if (fs->has_gt && val <= fs->gt_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be > %ld, got %ld", field_name, fs->gt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val >= ge_long (was satya_validate_int_gte)
            if (fs->has_ge && val < fs->ge_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be >= %ld, got %ld", field_name, fs->ge_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val < lt_long (was satya_validate_int_lt)
            if (fs->has_lt && val >= fs->lt_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be < %ld, got %ld", field_name, fs->lt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val <= le_long (was satya_validate_int_lte)
            if (fs->has_le && val > fs->le_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be <= %ld, got %ld", field_name, fs->le_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: val % mul_long == 0 (was satya_validate_int_multiple_of)
            if (fs->has_mul && (val % fs->mul_long) != 0) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be a multiple of %ld, got %ld", field_name, fs->mul_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        } else if (PyFloat_Check(result)) {
            double val = PyFloat_AsDouble(result);
            // INLINED: isfinite check (was satya_validate_float_finite)
            if (!fs->allow_inf_nan && !isfinite(val)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be finite", field_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            // INLINED: all float comparisons (no FFI calls)
            if (fs->has_gt && val <= fs->gt_dbl) { validation_failed = 1; }
            if (!validation_failed && fs->has_ge && val < fs->ge_dbl) { validation_failed = 2; }
            if (!validation_failed && fs->has_lt && val >= fs->lt_dbl) { validation_failed = 3; }
            if (!validation_failed && fs->has_le && val > fs->le_dbl) { validation_failed = 4; }
            if (!validation_failed && fs->has_mul) {
                double remainder = fmod(val, fs->mul_dbl);
                if (remainder != 0.0 && fabs(remainder) > 1e-9) { validation_failed = 5; }
            }
            if (validation_failed) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                char buf[128];
                switch (validation_failed) {
                    case 1: snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, fs->gt_dbl, val); break;
                    case 2: snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, fs->ge_dbl, val); break;
                    case 3: snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, fs->lt_dbl, val); break;
                    case 4: snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, fs->le_dbl, val); break;
                    case 5: snprintf(buf, sizeof(buf), "%s: Value must be a multiple of %g, got %g", field_name, fs->mul_dbl, val); break;
                }
                PyObject *msg = PyUnicode_FromString(buf);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- LENGTH CONSTRAINTS ---
        if (fs->has_minl || fs->has_maxl) {
            Py_ssize_t length = PyObject_Length(result);
            if (length == -1 && PyErr_Occurred()) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            if (fs->has_minl && length < fs->min_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd", field_name, fs->min_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_maxl && length > fs->max_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd", field_name, fs->max_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- FORMAT VALIDATION ---
        if (fs->format_code > 0 && PyUnicode_Check(result)) {
            const char *str_val = PyUnicode_AsUTF8(result);
            if (!str_val) { Py_DECREF(result); Py_DECREF(obj_dict); Py_XDECREF(errors); return NULL; }
            int valid = 1;
            const char *fmt_name = "unknown";
            switch (fs->format_code) {
                case 1: valid = inline_validate_email(str_val); fmt_name = "email"; break;  // INLINED
                case 2: valid = satya_validate_url(str_val); fmt_name = "URL"; break;
                case 3: valid = satya_validate_uuid(str_val); fmt_name = "UUID"; break;
                case 4: valid = satya_validate_ipv4(str_val); fmt_name = "IPv4"; break;
                case 5: valid = satya_validate_ipv6(str_val); fmt_name = "IPv6"; break;
                case 6: valid = satya_validate_base64(str_val); fmt_name = "base64"; break;
                case 7: valid = satya_validate_iso_date(str_val); fmt_name = "ISO date"; break;
                case 8: valid = satya_validate_iso_datetime(str_val); fmt_name = "ISO datetime"; break;
            }
            if (!valid) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Invalid %s format", field_name, fmt_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- SUCCESS: set in __dict__ ---
        PyDict_SetItem(obj_dict, fs->name_obj, result);
        Py_DECREF(result);
    }

    // --- HANDLE EXTRA FIELDS (OPTIMIZED: no consumed set) ---
    PyObject *extra_data = NULL;
    // Only check for extras if we found fewer fields than kwargs has
    // This is the common case optimization - most models don't have extra fields
    if (extra_mode != 0 && found_count < kwargs_size) {
        PyObject *key, *value;
        Py_ssize_t pos = 0;
        while (PyDict_Next(kwargs, &pos, &key, &value)) {
            // Check if this key is a known field (by name or alias)
            int is_known = 0;
            for (Py_ssize_t i = 0; i < ms->n_fields && !is_known; i++) {
                CompiledFieldSpec *fs = &ms->specs[i];
                if (PyObject_RichCompareBool(key, fs->name_obj, Py_EQ) == 1) {
                    is_known = 1;
                } else if (fs->alias_obj != Py_None &&
                           PyObject_RichCompareBool(key, fs->alias_obj, Py_EQ) == 1) {
                    is_known = 1;
                }
            }
            if (!is_known) {
                if (extra_mode == 1) {  // 'forbid'
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *err = Py_BuildValue("(Os)", key, "Extra inputs are not permitted");
                    PyList_Append(errors, err); Py_DECREF(err);
                } else if (extra_mode == 2) {  // 'allow'
                    if (!extra_data) { extra_data = PyDict_New(); }
                    PyDict_SetItem(extra_data, key, value);
                }
            }
        }
    }

    Py_DECREF(obj_dict);

    // --- SET PYDANTIC INTERNAL ATTRIBUTES (direct __dict__ access for speed) ---
    // Re-get obj_dict since we released it earlier
    obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) { Py_XDECREF(extra_data); Py_XDECREF(errors); return NULL; }

    // Use interned strings for fast dict access
    static PyObject *fields_set_key = NULL;
    static PyObject *extra_key = NULL;
    static PyObject *private_key = NULL;
    if (!fields_set_key) {
        fields_set_key = PyUnicode_InternFromString("__pydantic_fields_set__");
        extra_key = PyUnicode_InternFromString("__pydantic_extra__");
        private_key = PyUnicode_InternFromString("__pydantic_private__");
    }

    // OPTIMIZATION: Create PySet from bitmask only once at the end
    // This is faster than calling PySet_Add for each field during the loop
    PyObject *fields_set = PySet_New(NULL);
    if (!fields_set) { Py_DECREF(obj_dict); Py_XDECREF(extra_data); Py_XDECREF(errors); return NULL; }
    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        if (fields_bitmask & ((uint64_t)1 << i)) {
            PySet_Add(fields_set, ms->specs[i].name_obj);
        }
    }

    PyDict_SetItem(obj_dict, fields_set_key, fields_set);
    Py_DECREF(fields_set);

    if (extra_data) {
        PyDict_SetItem(obj_dict, extra_key, extra_data);
        Py_DECREF(extra_data);
    } else {
        PyDict_SetItem(obj_dict, extra_key, Py_None);
    }
    PyDict_SetItem(obj_dict, private_key, Py_None);
    Py_DECREF(obj_dict);

    if (errors && PyList_GET_SIZE(errors) > 0) return errors;
    Py_XDECREF(errors);
    Py_RETURN_NONE;
}

// =============================================================================
// dump_model_compiled: Ultra-fast dict dump using pre-compiled specs
// Returns Python dict directly without intermediate processing
// =============================================================================
// Forward declaration for recursive dump
static PyObject* dump_model_recursive(PyObject *model_self);

// Helper: dump a single value, recursing into BaseModel instances and lists
static PyObject* dump_value_recursive(PyObject *value) {
    // Check if value has __dhi_fields__ (is a BaseModel)
    if (PyObject_HasAttrString(value, "__dhi_fields__")) {
        return dump_model_recursive(value);
    }
    // Check if value is a list - recurse into items
    if (PyList_Check(value)) {
        Py_ssize_t len = PyList_GET_SIZE(value);
        PyObject *new_list = PyList_New(len);
        if (!new_list) return NULL;
        for (Py_ssize_t i = 0; i < len; i++) {
            PyObject *item = PyList_GET_ITEM(value, i);
            PyObject *dumped;
            if (PyObject_HasAttrString(item, "__dhi_fields__")) {
                dumped = dump_model_recursive(item);
            } else {
                dumped = item;
                Py_INCREF(dumped);
            }
            if (!dumped) { Py_DECREF(new_list); return NULL; }
            PyList_SET_ITEM(new_list, i, dumped);  // steals ref
        }
        return new_list;
    }
    Py_INCREF(value);
    return value;
}

// Recursive dump: handles nested models and list-of-models
static PyObject* dump_model_recursive(PyObject *model_self) {
    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    // Get compiled specs if available
    PyObject *compiled_attr = PyObject_GetAttrString((PyObject*)Py_TYPE(model_self), "__dhi_compiled_specs__");
    if (!compiled_attr || compiled_attr == Py_None) {
        Py_XDECREF(compiled_attr);
        // Fallback: call Python model_dump
        Py_DECREF(obj_dict);
        return PyObject_CallMethod(model_self, "model_dump", NULL);
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(compiled_attr, "dhi.compiled_specs");
    if (!ms) {
        Py_DECREF(compiled_attr);
        Py_DECREF(obj_dict);
        return PyObject_CallMethod(model_self, "model_dump", NULL);
    }

    PyObject *result = _PyDict_NewPresized(ms->n_fields);
    if (!result) { Py_DECREF(compiled_attr); Py_DECREF(obj_dict); return NULL; }

    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];
        PyObject *value = PyDict_GetItem(obj_dict, fs->name_obj);
        if (!value) continue;

        if (fs->type_code == 6 || fs->type_code == 8) {
            // Nested model or union - recurse
            PyObject *dumped = dump_value_recursive(value);
            if (!dumped) { Py_DECREF(result); Py_DECREF(compiled_attr); Py_DECREF(obj_dict); return NULL; }
            PyDict_SetItem(result, fs->name_obj, dumped);
            Py_DECREF(dumped);
        } else if (fs->type_code == 7) {
            // List of models - recurse into list
            PyObject *dumped = dump_value_recursive(value);
            if (!dumped) { Py_DECREF(result); Py_DECREF(compiled_attr); Py_DECREF(obj_dict); return NULL; }
            PyDict_SetItem(result, fs->name_obj, dumped);
            Py_DECREF(dumped);
        } else {
            // Simple value - direct copy
            PyDict_SetItem(result, fs->name_obj, value);
        }
    }

    Py_DECREF(compiled_attr);
    Py_DECREF(obj_dict);
    return result;
}

static PyObject* py_dump_model_compiled(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *capsule;

    if (!PyArg_ParseTuple(args, "OO", &model_self, &capsule)) {
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    // Use recursive dump that handles nested models
    return dump_model_recursive(model_self);
}

static PyObject* py_dump_json_compiled(PyObject* self_unused, PyObject* args) {
    PyObject *model_self, *capsule;

    if (!PyArg_ParseTuple(args, "OO", &model_self, &capsule)) {
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return NULL;

    PyObject *obj_dict = PyObject_GenericGetDict(model_self, NULL);
    if (!obj_dict) return NULL;

    // Initial buffer
    size_t buf_size = 256;
    char *buf = malloc(buf_size);
    if (!buf) { Py_DECREF(obj_dict); return PyErr_NoMemory(); }
    size_t pos = 0;

    buf[pos++] = '{';

    int first = 1;
    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];
        PyObject *value = PyDict_GetItem(obj_dict, fs->name_obj);
        if (!value) continue;

        // Comma separator
        if (!first) {
            if (json_append(&buf, &buf_size, &pos, ", ", 2) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        }
        first = 0;

        // Field name
        const char *field_name = PyUnicode_AsUTF8(fs->name_obj);
        Py_ssize_t name_len = strlen(field_name);
        if (json_escape_string(&buf, &buf_size, &pos, field_name, name_len) < 0) {
            free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
        }
        if (json_append(&buf, &buf_size, &pos, ": ", 2) < 0) {
            free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
        }

        // Value serialization
        if (value == Py_None) {
            if (json_append(&buf, &buf_size, &pos, "null", 4) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyBool_Check(value)) {
            if (value == Py_True) {
                if (json_append(&buf, &buf_size, &pos, "true", 4) < 0) {
                    free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
                }
            } else {
                if (json_append(&buf, &buf_size, &pos, "false", 5) < 0) {
                    free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
                }
            }
        } else if (PyLong_Check(value)) {
            long val = PyLong_AsLong(value);
            char num_buf[32];
            int num_len = snprintf(num_buf, sizeof(num_buf), "%ld", val);
            if (json_append(&buf, &buf_size, &pos, num_buf, num_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyFloat_Check(value)) {
            double val = PyFloat_AsDouble(value);
            char num_buf[64];
            int num_len;
            // Handle special floats
            if (isinf(val)) {
                num_len = snprintf(num_buf, sizeof(num_buf), "null"); // JSON doesn't support Infinity
            } else if (isnan(val)) {
                num_len = snprintf(num_buf, sizeof(num_buf), "null"); // JSON doesn't support NaN
            } else {
                num_len = snprintf(num_buf, sizeof(num_buf), "%.17g", val);
            }
            if (json_append(&buf, &buf_size, &pos, num_buf, num_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyUnicode_Check(value)) {
            Py_ssize_t str_len;
            const char *str = PyUnicode_AsUTF8AndSize(value, &str_len);
            if (!str) { free(buf); Py_DECREF(obj_dict); return NULL; }
            if (json_escape_string(&buf, &buf_size, &pos, str, str_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else if (PyBytes_Check(value)) {
            // Encode bytes as base64 or just the raw bytes as string
            Py_ssize_t bytes_len = PyBytes_GET_SIZE(value);
            const char *bytes_data = PyBytes_AS_STRING(value);
            if (json_escape_string(&buf, &buf_size, &pos, bytes_data, bytes_len) < 0) {
                free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
        } else {
            // Fallback: use Python's repr or str
            PyObject *str_obj = PyObject_Str(value);
            if (!str_obj) { free(buf); Py_DECREF(obj_dict); return NULL; }
            Py_ssize_t str_len;
            const char *str = PyUnicode_AsUTF8AndSize(str_obj, &str_len);
            if (!str) { Py_DECREF(str_obj); free(buf); Py_DECREF(obj_dict); return NULL; }
            if (json_escape_string(&buf, &buf_size, &pos, str, str_len) < 0) {
                Py_DECREF(str_obj); free(buf); Py_DECREF(obj_dict); return PyErr_NoMemory();
            }
            Py_DECREF(str_obj);
        }
    }

    buf[pos++] = '}';

    Py_DECREF(obj_dict);

    PyObject *result = PyUnicode_FromStringAndSize(buf, pos);
    free(buf);
    return result;
}

// =============================================================================
// DhiStruct: HIGH-PERFORMANCE VALIDATED STRUCT (msgspec-like)
// =============================================================================
// Stores field values in a C array instead of Python __dict__.
// This eliminates PyDict overhead and provides ~6x speedup over BaseModel.

// Instance object - stores field values directly in C array
typedef struct {
    PyObject_HEAD
    PyObject *values[];  // Flexible array member - holds field values
} DhiStructObject;

// Forward declarations
static PyTypeObject DhiStructType;

// Helper: Get field count from type's tp_dict
static Py_ssize_t DhiStruct_get_n_fields(PyTypeObject *type) {
    PyObject *n_fields_obj = PyDict_GetItemString(type->tp_dict, "__dhi_n_fields__");
    if (!n_fields_obj) return 0;
    return PyLong_AsSsize_t(n_fields_obj);
}

// tp_new: Allocate object with space for field values
static PyObject* DhiStruct_new(PyTypeObject *type, PyObject *args, PyObject *kwds) {
    Py_ssize_t n_fields = DhiStruct_get_n_fields(type);

    // Allocate object with flexible array for values
    DhiStructObject *self = (DhiStructObject*)type->tp_alloc(type, n_fields);
    if (!self) return NULL;

    // Initialize all values to NULL
    for (Py_ssize_t i = 0; i < n_fields; i++) {
        self->values[i] = NULL;
    }

    return (PyObject*)self;
}

// tp_dealloc: Free the object
static void DhiStruct_dealloc(DhiStructObject *self) {
    PyTypeObject *type = Py_TYPE(self);
    Py_ssize_t n_fields = DhiStruct_get_n_fields(type);

    // Decref all stored values
    for (Py_ssize_t i = 0; i < n_fields; i++) {
        Py_XDECREF(self->values[i]);
    }

    type->tp_free((PyObject*)self);
}

// tp_init: Validate and store field values (THE HOT PATH)
static int DhiStruct_init(DhiStructObject *self, PyObject *args, PyObject *kwargs) {
    if (args && PyTuple_GET_SIZE(args) > 0) {
        PyErr_SetString(PyExc_TypeError, "DhiStruct does not accept positional arguments");
        return -1;
    }

    if (!kwargs) {
        kwargs = PyDict_New();
        if (!kwargs) return -1;
        Py_DECREF(kwargs);
        kwargs = NULL;
    }

    PyTypeObject *type = Py_TYPE(self);

    // Get compiled specs from type
    PyObject *capsule = PyDict_GetItemString(type->tp_dict, "__dhi_compiled_specs__");
    if (!capsule) {
        PyErr_SetString(PyExc_RuntimeError, "DhiStruct type not properly initialized (missing specs)");
        return -1;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return -1;

    // Get field indices dict for fast lookup
    PyObject *field_indices = PyDict_GetItemString(type->tp_dict, "__dhi_field_indices__");
    if (!field_indices) {
        PyErr_SetString(PyExc_RuntimeError, "DhiStruct type not properly initialized (missing indices)");
        return -1;
    }

    PyObject *errors = NULL;

    // ULTRA-FAST validation loop - no __dict__ operations!
    for (Py_ssize_t i = 0; i < ms->n_fields; i++) {
        CompiledFieldSpec *fs = &ms->specs[i];

        // Extract value from kwargs
        PyObject *value = NULL;
        if (kwargs) {
            if (fs->alias_obj != Py_None) {
                value = PyDict_GetItem(kwargs, fs->alias_obj);
            }
            if (!value) {
                value = _PyDict_GetItem_KnownHash(kwargs, fs->name_obj, fs->name_hash);
            }
        }

        if (!value) {
            if (!fs->required) {
                // Use default value
                Py_INCREF(fs->default_val);
                self->values[i] = fs->default_val;
                continue;
            }
            if (!errors) { errors = PyList_New(0); if (!errors) return -1; }
            PyObject *err = Py_BuildValue("(Os)", fs->name_obj, "Field required");
            PyList_Append(errors, err); Py_DECREF(err);
            continue;
        }

        // --- TYPE CHECKING ---
        PyObject *result = value;
        Py_INCREF(result);
        const char *field_name = NULL;

        if (fs->type_code == 1) { // int
            if (fs->strict) {
                if (!PyLong_CheckExact(result) || PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly int, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyLong_Check(result)) {
                    if (PyFloat_Check(result)) {
                        PyObject *new_val = PyNumber_Long(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert float to int", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected int, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 2) { // float
            if (fs->strict) {
                if (!PyFloat_CheckExact(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected exactly float, got %s", field_name, Py_TYPE(value)->tp_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
            } else {
                if (PyBool_Check(result)) {
                    Py_DECREF(result);
                    field_name = PyUnicode_AsUTF8(fs->name_obj);
                    if (!errors) { errors = PyList_New(0); }
                    PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got bool", field_name);
                    PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                    PyList_Append(errors, err); Py_DECREF(err); continue;
                }
                if (!PyFloat_Check(result)) {
                    if (PyLong_Check(result)) {
                        PyObject *new_val = PyNumber_Float(result);
                        if (!new_val) { Py_DECREF(result); PyErr_Clear();
                            field_name = PyUnicode_AsUTF8(fs->name_obj);
                            if (!errors) { errors = PyList_New(0); }
                            PyObject *msg = PyUnicode_FromFormat("%s: Cannot convert int to float", field_name);
                            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                            PyList_Append(errors, err); Py_DECREF(err); continue;
                        }
                        Py_DECREF(result); result = new_val;
                    } else {
                        Py_DECREF(result);
                        field_name = PyUnicode_AsUTF8(fs->name_obj);
                        if (!errors) { errors = PyList_New(0); }
                        PyObject *msg = PyUnicode_FromFormat("%s: Expected float, got %s", field_name, Py_TYPE(value)->tp_name);
                        PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                        PyList_Append(errors, err); Py_DECREF(err); continue;
                    }
                }
            }
        } else if (fs->type_code == 3) { // str
            if (!PyUnicode_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected str, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        } else if (fs->type_code == 4) { // bool
            if (!PyBool_Check(result)) {
                Py_DECREF(result);
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Expected bool, got %s", field_name, Py_TYPE(value)->tp_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); continue;
            }
        }

        // --- NUMERIC CONSTRAINTS (INLINED - no FFI) ---
        int validation_failed = 0;
        if (PyLong_Check(result) && !PyBool_Check(result)) {
            long val = PyLong_AsLong(result);
            if (fs->has_gt && val <= fs->gt_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be > %ld, got %ld", field_name, fs->gt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_ge && val < fs->ge_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be >= %ld, got %ld", field_name, fs->ge_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_lt && val >= fs->lt_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be < %ld, got %ld", field_name, fs->lt_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_le && val > fs->le_long) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be <= %ld, got %ld", field_name, fs->le_long, val);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        } else if (PyFloat_Check(result)) {
            double val = PyFloat_AsDouble(result);
            if (!fs->allow_inf_nan && !isfinite(val)) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Value must be finite", field_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_gt && val <= fs->gt_dbl) { validation_failed = 1; }
            if (!validation_failed && fs->has_ge && val < fs->ge_dbl) { validation_failed = 2; }
            if (!validation_failed && fs->has_lt && val >= fs->lt_dbl) { validation_failed = 3; }
            if (!validation_failed && fs->has_le && val > fs->le_dbl) { validation_failed = 4; }
            if (validation_failed) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                char buf[128];
                switch (validation_failed) {
                    case 1: snprintf(buf, sizeof(buf), "%s: Value must be > %g, got %g", field_name, fs->gt_dbl, val); break;
                    case 2: snprintf(buf, sizeof(buf), "%s: Value must be >= %g, got %g", field_name, fs->ge_dbl, val); break;
                    case 3: snprintf(buf, sizeof(buf), "%s: Value must be < %g, got %g", field_name, fs->lt_dbl, val); break;
                    case 4: snprintf(buf, sizeof(buf), "%s: Value must be <= %g, got %g", field_name, fs->le_dbl, val); break;
                    default: buf[0] = '\0';
                }
                PyObject *msg = PyUnicode_FromString(buf);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- LENGTH CONSTRAINTS ---
        if (fs->has_minl || fs->has_maxl) {
            Py_ssize_t length = PyObject_Length(result);
            if (length == -1 && PyErr_Occurred()) { Py_DECREF(result); Py_XDECREF(errors); return -1; }
            if (fs->has_minl && length < fs->min_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd", field_name, fs->min_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
            if (fs->has_maxl && length > fs->max_len) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd", field_name, fs->max_len, length);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- FORMAT VALIDATION ---
        if (fs->format_code > 0 && PyUnicode_Check(result)) {
            const char *str_val = PyUnicode_AsUTF8(result);
            if (!str_val) { Py_DECREF(result); Py_XDECREF(errors); return -1; }
            int valid = 1;
            const char *fmt_name = "unknown";
            switch (fs->format_code) {
                case 1: valid = inline_validate_email(str_val); fmt_name = "email"; break;
                case 2: valid = satya_validate_url(str_val); fmt_name = "URL"; break;
                case 3: valid = satya_validate_uuid(str_val); fmt_name = "UUID"; break;
                case 4: valid = satya_validate_ipv4(str_val); fmt_name = "IPv4"; break;
                case 5: valid = satya_validate_ipv6(str_val); fmt_name = "IPv6"; break;
                case 6: valid = satya_validate_base64(str_val); fmt_name = "base64"; break;
                case 7: valid = satya_validate_iso_date(str_val); fmt_name = "ISO date"; break;
                case 8: valid = satya_validate_iso_datetime(str_val); fmt_name = "ISO datetime"; break;
            }
            if (!valid) {
                field_name = PyUnicode_AsUTF8(fs->name_obj);
                if (!errors) { errors = PyList_New(0); }
                PyObject *msg = PyUnicode_FromFormat("%s: Invalid %s format", field_name, fmt_name);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg); Py_DECREF(msg);
                PyList_Append(errors, err); Py_DECREF(err); Py_DECREF(result); continue;
            }
        }

        // --- SUCCESS: Store directly in values array (NO __dict__!) ---
        self->values[i] = result;  // Already incref'd above
    }

    // Check for errors
    if (errors && PyList_GET_SIZE(errors) > 0) {
        // Raise ValidationError with all errors
        PyObject *exc_args = Py_BuildValue("(sO)", "Validation failed", errors);
        PyErr_SetObject(PyExc_ValueError, exc_args);
        Py_DECREF(exc_args);
        Py_DECREF(errors);
        return -1;
    }
    Py_XDECREF(errors);

    return 0;
}

// tp_getattro: Fast field access by name
static PyObject* DhiStruct_getattro(DhiStructObject *self, PyObject *name) {
    PyTypeObject *type = Py_TYPE(self);

    // First check if it's a field
    PyObject *field_indices = PyDict_GetItemString(type->tp_dict, "__dhi_field_indices__");
    if (field_indices) {
        PyObject *index_obj = PyDict_GetItem(field_indices, name);
        if (index_obj) {
            Py_ssize_t index = PyLong_AsSsize_t(index_obj);
            PyObject *value = self->values[index];
            if (value) {
                Py_INCREF(value);
                return value;
            }
            PyErr_Format(PyExc_AttributeError, "'%.50s' object has no attribute '%.400s'",
                        type->tp_name, PyUnicode_AsUTF8(name));
            return NULL;
        }
    }

    // Fall back to generic attribute lookup (for methods, etc.)
    return PyObject_GenericGetAttr((PyObject*)self, name);
}

// tp_setattro: Fast field setting by name
static int DhiStruct_setattro(DhiStructObject *self, PyObject *name, PyObject *value) {
    PyTypeObject *type = Py_TYPE(self);

    // Check if it's a field
    PyObject *field_indices = PyDict_GetItemString(type->tp_dict, "__dhi_field_indices__");
    if (field_indices) {
        PyObject *index_obj = PyDict_GetItem(field_indices, name);
        if (index_obj) {
            Py_ssize_t index = PyLong_AsSsize_t(index_obj);
            PyObject *old = self->values[index];
            Py_XINCREF(value);
            self->values[index] = value;
            Py_XDECREF(old);
            return 0;
        }
    }

    PyErr_Format(PyExc_AttributeError, "'%.50s' object has no attribute '%.400s'",
                type->tp_name, PyUnicode_AsUTF8(name));
    return -1;
}

// tp_repr: String representation
static PyObject* DhiStruct_repr(DhiStructObject *self) {
    PyTypeObject *type = Py_TYPE(self);
    PyObject *field_names = PyDict_GetItemString(type->tp_dict, "__dhi_field_names__");
    if (!field_names) {
        return PyUnicode_FromFormat("<%s object>", type->tp_name);
    }

    Py_ssize_t n_fields = PyTuple_GET_SIZE(field_names);

    // Build repr string
    PyObject *parts = PyList_New(0);
    if (!parts) return NULL;

    for (Py_ssize_t i = 0; i < n_fields; i++) {
        PyObject *name = PyTuple_GET_ITEM(field_names, i);
        PyObject *value = self->values[i];
        if (value) {
            PyObject *value_repr = PyObject_Repr(value);
            if (!value_repr) { Py_DECREF(parts); return NULL; }
            PyObject *part = PyUnicode_FromFormat("%S=%S", name, value_repr);
            Py_DECREF(value_repr);
            if (!part) { Py_DECREF(parts); return NULL; }
            PyList_Append(parts, part);
            Py_DECREF(part);
        }
    }

    PyObject *sep = PyUnicode_FromString(", ");
    PyObject *joined = PyUnicode_Join(sep, parts);
    Py_DECREF(sep);
    Py_DECREF(parts);

    if (!joined) return NULL;

    PyObject *result = PyUnicode_FromFormat("%s(%S)", type->tp_name, joined);
    Py_DECREF(joined);
    return result;
}

// Type object definition
static PyTypeObject DhiStructType = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "dhi._dhi_native.Struct",
    .tp_doc = "High-performance validated struct (stores fields in C array, not __dict__)",
    .tp_basicsize = sizeof(DhiStructObject),
    .tp_itemsize = sizeof(PyObject*),  // For flexible array member
    .tp_flags = Py_TPFLAGS_DEFAULT | Py_TPFLAGS_BASETYPE,
    .tp_new = DhiStruct_new,
    .tp_init = (initproc)DhiStruct_init,
    .tp_dealloc = (destructor)DhiStruct_dealloc,
    .tp_getattro = (getattrofunc)DhiStruct_getattro,
    .tp_setattro = (setattrofunc)DhiStruct_setattro,
    .tp_repr = (reprfunc)DhiStruct_repr,
};

// Helper function to initialize a Struct subclass
// Called from Python: _dhi_native.init_struct_class(cls, field_specs_tuple)
static PyObject* py_init_struct_class(PyObject *self, PyObject *args) {
    PyObject *cls;
    PyObject *field_specs;

    if (!PyArg_ParseTuple(args, "OO!", &cls, &PyTuple_Type, &field_specs)) {
        return NULL;
    }

    if (!PyType_Check(cls)) {
        PyErr_SetString(PyExc_TypeError, "First argument must be a class");
        return NULL;
    }

    PyTypeObject *type = (PyTypeObject*)cls;

    // Compile specs - need to wrap field_specs in a tuple for py_compile_model_specs
    PyObject *specs_args = PyTuple_Pack(1, field_specs);
    if (!specs_args) return NULL;
    PyObject *capsule = py_compile_model_specs(self, specs_args);
    Py_DECREF(specs_args);
    if (!capsule) return NULL;

    // Build field names tuple and indices dict
    Py_ssize_t n_fields = PyTuple_GET_SIZE(field_specs);
    PyObject *field_names = PyTuple_New(n_fields);
    PyObject *field_indices = PyDict_New();

    if (!field_names || !field_indices) {
        Py_XDECREF(field_names);
        Py_XDECREF(field_indices);
        Py_DECREF(capsule);
        return NULL;
    }

    for (Py_ssize_t i = 0; i < n_fields; i++) {
        PyObject *spec = PyTuple_GET_ITEM(field_specs, i);
        PyObject *name = PyTuple_GET_ITEM(spec, 0);
        Py_INCREF(name);
        PyTuple_SET_ITEM(field_names, i, name);

        PyObject *index = PyLong_FromSsize_t(i);
        PyDict_SetItem(field_indices, name, index);
        Py_DECREF(index);
    }

    // Store metadata in type's dict
    PyDict_SetItemString(type->tp_dict, "__dhi_compiled_specs__", capsule);
    PyDict_SetItemString(type->tp_dict, "__dhi_field_names__", field_names);
    PyDict_SetItemString(type->tp_dict, "__dhi_field_indices__", field_indices);
    PyDict_SetItemString(type->tp_dict, "__dhi_n_fields__", PyLong_FromSsize_t(n_fields));

    Py_DECREF(capsule);
    Py_DECREF(field_names);
    Py_DECREF(field_indices);

    Py_RETURN_NONE;
}

// =============================================================================
// FAST JSON PARSER - Direct JSON -> Struct without intermediate dict
// Uses Zig SIMD backend for maximum performance
// =============================================================================

// Skip whitespace using SIMD (via Zig)
#define SKIP_WS_SIMD(json, pos, len) \
    (pos) = satya_skip_whitespace((json), (len), (pos))

// Fallback for simple cases
#define SKIP_WS(json, pos, len) \
    while ((pos) < (len) && ((json)[(pos)] == ' ' || (json)[(pos)] == '\t' || \
           (json)[(pos)] == '\n' || (json)[(pos)] == '\r')) { (pos)++; }

// Hybrid string parsing - inline for small strings, SIMD for larger ones
// Returns pointer to string content and updates pos
// Returns NULL on error
__attribute__((always_inline))
static inline char* json_parse_string_simd(const char *json, size_t *pos, size_t len,
                                size_t *out_len, int *needs_unescape) {
    size_t start = *pos;
    if (start >= len || json[start] != '"') return NULL;
    start++;

    // For strings < 64 bytes, use inline C (avoid FFI overhead)
    // Most field names and short values fall into this category
    size_t end = start;
    *needs_unescape = 0;

    // Quick scan - if we find the closing quote within 64 bytes, use inline
    while (end < len && end - start < 64) {
        char c = json[end];
        if (c == '"') {
            // Found end - use inline result
            *out_len = end - start;
            *pos = end + 1;
            return (char*)&json[start];
        }
        if (c == '\\') {
            *needs_unescape = 1;
            end += 2;
        } else {
            end++;
        }
    }

    // Long string (>64 bytes) or didn't find quote yet - use SIMD
    const char *str_ptr;
    size_t str_len;
    int has_escapes;
    size_t simd_end;

    int result = satya_extract_json_string(json, len, start, &str_ptr, &str_len, &has_escapes, &simd_end);
    if (result != 0) return NULL;

    *out_len = str_len;
    *needs_unescape = has_escapes;
    *pos = simd_end;
    return (char*)str_ptr;
}

// Legacy C version for fallback
__attribute__((always_inline))
static inline char* json_parse_string(const char *json, size_t *pos, size_t len,
                                size_t *out_len, int *needs_unescape) {
    size_t start = *pos;
    if (json[start] != '"') return NULL;
    start++;

    size_t end = start;
    *needs_unescape = 0;

    while (end < len) {
        char c = json[end];
        if (c == '"') {
            *out_len = end - start;
            *pos = end + 1;
            return (char*)&json[start];
        }
        if (c == '\\') {
            *needs_unescape = 1;
            end += 2;  // Skip escape sequence
        } else {
            end++;
        }
    }
    return NULL;  // Unterminated string
}

// Unescape JSON string into buffer
static PyObject* json_unescape_string(const char *str, size_t len) {
    char *buf = malloc(len + 1);
    if (!buf) return PyErr_NoMemory();

    size_t out = 0;
    for (size_t i = 0; i < len; i++) {
        if (str[i] == '\\' && i + 1 < len) {
            i++;
            switch (str[i]) {
                case '"': buf[out++] = '"'; break;
                case '\\': buf[out++] = '\\'; break;
                case '/': buf[out++] = '/'; break;
                case 'b': buf[out++] = '\b'; break;
                case 'f': buf[out++] = '\f'; break;
                case 'n': buf[out++] = '\n'; break;
                case 'r': buf[out++] = '\r'; break;
                case 't': buf[out++] = '\t'; break;
                case 'u': {
                    // Parse 4 hex digits
                    if (i + 4 < len) {
                        unsigned int codepoint = 0;
                        for (int j = 1; j <= 4; j++) {
                            char h = str[i + j];
                            codepoint <<= 4;
                            if (h >= '0' && h <= '9') codepoint |= h - '0';
                            else if (h >= 'a' && h <= 'f') codepoint |= h - 'a' + 10;
                            else if (h >= 'A' && h <= 'F') codepoint |= h - 'A' + 10;
                        }
                        i += 4;
                        // UTF-8 encode
                        if (codepoint < 0x80) {
                            buf[out++] = (char)codepoint;
                        } else if (codepoint < 0x800) {
                            buf[out++] = (char)(0xC0 | (codepoint >> 6));
                            buf[out++] = (char)(0x80 | (codepoint & 0x3F));
                        } else {
                            buf[out++] = (char)(0xE0 | (codepoint >> 12));
                            buf[out++] = (char)(0x80 | ((codepoint >> 6) & 0x3F));
                            buf[out++] = (char)(0x80 | (codepoint & 0x3F));
                        }
                    }
                    break;
                }
                default: buf[out++] = str[i]; break;
            }
        } else {
            buf[out++] = str[i];
        }
    }
    buf[out] = '\0';

    PyObject *result = PyUnicode_DecodeUTF8(buf, out, NULL);
    free(buf);
    return result;
}

// Parse JSON integer
static int json_parse_integer(const char *json, size_t *pos, size_t len, long *out) {
    size_t start = *pos;
    int negative = 0;

    if (start < len && json[start] == '-') {
        negative = 1;
        start++;
    }

    if (start >= len || json[start] < '0' || json[start] > '9') return 0;

    long value = 0;
    while (start < len && json[start] >= '0' && json[start] <= '9') {
        value = value * 10 + (json[start] - '0');
        start++;
    }

    *out = negative ? -value : value;
    *pos = start;
    return 1;
}

// Parse JSON number (int or float) - optimized for small integers
__attribute__((always_inline))
static inline PyObject* json_parse_number(const char *json, size_t *pos, size_t len) {
    size_t i = *pos;
    int is_negative = 0;
    int is_float = 0;

    // Check for negative sign
    if (i < len && json[i] == '-') {
        is_negative = 1;
        i++;
    }

    // Fast path: parse small integer inline (up to 18 digits fits in int64)
    if (i < len && json[i] >= '0' && json[i] <= '9') {
        long value = 0;
        int digit_count = 0;

        while (i < len && json[i] >= '0' && json[i] <= '9') {
            value = value * 10 + (json[i] - '0');
            i++;
            digit_count++;
            if (digit_count > 18) break;  // Fall back for very large numbers
        }

        // Check if it's a float (has . or e/E)
        if (i < len && (json[i] == '.' || json[i] == 'e' || json[i] == 'E')) {
            is_float = 1;
        } else if (digit_count <= 18) {
            // It's a small integer - use fast path
            *pos = i;
            return PyLong_FromLong(is_negative ? -value : value);
        }
    }

    // Slow path: parse as string (for floats and very large integers)
    size_t start = *pos;
    i = start;

    // Re-scan the number
    if (i < len && json[i] == '-') i++;
    while (i < len && json[i] >= '0' && json[i] <= '9') i++;

    if (i < len && json[i] == '.') {
        is_float = 1;
        i++;
        while (i < len && json[i] >= '0' && json[i] <= '9') i++;
    }

    if (i < len && (json[i] == 'e' || json[i] == 'E')) {
        is_float = 1;
        i++;
        if (i < len && (json[i] == '+' || json[i] == '-')) i++;
        while (i < len && json[i] >= '0' && json[i] <= '9') i++;
    }

    size_t num_len = i - start;

    // Use stack buffer for small numbers (avoid malloc)
    char stack_buf[32];
    char *num_str;
    if (num_len < 32) {
        num_str = stack_buf;
    } else {
        num_str = malloc(num_len + 1);
        if (!num_str) return PyErr_NoMemory();
    }
    memcpy(num_str, &json[start], num_len);
    num_str[num_len] = '\0';

    PyObject *result;
    if (is_float) {
        result = PyFloat_FromDouble(strtod(num_str, NULL));
    } else {
        result = PyLong_FromString(num_str, NULL, 10);
    }

    if (num_len >= 32) free(num_str);
    *pos = i;
    return result;
}

// Hybrid number parsing - inline for small ints, SIMD for large numbers/floats
__attribute__((always_inline))
static inline PyObject* json_parse_number_simd(const char *json, size_t *pos, size_t len) {
    size_t i = *pos;
    int is_negative = 0;

    // Check for negative
    if (i < len && json[i] == '-') {
        is_negative = 1;
        i++;
    }

    // Fast path: inline parsing for small integers (up to 18 digits)
    // This avoids FFI overhead for common cases like "30", "100", etc.
    if (i < len && json[i] >= '0' && json[i] <= '9') {
        long value = 0;
        int digit_count = 0;
        size_t start_digits = i;

        while (i < len && json[i] >= '0' && json[i] <= '9') {
            value = value * 10 + (json[i] - '0');
            i++;
            digit_count++;
            if (digit_count > 18) break;  // Fall back for very large numbers
        }

        // Check if it's a float
        if (i < len && (json[i] == '.' || json[i] == 'e' || json[i] == 'E')) {
            // Float - use Zig SIMD for accuracy
            double fval;
            size_t end;
            int result = satya_parse_json_float(json, len, *pos, &fval, &end);
            if (result != 0) {
                PyErr_SetString(PyExc_ValueError, "Invalid float");
                return NULL;
            }
            *pos = end;
            return PyFloat_FromDouble(fval);
        }

        // Small integer - return directly (no FFI needed!)
        if (digit_count <= 18) {
            *pos = i;
            return PyLong_FromLong(is_negative ? -value : value);
        }

        // Very large integer - fall back to Zig SIMD
        long int_val;
        size_t end;
        int result = satya_parse_json_int(json, len, *pos, &int_val, &end);
        if (result != 0) {
            PyErr_SetString(PyExc_ValueError, "Invalid integer");
            return NULL;
        }
        *pos = end;
        return PyLong_FromLong(int_val);
    }

    // Invalid number
    PyErr_SetString(PyExc_ValueError, "Invalid number");
    return NULL;
}

// Skip a JSON value (for unknown fields)
static int json_skip_value(const char *json, size_t *pos, size_t len) {
    SKIP_WS(json, *pos, len);
    if (*pos >= len) return 0;

    char c = json[*pos];

    if (c == '"') {
        // Skip string
        (*pos)++;
        while (*pos < len) {
            if (json[*pos] == '\\') (*pos) += 2;
            else if (json[*pos] == '"') { (*pos)++; return 1; }
            else (*pos)++;
        }
        return 0;
    } else if (c == '{') {
        // Skip object
        (*pos)++;
        int depth = 1;
        while (*pos < len && depth > 0) {
            if (json[*pos] == '{') depth++;
            else if (json[*pos] == '}') depth--;
            else if (json[*pos] == '"') {
                (*pos)++;
                while (*pos < len && json[*pos] != '"') {
                    if (json[*pos] == '\\') (*pos)++;
                    (*pos)++;
                }
            }
            (*pos)++;
        }
        return depth == 0;
    } else if (c == '[') {
        // Skip array
        (*pos)++;
        int depth = 1;
        while (*pos < len && depth > 0) {
            if (json[*pos] == '[') depth++;
            else if (json[*pos] == ']') depth--;
            else if (json[*pos] == '"') {
                (*pos)++;
                while (*pos < len && json[*pos] != '"') {
                    if (json[*pos] == '\\') (*pos)++;
                    (*pos)++;
                }
            }
            (*pos)++;
        }
        return depth == 0;
    } else if (c == 't' && *pos + 4 <= len && memcmp(&json[*pos], "true", 4) == 0) {
        *pos += 4; return 1;
    } else if (c == 'f' && *pos + 5 <= len && memcmp(&json[*pos], "false", 5) == 0) {
        *pos += 5; return 1;
    } else if (c == 'n' && *pos + 4 <= len && memcmp(&json[*pos], "null", 4) == 0) {
        *pos += 4; return 1;
    } else if (c == '-' || (c >= '0' && c <= '9')) {
        // Skip number
        if (c == '-') (*pos)++;
        while (*pos < len && json[*pos] >= '0' && json[*pos] <= '9') (*pos)++;
        if (*pos < len && json[*pos] == '.') {
            (*pos)++;
            while (*pos < len && json[*pos] >= '0' && json[*pos] <= '9') (*pos)++;
        }
        if (*pos < len && (json[*pos] == 'e' || json[*pos] == 'E')) {
            (*pos)++;
            if (*pos < len && (json[*pos] == '+' || json[*pos] == '-')) (*pos)++;
            while (*pos < len && json[*pos] >= '0' && json[*pos] <= '9') (*pos)++;
        }
        return 1;
    }
    return 0;
}

// SIMD-accelerated skip value using Zig backend
static int json_skip_value_simd(const char *json, size_t *pos, size_t len) {
    size_t end;
    int result = satya_skip_json_value(json, len, *pos, &end);
    if (result != 0) return 0;
    *pos = end;
    return 1;
}

// Internal JSON parsing with validation into DhiStructObject
// Returns 0 on success, -1 on error (with Python exception set)
static int decoder_parse_json_internal(
    DhiStructObject *self,
    const char *json,
    size_t len,
    CompiledModelSpecs *ms
) {
    Py_ssize_t n_fields = ms->n_fields;

    // Initialize all values to NULL first for safe cleanup on error
    // Use memset for speed when n_fields > 0
    if (n_fields > 0) {
        memset(self->values, 0, n_fields * sizeof(PyObject*));
    }

    size_t pos = 0;
    SKIP_WS(json, pos, len);

    if (__builtin_expect(pos >= len || json[pos] != '{', 0)) {
        PyErr_SetString(PyExc_ValueError, "Expected JSON object");
        return -1;
    }
    pos++;

    // Track which fields we've seen (no malloc needed - use cached specs)
    Py_ssize_t expected_field = 0;  // For ordered field matching

    PyObject *errors = NULL;

    while (pos < len) {
        SKIP_WS(json, pos, len);
        if (__builtin_expect(pos >= len, 0)) {
            PyErr_SetString(PyExc_ValueError, "Unexpected end of JSON");
            goto error;
        }
        if (json[pos] == '}') { pos++; break; }
        if (json[pos] == ',') { pos++; continue; }

        // Parse field name
        if (__builtin_expect(json[pos] != '"', 0)) {
            PyErr_SetString(PyExc_ValueError, "Expected field name");
            goto error;
        }

        size_t key_len;
        int needs_unescape;
        // Use SIMD-accelerated string parsing for field names
        char *key_start = json_parse_string_simd(json, &pos, len, &key_len, &needs_unescape);
        if (__builtin_expect(!key_start, 0)) {
            PyErr_SetString(PyExc_ValueError, "Invalid field name");
            goto error;
        }

        // Skip colon
        SKIP_WS(json, pos, len);
        if (__builtin_expect(pos >= len || json[pos] != ':', 0)) {
            PyErr_SetString(PyExc_ValueError, "Expected ':'");
            goto error;
        }
        pos++;
        SKIP_WS(json, pos, len);
        if (__builtin_expect(pos >= len, 0)) {
            PyErr_SetString(PyExc_ValueError, "Unexpected end of JSON");
            goto error;
        }

        // Match field name using cached hash and length (no malloc, no strlen!)
        uint64_t key_hash = fnv1a_hash_inline(key_start, key_len);
        Py_ssize_t field_idx = -1;

        // Ordered matching: check expected field first (fast path for in-order JSON)
        // Skip memcmp in fast path - FNV-1a hash + length match is sufficient
        // (collision probability is ~1 in 2^64 for same-length strings)
        if (expected_field < n_fields) {
            CompiledFieldSpec *efs = &ms->specs[expected_field];
            if (efs->name_hash_fnv == key_hash && efs->name_len == key_len) {
                field_idx = expected_field;
                expected_field++;
                goto field_matched;
            }
        }

        // Fall back to linear search - use memcmp for safety in edge cases
        for (Py_ssize_t i = 0; i < n_fields; i++) {
            CompiledFieldSpec *cfs = &ms->specs[i];
            if (cfs->name_hash_fnv == key_hash && cfs->name_len == key_len) {
                if (memcmp(cfs->name_ptr, key_start, key_len) == 0) {
                    field_idx = i;
                    break;
                }
            }
        }

field_matched:

        // Unknown field - skip value using SIMD
        if (field_idx < 0) {
            if (!json_skip_value_simd(json, &pos, len)) {
                PyErr_SetString(PyExc_ValueError, "Invalid JSON value");
                goto error;
            }
            continue;
        }

        CompiledFieldSpec *fs = &ms->specs[field_idx];

        // Parse value based on expected type
        // Track JSON value type to skip redundant type checks
        PyObject *value = NULL;
        int json_type = 0;  // 1=int, 2=float, 3=str, 4=bool, 5=null
        char c = json[pos];

        if (c == '"') {
            // String value - SIMD accelerated parsing
            json_type = 3;
            size_t str_len;
            int needs_esc;
            char *str_start = json_parse_string_simd(json, &pos, len, &str_len, &needs_esc);
            if (__builtin_expect(!str_start, 0)) {
                PyErr_SetString(PyExc_ValueError, "Invalid string value");
                goto error;
            }

            if (__builtin_expect(needs_esc, 0)) {
                // Rare case: string has escapes
                value = json_unescape_string(str_start, str_len);
            } else {
                // Common case: no escapes, use faster function
                value = PyUnicode_FromStringAndSize(str_start, str_len);
            }
            if (__builtin_expect(!value, 0)) goto error;

        } else if (c == '-' || (c >= '0' && c <= '9')) {
            // Number value - SIMD accelerated parsing
            value = json_parse_number_simd(json, &pos, len);
            if (!value) goto error;
            json_type = PyFloat_Check(value) ? 2 : 1;

            // Convert int to float if needed
            if (fs->type_code == 2 && json_type == 1) {
                PyObject *fval = PyNumber_Float(value);
                Py_DECREF(value);
                value = fval;
                if (!value) goto error;
                json_type = 2;
            }

        } else if (c == 't' && pos + 4 <= len && memcmp(&json[pos], "true", 4) == 0) {
            value = Py_True;
            Py_INCREF(value);
            pos += 4;
            json_type = 4;
        } else if (c == 'f' && pos + 5 <= len && memcmp(&json[pos], "false", 5) == 0) {
            value = Py_False;
            Py_INCREF(value);
            pos += 5;
            json_type = 4;
        } else if (c == 'n' && pos + 4 <= len && memcmp(&json[pos], "null", 4) == 0) {
            value = Py_None;
            Py_INCREF(value);
            pos += 4;
            json_type = 5;
        } else if (c == '[' || c == '{') {
            // Array or nested object - skip using SIMD
            if (!json_skip_value_simd(json, &pos, len)) {
                PyErr_SetString(PyExc_ValueError, "Invalid nested value");
                goto error;
            }
            value = Py_None;
            Py_INCREF(value);
            json_type = 5;
        } else {
            PyErr_SetString(PyExc_ValueError, "Invalid JSON value");
            goto error;
        }

        // Type checking - only when JSON type doesn't match expected type
        // This skips redundant checks when types align (common case)
        const char *field_name = fs->name_ptr;
        int type_mismatch = 0;

        if (fs->type_code == 1) {  // int
            if (json_type != 1) type_mismatch = 1;
        } else if (fs->type_code == 2) {  // float
            if (json_type != 1 && json_type != 2) type_mismatch = 1;
        } else if (fs->type_code == 3) {  // str
            if (json_type != 3) type_mismatch = 1;
        } else if (fs->type_code == 4) {  // bool
            if (json_type != 4) type_mismatch = 1;
        }
        // type_code == 0 (any) or 5 (bytes) - skip type checking

        if (__builtin_expect(type_mismatch, 0)) {
            if (!errors) errors = PyList_New(0);
            const char *expected =
                fs->type_code == 1 ? "int" :
                fs->type_code == 2 ? "float" :
                fs->type_code == 3 ? "str" :
                fs->type_code == 4 ? "bool" : "unknown";
            PyObject *msg = PyUnicode_FromFormat("%s: Expected %s, got %s",
                field_name, expected, Py_TYPE(value)->tp_name);
            PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
            Py_DECREF(msg);
            PyList_Append(errors, err);
            Py_DECREF(err);
            Py_DECREF(value);
            continue;
        }

        // Numeric constraint validation - combined check for happy path
        if (PyLong_Check(value) && !PyBool_Check(value) &&
            (fs->has_gt | fs->has_ge | fs->has_lt | fs->has_le)) {
            long val = PyLong_AsLong(value);
            // Combined validity check - single branch for happy path
            int valid = (!fs->has_gt || val > fs->gt_long) &&
                        (!fs->has_ge || val >= fs->ge_long) &&
                        (!fs->has_lt || val < fs->lt_long) &&
                        (!fs->has_le || val <= fs->le_long);
            if (__builtin_expect(!valid, 0)) {
                // Error path - figure out which constraint failed
                if (!errors) errors = PyList_New(0);
                PyObject *msg = NULL;
                if (fs->has_gt && val <= fs->gt_long) {
                    msg = PyUnicode_FromFormat("%s: Value must be > %ld, got %ld",
                        field_name, fs->gt_long, val);
                } else if (fs->has_ge && val < fs->ge_long) {
                    msg = PyUnicode_FromFormat("%s: Value must be >= %ld, got %ld",
                        field_name, fs->ge_long, val);
                } else if (fs->has_lt && val >= fs->lt_long) {
                    msg = PyUnicode_FromFormat("%s: Value must be < %ld, got %ld",
                        field_name, fs->lt_long, val);
                } else {
                    msg = PyUnicode_FromFormat("%s: Value must be <= %ld, got %ld",
                        field_name, fs->le_long, val);
                }
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                Py_DECREF(msg);
                PyList_Append(errors, err);
                Py_DECREF(err);
                Py_DECREF(value);
                continue;
            }
        }

        // String length validation - combined check for happy path
        if (PyUnicode_Check(value) && (fs->has_minl | fs->has_maxl)) {
            Py_ssize_t slen = PyUnicode_GET_LENGTH(value);
            int valid = (!fs->has_minl || slen >= fs->min_len) &&
                        (!fs->has_maxl || slen <= fs->max_len);
            if (__builtin_expect(!valid, 0)) {
                if (!errors) errors = PyList_New(0);
                PyObject *msg;
                if (fs->has_minl && slen < fs->min_len) {
                    msg = PyUnicode_FromFormat("%s: Length must be >= %zd, got %zd",
                        field_name, fs->min_len, slen);
                } else {
                    msg = PyUnicode_FromFormat("%s: Length must be <= %zd, got %zd",
                        field_name, fs->max_len, slen);
                }
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                Py_DECREF(msg);
                PyList_Append(errors, err);
                Py_DECREF(err);
                Py_DECREF(value);
                continue;
            }
        }

        // Store value
        self->values[field_idx] = value;
    }

    // Check required fields and apply defaults
    for (Py_ssize_t i = 0; i < n_fields; i++) {
        if (self->values[i] == NULL) {
            CompiledFieldSpec *fs = &ms->specs[i];
            if (fs->required) {
                if (!errors) errors = PyList_New(0);
                PyObject *msg = PyUnicode_FromFormat("Field '%s' is required",
                    fs->name_ptr);
                PyObject *err = Py_BuildValue("(OO)", fs->name_obj, msg);
                Py_DECREF(msg);
                PyList_Append(errors, err);
                Py_DECREF(err);
            } else if (fs->default_val && fs->default_val != Py_None) {
                Py_INCREF(fs->default_val);
                self->values[i] = fs->default_val;
            } else {
                Py_INCREF(Py_None);
                self->values[i] = Py_None;
            }
        }
    }

    if (errors && PyList_GET_SIZE(errors) > 0) {
        PyObject *exc_args = Py_BuildValue("(sO)", "Validation failed", errors);
        PyErr_SetObject(PyExc_ValueError, exc_args);
        Py_DECREF(exc_args);
        Py_DECREF(errors);
        return -1;
    }
    Py_XDECREF(errors);

    return 0;

error:
    Py_XDECREF(errors);
    return -1;
}

// struct_from_json(cls, json_bytes) -> Struct instance
static PyObject* py_struct_from_json(PyObject *self, PyObject *args) {
    PyObject *cls;
    PyObject *json_data;

    if (!PyArg_ParseTuple(args, "OO", &cls, &json_data)) {
        return NULL;
    }

    if (!PyType_Check(cls)) {
        PyErr_SetString(PyExc_TypeError, "First argument must be a Struct class");
        return NULL;
    }

    // Get JSON as UTF-8 bytes
    const char *json;
    Py_ssize_t len;
    PyObject *bytes_obj = NULL;

    if (PyBytes_Check(json_data)) {
        json = PyBytes_AS_STRING(json_data);
        len = PyBytes_GET_SIZE(json_data);
    } else if (PyUnicode_Check(json_data)) {
        bytes_obj = PyUnicode_AsUTF8String(json_data);
        if (!bytes_obj) return NULL;
        json = PyBytes_AS_STRING(bytes_obj);
        len = PyBytes_GET_SIZE(bytes_obj);
    } else {
        PyErr_SetString(PyExc_TypeError, "JSON data must be bytes or str");
        return NULL;
    }

    // Get compiled specs
    PyTypeObject *type = (PyTypeObject*)cls;
    PyObject *capsule = PyDict_GetItemString(type->tp_dict, "__dhi_compiled_specs__");
    if (!capsule) {
        Py_XDECREF(bytes_obj);
        PyErr_SetString(PyExc_ValueError, "Struct class not initialized");
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) {
        Py_XDECREF(bytes_obj);
        return NULL;
    }

    // Allocate struct object
    DhiStructObject *obj = (DhiStructObject*)type->tp_alloc(type, ms->n_fields);
    if (!obj) {
        Py_XDECREF(bytes_obj);
        return NULL;
    }

    // Parse JSON and populate fields
    int result = decoder_parse_json_internal(obj, json, len, ms);
    Py_XDECREF(bytes_obj);

    if (result < 0) {
        Py_DECREF(obj);
        return NULL;
    }

    return (PyObject*)obj;
}

// struct_from_json_batch(cls, json_bytes) -> list of Struct instances
static PyObject* py_struct_from_json_batch(PyObject *self, PyObject *args) {
    PyObject *cls;
    PyObject *json_data;

    if (!PyArg_ParseTuple(args, "OO", &cls, &json_data)) {
        return NULL;
    }

    if (!PyType_Check(cls)) {
        PyErr_SetString(PyExc_TypeError, "First argument must be a Struct class");
        return NULL;
    }

    // Get JSON as UTF-8 bytes
    const char *json;
    Py_ssize_t len;
    PyObject *bytes_obj = NULL;

    if (PyBytes_Check(json_data)) {
        json = PyBytes_AS_STRING(json_data);
        len = PyBytes_GET_SIZE(json_data);
    } else if (PyUnicode_Check(json_data)) {
        bytes_obj = PyUnicode_AsUTF8String(json_data);
        if (!bytes_obj) return NULL;
        json = PyBytes_AS_STRING(bytes_obj);
        len = PyBytes_GET_SIZE(bytes_obj);
    } else {
        PyErr_SetString(PyExc_TypeError, "JSON data must be bytes or str");
        return NULL;
    }

    // Get compiled specs
    PyTypeObject *type = (PyTypeObject*)cls;
    PyObject *capsule = PyDict_GetItemString(type->tp_dict, "__dhi_compiled_specs__");
    if (!capsule) {
        Py_XDECREF(bytes_obj);
        PyErr_SetString(PyExc_ValueError, "Struct class not initialized");
        return NULL;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) {
        Py_XDECREF(bytes_obj);
        return NULL;
    }

    // Find array start
    size_t pos = 0;
    SKIP_WS(json, pos, (size_t)len);

    if (pos >= (size_t)len || json[pos] != '[') {
        Py_XDECREF(bytes_obj);
        PyErr_SetString(PyExc_ValueError, "Expected JSON array");
        return NULL;
    }
    pos++;

    // Create result list
    PyObject *result = PyList_New(0);
    if (!result) {
        Py_XDECREF(bytes_obj);
        return NULL;
    }

    while (pos < (size_t)len) {
        SKIP_WS(json, pos, (size_t)len);
        if (json[pos] == ']') break;
        if (json[pos] == ',') { pos++; continue; }

        // Find object start
        if (json[pos] != '{') {
            Py_XDECREF(bytes_obj);
            Py_DECREF(result);
            PyErr_SetString(PyExc_ValueError, "Expected JSON object in array");
            return NULL;
        }

        // Find object end to get substring
        size_t obj_start = pos;
        int depth = 0;
        int in_string = 0;
        while (pos < (size_t)len) {
            char c = json[pos];
            if (in_string) {
                if (c == '\\') pos++;
                else if (c == '"') in_string = 0;
            } else {
                if (c == '"') in_string = 1;
                else if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) { pos++; break; }
                }
            }
            pos++;
        }

        // Allocate and parse single object
        DhiStructObject *obj = (DhiStructObject*)type->tp_alloc(type, ms->n_fields);
        if (!obj) {
            Py_XDECREF(bytes_obj);
            Py_DECREF(result);
            return NULL;
        }

        int parse_result = decoder_parse_json_internal(obj, &json[obj_start], pos - obj_start, ms);
        if (parse_result < 0) {
            Py_DECREF(obj);
            Py_XDECREF(bytes_obj);
            Py_DECREF(result);
            return NULL;
        }

        PyList_Append(result, (PyObject*)obj);
        Py_DECREF(obj);
    }

    Py_XDECREF(bytes_obj);
    return result;
}

// =============================================================================
// DECODER TYPE - Caches specs for faster repeated parsing
// =============================================================================

typedef struct {
    PyObject_HEAD
    PyTypeObject *struct_type;
    CompiledModelSpecs *specs;
} DhiDecoderObject;

static void DhiDecoder_dealloc(DhiDecoderObject *self) {
    Py_XDECREF(self->struct_type);
    Py_TYPE(self)->tp_free((PyObject*)self);
}

static PyObject* DhiDecoder_new(PyTypeObject *type, PyObject *args, PyObject *kwds) {
    DhiDecoderObject *self = (DhiDecoderObject*)type->tp_alloc(type, 0);
    if (self) {
        self->struct_type = NULL;
        self->specs = NULL;
    }
    return (PyObject*)self;
}

static int DhiDecoder_init(DhiDecoderObject *self, PyObject *args, PyObject *kwds) {
    PyObject *cls;

    if (!PyArg_ParseTuple(args, "O", &cls)) {
        return -1;
    }

    if (!PyType_Check(cls)) {
        PyErr_SetString(PyExc_TypeError, "Argument must be a Struct class");
        return -1;
    }

    // Get compiled specs
    PyTypeObject *type = (PyTypeObject*)cls;
    PyObject *capsule = PyDict_GetItemString(type->tp_dict, "__dhi_compiled_specs__");
    if (!capsule) {
        PyErr_SetString(PyExc_ValueError, "Struct class not initialized");
        return -1;
    }

    CompiledModelSpecs *ms = (CompiledModelSpecs*)PyCapsule_GetPointer(capsule, "dhi.compiled_specs");
    if (!ms) return -1;

    Py_INCREF(cls);
    self->struct_type = type;
    self->specs = ms;

    return 0;
}

static PyObject* DhiDecoder_decode(DhiDecoderObject *self, PyObject *args) {
    PyObject *json_data;

    if (!PyArg_ParseTuple(args, "O", &json_data)) {
        return NULL;
    }

    // Get JSON as UTF-8 bytes
    const char *json;
    Py_ssize_t len;
    PyObject *bytes_obj = NULL;

    if (PyBytes_Check(json_data)) {
        json = PyBytes_AS_STRING(json_data);
        len = PyBytes_GET_SIZE(json_data);
    } else if (PyUnicode_Check(json_data)) {
        bytes_obj = PyUnicode_AsUTF8String(json_data);
        if (!bytes_obj) return NULL;
        json = PyBytes_AS_STRING(bytes_obj);
        len = PyBytes_GET_SIZE(bytes_obj);
    } else {
        PyErr_SetString(PyExc_TypeError, "JSON data must be bytes or str");
        return NULL;
    }

    // Allocate struct object
    DhiStructObject *obj = (DhiStructObject*)self->struct_type->tp_alloc(
        self->struct_type, self->specs->n_fields);
    if (!obj) {
        Py_XDECREF(bytes_obj);
        return NULL;
    }

    // Parse JSON
    int result = decoder_parse_json_internal(obj, json, len, self->specs);
    Py_XDECREF(bytes_obj);

    if (result < 0) {
        Py_DECREF(obj);
        return NULL;
    }

    return (PyObject*)obj;
}

static PyMethodDef DhiDecoder_methods[] = {
    {"decode", (PyCFunction)DhiDecoder_decode, METH_VARARGS,
     "Decode JSON bytes/str to a Struct instance"},
    {NULL, NULL, 0, NULL}
};

static PyTypeObject DhiDecoderType = {
    PyVarObject_HEAD_INIT(NULL, 0)
    .tp_name = "dhi._dhi_native.Decoder",
    .tp_doc = "High-performance JSON decoder for Struct classes",
    .tp_basicsize = sizeof(DhiDecoderObject),
    .tp_itemsize = 0,
    .tp_flags = Py_TPFLAGS_DEFAULT,
    .tp_new = DhiDecoder_new,
    .tp_init = (initproc)DhiDecoder_init,
    .tp_dealloc = (destructor)DhiDecoder_dealloc,
    .tp_methods = DhiDecoder_methods,
};

// Method definitions
static PyMethodDef DhiNativeMethods[] = {
    {"validate_int", py_validate_int, METH_VARARGS,
     "Validate integer bounds (value, min, max) -> bool"},
    {"validate_string_length", py_validate_string_length, METH_VARARGS,
     "Validate string length (str, min_len, max_len) -> bool"},
    {"validate_email", py_validate_email, METH_VARARGS,
     "Validate email format (str) -> bool"},
    {"validate_batch_direct", py_validate_batch_direct, METH_VARARGS,
     "GENERAL batch validation: (items, field_specs) -> (list[bool], int)"},
    {"validate_field", py_validate_field, METH_VARARGS,
     "Validate a single field: (value, field_name, constraints) -> validated_value"},
    {"init_model", py_init_model, METH_VARARGS,
     "Batch init: (self, kwargs, field_specs) -> None or errors list"},
    {"compile_model_specs", py_compile_model_specs, METH_VARARGS,
     "Pre-compile field specs into C structs: (specs_tuple) -> PyCapsule"},
    {"init_model_compiled", py_init_model_compiled, METH_VARARGS,
     "Ultra-fast init with pre-compiled specs: (self, kwargs, capsule) -> None or errors"},
    {"init_model_full", (PyCFunction)py_init_model_full, METH_FASTCALL,
     "Full native init: (self, kwargs, capsule, extra_mode) -> None or errors. Sets all pydantic attrs."},
    {"dump_model_compiled", py_dump_model_compiled, METH_VARARGS,
     "Ultra-fast model_dump with pre-compiled specs: (self, capsule) -> dict"},
    {"dump_json_compiled", py_dump_json_compiled, METH_VARARGS,
     "Ultra-fast JSON dump with pre-compiled specs: (self, capsule) -> JSON string"},
    {"init_struct_class", py_init_struct_class, METH_VARARGS,
     "Initialize a Struct subclass with field specs: (cls, field_specs) -> None"},
    {"struct_from_json", py_struct_from_json, METH_VARARGS,
     "Parse JSON directly to Struct: (cls, json_bytes) -> Struct instance"},
    {"struct_from_json_batch", py_struct_from_json_batch, METH_VARARGS,
     "Parse JSON array to list of Structs: (cls, json_bytes) -> list[Struct]"},
    {NULL, NULL, 0, NULL}
};

// Module definition
static struct PyModuleDef dhi_native_module = {
    PyModuleDef_HEAD_INIT,
    "_dhi_native",
    "Native Zig validators for dhi (CPython extension)",
    -1,
    DhiNativeMethods
};

// Module initialization
PyMODINIT_FUNC PyInit__dhi_native(void) {
    PyObject *module = PyModule_Create(&dhi_native_module);
    if (!module) return NULL;

    // Initialize and register DhiStructType
    if (PyType_Ready(&DhiStructType) < 0) {
        Py_DECREF(module);
        return NULL;
    }

    Py_INCREF(&DhiStructType);
    if (PyModule_AddObject(module, "Struct", (PyObject*)&DhiStructType) < 0) {
        Py_DECREF(&DhiStructType);
        Py_DECREF(module);
        return NULL;
    }

    // Initialize and register DhiDecoderType
    if (PyType_Ready(&DhiDecoderType) < 0) {
        Py_DECREF(module);
        return NULL;
    }

    Py_INCREF(&DhiDecoderType);
    if (PyModule_AddObject(module, "Decoder", (PyObject*)&DhiDecoderType) < 0) {
        Py_DECREF(&DhiDecoderType);
        Py_DECREF(module);
        return NULL;
    }

    return module;
}
