# De dónde sale el orden de los niveles

`src/data/levels.json` **no contiene ni una sola fecha**, y no puede contenerla:
la regla está en `CLAUDE.md` y `scripts/validate.mjs` rompe el build si aparece
un campo `date`, `week` o `deadline`. Este fichero existe para que eso siga
siendo cierto sin que el orden de la isla se vuelva inexplicable.

**El calendario decide cuatro cosas y ninguna más:** qué días existen, en qué
orden van, cuáles son de teoría y cuáles de práctica, y dónde caen los dos
exámenes. Nada de eso es una fecha una vez está dentro del modelo — es una
posición en una lista.

- **Fuente:** el board de Whimsical del curso, tabla *Fall Semester Schedule*.
- **Decisión de Marc (5 sept 2026):** el semestre de otoño **es** la regla. El
  de primavera es su propia guía; la única diferencia está al final, en días de
  proyecto en grupo donde prácticamente no da clase, así que no genera un
  segundo mapa. La isla es una **plantilla** para todas sus asignaturas de RV,
  que son casi idénticas entre sí.

---

## El reparto

28 clases reales. La reavaluación no es una clase: es un extra colgando del
castillo grande.

| # | Día del calendario | Nivel | Color |
| --- | --- | --- | --- |
| 1 | Lun 14 sept | `w1-01` | azul · teoría |
| 2 | Mié 16 sept | `w1-02` | naranja · práctica — le cuelga `w1-att-01`, lila |
| 3 | Lun 21 sept | `w1-03` | azul · teoría |
| 4 | Mié 23 sept | `w1-arf-01` | naranja · práctica |
| 5 | Lun 28 sept | `w1-05` | azul · teoría |
| 6 | Mié 30 sept | `w1-arf-02` | naranja · práctica |
| 7 | Lun 5 oct | `w1-07` | azul · teoría |
| 8 | Mié 7 oct | `w1-arf-03` | naranja · práctica |
| — | Lun 12 oct | *festivo — sin nivel* | |
| 9 | Mié 14 oct | `w2-pre-02` | naranja · práctica |
| 10 | Lun 19 oct | `w2-02` | azul · teoría |
| 11 | Mié 21 oct | `w2-pre-03` | naranja · práctica |
| 12 | Lun 26 oct | `w2-04` | azul · teoría |
| 13 | **Mié 28 oct** | `w2-boss` | **rojo · examen parcial (castillo del medio)** |
| 14 | Lun 2 nov | `w2-05` | azul · teoría — le cuelga `w2-att-01`, lila |
| 15 | Mié 4 nov | `w2-post-03` | naranja · práctica |
| 16 | Lun 9 nov | `w2-07` | naranja · práctica |
| 17 | Mié 11 nov | `w3-xrit-02` | naranja · práctica |
| 18 | Lun 16 nov | `w2-09` | naranja · práctica |
| 19 | Mié 18 nov | `w3-xrit-03` | naranja · práctica |
| 20 | Lun 23 nov | `w3-01` | amarillo · proyecto |
| 21 | Mié 25 nov | `w3-02` | amarillo · proyecto |
| 22 | Lun 30 nov | `w3-03` | amarillo · proyecto |
| 23 | Mié 2 dic | `w3-04` | amarillo · proyecto |
| — | Lun 7 dic | *festivo — sin nivel* | |
| 24 | Mié 9 dic | `w3-05` | amarillo · proyecto |
| 25 | Lun 14 dic | `w3-06` | amarillo · proyecto |
| 26 | Mié 16 dic | `w3-07` | amarillo · proyecto |
| 27 | Lun 21 dic | `w3-08` | amarillo · proyecto |
| 28 | **11–20 ene** | `w3-boss` | **rojo · jefe final (castillo grande)** |
| extra | 3–5 feb | `w3-reeval` | rojo · fuera del camino, conector discontinuo |

## Las reglas que generan esa tabla

1. **12 clases antes del parcial**, 6 de teoría (lunes, azul) y 6 de práctica
   (miércoles, naranja). Se cumple exactamente: posiciones 1–12.
2. **El parcial** es el castillo del medio del mapa.
3. **14 días después**, de los cuales **solo el primero es teoría**. Por eso las
   posiciones 16 y 18 son naranjas aunque caigan en lunes: la regla de Marc
   manda sobre el día de la semana.
4. **Las 8 últimas clases prácticas son amarillas** (posiciones 20–27): no hay
   temario ni ejercicios, los equipos desarrollan y el profesor da soporte. Y
   coinciden con lo que dice el calendario — Concept, Set up, Desenvolupament.
5. **Los dos exámenes son rojos.**
6. **La reavaluación** no cuenta como clase.
7. **Las dos actividades de Actitud 10% son nodos propios**, no un recoloreado
   del día: cuelgan de su clase por una línea discontinua y son lilas. El día
   sigue siendo una clase normal y conserva su color. Ahí es donde irá el
   enunciado de cada actividad cuando Marc lo pase.

## Por qué los mundos quedan 8 / 11 / 9

El motor reparte los nodos por longitud de arco y el mundo 2 tiene una ranura
reservada para el jefe intermedio, que **debe** quedar entre dos mitades. Ese
corte manda:

- **Mundo 1 — 8 nodos:** introducción y AR Foundation, cierra con la entrega de
  AR Foundation.
- **Mundo 2 — 11 nodos:** Building Blocks y XRIT, **con el parcial en medio**.
  Que el bloque 2 se parta a caballo del examen ya era una decisión tomada en la
  ronda 6, y el calendario la confirma.
- **Mundo 3 — 9 nodos en el camino:** las 8 sesiones de proyecto autónomo y el
  castillo final, más la reavaluación fuera del camino.

## Si el año que viene cambia el calendario

Se reedita la tabla de arriba y se regenera `levels.json`. El orden es lo único
que hay que rehacer; los ocho ejercicios evaluables conservan su `id`, su
bloque, su peso y su enunciado, y siguen a los días que les tocan.

## Lo que falta, y no es código

- **Los enlaces de la columna Classes.** Son shortlinks `canva.link/…`, que no
  son ni URLs `?embed` ni `/edit`, así que entran como **enlace** (`slidesLink`)
  y no como incrustación. 15 de 29 niveles tienen uno; el resto de filas de la
  tabla vienen vacías. Cuando haya URLs públicas de *Compartir → Insertar*, cada
  nivel cambia `slidesLink` por un bloque `slides` de tipo `canva` y se
  incrusta de verdad. Marc actualiza la columna en Whimsical y se vuelve a leer
  el board.
- **Los TODOs paso a paso** de las sesiones prácticas.
