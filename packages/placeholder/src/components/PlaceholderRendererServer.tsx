/**
 * PlaceholderRendererServer.tsx  (library)
 *
 * Async Server Component renderer for placeholder item sequences.
 * All props except placeholderName are optional when used inside a
 * <PlaceholderProvider> — registry, serverFactory, and ClientRenderer
 * are read from React.cache set by the provider.
 *
 * Pass props explicitly when using without a provider.
 */

import React from "react";
import type {
  PlaceholderRegistry,
  PlaceholderItem,
  SlotItem,
  ComponentItem,
} from "../types";
import type { PlaceholderRendererProps } from "./PlaceholderRenderer";
import type { ProviderServerFactory } from "./PlaceholderProvider";
import {
  getPlaceholderRegistry,
  getPlaceholderServerFactory,
  getPlaceholderClientRenderer,
} from "./PlaceholderProvider";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlaceholderRendererServerProps {
  /** The placeholder to render. Always required. */
  placeholderName: string;
  /**
   * The registry to resolve items from.
   * Optional inside a <PlaceholderProvider> — reads from React.cache.
   * Required when used without a provider.
   */
  registry?: PlaceholderRegistry;
  /**
   * The server factory instance.
   * Optional inside a <PlaceholderProvider> — reads from React.cache.
   * Required when used without a provider.
   */
  serverFactory?: ProviderServerFactory;
  /**
   * The client renderer component — returned by createPlaceholderRenderer().
   * Optional inside a <PlaceholderProvider> — reads from React.cache.
   * Required when used without a provider.
   */
  ClientRenderer?: React.ComponentType<PlaceholderRendererProps>;
  /** Optional component for divider items. */
  dividerComponent?: React.ComponentType;
}

// ─── PlaceholderRendererServer ────────────────────────────────────────────────

export async function PlaceholderRendererServer({
  placeholderName,
  registry: registryProp,
  serverFactory: serverFactoryProp,
  ClientRenderer: ClientRendererProp,
  dividerComponent,
}: PlaceholderRendererServerProps) {
  // Prefer explicit props; fall back to values set by PlaceholderProvider.
  const registry = registryProp ?? getPlaceholderRegistry();
  const serverFactory = serverFactoryProp ?? getPlaceholderServerFactory();
  const ClientRenderer = ClientRendererProp ?? getPlaceholderClientRenderer();

  const items = registry.resolve(placeholderName);

  if (items.length === 0) return null;

  return (
    <>
      {items.map((item) => (
        <PlaceholderItemServer
          key={item.id}
          item={item}
          serverFactory={serverFactory}
          ClientRenderer={ClientRenderer}
          dividerComponent={dividerComponent}
        />
      ))}
    </>
  );
}

// ─── Per-item async server component ─────────────────────────────────────────

async function PlaceholderItemServer({
  item,
  serverFactory,
  ClientRenderer,
  dividerComponent,
}: {
  item: PlaceholderItem;
  serverFactory: ProviderServerFactory;
  ClientRenderer: React.ComponentType<PlaceholderRendererProps>;
  dividerComponent?: React.ComponentType;
}) {
  if (item.kind === "divider") {
    return (
      <ClientRenderer items={[item]} dividerComponent={dividerComponent} />
    );
  }

  if (item.kind === "slot") {
    const slotItem = item as SlotItem;
    if (serverFactory.contract.has(slotItem.slotName)) {
      const Component = await serverFactory.resolveServer(slotItem.slotName);
      return <Component {...(slotItem.props as Record<string, unknown>)} />;
    }
    return (
      <ClientRenderer items={[slotItem]} dividerComponent={dividerComponent} />
    );
  }

  if (item.kind === "component") {
    const componentItem = item as ComponentItem;
    const { component, props } = componentItem;

    const isThunk = (() => {
      if (typeof component !== "function") return false;
      try {
        const probe = (component as () => unknown)();
        return (
          probe != null &&
          typeof (probe as Promise<unknown>).then === "function"
        );
      } catch {
        return false;
      }
    })();

    if (isThunk) {
      const mod = await (component as () => Promise<unknown>)();

      // The thunk can resolve to either:
      //   (a) A component directly — e.g. import("@repo/ui").then(m => m.ProductDescription)
      //   (b) A module object with a .default — e.g. () => import("./Foo")
      const Component =
        typeof mod === "function"
          ? (mod as React.ComponentType<Record<string, unknown>>)
          : (mod as { default: React.ComponentType<Record<string, unknown>> })
              .default;

      if (!Component) {
        throw new Error(
          `PlaceholderItemServer: thunk for item "${componentItem.id}" resolved to undefined. ` +
            `Check that the import path and named export are correct.`,
        );
      }

      return <Component {...(props as Record<string, unknown>)} />;
    }

    const Component = component as React.ComponentType<Record<string, unknown>>;
    return <Component {...(props as Record<string, unknown>)} />;
  }

  return null;
}
