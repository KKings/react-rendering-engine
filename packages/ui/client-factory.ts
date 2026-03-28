// packages/ui/client-factory.ts
import { FactoryBuilder } from "../factory";
import { addToCartSlot } from "./client/AddToCart/slot";

export const clientFactory = new FactoryBuilder()
  .add(addToCartSlot)
  .build();