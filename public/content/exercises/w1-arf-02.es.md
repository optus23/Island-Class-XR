---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 2 · Image Tracking

Crea una app de image tracking con Unity AR Foundation
que instancie **una solución 3D para lidiar con los green goblins**

**Bloque 1 — AR Foundation** · **Individual** · ocho pasos, sin código

---

## Hoy tampoco se escribe código

El ejercicio 1 te puso una build de AR real en el móvil. Este cambia lo que la
dispara: en vez de un **plano** detectado, tu objeto aparece sobre una **imagen**
detectada — un marcador.

Todo vuelve a pasar en el **Inspector**. Lo nuevo de hoy es el **XR Simulator**,
que te deja probar el image tracking dentro del Editor, sin hacer build y sin
imprimir nada.

Esta vez los goblins son verdes y son varios. Lo que instancies para lidiar con
ellos sigue siendo cosa tuya.

---

## Know how · Qué es el image tracking

El **AR Tracked Image Manager** crea un GameObject por cada imagen que detecta
en el entorno.

Por sí solo no detecta nada. Hay que darle una **reference image library**: un
conjunto compilado de las imágenes que quieres que busque. Detecta esas y
ninguna más.

La librería se puede cambiar en tiempo de ejecución, pero mientras el manager
esté activo no puede quedarse nunca a null.

---

## Paso 1 · La plantilla AR Mobile

Unity Hub → **New project** → **AR Mobile**, dentro de *Core*.

**Asegúrate de tener el módulo de Android instalado** en el Editor — Unity Hub →
*Installs* → **Add modules** → *Android Build Support*, con **OpenJDK** y
**Android SDK & NDK Tools** dentro.

Si falta ese módulo, en el paso siguiente Android ni siquiera aparecerá en Build
Settings, y buscarás el problema donde no está.

---

## Paso 2 · Plataforma y proveedor

Dos cosas, y no son la misma:

1. `File > Build Settings` → selecciona **Android** → **Switch Platform**.
2. `Project Settings > XR Plug-in Management` → pestaña **Android** → confirma
   que el checkbox de **ARCore** está marcado.

Cambiar de plataforma reimporta el proyecto entero: hazlo ahora, que aún está
vacío. Y que el paquete de ARCore esté instalado no es lo mismo que que ARCore
esté **activado** — el checkbox es lo que enciende la AR.

---

## Paso 3 · Una escena nueva

**Crea una escena nueva.** Esta vez no modificas la demo de la plantilla: la
escena la montas tú.

- **Borra el objeto `Main Camera`.** El rig de AR trae su propia cámara, y dos
  cámaras es una escena confusa.
- Añade **`AR Session`** y **`XR Origin (AR)`**.
- Luego selecciona el **XR Origin** y **Add Component → `AR Tracked Image
  Manager`**.

Deja los campos del manager vacíos de momento. El paso 4 fabrica lo que va
dentro.

---

## Paso 4 · La reference image library

En la ventana Project, clic derecho en `Assets` →
**`Create > XR > Reference Image Library`**.

Selecciona el asset, pulsa **Add Image** y suelta dentro una textura normal —
PNG, JPG, lo que tengas.

**Elige una imagen con contraste y detalle irregular.** El editor le pone una
puntuación mientras la procesa. Una puntuación baja significa un marcador que
solo funciona con luz perfecta y en ángulo perfecto, y acabarás echándole la
culpa al código.

---

## Paso 5 · El XR Simulator

`Window > XR > AR Foundation > XR Environment`.

Esto abre una habitación simulada dentro de la que puedes darle al Play —
incluido el image tracking — así que puedes probar el ejercicio de hoy **sin
hacer la APK y sin imprimir ningún marcador**.

Ve a la pestaña **XR Environment** y a **Edit Environment**. Si no te deja editar
el que hay, **duplica el entorno por defecto** y edita tu copia.

---

## Paso 6 · Mete tu marcador en la habitación simulada

El entorno ya trae una imagen colgada en la habitación.

- Selecciona el objeto **`Logo Quad`** y **cámbiale el material** para que
  muestre **la misma imagen que añadiste a la librería** en el paso 4.
- Y después — esto es lo que se olvida todo el mundo — pon esa misma imagen
  también en el componente **Simulated Tracked Image**.

El quad es lo que *ves*; el componente Simulated Tracked Image es lo que el
simulador realmente *trackea*. Si cambias solo el primero, la habitación se ve
bien y no se detecta nada nunca.

---

## Paso 7 · Qué se instancia

Vuelve al **XR Origin** de la Hierarchy, y al **AR Tracked Image Manager** que
añadiste en el paso 3.

- Arrastra tu **reference image library** a su campo de librería.
- Asigna el **prefab** que debe instanciarse cuando se trackee la imagen.

Ese prefab es tu respuesta a los green goblins. El objeto 3D que quieras:
modélalo, descárgalo o reutiliza el del ejercicio 1.

**Si el marcador va a estar en movimiento**, sube **Max Number Of Moving Images**
a 1 como mínimo. A 0, un marcador sostenido en la mano se detecta una vez y deja
de seguirte.

---

## Paso 8 · Prueba y luego build

**Prueba primero en Play Mode con el XR Simulator.** Cuesta segundos; una build
cuesta minutos. No descubras un material mal puesto por la vía de una APK.

Después `File > Build Settings`:

- comprueba que tu escena está en la lista **Scenes In Build** — *Add Open
  Scenes* si no está, y este es el paso que la gente se salta;
- pulsa **Build** y elige la carpeta de destino.

Esa es tu APK. Instálala en el móvil y apunta al marcador — en papel o en otra
pantalla.

---

## Si algo no funciona

- **Android no sale en Build Settings** → falta el módulo del Editor (paso 1).
- **La build no tiene AR** → el checkbox de ARCore no está marcado (paso 2).
- **La escena no muestra nada** → borraste la Main Camera pero no añadiste
  `XR Origin (AR)` (paso 3).
- **En el simulador no se detecta nunca nada** → la imagen está en el material
  del quad pero no en el componente **Simulated Tracked Image** (paso 6).
- **Se detecta, pero el objeto no aparece** → no hay prefab asignado en el
  manager (paso 7).
- **Se detecta una vez y deja de seguir** → **Max Number Of Moving Images** está
  a 0 (paso 7).
- **Solo funciona con luz perfecta** → marcador con poco contraste; vuelve al
  paso 4 y mira la puntuación de calidad.
