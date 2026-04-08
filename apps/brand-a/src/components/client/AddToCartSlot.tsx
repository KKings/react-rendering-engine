"use client";

import { useFactory } from "@repo/slots";

export function AddToCartSlot(props: {
  productId: string;
  price: number;
  initialStock: number;
}) {
  const clientFactory = useFactory();
  return clientFactory.render("add-to-cart", props);
}
