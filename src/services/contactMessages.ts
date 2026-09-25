import type { ContactRequest } from "@/schemas/contact";
import type { Env } from "@/types/env";

export interface ContactMessageRow {
  id: number;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  email_status: string;
  status: string;
}

// Si Resend falla, routes/contact.ts responde 502 para que el frontend
// reintente (mismo criterio que ya usa con 429/5xx). Sin esto, cada reintento
// crearía un mensaje duplicado en el panel para lo que el cliente ve como un
// solo envío.
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

export const findRecentDuplicate = (
  env: Env,
  request: ContactRequest,
  now: Date,
) => {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();

  return env.DB.prepare(
    `SELECT id FROM contact_messages
     WHERE email = ?1 AND message = ?2 AND created_at >= ?3
     ORDER BY created_at DESC
     LIMIT 1`,
  )
    .bind(request.email, request.message, since)
    .first<{ id: number }>();
};

export const persistContactMessage = async (
  env: Env,
  request: ContactRequest,
  now: Date,
): Promise<number> => {
  const result = await env.DB.prepare(
    `INSERT INTO contact_messages (created_at, name, email, phone, subject, message)
     VALUES (?1,?2,?3,?4,?5,?6)`,
  )
    .bind(
      now.toISOString(),
      request.name,
      request.email,
      request.phone ?? null,
      request.subject,
      request.message,
    )
    .run();

  return result.meta.last_row_id;
};

/** Deja rastro de si el correo al negocio salió, para que el panel lo muestre. */
export const recordContactMessageEmailStatus = (
  env: Env,
  id: number,
  status: string,
) =>
  env.DB.prepare("UPDATE contact_messages SET email_status = ?2 WHERE id = ?1")
    .bind(id, status.slice(0, 200))
    .run();

export const listContactMessages = async (
  env: Env,
): Promise<ContactMessageRow[]> => {
  const rows = await env.DB.prepare(
    "SELECT * FROM contact_messages ORDER BY created_at DESC",
  ).all<ContactMessageRow>();

  return rows.results;
};

export const updateContactMessageStatus = async (
  env: Env,
  id: number,
  status: string,
): Promise<boolean> => {
  const result = await env.DB.prepare(
    "UPDATE contact_messages SET status = ?2 WHERE id = ?1",
  )
    .bind(id, status)
    .run();

  return result.meta.changes > 0;
};
