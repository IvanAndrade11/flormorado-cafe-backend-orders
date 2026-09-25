import { z } from "zod";

import { ORDER_STATUSES } from "@/utils/constants";

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const contactMessageStatusUpdateSchema = z.object({
  status: z.enum(["nuevo", "atendido"]),
});
