import { SlotBuilder } from "@repo/slots";
import type { Product } from "./types";

export const productSummary = new SlotBuilder<Product>("product-summary")
  .description("Server-rendered product name, price, stock, and description")
  .defaultsTo(() => import("./ProductSummary"))
  .server()   // ← target: "server"
  .async()