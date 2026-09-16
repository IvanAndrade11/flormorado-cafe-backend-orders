import { z } from "zod";

// Formato colombiano con punto de miles, tal como llega de ConfigCat: "45.000".
const COP_PRICE = /^\d{1,3}(\.\d{3})*$/;

// Solo se declaran los campos de los que depende el backend. Los demás
// (imageUrl, tags, process, ...) pasan sin validar a propósito: si el catálogo
// gana un campo nuevo o cambia uno que no usamos, la verificación de precios no
// tiene por qué romperse.
export const catalogProductSchema = z.object({
  id: z.string().min(1),
  stock: z.boolean(),
  name: z.string().min(1),
  brand: z.string(),
  grinding: z.string(),
  size: z.string(),
  price: z.string().regex(COP_PRICE, 'se esperaba un precio como "45.000"'),
  shippingPrice: z.number().int().nonnegative(),
});

export const catalogSchema = z.object({
  products: z.array(catalogProductSchema).min(1),
});

export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type Catalog = z.infer<typeof catalogSchema>;
