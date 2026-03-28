"use client";

/**
 * PlaceholderClientProvider.tsx  (library)
 *
 * Client Component that holds pre-resolved placeholder items in React context.
 * Also holds the ClientRenderer so client-side components can render
 * placeholder sequences without importing either the factory or the renderer.
 *
 * Both items and ClientRenderer are received as props from PlaceholderProvider
 * (a Server Component). Only serialisable data crosses the boundary — no
 * functions, no factory instances, no registry objects.
 */

import { createContext, useContext, type ReactNode, type ComponentType } from "react";
import type { SlotItem, DividerItem } from "../types";
import type { PlaceholderRendererProps } from "./PlaceholderRenderer";

// ─── Context shape ────────────────────────────────────────────────────────────

type SerialisableItem = SlotItem | DividerItem;

interface PlaceholderClientContextValue {
  /** Pre-resolved serialisable items keyed by placeholder name. */
  items: Record<string, ReadonlyArray<SerialisableItem>>;
  /**
   * The application's client renderer component.
   * Stored in context so usePlaceholderItems() callers don't need to
   * import it directly — the provider wires it once at the top of the tree.
   */
  ClientRenderer: ComponentType<PlaceholderRendererProps>;
}

const PlaceholderClientContext =
  createContext<PlaceholderClientContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface PlaceholderClientProviderProps {
  items: Record<string, ReadonlyArray<SerialisableItem>>;
  ClientRenderer: ComponentType<PlaceholderRendererProps>;
  children: ReactNode;
}

export function PlaceholderClientProvider({
  items,
  ClientRenderer,
  children,
}: PlaceholderClientProviderProps) {
  return (
    <PlaceholderClientContext.Provider value={{ items, ClientRenderer }}>
      {children}
    </PlaceholderClientContext.Provider>
  );
}

// ─── Consumer hooks ───────────────────────────────────────────────────────────

function usePlaceholderClientContext(): PlaceholderClientContextValue {
  const ctx = useContext(PlaceholderClientContext);
  if (!ctx) {
    throw new Error(
      "Placeholder client hooks called outside a <PlaceholderProvider>. " +
      "Wrap the page or layout with <PlaceholderProvider>."
    );
  }
  return ctx;
}

/**
 * Returns the pre-resolved serialisable items for a named placeholder.
 * Only SlotItems and DividerItems — ComponentItems are never included.
 *
 * @example
 * "use client";
 * const items = usePlaceholderItems("product-sidebar");
 * // Render directly or pass to the renderer from usePlaceholderRenderer()
 */
export function usePlaceholderItems(
  placeholderName: string
): ReadonlyArray<SerialisableItem> {
  const { items } = usePlaceholderClientContext();
  return items[placeholderName] ?? [];
}

/**
 * Returns the ClientRenderer component bound at provider setup time.
 * Avoids each client component needing to import the renderer directly.
 *
 * @example
 * "use client";
 * const PlaceholderRenderer = usePlaceholderRenderer();
 * const items = usePlaceholderItems("product-sidebar");
 * return <PlaceholderRenderer items={items} />;
 */
export function usePlaceholderRenderer(): ComponentType<PlaceholderRendererProps> {
  return usePlaceholderClientContext().ClientRenderer;
}