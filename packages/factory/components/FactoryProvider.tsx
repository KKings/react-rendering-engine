"use client";

/**
 * FactoryProvider.tsx
 *
 * Accepts the factory instance (or a branch) as a prop and:
 *   1. Registers overrides on it before children render.
 *   2. Places it in FactoryRendererContext so PlaceholderRenderer instances
 *      inside this subtree use the branch for slot resolution — not the base
 *      factory singleton that createPlaceholderRenderer() closed over.
 *   3. Places it in FactoryContext for direct useFactory() consumers.
 *
 * This is what connects ComponentFactory's branch override to the
 * PlaceholderRenderer that PlaceholderRendererServer delegates client slots to.
 */

import { createContext, useContext, type ReactNode, type ComponentType } from "react";
import type { ComponentFactory } from "@/packages/factory/types";
import { FactoryRendererContext } from "@/packages/placeholder/components/PlaceholderRenderer";

const FactoryContext = createContext<ComponentFactory | null>(null);

interface FactoryProviderProps {
  factory: ComponentFactory;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overrides: Record<string, () => Promise<{ default: ComponentType<any> }>>;
  children: ReactNode;
}

export function FactoryProvider({ factory, overrides, children }: FactoryProviderProps) {
  // Register overrides on the factory (or branch) before any child renders.
  Object.entries(overrides).forEach(([slot, thunk]) => {
    factory.register(slot, thunk, "async");
  });

  return (
    // FactoryRendererContext — read by PlaceholderRenderer's RenderItem.
    // Slot items inside this subtree will use the branch factory (with overrides)
    // instead of the base factory singleton (no overrides).
    <FactoryRendererContext.Provider value={factory}>
      {/* FactoryContext — read by useFactory() consumers */}
      <FactoryContext.Provider value={factory}>
        {children}
      </FactoryContext.Provider>
    </FactoryRendererContext.Provider>
  );
}

export function useFactory(): ComponentFactory {
  const ctx = useContext(FactoryContext);
  if (!ctx) {
    throw new Error(
      "useFactory() was called outside a <FactoryProvider>. " +
      "Wrap the component tree with <FactoryProvider factory={...} overrides={...}>."
    );
  }
  return ctx;
}