import { Hono } from "hono";

import { SERVICE_NAME } from "@/utils/constants";

export const health = new Hono();

health.get("/", (c) => c.json({ status: "ok", service: SERVICE_NAME }));
