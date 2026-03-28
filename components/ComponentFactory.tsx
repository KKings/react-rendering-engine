"use client";

/**
 * ComponentFactory.tsx
 *
 * Brand-level client slot registration component.
 *
 * Uses clientFactory.branch() rather than the singleton directly.
 * This is the critical isolation step that prevents registered overrides
 * from leaking to other factory consumers (e.g. product-main) that
 * close over the parent clientFactory and expect the default component.
 *
 * Without branch():
 *   clientFactory.register("add-to-cart", BrandOverride)
 *   → clientFactory singleton now has the override
 *   → createPlaceholderRenderer(clientFactory) uses the same singleton
 *   → product-main renders BrandOverride instead of the default ✗
 *
 * With branch():
 *   const branch = clientFactory.branch()
 *   branch.register("add-to-cart", BrandOverride)
 *   → branch has the override
 *   → clientFactory singleton is untouched
 *   → createPlaceholderRenderer(clientFactory) renders the default ✓
 *   → FactoryProvider supplies branch to children → sidebar renders BrandOverride ✓
 */

import { clientFactory } from "@/packages/ui/client-factory";
import { FactoryProvider } from "@/packages/factory/components/FactoryProvider";
import type { ReactNode } from "react";

export default function ComponentFactory({ children }: { children?: ReactNode }) {
  // branch() shares the contract (slot definitions) with clientFactory
  // but gets its own empty registry — overrides stay scoped to this subtree.
  const branch = clientFactory.branch();

  return (
    <FactoryProvider
      factory={branch}
      overrides={{
        "add-to-cart": () => import("./client/AddToCart"),
      }}
    >
      {children}
    </FactoryProvider>
  );
}