import type { ComponentType, ReactNode } from "react";

// ─── Type definitions ─────────────────────────────────────────────────────────

/**
 * How a component is provided — either eager or lazy.
 *
 * - Eager (ComponentType): imported at module evaluation time,
 *   always in the bundle. Use for sync/small components.
 * - Lazy (() => Promise): dynamic import thunk, code-split and
 *   only fetched on demand. Use for async/large components.
 */
export type DefaultResolver<TProps extends object> =
  | ComponentType<TProps>
  | (() => Promise<{ default: ComponentType<TProps> }>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | (() => Promise<any>);

// ─── Item kinds ───────────────────────────────────────────────────────────────

export type PlaceholderItemKind = "component" | "slot" | "divider";

// ─── Item definitions ─────────────────────────────────────────────────────────

interface PlaceholderItemBase {
  readonly id: string;
  readonly visible: boolean;
}

export interface ComponentItem<TProps extends object = object>
  extends PlaceholderItemBase {
  readonly kind: "component";
  readonly component: DefaultResolver<TProps>;
  readonly props: TProps;
}

export interface SlotItem<TProps extends object = object>
  extends PlaceholderItemBase {
  readonly kind: "slot";
  readonly slotName: string;
  readonly props: TProps;
}

export interface DividerItem extends PlaceholderItemBase {
  readonly kind: "divider";
}

export type PlaceholderItem<TProps extends object = object> =
  | ComponentItem<TProps>
  | SlotItem<TProps>
  | DividerItem;

// ─── Placeholder definition ───────────────────────────────────────────────────

export interface PlaceholderDefinition {
  readonly name: string;
  readonly description: string;
  readonly items: ReadonlyArray<PlaceholderItem>;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Operations a brand applies to a placeholder's item sequence.
 * All operations target items by id, not by index.
 */
export type PlaceholderMutation =
  | { op: "append";       item: PlaceholderItem }
  | { op: "prepend";      item: PlaceholderItem }
  | { op: "insertAfter";  afterId: string; item: PlaceholderItem }
  | { op: "insertBefore"; beforeId: string; item: PlaceholderItem }
  | { op: "remove";       id: string }
  | { op: "hide";         id: string }
  | { op: "show";         id: string }
  | { op: "replace";      id: string; item: PlaceholderItem };

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * The resolved placeholder registry produced by PlaceholderRegistryBuilder.build().
 */
export interface PlaceholderRegistry {
  /**
   * Apply mutations to a named placeholder.
   * Mutates the registry's working copies in place.
   * Returns the registry for fluent chaining.
   *
   * ⚠️  Do not call on the shared singleton from a per-request context
   * (e.g. inside a page component). Use branch() first to get an isolated
   * copy, then call configure() on the branch.
   */
  configure(
    placeholderName: string,
    mutations: PlaceholderMutation[]
  ): PlaceholderRegistry;

  /**
   * Create an isolated copy of this registry with its current working state.
   * Mutations on the branch do not affect the original or any other branch.
   * Safe to call per-request from page Server Components.
   *
   * @example
   * // page.tsx — isolated per request, original registry untouched
   * const pageRegistry = placeholderRegistry.branch();
   * pageRegistry.configure("product-sidebar", [...]);
   *
   * return <PlaceholderRendererServer registry={pageRegistry} ... />;
   */
  branch(): PlaceholderRegistry;

  /**
   * Resolve the final ordered, visible item list for a placeholder.
   * Hidden items are excluded from the output.
   */
  resolve(placeholderName: string): ReadonlyArray<PlaceholderItem>;

  /** Pre-mutation snapshot of all placeholder definitions. */
  readonly definitions: ReadonlyMap<string, PlaceholderDefinition>;
}