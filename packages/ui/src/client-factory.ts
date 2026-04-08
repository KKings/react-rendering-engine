import { FactoryBuilder } from "@repo/slots";
import { addToCartSlot } from "./client/AddToCart/slot";

export const clientFactory = new FactoryBuilder().add(addToCartSlot).build();