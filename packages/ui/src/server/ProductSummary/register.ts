
import { serverFactory } from "../../server-factory";

serverFactory.register("product-summary", () => import("./ProductSummary"), "async");