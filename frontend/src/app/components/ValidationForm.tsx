"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { ValidationResults } from "./ValidationResults";
import { dhi } from 'dhi';
import { z } from 'zod';

const ITERATIONS = 1_000_000;

type ValidationFormProps = {
  sampleSchemas: {
    simple: { dhi: string; zod: string };
    complex: { dhi: string; zod: string };
  };
  sampleData: {
    simple: string;
    complex: string;
  };
};

export function ValidationForm({ sampleSchemas, sampleData }: ValidationFormProps) {
  const [dhiSchema, setDhiSchema] = useState(sampleSchemas.simple.dhi);
  const [zodSchema, setZodSchema] = useState(sampleSchemas.simple.zod);
  const [testData, setTestData] = useState(sampleData.simple);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState({
    dhi: { time: 0, ops: 0, isValid: null as boolean | null },
    zod: { time: 0, ops: 0, isValid: null as boolean | null }
  });

  const runValidation = async (type: 'dhi' | 'zod') => {
    setIsRunning(true);
    
    try {
      const data = JSON.parse(testData);
      const testArray = Array(ITERATIONS).fill(data);

      if (type === 'dhi') {
        // Create complex schema
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

        const DhiUserSchema = await dhi.object({
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

        DhiUserSchema.setDebug(false);

        // Warm up
        for (let i = 0; i < 100; i++) {
          DhiUserSchema.validate(testArray[i]);
        }
        
        const startTime = performance.now();
        DhiUserSchema.validate_batch(testArray);
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        setMetrics(prev => ({
          ...prev,
          [type]: {
            time: totalTime,
            ops: Math.floor(ITERATIONS / (totalTime / 1000)),
            isValid: true
          }
        }));
      } else {
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

        const ZodUserSchema = z.object({
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
          posts: z.array(
            z.object({
              id: z.string(),
              title: z.string(),
              content: z.string(),
              likes: z.number(),
              comments: z.array(
                z.object({
                  id: z.string(),
                  text: z.string(),
                  author: z.string()
                })
              )
            })
          )
        });

        // Warm up
        for (let i = 0; i < 100; i++) {
          ZodUserSchema.safeParse(testArray[i]);
        }

        const startTime = performance.now();
        testArray.forEach(item => ZodUserSchema.safeParse(item));
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        setMetrics(prev => ({
          ...prev,
          [type]: {
            time: totalTime,
            ops: Math.floor(ITERATIONS / (totalTime / 1000)),
            isValid: true
          }
        }));
      }
    } catch (error) {
      console.error('Validation error:', error);
      setMetrics(prev => ({
        ...prev,
        [type]: {
          time: 0,
          ops: 0,
          isValid: false
        }
      }));
    }

    setIsRunning(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <Tabs defaultValue="schema" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="data">Test Data</TabsTrigger>
          </TabsList>
          <TabsContent value="schema">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium">DHI Schema</h3>
                <Textarea
                  value={dhiSchema}
                  onChange={(e) => setDhiSchema(e.target.value)}
                  rows={10}
                />
              </div>
              <div>
                <h3 className="mb-2 font-medium">Zod Schema</h3>
                <Textarea
                  value={zodSchema}
                  onChange={(e) => setZodSchema(e.target.value)}
                  rows={10}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="data">
            <div>
              <h3 className="mb-2 font-medium">Test Data (JSON)</h3>
              <Textarea
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                rows={10}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ValidationResults 
        metrics={metrics}
        isRunning={isRunning}
        onRunDhi={() => runValidation('dhi')}
        onRunZod={() => runValidation('zod')}
        iterations={ITERATIONS}
      />
    </div>
  );
} 