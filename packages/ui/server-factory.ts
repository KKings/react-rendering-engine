// packages/ui/client-factory.ts
import { FactoryBuilder } from "../factory";
import { productDescription } from "./server/ProductDescription/slot";
import { productSummary } from "./server/ProductSummary/slot";

export const serverFactory = new FactoryBuilder()
  .add(productSummary)
  .add(productDescription)
  .build();