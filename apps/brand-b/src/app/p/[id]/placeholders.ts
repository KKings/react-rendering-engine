import { PlaceholderMutation } from "@repo/placeholder";

type PlaceholderConfigurationFunc = (
  productId: string,
) => Record<string, PlaceholderMutation[]>;

/**
 * Brand-b specific placeholder changes for a product
 */
export const createPlaceholderConfiguration: PlaceholderConfigurationFunc = (
  productId: string,
) => ({
  "server:product:sidebar-top": [
    {
      op: "append",
      item: {
        kind: "component",
        id: "product-summary",
        component: () =>
          import("@repo/ui").then((mod) => mod.ProductSummaryServer),
        props: {
          productId,
        },
        visible: true,
      },
    },
  ],
  "product:sidebar": [
    {
      op: "append",
      item: {
        kind: "component",
        id: "product-image",
        component: () => import("@repo/ui").then((mod) => mod.ProductImage),
        props: {
          image: {
            url: "https://picsum.photos/seed/9/300/150",
            width: 300,
            height: 150,
          },
        },
        visible: true,
      },
    },
  ],
  "product:main": [
    {
      op: "replace",
      id: "product-description",
      item: {
        kind: "component",
        id: "product-description",
        component: () => import("@/components/server/ProductDescription"),
        props: {},
        visible: true,
      },
    },
  ],
});
