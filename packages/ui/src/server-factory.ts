import { FactoryBuilder } from "@repo/slots";
import { productDescription } from "./server/ProductDescription/slot";
import { productSummary } from "./server/ProductSummary/slot";

export const serverFactory = new FactoryBuilder()
  .add(productSummary)
  .add(productDescription)
  .build();