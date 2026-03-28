// packages/ui/client/AddToCart/register.ts
"use client";

import { clientFactory } from "../../client-factory";

clientFactory.register("add-to-cart", () => import("./AddToCart"), "async");