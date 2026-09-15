import { Hono } from "hono";

import { health } from "@/routes";

const app = new Hono();

app.route("/health", health);

export default app;
