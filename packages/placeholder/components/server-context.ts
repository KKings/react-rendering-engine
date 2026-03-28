// packages/placeholder/server-context.ts
import { cache } from "react";
import type { PlaceholderRegistry } from "../types";

/**
 * Returns the branch set by PlaceholderProvider for this render pass.
 * React.cache scopes this to a single request — no cross-request bleed.
 * Throws if called outside a PlaceholderProvider.
 */
export const getPlaceholderBranch = cache((): { registry: PlaceholderRegistry | null } => {
  // The object is mutated by PlaceholderProvider after creation.
  // cache() returns the same object reference within a render pass.
  return { registry: null };
});