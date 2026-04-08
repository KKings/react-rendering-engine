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

import type { Product } from "./types";

export default async function ProductSummary({ id, name, price }: Product) {
  return (
    <ul>
      <li>ID: {id}</li>
      <li>Name: {name}</li>
      <li>Price: {price}</li>
    </ul>
  )
}