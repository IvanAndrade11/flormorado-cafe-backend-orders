# Qué hacer ante un incidente de seguridad

La [política de tratamiento de datos](https://flormoradocafe.com/#/politica-de-datos)
le promete al cliente que un incidente que afecte sus datos se reportará a la
Superintendencia de Industria y Comercio. La Ley 1581 (art. 17, lit. n) obliga a
informarle a la autoridad cuando se presenten violaciones a los códigos de
seguridad y haya riesgo en la administración de la información.

Este documento existe para que esa decisión no se tome improvisando el día que
pase.

## Qué cuenta como incidente

No todo problema lo es. Lo es cuando datos de clientes **pudieron** quedar al
alcance de alguien que no debía verlos, aunque no haya certeza de que ocurrió:

- La clave del panel (`ADMIN_PASSWORD`) se filtró, se compartió o quedó en un
  dispositivo perdido. Es la que protege nombres, teléfonos y direcciones.
- El token de Cloudflare del CI quedó expuesto: da acceso a publicar el Worker y
  a la base de datos.
- Una exportación de la base salió del equipo, se subió a algún lado o se envió
  por error.
- La clave de Resend se filtró: con ella se pueden enviar correos desde el
  dominio, suplantando al negocio.
- El buzón `info@flormoradocafe.com` fue accedido por un tercero.
- Un correo con datos de un cliente se envió a la persona equivocada.

**No** es un incidente que el sitio se caiga, que falle un correo o que alguien
intente entrar al panel y no lo logre. Eso es disponibilidad o un intento
fallido, no una violación.

## Las primeras horas

1. **Cortar el acceso antes de investigar.** Rotar lo que se haya expuesto:
   `npx wrangler secret put ADMIN_PASSWORD`, el token del CI desde **My Profile →
   API Tokens** en Cloudflare, la clave de Resend desde su panel. Rotar es
   barato; averiguar primero y rotar después, no.
2. **Anotar la hora y qué se vio.** Fecha y hora del hallazgo, cómo se detectó,
   qué se hizo y a qué hora. Después nadie se acuerda, y es lo primero que pide
   la autoridad.
3. **Medir el alcance.** Qué tablas y qué filas pudieron verse, y de cuántas
   personas. Se consulta con `npx wrangler d1 execute flormorado-orders --remote`.
   Si no se puede determinar, se dice eso: no se inventa una cifra baja.
4. **Decidir si se reporta.** La decisión es de Iván. Ante la duda, se reporta:
   no reportar algo que debía reportarse pesa más que lo contrario.

## El reporte a la SIC

El canal habitual es el formulario del Registro Nacional de Bases de Datos, pero
**el responsable es persona natural y no está obligado a inscribirse ahí**, así
que ese camino no aplica. El reporte va por los canales de atención de la SIC
(`sic.gov.co`), describiendo qué pasó, cuándo, a cuántas personas afecta, qué
datos involucra y qué se hizo para contenerlo.

## Qué se le dice al cliente

Si sus datos estuvieron en riesgo, se le avisa por el correo con el que compró:
qué pasó, qué datos suyos involucra, qué se hizo y qué puede hacer él. Sin
rodeos y sin minimizar. Es lo que la política promete y es lo que uno querría
que le hicieran.
