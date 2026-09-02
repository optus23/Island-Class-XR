# Decisiones abiertas — bloques prácticos (Blue Goblin)

Cuatro cosas del brief de ejercicios prácticos **están sin decidir a propósito**.
Ninguna bloquea nada: el contenido está redactado y publicado, y cada hueco se
declara como hueco en vez de rellenarse con una suposición.

Están marcadas en tres sitios a la vez, para que no se pierdan:

1. en `_fixme` dentro del nodo correspondiente de `src/data/levels.json`,
2. impresas al final de cada `npm run validate`,
3. aquí, con lo que hay que tocar cuando se cierren.

---

## (a) Reparto de nota entre ejercicios, dentro de cada bloque

**Lo que se sabe:** los tres bloques valen **30 % del curso, 10 % cada uno**.

**Lo que falta:** si dentro de un bloque los ejercicios pesan lo mismo o si el
ejercicio 3 pesa más. El brief apunta a lo segundo —lo llama «el de mayor peso»
en los bloques 1 y 2— pero no da número.

**Cómo está ahora:** `gradeWeight: { "block": "10 %", "exercise": null }` en los
ocho ejercicios. El portal escribe *«reparto por ejercicio por decidir»* donde
iría la cifra.

**Qué tocar al cerrarla:** `gradeWeight.exercise` en los ocho nodos, y quitar el
`_fixme` de `w1-arf-01`, `w2-pre-02` y `w3-xrit-02`.

> Nodos marcados: `w1-arf-01`, `w2-pre-02`, `w3-xrit-02`.

---

## (b) Punto de partida del bloque 1

**Lo que falta:** de las dos opciones que plantea el brief,

- instalar AR Foundation en clase con los alumnos y entregarles después el
  proyecto ya montado, con Blue Goblin instanciado en la escena, **o**
- que cada alumno genere el proyecto desde cero.

**Cómo está ahora:** el enunciado y el `starting_point` de los tres ejercicios
**asumen la primera opción**, que es la que hace que el ejercicio 1 quepa en una
sesión.

**Qué tocar al cerrarla, si sale la segunda:** el `starting_point` de
`w1-arf-01`, `w1-arf-02` y `w1-arf-03`, el enunciado
`public/content/exercises/w1-arf-01.md`, y añadir los hitos de alta del proyecto
(paquetes, XR Plug-in Management, plataforma) al ejercicio 1, que hoy los da por
hechos.

> Nodo marcado: `w1-arf-01`.

---

## (c) Identidad de la «nueva amenaza» del bloque 2

**Lo que falta:** contra qué se pasa a luchar Blue Goblin cuando cambia de bando
en el ejercicio 2. El brief dice que cambia de bando; no dice contra qué.

**Cómo está ahora:** el enunciado pide una amenaza **distinguible de Blue Goblin
a simple vista** y deja que cada grupo proponga la suya, documentándola. El
ejercicio 3 del bloque la hereda tal cual.

**Qué tocar al cerrarla:** `w2-pre-03` (objetivo, hitos y enunciado) y la
narrativa de `w2-post-03`, que arrastra el mismo personaje.

> Nodo marcado: `w2-pre-03`.

---

## (d) Método de entrega del bloque 3

**Lo que falta:** el brief fija la entrega **por build (APK)** para los bloques 1
y 2, con su motivo —refuerza compilar, y evita instalar ~35 APKs sueltos— pero
**no dice nada del bloque 3**.

**Cómo está ahora:** `submissionMethod: null` en los dos ejercicios del bloque,
en vez de asumir «build» por analogía. El enunciado dice explícitamente que está
pendiente y propone, como provisional, dejar el proyecto en un repositorio del
grupo.

**Qué tocar al cerrarla:** `submissionMethod` en `w3-xrit-02` y `w3-xrit-03`, sus
`deliverable`, y el apartado *Entrega* de los dos enunciados.

> Nodo marcado: `w3-xrit-02`.

---

## Una quinta, menor

El bloque 3 tiene **2 ejercicios sobre 5 sesiones** de la etapa `xr-toolkit`
(`w3-xrit-01` es el montaje inicial; `w3-xrit-04` y `w3-xrit-05` siguen siendo
sesiones PLACEHOLDER). No es una decisión del brief —él solo dice «2 ejercicios,
no 3, para no saturar antes del proyecto final»— pero esas dos sesiones sueltas
siguen sin contenido, como ya recogía `handoff.md`.
