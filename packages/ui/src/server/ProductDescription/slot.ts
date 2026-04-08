import { SlotBuilder } from "@repo/slots";

export const productDescription = new SlotBuilder("product-description")
  .description("Server-rendered product description")
  .defaultsTo(() => import("./index"))
  .server()   // ← target: "server"
  .async();