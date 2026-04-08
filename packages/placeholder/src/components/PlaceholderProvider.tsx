/**
 * PlaceholderProvider.tsx  (library)
 *
 * Server Component that wires the placeholder system for a page or layout.
 * Stores the registry branch, serverFactory, and ClientRenderer in React.cache
 * so descendant PlaceholderRendererServer components need no props.
 */

import { cache } from "react";
import React from "react";
import type { ReactNode, ComponentType } from "react";
import type {
  PlaceholderRegistry,
  PlaceholderMutation,
  SlotItem,
  DividerItem,
} from "../types";
import type { PlaceholderRendererProps } from "./PlaceholderRenderer";
import { filterSerializableItems } from "../server-utils";
import { PlaceholderClientProvider } from "./PlaceholderClientProvider";

// ─── Structural factory interface ─────────────────────────────────────────────

export interface ProviderServerFactory {
  contract: ReadonlyMap<string, unknown>;
  resolveServer<TProps extends object>(slotName: string): Promise<ComponentType<TProps>>;
}

// ─── Per-request server-side storage ─────────────────────────────────────────

interface ProviderSlot {
  registry: PlaceholderRegistry | null;
  serverFactory: ProviderServerFactory | null;
  ClientRenderer: ComponentType<PlaceholderRendererProps> | null;
}

const getProviderSlot = cache((): ProviderSlot => ({
  registry: null,
  serverFactory: null,
  ClientRenderer: null,
}));

export function getPlaceholderRegistry(): PlaceholderRegistry {
  const slot = getProviderSlot();
  if (!slot.registry) {
    throw new Error(
      "getPlaceholderRegistry() called outside a <PlaceholderProvider>."
    );
  }
  return slot.registry;
}

export function getPlaceholderServerFactory(): ProviderServerFactory {
  const slot = getProviderSlot();
  if (!slot.serverFactory) {
    throw new Error(
      "getPlaceholderServerFactory() called outside a <PlaceholderProvider>."
    );
  }
  return slot.serverFactory;
}

export function getPlaceholderClientRenderer(): ComponentType<PlaceholderRendererProps> {
  const slot = getProviderSlot();
  if (!slot.ClientRenderer) {
    throw new Error(
      "getPlaceholderClientRenderer() called outside a <PlaceholderProvider>."
    );
  }
  return slot.ClientRenderer;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceholderProviderProps {
  registry: PlaceholderRegistry;
  serverFactory: ProviderServerFactory;
  ClientRenderer: ComponentType<PlaceholderRendererProps>;
  configure?: Record<string, PlaceholderMutation[]>;
  /**
   * Placeholder names whose SLOT and DIVIDER items should be pre-resolved
   * for client component descendants via React context.
   *
   * Only SlotItems and DividerItems are passed — ComponentItems contain
   * functions that cannot cross the server/client boundary.
   *
   * Do NOT list placeholders that contain only ComponentItems here — those
   * are rendered entirely server-side by PlaceholderRendererServer and never
   * need to cross the boundary.
   */
  clientPlaceholders?: string[];
  children: ReactNode;
}

// ─── PlaceholderProvider ──────────────────────────────────────────────────────

export function PlaceholderProvider({
  registry,
  serverFactory,
  ClientRenderer,
  configure,
  clientPlaceholders = [],
  children,
}: PlaceholderProviderProps) {
  const branch = registry.branch();

  // Apply mutations, each wrapped independently so one failure does not
  // silently abort remaining mutations for other placeholders.
  if (configure) {
    for (const [name, mutations] of Object.entries(configure)) {
      try {
        branch.configure(name, mutations);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error(
            `PlaceholderProvider: configure("${name}") failed.\n` +
            `This is likely because a mutation references an item id that does ` +
            `not exist in the placeholder definition.\n` +
            `Check that the id in your mutation matches an item defined in the ` +
            `PlaceholderBuilder for "${name}".\n`,
            err
          );
        }
      }
    }
  }

  const slot = getProviderSlot();
  slot.registry = branch;
  slot.serverFactory = serverFactory;
  slot.ClientRenderer = ClientRenderer;

  const clientItems: Record<string, ReadonlyArray<SlotItem | DividerItem>> = {};
  for (const name of clientPlaceholders) {
    clientItems[name] = filterSerializableItems(branch.resolve(name));
  }

  return (
    <PlaceholderClientProvider
      items={clientItems}
      ClientRenderer={ClientRenderer}
    >
      {children}
    </PlaceholderClientProvider>
  );
}