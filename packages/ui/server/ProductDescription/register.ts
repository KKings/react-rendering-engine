
import { serverFactory } from "../../server-factory";

serverFactory.register("product-description", () => import("./index"), "async");