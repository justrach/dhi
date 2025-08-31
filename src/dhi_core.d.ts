declare module './dhi_core.js' {
  export class DhiCore {
    constructor();
    add_field(name: string, field_type: string, required: boolean): void;
    validate(value: any): boolean;
    validate_batch(items: any[]): any;
    set_debug(debug: boolean): void;
    set_optional(optional: boolean): void;
    set_nullable(nullable: boolean): void;
    set_value_type(value_type: string): void;
  }

  const init: (input?: any) => Promise<any>;
  export default init;
}
