use wasm_bindgen::prelude::*;
use js_sys::{Array, Object, Reflect};
use std::collections::HashMap;

const CHUNK_SIZE: usize = 10000;  // Process in chunks for better cache usage

#[wasm_bindgen(start)]
pub fn init() {
    // Initialize WASM module
}

#[wasm_bindgen]
pub struct DhiCore {
    schema: HashMap<String, FieldValidator>,
    field_cache: HashMap<String, JsValue>,  // Pre-built cache of field names
    batch_size: i32,
    custom_types: HashMap<String, HashMap<String, FieldValidator>>,
    debug: bool,
}

#[derive(Debug, Clone)]
struct FieldValidator {
    field_type: FieldType,
    required: bool,
}

#[derive(Debug, Clone)]
enum FieldType {
    String,
    Number,
    Boolean,
    Array(Box<FieldType>),
    Object(HashMap<String, FieldValidator>),
    Custom(String),
    Any,
    Record(Box<FieldType>),
    Date,
    BigInt,      // Add BigInt
    Symbol,      // Add Symbol
    Undefined,   // Add Undefined
    Null,        // Add Null
    Void,        // Add Void
    Unknown,     // Add Unknown
    Never,       // Add Never
    Enum(Vec<String>),  // Add Enum type
}

#[wasm_bindgen]
impl DhiCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        DhiCore {
            schema: HashMap::new(),
            field_cache: HashMap::new(),
            batch_size: 1000,
            custom_types: HashMap::new(),
            debug: false,
        }
    }

    #[wasm_bindgen]
    pub fn get_batch_size(&self) -> i32 {
        self.batch_size
    }

    #[wasm_bindgen]
    pub fn set_batch_size(&mut self, size: i32) {
        self.batch_size = size;
    }

    #[wasm_bindgen]
    pub fn define_custom_type(&mut self, type_name: String) -> Result<(), JsValue> {
        if !self.custom_types.contains_key(&type_name) {
            self.custom_types.insert(type_name, HashMap::new());
        }
        Ok(())
    }

    #[wasm_bindgen]
    pub fn add_field_to_custom_type(
        &mut self,
        type_name: String,
        field_name: String,
        field_type: String,
        required: bool,
    ) -> Result<(), JsValue> {
        let parsed_field_type = self.parse_field_type(&field_type)?;
        
        let custom_type = self.custom_types.get_mut(&type_name)
            .ok_or_else(|| JsValue::from_str("Custom type not defined"))?;

        custom_type.insert(field_name, FieldValidator {
            field_type: parsed_field_type,
            required,
        });
        Ok(())
    }

    #[wasm_bindgen]
    pub fn add_field(&mut self, name: String, field_type: String, required: bool) -> Result<(), JsValue> {
        let field_type = self.parse_field_type(&field_type)?;
        self.schema.insert(name, FieldValidator { field_type, required });
        Ok(())
    }

    // New method to add nested object
    #[wasm_bindgen]
    pub fn add_object_field(&mut self, name: String, required: bool) -> Result<(), JsValue> {
        self.schema.insert(name, FieldValidator { 
            field_type: FieldType::Object(HashMap::new()),
            required 
        });
        Ok(())
    }

    // New method to add field to nested object
    #[wasm_bindgen]
    pub fn add_nested_field(&mut self, object_path: String, field_name: String, field_type: String, required: bool) -> Result<(), JsValue> {
        // Parse field type first to avoid borrow checker issue
        let parsed_field_type = self.parse_field_type(&field_type)?;
        
        if object_path.is_empty() {
            // If no path, add directly to root schema
            self.schema.insert(field_name, FieldValidator { 
                field_type: parsed_field_type, 
                required 
            });
            return Ok(());
        }

        let parts: Vec<&str> = object_path.split('.').collect();
        let mut current_schema = &mut self.schema;

        // Navigate to the correct nested object
        for part in parts {
            if let Some(FieldValidator { field_type: FieldType::Object(ref mut nested_schema), .. }) = current_schema.get_mut(part) {
                current_schema = nested_schema;
            } else {
                return Err(JsValue::from_str("Invalid object path"));
            }
        }

        // Add the field to the nested object
        current_schema.insert(field_name, FieldValidator { 
            field_type: parsed_field_type, 
            required 
        });
        Ok(())
    }

    #[wasm_bindgen]
    pub fn validate(&self, value: JsValue) -> Result<bool, JsValue> {
        match self.validate_value_internal(&value) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false)
        }
    }

    #[wasm_bindgen]
    pub fn validate_batch(&self, items: Array) -> Result<Array, JsValue> {
        let results = Array::new();
        let len = items.length() as usize;
        results.set_length(len as u32);
        
        // Check if we have any complex types (objects/arrays)
        let has_complex_types = self.schema.values().any(|v| {
            matches!(v.field_type, FieldType::Object(_) | FieldType::Array(_) | FieldType::Custom(_))
        });

        if !has_complex_types {
            // FAST PATH for simple objects
            let field_jsvalues: Vec<_> = self.schema.iter()
                .map(|(k, v)| (JsValue::from_str(k), &v.field_type))
                .collect();

            for i in 0..len {
                let item = items.get(i as u32);
                if !item.is_object() {
                    results.set(i as u32, JsValue::from_bool(false));
                    continue;
                }

                let obj = match item.dyn_ref::<Object>() {
                    Some(o) => o,
                    None => {
                        results.set(i as u32, JsValue::from_bool(false));
                        continue;
                    }
                };

                let mut is_valid = true;
                for (field_name, field_type) in &field_jsvalues {
                    match Reflect::has(obj, field_name) {
                        Ok(true) => {
                            let value = Reflect::get(obj, field_name).unwrap();
                            match field_type {
                                FieldType::String => if !value.is_string() { is_valid = false; break; }
                                FieldType::Number => if value.as_f64().is_none() { is_valid = false; break; }
                                FieldType::Boolean => if value.as_bool().is_none() { is_valid = false; break; }
                                _ => unreachable!()
                            }
                        }
                        _ => {
                            is_valid = false;
                            break;
                        }
                    }
                }
                results.set(i as u32, JsValue::from_bool(is_valid));
            }
        } else {
            // SLOW PATH for complex objects
            // ... existing complex validation code ...
            for chunk_start in (0..len).step_by(CHUNK_SIZE) {
                let chunk_end = (chunk_start + CHUNK_SIZE).min(len);
                for i in chunk_start..chunk_end {
                    let item = items.get(i as u32);
                    let is_valid = self.validate_value_internal(&item).is_ok();
                    results.set(i as u32, JsValue::from_bool(is_valid));
                }
            }
        }
        
        Ok(results)
    }

    #[wasm_bindgen]
    pub fn set_debug(&mut self, debug: bool) {
        self.debug = debug;
    }

    fn validate_value_internal(&self, value: &JsValue) -> Result<(), JsValue> {
        if !value.is_object() {
            return Err(JsValue::from_bool(false));
        }

        let obj = value.dyn_ref::<Object>()
            .ok_or_else(|| JsValue::from_bool(false))?;

        for (field_name, validator) in &self.schema {
            match &validator.field_type {
                FieldType::Object(nested_schema) => {
                    // Handle nested object validation
                    if validator.required && !Reflect::has(obj, &JsValue::from_str(field_name))? {
                        return Err(JsValue::from_bool(false));
                    }
                    if Reflect::has(obj, &JsValue::from_str(field_name))? {
                        let nested_value = Reflect::get(obj, &JsValue::from_str(field_name))?;
                        self.validate_object(&nested_value, nested_schema)?;
                    }
                }
                _ => {
                    // Handle primitive types as before
                    if validator.required && !Reflect::has(obj, &JsValue::from_str(field_name))? {
                        return Err(JsValue::from_bool(false));
                    }
                    if Reflect::has(obj, &JsValue::from_str(field_name))? {
                        let field_value = Reflect::get(obj, &JsValue::from_str(field_name))?;
                        self.validate_value(&field_value, &validator.field_type)?;
                    }
                }
            }
        }
        Ok(())
    }

    fn validate_object(&self, value: &JsValue, schema: &HashMap<String, FieldValidator>) -> Result<(), JsValue> {
        let obj = value.dyn_ref::<Object>()
            .ok_or_else(|| JsValue::from_bool(false))?;

        for (field_name, validator) in schema {
            if validator.required && !Reflect::has(obj, &JsValue::from_str(field_name))? {
                return Err(JsValue::from_bool(false));
            }
            if Reflect::has(obj, &JsValue::from_str(field_name))? {
                let field_value = Reflect::get(obj, &JsValue::from_str(field_name))?;
                self.validate_value(&field_value, &validator.field_type)?;
            }
        }
        Ok(())
    }

    fn parse_field_type(&self, field_type: &str) -> Result<FieldType, JsValue> {
        match field_type {
            "string" => Ok(FieldType::String),
            "number" => Ok(FieldType::Number),
            "boolean" => Ok(FieldType::Boolean),
            "object" => Ok(FieldType::Object(HashMap::new())),
            "record" => Ok(FieldType::Record(Box::new(FieldType::Any))),
            "date" => Ok(FieldType::Date),
            "bigint" => Ok(FieldType::BigInt),
            "symbol" => Ok(FieldType::Symbol),
            "undefined" => Ok(FieldType::Undefined),
            "null" => Ok(FieldType::Null),
            "void" => Ok(FieldType::Void),
            "unknown" => Ok(FieldType::Unknown),
            "never" => Ok(FieldType::Never),
            _ => {
                if let Some(values) = field_type.strip_prefix("enum:") {
                    return Ok(FieldType::Enum(
                        values.split(',').map(String::from).collect()
                    ));
                }
                if let Some(inner_type) = field_type.strip_prefix("Array<").and_then(|s| s.strip_suffix(">")) {
                    let inner = self.parse_field_type(inner_type)?;
                    return Ok(FieldType::Array(Box::new(inner)));
                }
                if let Some(inner_type) = field_type.strip_prefix("Record<").and_then(|s| s.strip_suffix(">")) {
                    let inner = self.parse_field_type(inner_type)?;
                    return Ok(FieldType::Record(Box::new(inner)));
                }
                if self.custom_types.contains_key(field_type) {
                    return Ok(FieldType::Custom(field_type.to_string()));
                }
                Err(JsValue::from_str(&format!("Unsupported type: {}", field_type)))
            }
        }
    }

    // Add back validate_value method
    #[inline(always)]
    fn validate_value(&self, value: &JsValue, field_type: &FieldType) -> Result<(), JsValue> {
        match field_type {
            FieldType::String => {
                if !value.is_string() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Number => {
                if value.as_f64().is_none() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Boolean => {
                if value.as_bool().is_none() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Array(item_type) => {
                let array = value.dyn_ref::<Array>()
                    .ok_or_else(|| JsValue::from_bool(false))?;
                
                for i in 0..array.length() {
                    let item = array.get(i);
                    self.validate_value(&item, item_type)?;
                }
                Ok(())
            }
            FieldType::Object(nested_schema) => {
                self.validate_object(value, nested_schema)
            }
            FieldType::Custom(type_name) => {
                if let Some(custom_type) = self.custom_types.get(type_name) {
                    self.validate_object(value, custom_type)
                } else {
                    Ok(())
                }
            }
            FieldType::Record(value_type) => {
                let obj = value.dyn_ref::<Object>()
                    .ok_or_else(|| JsValue::from_bool(false))?;
                
                let entries = Object::entries(obj);
                for i in 0..entries.length() {
                    let entry = entries.get(i);
                    let value = Reflect::get(&entry, &JsValue::from(1))?;
                    self.validate_value(&value, value_type)?;
                }
                Ok(())
            }
            FieldType::Date => {
                // Check if value is a Date object
                if !value.is_instance_of::<js_sys::Date>() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::BigInt => {
                if !value.is_bigint() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Symbol => {
                if !value.is_symbol() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Undefined => {
                if !value.is_undefined() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Null => {
                if !value.is_null() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Void => {
                if !value.is_undefined() {
                    return Err(JsValue::from_bool(false));
                }
                Ok(())
            }
            FieldType::Unknown => Ok(()), // accepts any value
            FieldType::Never => Err(JsValue::from_bool(false)), // always fails validation
            FieldType::Any => Ok(()),
            FieldType::Enum(allowed_values) => {
                if let Some(str_val) = value.as_string() {
                    if allowed_values.contains(&str_val) {
                        Ok(())
                    } else {
                        Err(JsValue::from_bool(false))
                    }
                } else {
                    Err(JsValue::from_bool(false))
                }
            }
        }
    }

    #[wasm_bindgen]
    pub fn set_optional(&mut self, optional: bool) {
        if let Some(last_field) = self.schema.iter_mut().last() {
            last_field.1.required = !optional;
        }
    }

    #[wasm_bindgen]
    pub fn set_nullable(&mut self, nullable: bool) {
        if let Some(last_field) = self.schema.iter_mut().last() {
            // TODO: Implement nullable logic
            last_field.1.required = !nullable;
        }
    }

    #[wasm_bindgen]
    pub fn set_value_type(&mut self, value_type: &str) {
        if let Some(last_field) = self.schema.iter_mut().last() {
            last_field.1.field_type = match value_type {
                "string" => FieldType::String,
                "number" => FieldType::Number,
                "boolean" => FieldType::Boolean,
                // Add other types as needed
                _ => FieldType::Any,
            };
        }
    }
} 