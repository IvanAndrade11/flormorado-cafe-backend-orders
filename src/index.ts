import { Hono } from "hono";

import { health, orders } from "@/routes";
import type { Env } from "@/types/env";

const app = new Hono<{ Bindings: Env }>();

app.route("/health", health);
app.route("/orders", orders);

export default app;
