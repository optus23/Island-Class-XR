---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 3 · AR Foundation Samples

El problema está **resuelto** — así que ya podéis usar los samples

Crea una app a partir de los **AR Foundation Samples** de Unity
y **prueba todas sus features**

**Bloque 1 — AR Foundation** · **En grupo** · tres pasos, sin código

---

## Qué es el día de hoy

Los dos primeros ejercicios os hacían montar una escena a mano, un manager cada
vez. Hoy abrís en su lugar el **proyecto oficial de samples**: un único proyecto
de Unity que ya trae una escena funcionando por cada feature que tiene AR
Foundation.

Hoy no integráis nada en vuestro proyecto. Abrís el suyo, lo ejecutáis en el
móvil y descubrís **qué sabe hacer la plataforma de verdad** — que es lo que
necesitáis antes del bloque 2.

---

## Si vais con retraso

Los ejercicios 1 y 2 tienen un proyecto resuelto:

**[`github.com/pomedas/ArMobile`](https://github.com/pomedas/ArMobile)**

Usadlo de dos maneras:

- como **solución** de los ejercicios 1 y 2, para compararla con lo que
  construisteis;
- como **punto de partida** para la entrega del bloque, si no conseguisteis
  terminarlos.

Nadie debería quedarse bloqueado en la entrega porque el ejercicio 1 o el 2 no
salieran. Coged el proyecto y seguid.

---

## Paso 1 · Descarga los samples

Coge el proyecto open source del GitHub de Unity: **`arfoundation-samples`**.

**Asegúrate de elegir la rama correcta.** Este es todo el paso y es el que sale
mal: el repositorio mantiene una rama por versión de AR Foundation, y una rama
que no coincide con tu Editor te da un proyecto lleno de errores de compilación
antes de haber hecho nada.

**Mira qué versión de AR Foundation usa tu proyecto y coge la rama que lleva
ese nombre.** Las ramas se llaman como la versión a la que apuntan, y la lista
cambia con cada release: la correcta hoy no es la correcta dentro de un año.

---

## Paso 2 · Ábrelo desde disco

Unity Hub → **Add** → **Add project from disk**, y apunta a la carpeta que
acabas de descargar.

**Comprueba que tienes los módulos de Android instalados** antes de abrirlo —
Unity Hub → *Installs* → **Add modules** → *Android Build Support*, con
**OpenJDK** y **Android SDK & NDK Tools** dentro.

Es la misma comprobación que en los ejercicios 1 y 2, y falla igual: sin el
módulo, Android no aparece nunca en Build Settings.

---

## Know how · Prueba todas las features

Abre las escenas de ejemplo y pruébalas:

- **Face Tracking**
- **Body Tracking** — *solo en iPhone*
- **Simple Occlusion**
- **Ambient Intensity**

No todo funciona en todos los móviles. Una feature que no hace nada en tu
dispositivo suele ser el dispositivo, no tu build.

---

## Know how · Y más

- **Point Cloud**
- **Configuration**
- **Anchors**
- **Plane detection** — la que ya montaste a mano en el ejercicio 1

Verla aquí al lado de las demás es justo el objetivo: lo que te costó una sesión
cablear es una escena dentro de un catálogo, y ese catálogo es de donde arranca
el bloque 2.

---

## Know how · Prueba en modo editor

Antes de hacer una build, ejecútalo en el Editor.

Busca **`menuloader`** en la barra de búsqueda del proyecto y abre esa escena.

**Esa escena es la que enlaza todas las demás.** Si abres una escena de ejemplo
suelta, tienes esa única feature y ninguna forma de volver al menú; si abres
`menuloader`, tienes la app tal y como está pensada para navegarse.

---

## Paso 3 · Prueba y luego build

**Prueba primero en Play Mode con el XR Simulator.**

Después `File > Build Settings`:

- asegúrate de que tu escena está en la lista **Scenes In Build**;
- pulsa **Build** y elige la carpeta de destino.

Esa es tu APK. Instálala en el móvil.

Enhorabuena — con esto el bloque está terminado.

---

## Si algo no funciona

- **El proyecto se abre lleno de errores de compilación** → rama equivocada
  (paso 1). Contrástala con tu versión del Editor.
- **Android no sale en Build Settings** → falta el módulo del Editor (paso 2).
- **Una escena de ejemplo se abre pero no hay menú** → abriste la escena
  directamente en vez de `menuloader`.
- **El body tracking no hace nada** → es solo para iPhone. No es tu build.
- **Una feature no hace nada en tu móvil** → no todos los dispositivos soportan
  todas las features; prueba otro sample antes de darlo por roto.
