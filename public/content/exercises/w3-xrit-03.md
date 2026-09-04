---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 2 · Hand tracking y gestos

**Bloque 3 — XR Interaction Toolkit** · 10 % del curso, reparto por ejercicio *por decidir*
**Por grupo** · **Entrega: pendiente de definir** · Se hace **en clase**

---

## La historia

Último ejercicio antes del proyecto final, y el que **cierra la historia**.

Un goblin azul se coló en el despacho del profesor. Salió del móvil montado en un
mecha, cambió de bando, se enfrentó con vosotros a algo peor entre los muebles de
vuestra casa. Aquí se acaba — y se acaba **sin mandos**, con un gesto de tu mano.


---

## Qué tenéis que hacer

Dejad los mandos fuera de la escena y fuera de la mesa. Con **hand tracking**,
haced que un gesto que decidáis vosotros dispare el desenlace de Blue Goblin.

El gesto tiene que ser **la acción que resuelve la historia**, no un adorno al
lado de un botón que hace lo mismo.


---

## Requisitos mínimos

- Hand tracking activo en OpenXR **y en los ajustes del visor**.
- Manos visibles y articuladas, con los datos de las articulaciones llegando en
  tiempo de ejecución.
- Interacción básica sin mandos: *poke* o *pinch* sobre un objeto o una UI.
- **Un gesto reconocido de verdad** (*XR Hand Shape* / *Hand Pose*), con umbrales
  ajustados para que no se dispare solo al mover la mano.
- **Fallback** cuando las manos salen del campo de visión: la escena no se rompe
  ni deja al jugador esperando algo que ya no puede hacer.


---

## Entrega

> **Pendiente de definir**, igual que el ejercicio 1 del bloque.

De momento: el mismo repositorio del ejercicio anterior, con el gesto y el
desenlace documentados en el `README`.


---

## Cómo se evalúa

Que el gesto se reconozca sin falsos positivos, que haya fallback, y que el final
de Blue Goblin se entienda haciéndolo — de pie, sin mandos y sin nadie
explicándolo al lado.

---

<!-- _class: answer -->

## Respuesta

> **Pendiente de escribir.** Marc redacta aquí la solución comentada o los
> criterios de corrección de este ejercicio.

Esta diapositiva está marcada con `<!-- _class: answer -->`, así que se compila
a un archivo aparte y no se descarga hasta que el desbloqueo global está activo.
