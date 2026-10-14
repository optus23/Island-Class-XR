---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 1 · Meta Building Blocks

Crea una **app de realidad virtual** con Meta Building Blocks
para **interactuar con una solución 3D para lidiar con el robot gigante**

**Bloque 2 — Meta Building Blocks** · **En grupo** · ocho pasos, sin código

---

## El goblin ahora está de vuestro lado

Ha aparecido un robot gigante, y el blue goblin ha cambiado de bando: vais en
equipo con él.

Lo que construís es **vuestro** objeto 3D: la cosa que metéis en VR y que
cogéis con las manos. El modelo que queráis. Elegirlo es el ejercicio.

**Hoy tampoco se escribe código.** Todo pasa en el Inspector de Unity y en la
ventana de Building Blocks: sueltas un bloque en la escena y funciona.

---

## Know how · Qué hay dentro del Meta XR SDK

El All-in-One SDK son varios paquetes, y no necesitáis todos:

- **Core SDK** — render, tracking y primitivas de realidad mixta
- **Interaction SDK** — interacciones con manos, mandos y mirada
- **Haptics**, **Audio**, **Platform**, **MR Utility Kit**

**El Meta XR Simulator NO está en el SDK.** Se instala aparte — de eso va el
paso 6, y por eso puede negarse.

---

## Paso 1 · Un proyecto nuevo

Unity Hub → **New project** → plantilla **Universal 3D**.

**Asegúrate de tener el módulo de Android instalado** antes de empezar. Es la
misma comprobación que en el bloque 1 y falla igual: sin él, Android no aparece
nunca en Build Settings y te enteras al final del todo.

---

## Paso 2 · El Meta XR SDK desde el Asset Store

Abre el **Asset Store** y busca **Meta XR SDK**.

Pulsa **Add to My Assets**.

Tienes que estar **logueado en tu cuenta de Unity** para que ese botón haga
algo — si parece que no pasa nada, es por eso.

---

## Paso 3 · Paquetes, proveedor, validación

Tres cosas, en este orden:

1. `Window > Package Manager` → busca los paquetes de **Meta**. **No hace falta
   instalarlos todos.**
2. `Project Settings > XR Plug-in Management` → pon el proveedor en **OpenXR**.
3. **Project Validation → Fix All**, y después **Meta XR → Apply All**.

---

## Paso 3 · …y el que lo rompe todo

**Comprueba que el Oculus XR Plugin NO está instalado.**

Es el error más caro del día: con él en el proyecto junto a OpenXR, la build
funciona, el visor muestra tu escena y **no trackea nada** — ni la cabeza ni las
manos. Y no sale ningún error por ninguna parte.

Si tu proyecto lo tiene, quítalo antes de seguir.

---

## Paso 4 · Una escena nueva y tres bloques

**Crea una escena nueva y borra la `Main Camera`.** El Camera Rig trae la suya,
y dos cámaras es una escena confusa.

Después `Meta XR Tools > Building Blocks`, y arrastra **tres**:

- **Camera Rig** — sigue la cabeza y el cuerpo; es lo que sustituye a Main Camera
- **Interaction Rig** — trae el hand tracking *y* los mandos
- **Grab Interaction** — mete un cubo que se puede coger

---

## Paso 5 · Conecta el grab

Abre el **`[BuildingBlock] Cube`** y selecciona
**`[BuildingBlock] HandGrab Installation Routine AND`**.

Arrastra ese objeto seleccionado a **Grab Source**, dentro del componente
**Grab Interactable**.

**Pon el pivote en la parte agarrable del modelo.** Es el punto donde se cierra
la mano, así que un pivote en mitad de un objeto largo lo deja colgando del
puño en un ángulo que parece roto.

---

## Paso 6 · Prueba antes el XR Simulator

`Meta XR Tools` → activa el **Meta XR Simulator**.

Puede que te pida **instalarlo** primero — acepta y ábrelo. No viene en el SDK
que añadiste en el paso 2, así que es una descarga aparte.

**Si no hay manera de instalarlo, salta directamente al paso 7.** El simulador
es una comodidad, no un requisito: todo lo que viene después funciona en el
visor sin él.

---

## Know how · Conectar la Quest por Link

1. Conecta el visor al PC con un cable **USB-C**.
2. Abre **Meta Horizon Link** en el PC.
   **En el CITM, NO intentes instalarlo** — ejecuta el fichero
   **`oculus-reg.bat`** que hay en el escritorio.
3. En los **ajustes rápidos** de la Quest, pulsa **Link (PC)**.
4. Espera al entorno virtual y dale a **Play** en Unity.

**Desactiva el Meta XR Simulator antes de darle a Play.** Si se queda activado,
Unity habla con el simulador y el visor no muestra nada.

---

## Paso 7 · Que sea tu objeto

Cambia el cubo por lo que de verdad vas a traer:

- **Importa tu modelo** y asígnalo al **Mesh Filter** del cubo.
- **Crea su material** si el modelo no trae uno, y cambia también el material
  del objeto.
- Pulsa **Edit Collider** en el **Box Collider** y **ajústalo al modelo nuevo**
  — el collider es lo que tu mano agarra de verdad, así que una caja con la
  forma del cubo viejo agarra aire.

---

## Paso 8 · Build e instalación

`File > Build Settings` → comprueba que tu escena está en la lista **Scenes In
Build**.

Antes de buildear: visor conectado por **USB-C**, **modo desarrollador
activado** y **Always allow USB debugging** aceptado en el visor.

**Opción A — desde Unity.** `File > Build Profiles` → **Android** (o Meta
Quest) → en **Run Device** pulsa **Refresh** y elige tu Quest 3 → **Build And
Run**. Se instala y se abre sola.

**Opción B — si el visor no aparece.** Abre **Meta Quest Developer Hub**, pulsa
**Add Build**, elige tu `.apk` y lánzalo desde el visor:
**Library > Unknown Sources**.

---

## Si algo no funciona

- **La app arranca pero no trackea nada** → el Oculus XR Plugin está instalado
  junto a OpenXR (paso 3). Este es el que no da ningún error.
- **Android no sale en Build Settings** → falta el módulo del Editor (paso 1).
- **«Add to My Assets» no hace nada** → no estás logueado en Unity (paso 2).
- **La escena se ve negra, o la ves desde el suelo** → no borraste la Main
  Camera, o no añadiste el Camera Rig (paso 4).
- **El objeto cuelga de la mano torcido** → el pivote no está en la parte
  agarrable (paso 5).
- **No agarras nada** → el Box Collider sigue con la forma del cubo (paso 7).
- **El visor no muestra nada al dar a Play** → el Meta XR Simulator sigue
  activado.
- **El visor no aparece nunca en Run Device** → usa la opción B (paso 8).
