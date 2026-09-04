---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 1 · Locomoción e interacción

**Bloque 3 — XR Interaction Toolkit** · 10 % del curso, reparto por ejercicio *por decidir*
**Por grupo** · **Entrega: pendiente de definir** · Se hace **en clase**, rápido

---

## La historia

Se acabó mirar el mundo de Blue Goblin a través de una cámara. Te pones el visor
y **estás dentro**. No hay passthrough, no hay sala: hay un sitio, y hay que
aprender a moverse por él y a tocar lo que tiene.


---

## Qué tenéis que hacer

**Este bloque no da proyecto de partida.** A estas alturas el montaje lo lleváis
vosotros: partid de la **plantilla VR oficial de Unity** y resolved lo básico de
estar dentro de una escena en VR.

De consulta, el repositorio público *XR Interaction Toolkit Examples*: está para
mirarlo, no para copiar la escena entera.


---

## Requisitos mínimos

- **Locomoción continua**: desplazamiento con el stick y giro (snap o continuo).
- **Teleportación** funcionando en paralelo, con áreas o anchors y el rayo curvo
  visible al apuntar.
- Las dos conviven **sin pelearse por el mismo input**, y se sabe qué botón hace
  qué.
- Al menos un objeto **agarrable**, con el *attach point* ajustado: se coge por
  donde toca y no se queda flotando al soltarlo.
- Un interactable **de otro tipo** —botón, palanca o socket— para que no todo sea
  agarrar.
- Confort mínimo: viñeta o fundido al moverse, altura del suelo correcta, y
  **ninguna rotación de cámara forzada por código**.


---

## Entrega

> **Pendiente de definir.** El método de entrega de este bloque no está fijado, y
> no se da por supuesto que sea el APK de los bloques 1 y 2.

Mientras tanto: dejad el proyecto en un **repositorio del grupo**, con un
`README` que explique qué habéis montado y con qué mando se prueba.


---

## Cómo se evalúa

Que las dos locomociones funcionen a la vez sin conflictos, y que agarrar un
objeto se sienta bien y no aproximado.

