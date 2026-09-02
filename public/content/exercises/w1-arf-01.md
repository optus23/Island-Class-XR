# Ejercicio 1 · Plane Detection

**Bloque 1 — AR Foundation** · 10 % del curso, reparto por ejercicio *por decidir*
**Individual**, dentro de tu grupo de referencia · **Entrega: build (APK)**

## La historia

Un goblin azul se ha colado en el despacho del profesor. Nadie sabe cómo entró.
De momento se limita a estar ahí, mirándote desde la mesa a través de la cámara
del móvil.

En clase has visto un vídeo en el que el profesor toca la pantalla y aparece un
objeto sobre la superficie que la cámara ha detectado. **Ese vídeo es el
enunciado**: tienes que llegar al mismo resultado con tu propia idea.

## Qué tienes que hacer

Blue Goblin ya está instanciado en la escena de partida. Añade tú la mecánica:

> Al tocar un plano detectado, se instancia un modelo 3D en ese punto.

El modelo lo eliges tú, de donde quieras (Sketchfab, Poly Pizza, el asset store,
lo que tengas). Lo único que se te pide es que **represente cómo te enfrentas a
Blue Goblin o cómo lo camelas**, según la historia que quieras contar. Una espada,
una jaula, un pastel, un altavoz enorme: da igual, mientras se entienda.

## Requisitos mínimos

- Detección de planos activa y **visible**: hay que ver en pantalla qué está
  reconociendo el dispositivo.
- El objeto aparece **donde tocas**, no en el centro de la pantalla ni en el
  origen del mundo.
- Escala real. Sobre una mesa, tu objeto mide centímetros.
- Blue Goblin sigue en escena y pasa algo entre él y lo que instancias.

## Entrega

**Un APK**, no un vídeo. Se instala en un móvil para corregirlo, así que tiene
que arrancar solo. Nómbralo `bloque1-ej1-<apellido>.apk` y acompáñalo del enlace
a tu rama del repositorio de ejercicios (`01-plane-detection`).

En el `README` de la rama, tres líneas: qué modelo has usado, de dónde sale y
con qué licencia, y qué le hace a Blue Goblin.

## Cómo se evalúa

Que la mecánica funcione en un móvil real. Que la escala y el anclaje sean
creíbles. Que la escena cuente algo sin que tengas que explicarlo al lado.
