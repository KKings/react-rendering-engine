/**
 * PLACEHOLDER ARCHITECTURE PATTERNS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Server/Client Component Boundary in Placeholders
 *
 * The core issue: Functions (lazy thunks) cannot be serialized across
 * the Server/Client boundary. PlaceholderItems can contain ComponentItems
 * with lazy thunks, which fail when passed to client components.
 *
 * This document outlines three architectural patterns and when to use them.
 */

// ═════════════════════════════════════════════════════════════════════════════
// PATTERN 1: FILTERED SERIALIZATION (RECOMMENDED FOR YOUR PROJECT)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Best for: Mixed architectures where you have both slot-based resolution
 * (factory) and direct component items.
 *
 * Approach:
 *   1. Define placeholders with SlotItems and DividerItems only
 *   2. Use filterSerializableItems() on the server before passing to client
 *   3. Client PlaceholderRenderer only knows about slots and dividers
 *   4. All component resolution happens via factories (server or client)
 *
 * Pros:
 *   ✓ Clean separation of concerns
 *   ✓ Factories own all component resolution
 *   ✓ Works with both server and client slots
 *   ✓ Easy to mutate items (brands can add/remove slots)
 *
 * Cons:
 *   ✗ Cannot use eager ComponentItems in shared placeholder definitions
 *   ✗ All components must be registered in factories
 *
 * Example:
 *   // packages/ui/placeholder-registry.ts (SHARED/SERVER)
 *   export const placeholderRegistry = new PlaceholderRegistryBuilder()
 *     .add(
 *       new PlaceholderBuilder("product-page-actions")
 *         // Only slots and dividers — NO ComponentItems
 *         .slot<AddToCartProps>("add-to-cart", "add-to-cart", { ... })
 *         .divider("separator")
 *     )
 *     .build();
 *
 *   // app/p/[id]/page.tsx (SERVER COMPONENT)
 *   import { filterSerializableItems } from "@/packages/placeholder";
 *
 *   export default function ProductPage({ params }: ProductPageProps) {
 *     const actionItems = placeholderRegistry.resolve("product-page-actions");
 *
 *     return (
 *       <PlaceholderRenderer
 *         items={filterSerializableItems(actionItems)}
 *         factory={clientFactory}
 *       />
 *     );
 *   }
 */
export const PATTERN_1_FILTERED_SERIALIZATION = {
  description:
    "Filter out non-serializable items (ComponentItems) before passing to client",
  usage:
    "Scenarios with factories as the primary component resolution mechanism",
  implementation: `
    1. Use SlotItems in placeholder definitions instead of ComponentItems
    2. Call filterSerializableItems(items) on server before rendering client component
    3. All dynamic components registered in factories (clientFactory, serverFactory, etc.)
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// PATTERN 2: SERVER-SIDE PLACEHOLDER RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Best for: Simple cases where all placeholder items are server-resolved,
 * or where you want maximum control over component selection.
 *
 * Approach:
 *   1. Keep PlaceholderRenderer on the server (remove 'use client')
 *   2. Resolve all items on the server before rendering
 *   3. Only eager ComponentTypes are rendered (no lazy thunks)
 *   4. Client components are rendered via factory slots
 *
 * Pros:
 *   ✓ No serialization boundary to worry about
 *   ✓ Can use any ComponentItem (eager or lazy)
 *   ✓ Full control over what renders
 *   ✓ Simpler for specific use cases
 *
 * Cons:
 *   ✗ PlaceholderRenderer cannot be a Client Component
 *   ✗ Less flexible for brand mutations from client
 *   ✗ Cannot interleave client components with rendering logic
 *
 * Example:
 *   // packages/placeholder/components/PlaceholderRenderer.tsx
 *   // Remove "use client" — make it a Server Component
 *
 *   import { Suspense } from "react";
 *
 *   export async function PlaceholderRenderer({
 *     items,
 *     factory,
 *     dividerComponent,
 *   }: PlaceholderRendererProps) {
 *     // ... render logic
 *   }
 *
 *   // Now you can use ComponentItems with lazy thunks because
 *   // the resolve/lazy wrapping happens server-side
 */
export const PATTERN_2_SERVER_SIDE_RESOLUTION = {
  description: "Keep all placeholder processing on the server",
  usage: "Simple pages where items don't need client-side mutation",
  implementation: `
    1. Remove "use client" from PlaceholderRenderer
    2. Make PlaceholderRenderer an async Server Component
    3. Handle Suspense for lazy ComponentItems server-side
    4. Pass only rendered JSX to client components
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// PATTERN 3: DUAL REGISTRIES (SERVER & CLIENT)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Best for: Complex applications where server and client placeholders
 * are fundamentally different or require different mutation strategies.
 *
 * Approach:
 *   1. Define separate placeholder registries for server and client
 *   2. Server registry: SlotItems only, resolved server-side
 *   3. Client registry: SlotItems and eager ComponentItems
 *   4. Use the appropriate registry based on rendering context
 *
 * Pros:
 *   ✓ Maximum flexibility for server vs client concerns
 *   ✓ Can have completely different item sets per context
 *   ✓ Clear separation of responsibilities
 *   ✓ Brands can mutate server and client items independently
 *
 * Cons:
 *   ✗ More boilerplate and files
 *   ✗ Duplicate placeholder definitions in some cases
 *   ✗ Risk of inconsistency between server/client registries
 *
 * Example:
 *   // packages/ui/placeholder-registry.server.ts
 *   export const serverPlaceholderRegistry = new PlaceholderRegistryBuilder()
 *     .add(
 *       new PlaceholderBuilder("product-page-actions")
 *         .slot<ActionsProps>("actions-container", "product-actions", {})
 *     )
 *     .build();
 *
 *   // packages/ui/placeholder-registry.client.ts
 *   "use client";
 *
 *   export const clientPlaceholderRegistry = new PlaceholderRegistryBuilder()
 *     .add(
 *       new PlaceholderBuilder("product-interactions")
 *         .component("wishlist", WishlistButton, {})
 *         .component("compare", CompareButton, {})
 *     )
 *     .build();
 */
export const PATTERN_3_DUAL_REGISTRIES = {
  description: "Separate server and client placeholder registries",
  usage: "Complex applications with distinct server/client placeholder needs",
  implementation: `
    1. Create placeholder-registry.server.ts with server items only
    2. Create placeholder-registry.client.ts with client items only
    3. Use appropriate registry in each context
    4. Brands mutate each registry independently
  `,
};

// ═════════════════════════════════════════════════════════════════════════════
// MIGRATION GUIDE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Current state: Using Pattern 1 (Filtered Serialization)
 *
 * Changes made:
 *   1. ✅ Created server-utils.ts with filterSerializableItems()
 *   2. ✅ Updated [id]/page.tsx to filter items before passing to client
 *   3. ✅ Exported utilities from packages/placeholder/index.ts
 *
 * Next steps if needed:
 *   → Add more SlotItems to placeholder-registry.ts for new components
 *   → Register component defaults in clientFactory or serverFactory
 *   → Brands mutate registered slots instead of adding ComponentItems
 */

export const CURRENT_ARCHITECTURE = {
  pattern: "PATTERN 1: Filtered Serialization",
  files: {
    server: "packages/placeholder/server-utils.ts",
    page: "app/p/[id]/page.tsx",
    registry: "packages/ui/placeholder-registry.ts",
  },
  benefits: [
    "Factory-based resolution for consistency",
    "Easy brand mutation via slot registration",
    "Supports both server and client components",
  ],
};
