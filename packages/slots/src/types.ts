import type { ComponentType, ReactNode } from "react";

// ─── Slot classification ──────────────────────────────────────────────────────

export type SlotMode = "sync" | "async";

export type SlotTarget = "server" | "client";

// ─── Slot definition ─────────────────────────────────────────────────────────

/**
 * How the default component for a slot is provided.
 *
 * - Eager (ComponentType): always bundled.
 * - Lazy (() => Promise): code-split, fetched on demand.
 * - null: no default — a brand override MUST be registered.
 */
export type DefaultResolver<TProps extends object> =
  | ComponentType<TProps>
  | (() => Promise<{ default: ComponentType<TProps> }>);

export interface SlotDefinition<TProps extends object = object> {
  readonly name: string;
  readonly description: string;
  readonly mode: SlotMode;
  readonly target: SlotTarget;
  readonly fallback: ReactNode;
  /**
   * null means no default — an override must be registered before rendering.
   * Eager ComponentType = always bundled.
   * Lazy thunk = code-split on demand.
   */
  readonly defaultComponent: DefaultResolver<TProps> | null;
}

// ─── Registry entry ───────────────────────────────────────────────────────────

export type AsyncOverride<TProps extends object> = () => Promise<{
  default: ComponentType<TProps>;
}>;

export type SyncOverride<TProps extends object> = ComponentType<TProps>;

export type SlotOverride<TProps extends object> =
  | AsyncOverride<TProps>
  | SyncOverride<TProps>;

export interface RegistryEntry<TProps extends object = object> {
  readonly slotName: string;
  readonly override: SlotOverride<TProps>;
  readonly mode: SlotMode;
}

export type SlotMap = Record<string, object>
// e.g. { "add-to-cart": AddToCartProps; "nav": NavProps }

export type OverridesMap<TSlots extends SlotMap> = {
  [K in keyof TSlots]?: SlotOverride<TSlots[K]>
}
// Each key constrained to a known slot; each value constrained to that
// slot's props. All entries optional — brands only provide what they override.

// ─── ComponentFactory ─────────────────────────────────────────────────────────

export interface ComponentFactory {
  /**
   * Register a brand override for a named slot.
   * Must be called from a "use client" module for client slots — thunks in
   * server modules are resolved eagerly by the bundler, defeating code-splitting.
   */
  register<TProps extends object>(
    slotName: string,
    override: SlotOverride<TProps>,
    mode?: SlotMode
  ): ComponentFactory;

  /**
   * Resolve and render a CLIENT slot.
   * Async slots are automatically wrapped in Suspense.
   * Throws for server slots — use resolveServer() instead.
   */
  render<TProps extends object>(
    slotName: string,
    props: TProps
  ): React.ReactElement | null;

  /**
   * Resolve a CLIENT slot to its ComponentType without rendering.
   * Throws for server slots — use resolveServer() instead.
   */
  resolve<TProps extends object>(slotName: string): ComponentType<TProps>;

  /**
   * Resolve a SERVER slot via native await import().
   * Must be called from an async Server Component.
   * React.lazy is NOT used — the RSC renderer does not support LazyComponent.
   * Throws for client slots — use render() instead.
   */
  resolveServer<TProps extends object>(slotName: string): Promise<ComponentType<TProps>>;

  /**
   * Returns true if a brand override has been registered for this slot.
   */
  isRegistered(slotName: string): boolean;

  /**
   * Create an isolated factory instance that shares the slot contract
   * but starts with an empty override registry and fresh lazy cache.
   *
   * Overrides registered on the branch NEVER affect the parent factory or
   * any sibling branch. Use this to scope overrides to a component subtree:
   *
   * @example
   * // ComponentFactory.tsx ("use client")
   * const branch = clientFactory.branch();
   * branch.register("add-to-cart", () => import("./BrandAddToCart"), "async");
   *
   * // branch.render("add-to-cart", ...)  → BrandAddToCart
   * // clientFactory.render("add-to-cart", ...)  → default (unaffected)
   */
  branch(): ComponentFactory;

  readonly registeredSlots: ReadonlyMap<string, RegistryEntry>;
  readonly contract: ReadonlyMap<string, SlotDefinition>;
}