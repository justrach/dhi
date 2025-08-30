import * as React from "react";
import type { MDXComponents } from "mdx/types";
import { CodeBlock } from "@/components/site/CodeBlock";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function H2(props: React.HTMLAttributes<HTMLHeadingElement>) {
  const id = slugify(String(props.children ?? ""));
  return (
    <h2 id={id} className="scroll-mt-24 text-xl font-semibold mt-10" {...props} />
  );
}

function H3(props: React.HTMLAttributes<HTMLHeadingElement>) {
  const id = slugify(String(props.children ?? ""));
  return (
    <h3 id={id} className="scroll-mt-24 text-lg font-medium mt-8" {...props} />
  );
}

function Pre(props: any) {
  const child = props?.children as any;
  const code = child?.props?.children ?? "";
  const className: string = child?.props?.className ?? "";
  const lang = className.match(/language-([a-z0-9]+)/)?.[1] ?? "ts";
  return <CodeBlock code={String(code)} language={lang} />;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: H2,
    h3: H3,
    pre: Pre,
    ...components,
  };
}

