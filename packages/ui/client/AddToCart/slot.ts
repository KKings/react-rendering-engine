import { SlotBuilder } from "@/packages/factory";
import type { AddToCartProps } from "./types";

export const addToCartSlot = new SlotBuilder<AddToCartProps>("add-to-cart")
  .description("Interactive add-to-cart button")
  .defaultsTo(() => import('./AddToCart'))
  .client()
  .async();