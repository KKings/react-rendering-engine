import { SlotBuilder } from "@/packages/factory";

export const productDescription = new SlotBuilder("product-description")
  .description("Server-rendered product description")
  .defaultsTo(() => import("./index"))
  .server()   // ← target: "server"
  .async();