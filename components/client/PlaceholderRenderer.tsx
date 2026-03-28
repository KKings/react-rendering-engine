"use client";

/**
 * packages/ui/components/PlaceholderRenderer.tsx  (application layer)
 *
 * Application-specific instance of PlaceholderRenderer, bound to clientFactory.
 * This file lives in the application / shared-UI package — NOT in the
 * placeholder library package. It is the only file that imports clientFactory.
 *
 * Import this in your pages and components:
 *   import { PlaceholderRenderer } from "@/packages/ui/components/PlaceholderRenderer";
 *
 * Do NOT import createPlaceholderRenderer directly in pages — that would
 * require passing the factory everywhere and defeats the purpose.
 */

import { createPlaceholderRenderer } from "@/packages/placeholder";
import { clientFactory } from "@/packages/ui/client-factory";

clientFactory.register('add-to-cart', () => import("./AddToCart"), 'async')

export const PlaceholderRenderer = createPlaceholderRenderer(clientFactory);