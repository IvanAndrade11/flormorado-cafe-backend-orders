# Encargados del tratamiento

Los proveedores de esta lista tratan datos personales de clientes de Flormorado
Café **por cuenta nuestra**, siguiendo nuestras instrucciones y no para sus
propios fines. Su acuerdo de tratamiento de datos (DPA) es el documento que lo
deja por escrito, y es lo que sustenta que los datos se alojen fuera de
Colombia.

Esta lista tiene que coincidir con la sección 5 de la [política de tratamiento
de datos](https://flormoradocafe.com/#/politica-de-datos) que ve el cliente. Si
entra un proveedor nuevo, se actualizan los dos — un encargado que el cliente no
conoce es un tratamiento que no autorizó.

| Proveedor  | Qué datos trata                                                                                                                                | Dónde                                 | Acuerdo                                                                                                                                 | ¿Aceptado? |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Cloudflare | Todo: pedidos, clientes y mensajes de contacto viven en su base D1, y el Worker los procesa. Turnstile ve además datos técnicos de la conexión | EE. UU. y su red global               | [Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)                                                                     | Pendiente  |
| Resend     | Nombre, correo y detalle del pedido de cada correo de confirmación, y el resumen al negocio                                                    | EE. UU.                               | [Data Processing Addendum](https://resend.com/legal/dpa)                                                                                | Pendiente  |
| GitHub     | Publica la tienda (GitHub Pages). No recibe pedidos, pero sí la dirección IP de quien visita el sitio, en sus registros de servidor            | EE. UU.                               | Enlazado desde su [declaración de privacidad](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) | Pendiente  |
| Zoho       | El buzón `info@flormoradocafe.com`: ahí llegan el resumen de pedidos y los mensajes del formulario de contacto, con los datos que traen        | Según el centro de datos de la cuenta | Se solicita desde la cuenta (ver abajo)                                                                                                 | Pendiente  |

## Qué hay que hacer con cada uno

**Cloudflare y Resend** publican su DPA y se entiende aceptado al usar el
servicio. Basta con guardar una copia del PDF con la fecha en que se consultó,
porque las versiones cambian y lo que importa es cuál regía.

**GitHub** enlaza su acuerdo desde la declaración de privacidad. Misma idea:
guardar copia.

**Zoho** no lo publica abierto, hay que pedirlo. Dos caminos: desde la cuenta,
en **Privacy → Data Processing Addendum → Initiate Now**, o escribiendo a
`legal@zohocorp.com` indicando en qué centro de datos se creó la cuenta.

Cuando tengas cada uno, cambia su casilla a «Sí» con la fecha. No hace falta
guardarlos en el repositorio: basta con que estén donde puedas encontrarlos si
alguien los pide.

## Lo que no es un encargado

- **ConfigCat** sirve el catálogo de productos y los textos del blog. No recibe
  ni almacena un solo dato de cliente, así que no entra en esta lista.
- **Hostinger** administra el DNS de `flormoradocafe.com`. Resuelve nombres, no
  trata datos de clientes.

Que no sean encargados no es un descuido: es la razón por la que no aparecen en
la política.
