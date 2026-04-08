import type {
  PlaceholderDefinition,
  PlaceholderItem,
  DefaultResolver,
} from "./types";

/**
 * PlaceholderBuilder
 *
 * Fluent builder for a single placeholder's default item sequence.
 * Consumed by PlaceholderRegistryBuilder.add().
 *
 * The builder produces an ordered list of named items. Each item has a
 * stable id used by brand mutations (insertAfter, remove, hide, etc.).
 *
 * @example
 * ```ts
 * new PlaceholderBuilder("product-page-actions")
 *   .description("Action buttons below the product summary")
 *   .component("add-to-cart-slot",
 *     { kind: "slot", slotName: "add-to-cart", props: {} })
 *   .divider("actions-divider")
 *   .component<WishlistProps>("wishlist-btn",
 *     () => import("./WishlistButton"),
 *     { productId: "" })
 *   .build()
 * ```
 */
export class PlaceholderBuilder {
  private _name: string;
  private _description: string = "";
  private _items: PlaceholderItem[] = [];
  private _ids = new Set<string>();

  constructor(name: string) {
    this._name = name;
  }

  // ─── Fluent setters ────────────────────────────────────────────────────────

  description(text: string): this {
    this._description = text;
    return this;
  }

  // ─── Item appenders ────────────────────────────────────────────────────────

  /**
   * Append a component item to the sequence.
   *
   * The component can be eager (pass the ComponentType directly) or lazy
   * (pass a () => import(...) thunk). Same rules as SlotBuilder.defaultsTo().
   *
   * @example
   * // Eager
   * .component<WishlistProps>("wishlist", WishlistButton, { productId: "123" })
   *
   * // Lazy — excluded from shared bundle until rendered
   * .component<WishlistProps>("wishlist",
   *   () => import("./WishlistButton"),
   *   { productId: "123" })
   */
  component<TProps extends object>(
    id: string,
    component: DefaultResolver<TProps>,
    props: TProps,
    visible = true
  ): this {
    this._assertUniqueId(id);
    this._items.push({
      kind: "component",
      id,
      visible,
      component,
      props,
    } as unknown as PlaceholderItem);
    return this;
  }

  /**
   * Append a slot item — delegates rendering to the factory.
   * The factory resolves the brand override or default at render time.
   *
   * @example
   * .slot<AddToCartProps>("add-to-cart-slot", "add-to-cart", {
   *   productId: "123",
   *   price: 99.99,
   *   initialStock: 5,
   * })
   */
  slot<TProps extends object>(
    id: string,
    slotName: string,
    props: TProps,
    visible = true
  ): this {
    this._assertUniqueId(id);
    this._items.push({
      kind: "slot",
      id,
      visible,
      slotName,
      props,
    } as unknown as PlaceholderItem);
    return this;
  }

  /**
   * Append a divider — a structural separator with no component or props.
   *
   * @example
   * .divider("primary-secondary-divider")
   */
  divider(id: string, visible = true): this {
    this._assertUniqueId(id);
    this._items.push({
      kind: "divider",
      id,
      visible,
    } as unknown as PlaceholderItem);
    return this;
  }

  // ─── Finalise ──────────────────────────────────────────────────────────────

  build(): PlaceholderDefinition {
    if (this._items.length === 0) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `PlaceholderBuilder: placeholder "${this._name}" was built with no items. ` +
          `Add items with .component(), .slot(), or .divider() before calling .build().`
        );
      }
    }

    return Object.freeze({
      name: this._name,
      description: this._description,
      items: Object.freeze([...this._items]),
    } satisfies PlaceholderDefinition);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _assertUniqueId(id: string): void {
    if (this._ids.has(id)) {
      throw new Error(
        `PlaceholderBuilder "${this._name}": duplicate item id "${id}". ` +
        `Each item id must be unique within a placeholder.`
      );
    }
    this._ids.add(id);
  }
}
