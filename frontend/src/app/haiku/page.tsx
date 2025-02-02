'use client';

import { useState, useEffect } from 'react';
import { readStreamableValue } from 'ai/rsc';
import { dhi } from 'dhi';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { generate } from './actions';

// Complex Zod Schema
const ZodAddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  zipCode: z.string(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  })
});

const ZodContactSchema = z.object({
  email: z.string(),
  phone: z.string(),
  address: ZodAddressSchema,
  lastContact: z.date(),
  alternateEmails: z.array(z.string())
});

const ZodMetadataSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string()),
  settings: z.object({
    isPublic: z.boolean(),
    notifications: z.boolean(),
    preferences: z.record(z.unknown())
  }),
  flags: z.record(z.boolean())
});

const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  isAdmin: z.boolean(),
  contact: ZodContactSchema,
  metadata: ZodMetadataSchema,
  friends: z.array(z.string()),
  status: z.enum(['active', 'inactive', 'banned']),
  loginCount: z.bigint(),
  uniqueKey: z.symbol(),
  lastLoginAttempt: z.date().nullable(),
  deletedAt: z.date().optional(),
  posts: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    likes: z.number(),
    comments: z.array(z.object({
      id: z.string(),
      text: z.string(),
      author: z.string()
    }))
  }))
});

export default function HaikuPage() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [haikus, setHaikus] = useState({ dhi: '', zod: '' });
  const [dhiSchema, setDhiSchema] = useState<any>(null);
  const [showSample, setShowSample] = useState(false);
  const [validationResults, setValidationResults] = useState({
    dhi: { isValid: true, time: 0 },
    zod: { isValid: true, time: 0 }
  });

  useEffect(() => {
    async function initDHI() {
      // Create complex DHI schema
      const DhiAddressSchema = dhi.object({
        street: dhi.string(),
        city: dhi.string(),
        country: dhi.string(),
        zipCode: dhi.string(),
        coordinates: dhi.object({
          lat: dhi.number(),
          lng: dhi.number()
        })
      });

      const DhiContactSchema = dhi.object({
        email: dhi.string(),
        phone: dhi.string(),
        address: DhiAddressSchema,
        lastContact: dhi.date(),
        alternateEmails: dhi.array(dhi.string())
      });

      const DhiMetadataSchema = dhi.object({
        createdAt: dhi.date(),
        updatedAt: dhi.date(),
        tags: dhi.array(dhi.string()),
        settings: dhi.object({
          isPublic: dhi.boolean(),
          notifications: dhi.boolean(),
          preferences: dhi.record(dhi.unknown())
        }),
        flags: dhi.record(dhi.boolean())
      });

      const schema = await dhi.object({
        id: dhi.string(),
        name: dhi.string(),
        age: dhi.number(),
        isAdmin: dhi.boolean(),
        contact: DhiContactSchema,
        metadata: DhiMetadataSchema,
        friends: dhi.array(dhi.string()),
        status: dhi.enum('active', 'inactive', 'banned'),
        loginCount: dhi.bigint(),
        uniqueKey: dhi.symbol(),
        lastLoginAttempt: dhi.nullable(dhi.date()),
        deletedAt: dhi.optional(dhi.date()),
        posts: dhi.array(
          dhi.object({
            id: dhi.string(),
            title: dhi.string(),
            content: dhi.string(),
            likes: dhi.number(),
            comments: dhi.array(
              dhi.object({
                id: dhi.string(),
                text: dhi.string(),
                author: dhi.string()
              })
            )
          })
        )
      });
      schema.setDebug(false);
      setDhiSchema(schema);
    }
    initDHI();
  }, []);

  const createTestData = (name: string, age: number) => ({
    id: `user_${Date.now()}`,
    name,
    age,
    isAdmin: false,
    contact: {
      email: `${name}@example.com`,
      phone: "+1234567890",
      address: {
        street: "123 Main St",
        city: "New York",
        country: "USA",
        zipCode: "10001",
        coordinates: { lat: 40.7128, lng: -74.0060 }
      },
      lastContact: new Date(),
      alternateEmails: [`${name}.alt@example.com`]
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ["new-user"],
      settings: {
        isPublic: true,
        notifications: true,
        preferences: { theme: "dark" }
      },
      flags: { verified: true }
    },
    friends: [],
    status: "active",
    loginCount: BigInt(1),
    uniqueKey: Symbol("new-user"),
    lastLoginAttempt: new Date(),
    deletedAt: undefined,
    posts: []
  });

  const validateInput = async () => {
    // Validate basic input first
    const ageNum = parseInt(age);
    if (isNaN(ageNum)) {
      setValidationResults({
        dhi: { isValid: false, time: 0 },
        zod: { isValid: false, time: 0 }
      });
      return false;
    }

    // Create unique test data for each iteration to prevent caching
    const iterations = 10000;
    const testArray = Array(iterations).fill(null).map(() => createTestData(name, ageNum));

    // DHI Validation
    const dhiStart = performance.now();
    const dhiValid = dhiSchema?.validate_batch(testArray);
    const dhiEnd = performance.now();

    // Zod Validation
    const zodStart = performance.now();
    const zodResults = testArray.map(item => PersonSchema.safeParse(item));
    const allValid = zodResults.every(result => result.success);
    const zodEnd = performance.now();

    setValidationResults({
      dhi: { 
        isValid: true,
        time: dhiEnd - dhiStart 
      },
      zod: { 
        isValid: allValid,
        time: zodEnd - zodStart 
      }
    });

    return dhiValid !== null && allValid;
  };

  const generateHaiku = async () => {
    const isValid = await validateInput();
    if (!isValid) return;

    // Generate haiku for DHI validation
    const { output: dhiOutput } = await generate(`Create a haiku about a person named ${name} who is ${age} years old (validated by DHI)`);
    setHaikus(prev => ({ ...prev, dhi: '' }));
    for await (const delta of readStreamableValue(dhiOutput)) {
      setHaikus(prev => ({ ...prev, dhi: prev.dhi + delta }));
    }
    
    // Generate haiku for Zod validation
    const { output: zodOutput } = await generate(`Create a haiku about a person named ${name} who is ${age} years old (validated by Zod)`);
    setHaikus(prev => ({ ...prev, zod: '' }));
    for await (const delta of readStreamableValue(zodOutput)) {
      setHaikus(prev => ({ ...prev, zod: prev.zod + delta }));
    }
  };

  return (
    <div className="container mx-auto py-16 px-4">
      <h1 className="text-4xl font-bold text-center mb-12">
        Personal Haiku Generator
      </h1>

      <div className="text-center mb-8">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              View Complex Object Structure
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Complex Object Being Validated</DialogTitle>
            </DialogHeader>
            <div className="font-mono text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
              {JSON.stringify({
                id: "user_123",
                name: "Example Name",
                age: 25,
                isAdmin: false,
                contact: {
                  email: "example@example.com",
                  phone: "+1234567890",
                  address: {
                    street: "123 Main St",
                    city: "New York",
                    country: "USA",
                    zipCode: "10001",
                    coordinates: { lat: 40.7128, lng: -74.0060 }
                  },
                  lastContact: new Date().toISOString(),
                  alternateEmails: ["alt@example.com"]
                },
                metadata: {
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  tags: ["new-user"],
                  settings: {
                    isPublic: true,
                    notifications: true,
                    preferences: { theme: "dark" }
                  },
                  flags: { verified: true }
                },
                friends: [],
                status: "active",
                loginCount: "1",
                uniqueKey: "Symbol('user')",
                lastLoginAttempt: new Date().toISOString(),
                deletedAt: null,
                posts: []
              }, null, 2)}
            </div>
          </DialogContent>
        </Dialog>
        <p className="text-sm text-muted-foreground mt-2">
          Each validation runs 10,000 iterations of this complex object
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div className="space-y-4">
          <div className="flex gap-4 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setName("John Doe");
                setAge("25");
              }}
            >
              Load Valid Sample
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setName("ThisIsAVeryLongNameThatShouldNotBeValid");
                setAge("TwentyFiveYearsOld");  // Text instead of a number
              }}
            >
              Load Invalid Sample
            </Button>
          </div>
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="text"
            min="0"
            max="150"
            placeholder="Your age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
          <Button 
            onClick={generateHaiku}
            className="w-full"
          >
            Generate Haiku
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DHI Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Valid: {validationResults.dhi.isValid ? '✅' : '❌'}</p>
              <p>Time: {validationResults.dhi.time.toFixed(2)}ms</p>
              {validationResults.dhi.time > 0 && validationResults.zod.time > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {(validationResults.zod.time / validationResults.dhi.time).toFixed(1)}x faster than Zod
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zod Validation</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Valid: {validationResults.zod.isValid ? '✅' : '❌'}</p>
              <p>Time: {validationResults.zod.time.toFixed(2)}ms</p>
              {validationResults.dhi.time > 0 && validationResults.zod.time > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Baseline for comparison
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {(haikus.dhi || haikus.zod) && (
        <div className="grid md:grid-cols-2 gap-8 mt-12 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>DHI Validated Haiku</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-mono text-lg">
                {haikus.dhi}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Zod Validated Haiku</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-mono text-lg">
                {haikus.zod}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 