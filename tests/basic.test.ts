import { dhi } from '../src';

describe('Dhi Validation', () => {
  describe('Primitive Types', () => {
    test('validates string', async () => {
      const schema = await dhi.string();
      expect(schema.validate("test").success).toBe(true);
      expect(schema.validate(123).success).toBe(false);
    });

    test('validates number', async () => {
      const schema = await dhi.number();
      expect(schema.validate(123).success).toBe(true);
      expect(schema.validate("123").success).toBe(false);
    });

    test('validates boolean', async () => {
      const schema = await dhi.boolean();
      expect(schema.validate(true).success).toBe(true);
      expect(schema.validate("true").success).toBe(false);
    });

    test('validates date', async () => {
      const schema = await dhi.date();
      expect(schema.validate(new Date()).success).toBe(true);
      expect(schema.validate("2024-01-01").success).toBe(false);
    });

    test('validates bigint', async () => {
      const schema = await dhi.bigint();
      expect(schema.validate(BigInt(123)).success).toBe(true);
      expect(schema.validate(123).success).toBe(false);
    });

    test('validates symbol', async () => {
      const schema = await dhi.symbol();
      expect(schema.validate(Symbol('test')).success).toBe(true);
      expect(schema.validate("symbol").success).toBe(false);
    });
  });

  describe('Empty Types', () => {
    test('validates undefined', async () => {
      const schema = await dhi.undefined();
      expect(schema.validate(undefined).success).toBe(true);
      expect(schema.validate(null).success).toBe(false);
    });

    test('validates null', async () => {
      const schema = await dhi.null();
      expect(schema.validate(null).success).toBe(true);
      expect(schema.validate(undefined).success).toBe(false);
    });

    test('validates void', async () => {
      const schema = await dhi.void();
      expect(schema.validate(undefined).success).toBe(true);
      expect(schema.validate(null).success).toBe(false);
    });
  });

  describe('Complex Types', () => {
    test('validates arrays', async () => {
      const schema = await dhi.array(await dhi.string());
      expect(schema.validate(["a", "b", "c"]).success).toBe(true);
      expect(schema.validate([1, 2, 3]).success).toBe(false);
    });

    test('validates objects', async () => {
      const schema = await dhi.object({
        name: await dhi.string(),
        age: await dhi.number()
      });
      expect(schema.validate({ name: "John", age: 30 }).success).toBe(true);
      expect(schema.validate({ name: "John", age: "30" }).success).toBe(false);
    });

    test('validates records', async () => {
      const schema = await dhi.record<string, number>(await dhi.number());
      expect(schema.validate({ a: 1, b: 2 }).success).toBe(true);
      expect(schema.validate({ a: "1", b: "2" }).success).toBe(false);
    });
  });

  describe('Utilities', () => {
    test('validates optional fields', async () => {
      const schema = await dhi.object({
        required: await dhi.string(),
        optional: await dhi.optional(await dhi.number())
      });
      expect(schema.validate({ required: "test" }).success).toBe(true);
      expect(schema.validate({ required: "test", optional: 123 }).success).toBe(true);
      expect(schema.validate({}).success).toBe(false);
    });

    test('validates nullable fields', async () => {
      const schema = await dhi.object({
        required: await dhi.string(),
        nullable: await dhi.nullable(await dhi.number())
      });
      expect(schema.validate({ required: "test", nullable: null }).success).toBe(true);
      expect(schema.validate({ required: "test", nullable: 123 }).success).toBe(true);
      expect(schema.validate({ required: "test", nullable: "123" }).success).toBe(false);
    });
  });

  describe('Legacy API', () => {
    let UserSchema: any;

    async function createUserSchema() {
      const string = await dhi.string();
      const number = await dhi.number();
      const boolean = await dhi.boolean();

      return dhi.object({
        id: number,
        name: string,
        email: string,
        isActive: boolean,
        tags: await dhi.array(await dhi.string())
      });
    }

    beforeAll(async () => {
      UserSchema = await createUserSchema();
    });

    const validUser = {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      isActive: true,
      tags: ["user", "admin"]
    };

    const invalidUser = {
      id: "not-a-number",
      name: 123,
      email: "invalid-email",
      isActive: "true",
      tags: "not-an-array"
    };

    test('validates correct data', () => {
      const result = UserSchema.validate(validUser);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validUser);
    });

    test('fails on invalid data', () => {
      const result = UserSchema.validate(invalidUser);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });
}); 