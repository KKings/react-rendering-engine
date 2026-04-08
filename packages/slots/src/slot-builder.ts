import type { ReactNode } from "react";
import type { SlotDefinition, SlotMode, SlotTarget, DefaultResolver } from "./types";

/**
 * SlotBuilder
 *
 * A fluent builder for a single slot definition. Produced by
 * `FactoryBuilder.slot(name)` and consumed by `FactoryBuilder.add(builder)`.
 *
 * @example
 * ```ts
 * const slot = new SlotBuilder<HeroProps>("hero")
 *   .description("Full-width hero banner at the top of each brand page")
 *   .defaultsTo(DefaultHero)
 *   .async()                     // code-split; wrapped in Suspense
 *   .client()                    // resolves as a Client Component
 *   .withFallback(<HeroSkeleton />)
 *   .build();
 * ```
 */
export class SlotBuilder<TProps extends object = object> {
  private _name: string;
  private _description: string = "";
  private _mode: SlotMode = "async";        // default: async (code-split)
  private _target: SlotTarget = "client";   // default: client component
  private _fallback: ReactNode = null;
  private _defaultComponent: DefaultResolver<TProps> | null = null;

  constructor(name: string) {
    this._name = name;
  }

  // ─── Fluent setters ────────────────────────────────────────────────────────

  /**
   * Describe the purpose of this slot.
   * This is the public-facing contract documentation for brand teams.
   */
  description(text: string): this {
    this._description = text;
    return this;
  }

  /**
   * Set the default component rendered when no brand override is registered.
   * This is optional — if not called, a brand override MUST be registered.
   *
   * When omitted, the default component is tree-shaken from the bundle,
   * saving bytes when the slot is always overridden in practice.
   *
   * Accepts either:
   * - An eager `ComponentType` — imported at module eval time, always in the
   *   shared bundle. Best for sync slots or small, universally-needed components.
   * - A lazy thunk `() => import("...")` — excluded from the shared bundle and
   *   only fetched when the slot actually renders with no override. Best for
   *   async slots where the default is large or most brands override it anyway.
   *
   * @example
   * // Eager: always bundled — good for nav, footer, small primitives
   * .defaultsTo(DefaultNav)
   *
   * // Lazy: code-split — good for hero, product-card, large page sections
   * .defaultsTo(() => import("./components/defaults/Hero"))
   *
   * // No default: must be overridden
   * // new SlotBuilder<HeroProps>("hero").description(...).client()
   */
  defaultsTo(component: DefaultResolver<TProps>): this {
    this._defaultComponent = component;
    return this;
  }

  /**
   * Mark this slot as async (code-split).
   * The factory wraps the resolved component in a Suspense boundary.
   * This is the default — explicit call is useful for readability.
   */
  async(): this {
    this._mode = "async";
    return this;
  }

  /**
   * Mark this slot as sync (bundled).
   * The component is imported directly — no Suspense, no loading state.
   * Use for above-the-fold, critical-path components.
   */
  sync(): this {
    this._mode = "sync";
    return this;
  }

  /**
   * Declare this slot as a Client Component slot.
   * Async client slots use React.lazy for code splitting.
   */
  client(): this {
    this._target = "client";
    return this;
  }

  /**
   * Declare this slot as a Server Component slot.
   * Async server slots use native RSC async import — React.lazy is NOT used.
   * Note: server slots cannot accept 'use client' component overrides.
   */
  server(): this {
    this._target = "server";
    return this;
  }

  /**
   * Provide a fallback UI shown while an async slot's component is loading.
   * Ignored for sync slots.
   */
  withFallback(fallback: ReactNode): this {
    this._fallback = fallback;
    return this;
  }

  // ─── Finalise ──────────────────────────────────────────────────────────────

  /**
   * Validate and produce the immutable SlotDefinition.
   * `.defaultsTo()` is optional. If not called, the slot requires a brand override.
   */
  build(): SlotDefinition<TProps> {
    // if (
    //   process.env.NODE_ENV !== "production" &&
    //   this._target === "client" &&
    //   this._defaultComponent !== null
    // ) {
    //   console.warn(
    //     `SlotBuilder: slot "${this._name}" is a client slot with a defaultsTo() set in the factory contract.\n` +
    //     `The defaultsTo() thunk is in a server module — Turbopack will resolve it eagerly,\n` +
    //     `bundling the default component even when an override is registered.\n` +
    //     `\n` +
    //     `Instead: remove .defaultsTo() from the SlotBuilder and register the default\n` +
    //     `from a "use client" module:\n` +
    //     `\n` +
    //     `  // packages/ui/register-defaults.ts\n` +
    //     `  "use client";\n` +
    //     `  sharedFactory.register("${this._name}", () => import("./DefaultImpl"), "async");`
    //   );
    // }
    
    return Object.freeze({
      name: this._name,
      description: this._description,
      mode: this._mode,
      target: this._target,
      fallback: this._fallback,
      defaultComponent: this._defaultComponent,
    } satisfies SlotDefinition<TProps>);
  }
}