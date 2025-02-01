"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Metrics = {
  time: number;
  ops: number;
  isValid: boolean | null;
};

type ValidationResultsProps = {
  metrics: {
    dhi: Metrics;
    zod: Metrics;
  };
  isRunning: boolean;
  onRunDhi: () => void;
  onRunZod: () => void;
  iterations: number;
};

export function ValidationResults({ 
  metrics, 
  isRunning, 
  onRunDhi, 
  onRunZod,
  iterations 
}: ValidationResultsProps) {
  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Button 
          onClick={onRunDhi} 
          disabled={isRunning}
          className="flex-1"
        >
          Run DHI
        </Button>
        <Button 
          onClick={onRunZod} 
          disabled={isRunning}
          className="flex-1"
        >
          Run Zod
        </Button>
      </div>

      <CardDescription className="mt-2">
        Running validation on {iterations.toLocaleString()} iterations
      </CardDescription>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>DHI Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Time: {metrics.dhi.time.toFixed(2)}ms</p>
              <p>Ops/sec: {metrics.dhi.ops.toLocaleString()}</p>
              <p>Valid: {metrics.dhi.isValid?.toString() ?? 'Not run'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zod Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>Time: {metrics.zod.time.toFixed(2)}ms</p>
              <p>Ops/sec: {metrics.zod.ops.toLocaleString()}</p>
              <p>Valid: {metrics.zod.isValid?.toString() ?? 'Not run'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 