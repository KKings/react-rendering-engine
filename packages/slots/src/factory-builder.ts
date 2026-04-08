/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, lazy, createElement } from "react";
import type { ComponentType } from "react";
import type {
  ComponentFactory,
  DefaultResolver,
  RegistryEntry,
  SlotDefinition,
  SlotMode,
  SlotOverride,
  AsyncOverride,
  SyncOverride,
  SlotMap,
  OverridesMap,
} from "./types";
import { SlotBuilder } from "./slot-builder";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isLazyDefault<T extends object>(
  resolver: DefaultResolver<T> | null
): resolver is () => Promise<{ default: ComponentType<T> }> {
  if (typeof resolver !== "function") return false;
  try {
    const result = (resolver as () => unknown)();
    return result != null && typeof (result as Promise<unknown>).then === "function";
  } catch {
    return false;
  }
}

// ─── FactoryBuilder ───────────────────────────────────────────────────────────

/**
 * FactoryBuilder
 *
 * Fluent builder that collects slot definitions and produces a sealed,
 * strongly-typed ComponentFactory.
 *
 * TSlots maps slot names to their PROPS types — not to SlotDefinition objects.
 * This is what enables typed render/register/resolve calls:
 *   factory.render("add-to-cart", { productId, price, initialStock })
 *                                   ↑ typed as AddToCartProps automatically
 *
 * @example
 * const factory = new FactoryBuilder()
 *   .add(new SlotBuilder<AddToCartProps>("add-to-cart")
 *     .description("Interactive add-to-cart button")
 *     .client().async())
 *   .build();
 * // Inferred: ComponentFactory<{ "add-to-cart": AddToCartProps }>
 */
export class FactoryBuilder<TSlots extends SlotMap = Record<never, never>> {
  private _slots = new Map<string, SlotDefinition>();

  /**
   * Add a slot to the factory contract.
   * Each call widens TSlots to include the new slot name mapped to its props type.
   *
   * TName is the literal slot name string type.
   * TProps is the props type for that slot.
   * Together they extend TSlots: { ..., "add-to-cart": AddToCartProps }
   */
  add<TName extends string, TProps extends object>(
    slotOrBuilder: SlotBuilder<TProps> | SlotDefinition<TProps>,
  ): FactoryBuilder<TSlots & Record<TName, TProps>> {
    const definition =
      slotOrBuilder instanceof SlotBuilder
        ? slotOrBuilder.build()
        : slotOrBuilder;

    if (this._slots.has(definition.name)) {
      throw new Error(
        `FactoryBuilder: duplicate slot name "${definition.name}". Each slot name must be unique.`
      );
    }

    this._slots.set(definition.name, definition as SlotDefinition);
    return this as unknown as FactoryBuilder<TSlots & Record<TName, TProps>>;
  }

  /**
   * Seal the contract and return a ComponentFactory.
   * The contract is frozen — no new slots can be added after this.
   */
  build(): ComponentFactory {
    const contract = new Map(this._slots);
    return buildFactory<TSlots>(contract);
  }
}

// ─── buildFactory ─────────────────────────────────────────────────────────────
//
// Produces a ComponentFactory from a contract map.
// Called by both FactoryBuilder.build() and factory.branch().
//
// contract  — slot definitions, SHARED across all branches (read-only)
// registry  — override entries, FRESH per factory/branch (never shared)
// lazyCache — React.lazy wrappers, FRESH per factory/branch (never shared)
//
// The isolation of registry and lazyCache is what makes branch() work:
// registering an override on a branch cannot affect the parent factory
// because they hold completely separate Map instances.

function buildFactory<TSlots extends SlotMap>(
  contract: Map<string, SlotDefinition>
): ComponentFactory {
  // Fresh registry — no overrides inherited from parent
  const registry = new Map<string, RegistryEntry>();

  // Fresh lazyCache — keyed as "override:{slotName}" or "default:{slotName}"
  // Namespacing prevents an override cache key from colliding with a default
  // cache key when an override is removed (e.g. in HMR).
  const lazyCache = new Map<string, React.LazyExoticComponent<ComponentType<object>>>();

  // ─── resolve ───────────────────────────────────────────────────────────────

  function resolve(slotName: string): ComponentType<any> {
    const definition = contract.get(slotName);
    if (!definition) {
      throw new Error(
        `ComponentFactory.resolve: unknown slot "${slotName}". ` +
        `Known slots: [${[...contract.keys()].join(", ")}]`
      );
    }

    if (definition.target === "server") {
      throw new Error(
        `ComponentFactory.resolve: slot "${slotName}" is a server slot. ` +
        `Use await factory.resolveServer("${slotName}") inside a Server Component instead.`
      );
    }

    const entry = registry.get(slotName);

    // ── Override registered ─────────────────────────────────────────────────
    if (entry) {
      const { override, mode } = entry;

      if (mode === "sync") {
        return override as SyncOverride<any>;
      }

      const overrideCacheKey = `override:${slotName}`;
      if (!lazyCache.has(overrideCacheKey)) {
        lazyCache.set(
          overrideCacheKey,
          lazy(override as AsyncOverride<any>) as React.LazyExoticComponent<ComponentType<object>>
        );
      }
      return lazyCache.get(overrideCacheKey) as ComponentType<any>;
    }

    // ── No override — use default ───────────────────────────────────────────
    const { defaultComponent } = definition;

    if (defaultComponent === null) {
      throw new Error(
        `ComponentFactory.resolve: slot "${slotName}" has no registered override and no default. ` +
        `Register an override with factory.register("${slotName}", ...) in a "use client" module.`
      );
    }

    if (!isLazyDefault(defaultComponent)) {
      // Eager ComponentType — return directly, already in the bundle.
      return defaultComponent as ComponentType<any>;
    }

    // Lazy thunk — wrap in React.lazy, cache under "default:" key.
    const defaultCacheKey = `default:${slotName}`;
    if (!lazyCache.has(defaultCacheKey)) {
      lazyCache.set(
        defaultCacheKey,
        lazy(
          defaultComponent as () => Promise<{ default: ComponentType<any> }>
        ) as React.LazyExoticComponent<ComponentType<object>>
      );
    }
    return lazyCache.get(defaultCacheKey) as ComponentType<any>;
  }

  // ─── render ────────────────────────────────────────────────────────────────

  function render(
    slotName: string,
    props: object
  ): React.ReactElement | null {
    const definition = contract.get(slotName);
    if (!definition) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`ComponentFactory.render: unknown slot "${slotName}" — returning null`);
      }
      return null;
    }

    if (definition.target === "server") {
      throw new Error(
        `ComponentFactory.render: slot "${slotName}" is a server slot. ` +
        `Use await factory.resolveServer("${slotName}") inside a Server Component instead.`
      );
    }

    const entry = registry.get(slotName);
    const effectiveMode: SlotMode = entry?.mode ?? definition.mode;
    const Resolved = resolve(slotName);
    const element = createElement(Resolved, props);

    if (effectiveMode === "async" && definition.target === "client") {
      return createElement(Suspense, { fallback: definition.fallback }, element);
    }

    return element;
  }

  // ─── resolveServer ─────────────────────────────────────────────────────────

  async function resolveServer(
    slotName: string
  ): Promise<ComponentType<any>> {
    const definition = contract.get(slotName);
    if (!definition) {
      throw new Error(
        `ComponentFactory.resolveServer: unknown slot "${slotName}". ` +
        `Known slots: [${[...contract.keys()].join(", ")}]`
      );
    }

    if (definition.target !== "server") {
      throw new Error(
        `ComponentFactory.resolveServer: slot "${slotName}" is a client slot. ` +
        `Use factory.render("${slotName}", props) for client slots.`
      );
    }

    const entry = registry.get(slotName);

    if (entry) {
      const mod = await (
        entry.override as () => Promise<{ default: ComponentType<any> }>
      )();
      return mod.default;
    }

    const { defaultComponent } = definition;

    if (defaultComponent === null) {
      throw new Error(
        `ComponentFactory.resolveServer: slot "${slotName}" has no registered override and no default.`
      );
    }

    if (isLazyDefault(defaultComponent)) {
      const mod = await (
        defaultComponent as () => Promise<{ default: ComponentType<any> }>
      )();
      return mod.default;
    }

    return defaultComponent as ComponentType<any>;
  }

  // ─── register ──────────────────────────────────────────────────────────────

  function register(
    slotName: string,
    override: SlotOverride<any>,
    mode?: SlotMode
  ): ComponentFactory {
    const definition = contract.get(slotName);
    if (!definition) {
      throw new Error(
        `ComponentFactory.register: unknown slot "${slotName}". ` +
        `Known slots: [${[...contract.keys()].join(", ")}]`
      );
    }

    const resolvedMode: SlotMode = mode ?? definition.mode;

    if (definition.mode === "sync" && resolvedMode === "async") {
      throw new Error(
        `ComponentFactory.register: slot "${slotName}" is declared as sync — ` +
        `it cannot accept an async override.`
      );
    }


    // ── Dev warning: detect registration from a genuine Server Component ───────
    //
    // typeof window === "undefined" fires in TWO different situations:
    //   1. Inside a React Server Component (RSC) — genuinely server-only code.
    //      Here, import() thunks are statically analysed by the bundler and
    //      both the default and override end up in the same chunk. BAD.
    //
    //   2. During SSR of a "use client" component — client code running on the
    //      server to produce the initial HTML. The thunk lives in a client module
    //      and IS a genuine lazy split point. Bundle output is correct. FINE.
    //
    // We distinguish the two using React's `cache` function: it is only importable
    // and functional in the RSC runtime. In a "use client" SSR context, `cache`
    // is a no-op stub that returns the same function — but more usefully, the
    // React DevTools / fiber internals set a dispatcher that differs between the
    // two runtimes. The most portable signal: check for the RSC-specific async
    // context marker that Next.js sets.
    //
    // Fallback heuristic: if this module was imported from a "use client" file
    // (FactoryProvider.tsx), the override thunk is written in client code and
    // the bundle split works correctly regardless of window's value.
    //
    // We suppress the warning when `register()` is called during a component
    // render (indicated by the React dispatcher being set), which distinguishes
    // SSR of client components from module-level RSC evaluation.
    if (
      process.env.NODE_ENV !== "production" &&
      definition.target === "client" &&
      typeof window === "undefined"
    ) {
      // Attempt to detect whether we are in an RSC context vs SSR of a client
      // component. In Next.js App Router, RSC execution happens before any
      // React renderer is active on the server — React's current dispatcher
      // is null during RSC module evaluation but is set during SSR rendering.
      //
      // If we cannot confirm we are in active SSR rendering, warn — but include
      // context so the team can distinguish the false-positive case (FactoryProvider
      // during SSR) from the genuine problem (register() at module scope in an RSC).
      const ReactInternals = (React as unknown as Record<string, unknown>);
      const dispatcher = (
        ReactInternals.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED as
          | { ReactCurrentDispatcher?: { current: unknown } }
          | undefined
      )?.ReactCurrentDispatcher?.current;
      const isActiveSSRRender = dispatcher !== null && dispatcher !== undefined;
 
      if (!isActiveSSRRender) {
        console.warn(
          `[ComponentFactory] register("${slotName}") was called outside an active ` +
          `React render — likely from module scope in a Server Component.\n` +
          `\n` +
          `If this warning fires during FactoryProvider SSR rendering, it is a ` +
          `false positive and can be ignored — the override thunk lives in a "use client" ` +
          `module and the bundle split is working correctly.\n` +
          `\n` +
          `If this fires from module-level code in a server file (not during rendering), ` +
          `move the register() call into a "use client" module to get genuine lazy splitting.`
        );
      }
    }

    // Invalidate the override lazy cache entry only.
    // The "default:" entry is preserved — reusable if the override is later removed.
    lazyCache.delete(`override:${slotName}`);

    registry.set(slotName, {
      slotName,
      override: override as SlotOverride<object>,
      mode: resolvedMode,
    });

    return factory;
  }

  // ─── registerAll ───────────────────────────────────────────────────────────

  function registerAll(overrides: OverridesMap<TSlots>): ComponentFactory {
    for (const slotName of Object.keys(overrides) as (keyof TSlots & string)[]) {
      const override = overrides[slotName];
      if (override !== undefined) {
        register(slotName, override);
      }
    }
    return factory;
  }

  // ─── isRegistered ──────────────────────────────────────────────────────────

  function isRegistered(slotName: string): boolean {
    return registry.has(slotName);
  }

  // ─── branch ────────────────────────────────────────────────────────────────
  //
  // Returns a new factory sharing the same contract (slot definitions) but with
  // a completely fresh registry and lazyCache. No overrides are inherited.
  //
  // This is what makes scoped overrides possible:
  //   ComponentFactory calls clientFactory.branch() and registers "add-to-cart"
  //   on the branch — product:sidebar gets the override via the branch.
  //   product:main uses PlaceholderRenderer which closes over the original
  //   clientFactory singleton — its registry is still empty → renders default.
  //
  // The critical invariant: branch() creates new Map() instances. The parent's
  // registry and lazyCache are NEVER referenced from the branch. Mutations on
  // the branch (registry.set, lazyCache.set) cannot reach the parent's maps.

  function branch(): ComponentFactory {
    return buildFactory<TSlots>(contract);
  }

  // ─── Assemble ──────────────────────────────────────────────────────────────

  const factory: ComponentFactory = {
    register,
    render,
    resolve,
    resolveServer,
    isRegistered,
    branch,
    get registeredSlots() {
      return registry as ReadonlyMap<string, RegistryEntry>;
    },
    get contract() {
      return contract as ReadonlyMap<string, SlotDefinition>;
    },
  };

  return factory;
}