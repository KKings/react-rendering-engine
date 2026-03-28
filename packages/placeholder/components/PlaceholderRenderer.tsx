"use client";

/**
 * PlaceholderRenderer.tsx  (library)
 *
 * Library-grade client renderer for placeholder item sequences.
 * No factory is statically imported — the factory is provided at
 * creation time via createPlaceholderRenderer(factory).
 *
 * For slot items, the renderer prefers the factory from FactoryProvider
 * context (if present) over the factory it was created with. This allows
 * ComponentFactory to register branch overrides that take effect for the
 * subtree it wraps, while the base factory (used everywhere else) keeps
 * resolving the default.
 *
 *   createPlaceholderRenderer(clientFactory)
 *     → PlaceholderRenderer closed over clientFactory (no overrides)
 *
 *   <ComponentFactory>                     ← registers override on a branch
 *     <PlaceholderRendererServer .../>      ← passes ClientRenderer to client
 *       renders slot item →
 *         <PlaceholderRenderer items={[slotItem]} />
 *           RenderItem reads FactoryContext → gets branch → renders override ✓
 *
 *   <PlaceholderRendererServer .../> (outside ComponentFactory)
 *     renders slot item →
 *       <PlaceholderRenderer items={[slotItem]} />
 *         RenderItem: no FactoryContext → falls back to clientFactory → default ✓
 */

import React, {
  Suspense,
  lazy,
  createElement,
  useContext,
  createContext,
  type ComponentType,
} from "react";
import type { PlaceholderItem, ComponentItem, SlotItem } from "../types";

// ─── Factory interface ────────────────────────────────────────────────────────

interface RendererFactory {
  render(slotName: string, props: object): React.ReactElement | null;
}

// ─── FactoryContext ───────────────────────────────────────────────────────────
//
// Exported so FactoryProvider can write into it.
// When a branch factory is placed here, all PlaceholderRenderer instances
// inside the provider's subtree will use the branch for slot resolution.

export const FactoryRendererContext = createContext<RendererFactory | null>(null);

// ─── Renderer props ───────────────────────────────────────────────────────────

export interface PlaceholderRendererProps {
  items: ReadonlyArray<PlaceholderItem>;
  dividerComponent?: ComponentType;
}

// ─── createPlaceholderRenderer ────────────────────────────────────────────────

export function createPlaceholderRenderer(defaultFactory: RendererFactory) {
  const lazyComponentCache = new Map<
    string,
    React.LazyExoticComponent<ComponentType<object>>
  >();

  function resolveComponentItem<TProps extends object>(
    item: ComponentItem<TProps>,
  ): ComponentType<TProps> {
    const { component } = item;

    const isThunk = (() => {
      if (typeof component !== "function") return false;
      try {
        const result = (component as () => unknown)();
        return result != null && typeof (result as Promise<unknown>).then === "function";
      } catch {
        return false;
      }
    })();

    if (!isThunk) {
      return component as ComponentType<TProps>;
    }

    if (!lazyComponentCache.has(item.id)) {
      lazyComponentCache.set(
        item.id,
        lazy(
          component as () => Promise<{ default: ComponentType<TProps> }>,
        ) as React.LazyExoticComponent<ComponentType<object>>,
      );
    }
    return lazyComponentCache.get(item.id) as ComponentType<TProps>;
  }

  function RenderItem({
    item,
    dividerComponent,
  }: {
    item: PlaceholderItem;
    dividerComponent?: ComponentType;
  }) {
    // Prefer the factory from FactoryProvider context (a branch with overrides)
    // over the factory this renderer was created with (the base singleton).
    // This is what allows ComponentFactory's branch override to take effect
    // for slots inside its subtree while leaving other renderers unaffected.
    const contextFactory = useContext(FactoryRendererContext);
    const activeFactory = contextFactory ?? defaultFactory;

    if (item.kind === "divider") {
      return dividerComponent
        ? createElement(dividerComponent)
        : createElement("hr", {
            style: {
              border: "none",
              borderTop: "1px solid currentColor",
              opacity: 0.15,
            },
          });
    }

    if (item.kind === "slot") {
      const slotItem = item as SlotItem;
      // Uses activeFactory — branch (with override) if inside ComponentFactory,
      // defaultFactory (no overrides) if outside.
      return activeFactory.render(slotItem.slotName, slotItem.props);
    }

    const componentItem = item as ComponentItem;
    const Resolved = resolveComponentItem(componentItem);
    const element = createElement(Resolved, componentItem.props);

    if (lazyComponentCache.has(item.id)) {
      return createElement(Suspense, { fallback: null }, element);
    }

    return element;
  }

  function PlaceholderRenderer({ items, dividerComponent }: PlaceholderRendererProps) {
    if (items.length === 0) return null;

    return (
      <>
        {items.map((item) => (
          <RenderItem
            key={item.id}
            item={item}
            dividerComponent={dividerComponent}
          />
        ))}
      </>
    );
  }

  PlaceholderRenderer.displayName = "PlaceholderRenderer";

  return PlaceholderRenderer;
}