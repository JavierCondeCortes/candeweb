# Datos necesarios para sustituir la demostración

Este documento reúne únicamente la información editorial que Candemor debe confirmar. No deben
escribirse aquí contraseñas, códigos TOTP, tokens de recuperación, secretos de Twitch ni claves de
despliegue.

## Datos ya confirmados

- [x] Nombre público: `Candemor Racing Team` / `Candemor`.
- [x] Canal oficial de Twitch: `https://www.twitch.tv/candemorracingteam`.
- [x] Vídeo fuente de la portada: `public/exampleVideo.mp4` y derivados optimizados.
- [x] Campeonato destacado actual: `Candeonato Bandido`, torneo Fat Cat Race `42`.
- [x] Historial público detectado: torneos `46`, `42`, `38`, `36`, `35` y `34`.
- [x] Administración con propietario y altas adicionales aprobadas mediante invitación.

## 1. Identidad y mensaje

- [ ] Logotipo definitivo en SVG o PNG con fondo transparente.
- [ ] Confirmar si la marca corta visible debe ser `CND///`, `Candemor` u otra variante.
- [ ] Propuesta de valor de una frase para el hero, máximo `120` caracteres.
- [ ] Descripción breve de la comunidad, máximo `320` caracteres.
- [ ] Tres valores reales, con título y explicación de una frase.

Plantilla:

```md
Marca corta:
Propuesta de valor:
Descripción:
Valor 1 — título / explicación:
Valor 2 — título / explicación:
Valor 3 — título / explicación:
```

## 2. Miembros reales

Se necesitan entre cuatro y seis perfiles para reemplazar los cinco ejemplos ficticios. La
fotografía solo se publicará cuando exista permiso de uso confirmado.

| Campo                  | Requisito                                     |
| ---------------------- | --------------------------------------------- |
| Nombre visible         | Obligatorio                                   |
| Alias                  | Opcional                                      |
| Rol                    | Piloto, caster, dirección u otro rol real     |
| Descripción            | Máximo 280 caracteres                         |
| Fotografía             | Mínimo 720 × 900 px, preferiblemente vertical |
| Texto alternativo      | Descripción breve y objetiva de la fotografía |
| Permiso de publicación | Confirmación expresa                          |
| Twitch                 | Opcional; URL completa                        |
| Instagram/YouTube/X    | Opcional; solo perfiles oficiales             |
| Destacado y orden      | Posición deseada en la portada                |

Plantilla por persona:

```md
Nombre:
Alias:
Rol:
Descripción:
Archivo de fotografía:
Texto alternativo:
Permiso confirmado: sí / no
Twitch:
Instagram:
YouTube:
X:
Orden:
```

## 3. Contacto y comunidad

- [ ] Correo público de contacto.
- [x] Invitación permanente de Discord: `https://discord.gg/j22XuDEfMk`.
- [ ] Instagram oficial, si existe.
- [ ] YouTube oficial, si existe.
- [ ] Medio preferido para dudas sobre inscripciones.

## 4. Contenido y experiencias

- [x] Hasta cuatro clips públicos obtenidos del canal oficial mediante Twitch Helix.
- [x] Twitch proporciona título, creador, URL, miniatura, visualizaciones y duración.
- [x] La API entrega primero los clips más vistos; no existe una selección editorial manual en el
      MVP.

La portada no incrusta ni reproduce los clips automáticamente. Muestra sus datos públicos y solo
abre la reproducción en Twitch después de una acción explícita. Si Twitch no responde o no devuelve
clips válidos, se presenta un estado alternativo y se mantiene el enlace al canal oficial.

## 5. Candeonato actual

- [ ] Nombre y número editorial definitivos de la edición.
- [x] Estado editorial actual: finalizado, según su ubicación en la sección `Finalizados` del
      listado público de Fat Cat Race.
- [ ] Fecha y hora confirmadas, con zona horaria.
- [ ] Número de plazas, si existe límite.
- [ ] Lista definitiva de circuitos o confirmación de que depende de Discord.
- [ ] URL oficial de inscripción.
- [ ] Reglamento o URL del reglamento.
- [ ] Portada autorizada y su texto alternativo.
- [ ] Regla para decidir cuándo cambia el estado del evento.

Los puntos, posiciones y resultados seguirán procediendo de Fat Cat Race; no deben copiarse a mano
en esta plantilla.

## 6. Patrocinio y merchandising

Estas secciones permanecerán ocultas mientras no haya información real.

- [ ] Patrocinadores confirmados, logotipos autorizados y URL oficial.
- [ ] Orden o nivel de cada patrocinador.
- [ ] Estado real del merchandising.
- [ ] Productos, precios, imágenes y plataforma segura de compra, si existe.

## 7. Legal y publicación

- [ ] Titular legal de la web.
- [ ] Política de privacidad revisada para el formulario y la analítica, si se incorpora.
- [ ] Política de cookies, únicamente si se utilizan cookies no esenciales.
- [ ] Aviso legal y datos de contacto requeridos.
- [ ] Dominio definitivo.
- [ ] Acceso de la persona responsable al repositorio, Render y dominio.
- [ ] Ubicación externa para las copias de seguridad.
- [ ] Prueba manual final con NVDA, VoiceOver o TalkBack.

Los textos legales deben ser confirmados por la persona responsable de la web; no se generarán como
contenido ficticio para rellenar el diseño.

## Orden recomendado para entregar los datos

1. Correo de la persona administradora y creación de la cuenta desde `/admin/login`.
2. Activación de TOTP y almacenamiento privado de los códigos de recuperación.
3. Identidad, propuesta de valor y datos de contacto.
4. Miembros reales con fotografías y permisos.
5. Datos editoriales del Candeonato actual.
6. Clips, patrocinadores y merchandising confirmados.
7. Información legal, dominio y operación de copias externas.
