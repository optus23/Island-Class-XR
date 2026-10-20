---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 2 · Locomoción y passthrough

Crea una **app de realidad mixta** con Meta Building Blocks
para **encontrar al robot gigante** — muévete en VR y salta a MR con un botón

**Bloque 2 — Meta Building Blocks** · **En grupo** · ocho pasos, sin código

---

## El robot ha desaparecido

Ya no está en el mundo virtual. **Está en el físico**, así que vais a tener que
buscarlo en vuestra propia aula.

Ese es el ejercicio en una línea: **moverse por el mundo virtual** y después
**cambiar a passthrough con un botón** para ver dónde estáis de verdad.

**Hoy tampoco se escribe código.** El cambio de modo se hace con Building
Blocks y eventos del Inspector, no con un script.

---

## Know how · En el simulador no hay passthrough

El Meta XR Simulator va de maravilla para los pasos 5 y 6 — teleport, slide,
turn — y **no sirve para el paso 7**, porque no puede enseñaros vuestra
habitación.

Así que contadlo desde ya: montad la locomoción en el simulador si queréis,
pero **el cambio de modo hay que probarlo en el visor por Link o en una build.**

Y la trampa de siempre: **desactivad el Meta XR Simulator antes de dar a Play**
con el visor conectado, o Unity habla con el simulador y el visor se queda a
oscuras.

---

## Pasos 1 a 4 · Igual que el día anterior

Ya los conocéis del ejercicio 1. Si vuestro proyecto de aquella clase sigue
funcionando, abridlo y saltad al paso 5.

1. **Unity Hub → New project → Universal 3D**, con el **módulo de Android**.
2. **Asset Store → Meta XR SDK → Add to My Assets** (logueados en Unity).
3. **Package Manager** → los paquetes de Meta; **XR Plug-in Management →
   OpenXR**; **Project Validation → Fix All**; **Meta XR → Apply All**.
   **El Oculus XR Plugin NO puede estar instalado** — con él no hay tracking y
   no hay error.
4. **Escena nueva, borrar la `Main Camera`**, y después `Meta XR Tools >
   Building Blocks`.

---

## Paso 4 · …pero con tres bloques distintos

Esta vez arrastrad:

- **Camera Rig**
- **Interaction Rig** — manos y mandos
- **Passthrough** — el nuevo de hoy

Y construid algo por donde moverse: **añadid un cubo y cread un suelo**
(`GameObject > 3D Object > Plane`). Sin suelo no hay sitio al que
teletransportarse, y el paso 5 se queda sin nada sobre lo que trabajar.

---

## Paso 5 · Teleport sobre un plano

Id a **`OVRInteractionComprehensive`**, **clic derecho** → **Interaction SDK**
→ cambiad el tipo de interacción a **Plane**. Después pulsad **Create**.

Eso convierte vuestro suelo en una superficie a la que se puede saltar. Si sale
un aviso antes, pulsad **Fix All** y luego Create.

**El plano es aquello a lo que te teletransportas**, así que si al apuntar al
suelo no pasa nada, este es el paso al que volver.

---

## Paso 6 · Cambia el modo del mando

En **los dos** interactores, el izquierdo y el derecho:

- **desactivad** `ControllerSliderInteraction`
- **activad** `TeleportControllerInteraction`

**Hacedlo en los dos lados.** Hacerlo solo en uno es el error más común aquí, y
deja un visor donde una mano se teletransporta y la otra se desliza — que se
lee como un fallo del SDK en vez de como una casilla que se os pasó.

---

## Know how · La locomoción que trae el SDK

Siete tipos. Hoy usáis los tres primeros:

| Tipo | Qué hace |
| --- | --- |
| **Teleport** | Te lleva al instante a un punto lejano |
| **Turn** | Cambia hacia dónde miras sin moverte |
| **Slide** | Movimiento libre con el joystick |
| Step | Pasos rápidos para ajustar la posición |
| Telepath | Te lleva de forma suave a un punto lejano |
| Climbing | Te desplazas agarrándote a superficies |
| Walking Stick | Te impulsas con bastones virtuales contra el suelo |

La escena de ejemplo **`LocomotionExamples`** enseña los demás.

---

## Paso 7 · El botón que cambia de modo

El passthrough ya está en la escena desde el paso 4. Ahora hay que poder
encenderlo y apagarlo.

Añadid el Building Block **Controller Buttons Mapper**, y después:

- **Add a Button Click action**; en el **input manager**, elegid el botón que
  queráis.
- Añadid un **callback**: arrastrad el **GameObject del passthrough** →
  `enabled` → **false**.
- **Repetid con un segundo botón**, con `enabled` → **true**, para poder
  volver.

Un botón os lleva a VR y el otro a passthrough.

---

## Paso 7 · …y que en tu habitación no te muevas

Opcional, y es el detalle que lo deja acabado: mientras estáis en passthrough
estáis de pie en vuestra aula de verdad, así que deslizarse y teletransportarse
no tiene sentido.

Mismo mecanismo, sin script: en los eventos del botón de **passthrough**,
añadid también los GameObjects de locomoción → `GameObject > SetActive >
false`, y en los del botón de **VR**, devolvedlos a **true**.

---

## Know how · Conectar la Quest por Link

1. En el visor: `Ajustes > Sistema > Quest Link` → activar.
2. En el PC: abrid **Meta Horizon Link**, iniciad sesión y conectad el cable
   **USB-C**. **En el CITM no lo instaléis** — ejecutad `oculus-reg.bat` del
   escritorio.
3. En Meta Horizon Link: **ponedlo como runtime de OpenXR activo**, activad
   **Developer Runtime Features** y, dentro, **Passthrough over Meta Quest
   Link**.
4. En los **ajustes rápidos** de la Quest, pulsad **Link (PC)**, y después
   **Play** en Unity.

**¿Negro en vez de vuestra habitación?** El punto 3 es el porqué: el
passthrough por Link es un interruptor aparte, y viene apagado.

---

## Paso 8 · Build e instalación

`File > Build Settings` → vuestra escena en la lista **Scenes In Build**.

Visor por **USB-C**, **modo desarrollador activado** y **Always allow USB
debugging** aceptado en el visor.

**Opción A — desde Unity.** `File > Build Profiles` → **Android** (o Meta
Quest) → **Run Device** → **Refresh** → vuestra Quest 3 → **Build And Run**.

**Opción B — si el visor no aparece.** **Meta Quest Developer Hub** → **Add
Build** → vuestro `.apk`, y después **Library > Unknown Sources** en el visor.

Probadlo todo en la build: teleport, turn, slide y los dos botones.

---

## Si algo no funciona

- **No trackea nada** → el Oculus XR Plugin está instalado junto a OpenXR
  (paso 3). No da ningún error.
- **El teleport no hace nada** → el plano no llegó a crearse (paso 5), o el
  suelo no tiene collider.
- **Una mano se teletransporta y la otra se desliza** → el paso 6 solo está
  hecho en un lado.
- **El passthrough se ve negro** → *Passthrough over Meta Quest Link* está
  apagado, o el Skybox Material no es **None**.
- **El passthrough no aparece nunca en el simulador** → no puede. Usad el visor.
- **El visor se queda a oscuras al dar a Play** → el Meta XR Simulator sigue
  activado.
- **El evento del botón no encuentra `enabled`** → elegid el GameObject del
  passthrough, no su padre.
