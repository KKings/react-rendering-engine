/**
 * server-utils.ts
 *
 * Utilities for handling placeholders on the server side.
 * This file bridges the Server/Client component boundary by pre-processing
 * placeholder items before passing them to client components.
 *
 * Key principle: Functions (lazy thunks) cannot be serialized from server
 * to client. This module separates server and client concerns:
 *
 * - ComponentItems with lazy defaults → resolve server-side or skip
 * - SlotItems → pass to client (factory handles resolution)
 * - DividerItems → pass to client (serializable)
 */

import type { PlaceholderItem, SlotItem, DividerItem } from "./types";

/**
 * Filters placeholder items to only include serializable types.
 *
 * Removes ComponentItems (which may contain functions) and keeps:
 * - SlotItems: serializable, delegate resolution to client factory
 * - DividerItems: serializable, no component logic
 *
 * Use this when passing items from a Server Component to PlaceholderRenderer
 * (a Client Component).
 *
 * @example
 * // In a Server Component:
 * const allItems = placeholderRegistry.resolve("product-page-actions");
 * const serializableItems = filterSerializableItems(allItems);
 *
 * return (
 *   <PlaceholderRenderer
 *     items={serializableItems}
 *     factory={clientFactory}
 *   />
 * );
 */
export function filterSerializableItems(
  items: ReadonlyArray<PlaceholderItem>,
): ReadonlyArray<SlotItem | DividerItem> {
  return items.filter(
    (item) => item.kind === "slot" || item.kind === "divider",
  ) as ReadonlyArray<SlotItem | DividerItem>;
}

/**
 * Type guard: checks if an item has a required factory slot.
 * Useful for validation when PlaceholderRenderer requires specific slot registrations.
 *
 * @example
 * const slotItems = allItems.filter(isSlotItem);
 * // → Array<SlotItem> with type assertion
 */
export function isSlotItem(item: PlaceholderItem): item is SlotItem {
  return item.kind === "slot";
}

/**
 * Type guard: checks if an item is a divider.
 */
export function isDividerItem(
  item: PlaceholderItem,
): item is DividerItem {
  return item.kind === "divider";
}
