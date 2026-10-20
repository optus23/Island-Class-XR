---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercici 2 · Locomoció i passthrough

Crea una **app de realitat mixta** amb Meta Building Blocks
per **trobar el robot gegant** — mou-te en VR i salta a MR amb un botó

**Bloc 2 — Meta Building Blocks** · **En grup** · vuit passos, sense codi

---

## El robot ha desaparegut

Ja no és al món virtual. **És al físic**, així que haureu de buscar-lo a la
vostra pròpia aula.

Aquest és l'exercici en una línia: **moure's pel món virtual** i després
**canviar a passthrough amb un botó** per veure on sou de debò.

**Avui tampoc s'escriu codi.** El canvi de mode es fa amb Building Blocks i
esdeveniments de l'Inspector, no amb un script.

---

## Know how · Al simulador no hi ha passthrough

El Meta XR Simulator va molt bé per als passos 5 i 6 — teleport, slide, turn —
i **no serveix per al pas 7**, perquè no us pot ensenyar la vostra habitació.

Així que compteu-hi des d'ara: munteu la locomoció al simulador si voleu, però
**el canvi de mode s'ha de provar al visor per Link o en una build.**

I el parany de sempre: **desactiveu el Meta XR Simulator abans de donar-li a
Play** amb el visor connectat, o Unity parla amb el simulador i el visor es
queda a les fosques.

---

## Passos 1 a 4 · Igual que el dia anterior

Ja els coneixeu de l'exercici 1. Si el vostre projecte d'aquella classe encara
funciona, obriu-lo i salteu al pas 5.

1. **Unity Hub → New project → Universal 3D**, amb el **mòdul d'Android**.
2. **Asset Store → Meta XR SDK → Add to My Assets** (connectats a Unity).
3. **Package Manager** → els paquets de Meta; **XR Plug-in Management →
   OpenXR**; **Project Validation → Fix All**; **Meta XR → Apply All**.
   **L'Oculus XR Plugin NO pot estar instal·lat** — amb ell no hi ha tracking i
   no hi ha error.
4. **Escena nova, esborrar la `Main Camera`**, i després `Meta XR Tools >
   Building Blocks`.

---

## Pas 4 · …però amb tres blocs diferents

Aquesta vegada arrossegueu:

- **Camera Rig**
- **Interaction Rig** — mans i comandaments
- **Passthrough** — el nou d'avui

I construïu alguna cosa per on moure's: **afegiu un cub i creeu un terra**
(`GameObject > 3D Object > Plane`). Sense terra no hi ha lloc on
teletransportar-se, i el pas 5 es queda sense res sobre què treballar.

---

## Pas 5 · Teleport sobre un pla

Aneu a **`OVRInteractionComprehensive`**, **clic dret** → **Interaction SDK** →
canvieu el tipus d'interacció a **Plane**. Després premeu **Create**.

Això converteix el vostre terra en una superfície on es pot saltar. Si surt un
avís abans, premeu **Fix All** i després Create.

**El pla és allò on et teletransportes**, així que si en apuntar al terra no
passa res, aquest és el pas on tornar.

---

## Pas 6 · Canvia el mode del comandament

Als **dos** interactors, l'esquerre i el dret:

- **desactiveu** `ControllerSliderInteraction`
- **activeu** `TeleportControllerInteraction`

**Feu-ho als dos costats.** Fer-ho només en un és l'error més comú aquí, i deixa
un visor on una mà es teletransporta i l'altra llisca — que es llegeix com una
fallada del SDK i no com una casella que se us va passar.

---

## Know how · La locomoció que porta el SDK

Set tipus. Avui feu servir els tres primers:

| Tipus | Què fa |
| --- | --- |
| **Teleport** | Et porta a l'instant a un punt llunyà |
| **Turn** | Canvia cap on mires sense moure't |
| **Slide** | Moviment lliure amb el joystick |
| Step | Passos ràpids per ajustar la posició |
| Telepath | Et porta de manera suau a un punt llunyà |
| Climbing | Et desplaces agafant-te a superfícies |
| Walking Stick | T'impulses amb bastons virtuals contra el terra |

L'escena d'exemple **`LocomotionExamples`** ensenya els altres.

---

## Pas 7 · El botó que canvia de mode

El passthrough ja és a l'escena des del pas 4. Ara cal poder encendre'l i
apagar-lo.

Afegiu el Building Block **Controller Buttons Mapper**, i després:

- **Add a Button Click action**; a l'**input manager**, trieu el botó que
  vulgueu.
- Afegiu un **callback**: arrossegueu el **GameObject del passthrough** →
  `enabled` → **false**.
- **Repetiu amb un segon botó**, amb `enabled` → **true**, per poder tornar.

Un botó us porta a VR i l'altre a passthrough.

---

## Pas 7 · …i que a la teva habitació no et moguis

Opcional, i és el detall que ho deixa acabat: mentre sou en passthrough esteu
drets a la vostra aula de debò, així que lliscar i teletransportar-se no té
sentit.

Mateix mecanisme, sense script: als esdeveniments del botó de **passthrough**,
afegiu també els GameObjects de locomoció → `GameObject > SetActive > false`, i
als del botó de **VR**, torneu-los a **true**.

---

## Know how · Connectar la Quest per Link

1. Al visor: `Configuració > Sistema > Quest Link` → activar.
2. Al PC: obriu **Meta Horizon Link**, inicieu sessió i connecteu el cable
   **USB-C**. **Al CITM no l'instal·leu** — executeu `oculus-reg.bat` de
   l'escriptori.
3. A Meta Horizon Link: **poseu-lo com a runtime d'OpenXR actiu**, activeu
   **Developer Runtime Features** i, a dins, **Passthrough over Meta Quest
   Link**.
4. Als **ajustos ràpids** de la Quest, premeu **Link (PC)**, i després **Play**
   a Unity.

**Negre en comptes de la vostra habitació?** El punt 3 és el perquè: el
passthrough per Link és un interruptor a part, i ve apagat.

---

## Pas 8 · Build i instal·lació

`File > Build Settings` → la vostra escena a la llista **Scenes In Build**.

Visor per **USB-C**, **mode desenvolupador activat** i **Always allow USB
debugging** acceptat al visor.

**Opció A — des d'Unity.** `File > Build Profiles` → **Android** (o Meta Quest)
→ **Run Device** → **Refresh** → la vostra Quest 3 → **Build And Run**.

**Opció B — si el visor no apareix.** **Meta Quest Developer Hub** → **Add
Build** → el vostre `.apk`, i després **Library > Unknown Sources** al visor.

Proveu-ho tot a la build: teleport, turn, slide i els dos botons.

---

## Si alguna cosa no funciona

- **No traqueja res** → l'Oculus XR Plugin està instal·lat al costat d'OpenXR
  (pas 3). No dóna cap error.
- **El teleport no fa res** → el pla no es va arribar a crear (pas 5), o el
  terra no té collider.
- **Una mà es teletransporta i l'altra llisca** → el pas 6 només està fet en un
  costat.
- **El passthrough es veu negre** → *Passthrough over Meta Quest Link* està
  apagat, o el Skybox Material no és **None**.
- **El passthrough no apareix mai al simulador** → no pot. Feu servir el visor.
- **El visor es queda a les fosques en donar-li a Play** → el Meta XR Simulator
  continua activat.
- **L'esdeveniment del botó no troba `enabled`** → trieu el GameObject del
  passthrough, no el seu pare.
