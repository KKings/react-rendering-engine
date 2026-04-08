// No "use client" — this is a React Server Component.
//
// It runs only on the server: can await data, access databases, read env vars.
// It never ships to the browser — zero JS bundle cost.
// It cannot use useState, useEffect, or any browser API.

import { serverFactory } from "../../server-factory";
import { Product } from "./types";

export interface ProductSummaryProps {
  productId: string;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Simulates a database or fetch call — only possible in a Server Component.
async function fetchProduct(id: string): Promise<Product> {
  await delay(5000);
  return {
    id,
    name: "Obsidian Desk Lamp",
    price: 149.99,
    stock: 12,
    description: "A minimal, adjustable lamp with touch dimming.",
  };
}

// ── Server slot: "product-summary" ───────────────────────────────────────────
//
// This slot is declared as target: "server" in the factory contract.
// The factory resolves it with a plain await import() — no React.lazy.
// The resolved component is also a Server Component: it receives the already-
// fetched `product` as a prop, so data fetching is co-located here, not pushed
// down into client code.
//
// The key rule: a server slot must only ever accept a Server Component override.
// If a brand tried to register a 'use client' component here, it would either
// throw at registration time (if the factory enforces it) or produce a runtime
// error because RSC cannot render client components without a client boundary.

export default async function ProductSummaryServer({ productId }: ProductSummaryProps) {
  // Data is fetched here on the server — never exposed to the client bundle.
  const product = await fetchProduct(productId);

  // The factory resolves the correct RSC for this slot.
  // Because target === "server", factory.resolveServer() returns a promise
  // that we await directly — no Suspense, no React.lazy.
  const ProductSummary = await serverFactory.resolveServer<Product>("product-summary");

  // The resolved server component receives the server-fetched data as props.
  // All of this stays on the server — only the rendered HTML ships to the client.
  return <ProductSummary {...product} />;
}