/**
 * usage-example.ts / usage-example.tsx
 *
 * Shows how PlaceholderBuilder + PlaceholderRegistryBuilder compose with
 * the existing slot factory on a product page.
 *
 * Three files in a real project:
 *   1. packages/ui/placeholder-registry.ts   — shared default sequences
 *   2. packages/brand-luminary/register.ts   — brand mutations ("use client")
 *   3. app/products/[id]/page.tsx            — rendering
 */

// ─── 1. Shared package: define the default sequences ─────────────────────────
// packages/ui/placeholder-registry.ts

import {
  PlaceholderBuilder,
  PlaceholderRegistryBuilder,
} from "@repo/placeholder";
import { AddToCartProps } from "./client/AddToCart/types";

export const placeholderRegistry = new PlaceholderRegistryBuilder()

  .add(
    new PlaceholderBuilder("product:sidebar")
      .description("product sidebar items")
      .slot<AddToCartProps>(
        "add-to-cart", // item id — used for mutations
        "add-to-cart", // factory slot name
        { productId: "99", price: 0, initialStock: 99 }, // props (overridden at render)
      ),
  )

  .add(
    new PlaceholderBuilder("server:product:sidebar-top").description(
      "Server-rendered sidebar items (with async components)",
    ),
  )

  .add(
    new PlaceholderBuilder("product:main")
      .description("Above-the-fold product detail sections")
      .component(
        "product-image",
        () => import("./server/ProductImage"),
        {},
        true,
      )
      .slot("product-description", "product-description", {}, true),
  )
  .build();
