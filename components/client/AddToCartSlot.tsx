"use client";

import { clientFactory } from "@/packages/ui/client-factory";

export function AddToCartSlot(props: { productId: string; price: number; initialStock: number }) {
  // render() is called here, in the client module, after register() above.
  return clientFactory.render("add-to-cart", props);
}