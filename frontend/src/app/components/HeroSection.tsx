"use client";
import Image from "next/image";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HeroSection() {
  return (
    <>
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-24">
        <div className="mb-12 max-w-5xl mx-auto">
          <Image
            src="https://images.bhumi.trilok.ai/dhi_logo.jpg"
            alt="DHI Hero"
            width={2100}
            height={900}
            className="rounded-lg shadow-xl"
            priority
          />
        </div>
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-bold tracking-tighter">
            DHI
            <span className="text-2xl block mt-2 text-muted-foreground">
              धि - Intellect, understanding, wisdom
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            High-performance TypeScript validation library powered by WebAssembly
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <Button 
              size="lg" 
              asChild
            >
              <a href="#try-it-yourself">
                Try Live Demo
              </a>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              asChild
            >
              <a href="https://github.com/justrach/dhi" target="_blank" rel="noopener noreferrer">
                <GitHubLogoIcon className="mr-2 h-5 w-5" />
                View Source
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              asChild
            >
              <a href="/haiku">
                Try Haiku Demo
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Unmatched Performance</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>Execution Time</CardTitle>
                <CardDescription>1,000,000 validations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>DHI</span>
                  <span className="font-mono">2661.79ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Zod</span>
                  <span className="font-mono">5832.30ms</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Validations per Second</CardTitle>
                <CardDescription>Higher is better</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>DHI</span>
                  <span className="font-mono">375,687</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Zod</span>
                  <span className="font-mono">175,360</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>WebAssembly-Powered</CardTitle>
              <CardDescription>
                Ultra-fast performance using WebAssembly technology
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>TypeScript-First</CardTitle>
              <CardDescription>
                Seamless integration with TypeScript for strong typing
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Familiar API</CardTitle>
              <CardDescription>
                Similar to Zod, making it easy to adopt
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Code Example */}
      <div className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Simple to Use</h2>
          <div className="max-w-2xl mx-auto bg-background p-6 rounded-lg">
            <pre className="text-sm">
              {`import { dhi } from 'dhi';

const UserSchema = await dhi.object({
  name: dhi.string(),
  age: dhi.number(),
  email: dhi.string(),
  tags: dhi.array(dhi.string())
});`}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              © 2024 DHI. MIT License.
            </div>
            <div className="flex gap-4">
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com/justrach/dhi" target="_blank" rel="noopener noreferrer">
                  DHI Core
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://github.com/justrach/dhi/tree/main/frontend" target="_blank" rel="noopener noreferrer">
                  Frontend Code
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a href="https://www.npmjs.com/package/dhi" target="_blank" rel="noopener noreferrer">
                  npm
                </a>
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
} 