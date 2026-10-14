---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercici 1 · Meta Building Blocks

Crea una **app de realitat virtual** amb Meta Building Blocks
per **interactuar amb una solució 3D per encarar el robot gegant**

**Bloc 2 — Meta Building Blocks** · **En grup** · vuit passos, sense codi

---

## El goblin ara és del vostre bàndol

Ha aparegut un robot gegant, i el blue goblin ha canviat de bàndol: hi aneu en
equip.

El que construïu és **el vostre** objecte 3D: la cosa que fiqueu dins la VR i
que agafeu amb les mans. El model que vulgueu. Triar-lo és l'exercici.

**Avui tampoc s'escriu codi.** Tot passa a l'Inspector d'Unity i a la finestra
de Building Blocks: deixes anar un bloc a l'escena i funciona.

---

## Know how · Què hi ha dins del Meta XR SDK

L'All-in-One SDK són uns quants paquets, i no els necessiteu tots:

- **Core SDK** — render, tracking i primitives de realitat mixta
- **Interaction SDK** — interaccions amb mans, comandaments i mirada
- **Haptics**, **Audio**, **Platform**, **MR Utility Kit**

**El Meta XR Simulator NO és dins del SDK.** S'instal·la a part — d'això va el
pas 6, i per això es pot negar.

---

## Pas 1 · Un projecte nou

Unity Hub → **New project** → plantilla **Universal 3D**.

**Assegura't de tenir el mòdul d'Android instal·lat** abans de començar. És la
mateixa comprovació que al bloc 1 i falla igual: sense ell, Android no apareix
mai a Build Settings i te n'adones al final de tot.

---

## Pas 2 · El Meta XR SDK des de l'Asset Store

Obre l'**Asset Store** i busca **Meta XR SDK**.

Prem **Add to My Assets**.

Has d'estar **connectat al teu compte d'Unity** perquè aquest botó faci res —
si sembla que no passa res, és per això.

---

## Pas 3 · Paquets, proveïdor, validació

Tres coses, en aquest ordre:

1. `Window > Package Manager` → busca els paquets de **Meta**. **No cal
   instal·lar-los tots.**
2. `Project Settings > XR Plug-in Management` → posa el proveïdor a **OpenXR**.
3. **Project Validation → Fix All**, i després **Meta XR → Apply All**.

---

## Pas 3 · …i el que ho trenca tot

**Comprova que l'Oculus XR Plugin NO està instal·lat.**

És l'error més car del dia: amb ell al projecte al costat d'OpenXR, la build
funciona, el visor mostra la teva escena i **no traqueja res** — ni el cap ni
les mans. I no surt cap error enlloc.

Si el teu projecte el té, treu-lo abans de continuar.

---

## Pas 4 · Una escena nova i tres blocs

**Crea una escena nova i esborra la `Main Camera`.** El Camera Rig porta la
seva, i dues càmeres és una escena confusa.

Després `Meta XR Tools > Building Blocks`, i arrossega'n **tres**:

- **Camera Rig** — segueix el cap i el cos; és el que substitueix la Main Camera
- **Interaction Rig** — porta el hand tracking *i* els comandaments
- **Grab Interaction** — hi posa un cub que es pot agafar

---

## Pas 5 · Connecta el grab

Obre el **`[BuildingBlock] Cube`** i selecciona
**`[BuildingBlock] HandGrab Installation Routine AND`**.

Arrossega aquest objecte seleccionat a **Grab Source**, dins del component
**Grab Interactable**.

**Posa el pivot a la part agafable del model.** És el punt on es tanca la mà,
així que un pivot al mig d'un objecte llarg el deixa penjant del puny en un
angle que sembla trencat.

---

## Pas 6 · Prova abans l'XR Simulator

`Meta XR Tools` → activa el **Meta XR Simulator**.

Pot ser que et demani **instal·lar-lo** primer — accepta i obre'l. No ve al SDK
que vas afegir al pas 2, així que és una descàrrega a part.

**Si no hi ha manera d'instal·lar-lo, salta directament al pas 7.** El simulador
és una comoditat, no un requisit: tot el que ve després funciona al visor sense
ell.

---

## Know how · Connectar la Quest per Link

1. Connecta el visor al PC amb un cable **USB-C**.
2. Obre **Meta Horizon Link** al PC.
   **Al CITM, NO intentis instal·lar-lo** — executa el fitxer
   **`oculus-reg.bat`** que hi ha a l'escriptori.
3. Als **ajustos ràpids** de la Quest, prem **Link (PC)**.
4. Espera l'entorn virtual i dóna-li a **Play** a Unity.

**Desactiva el Meta XR Simulator abans de donar-li a Play.** Si es queda
activat, Unity parla amb el simulador i el visor no mostra res.

---

## Pas 7 · Que sigui el teu objecte

Canvia el cub pel que realment portaràs:

- **Importa el teu model** i assigna'l al **Mesh Filter** del cub.
- **Crea el seu material** si el model no en porta, i canvia també el material
  de l'objecte.
- Prem **Edit Collider** al **Box Collider** i **ajusta'l al model nou** — el
  collider és el que la teva mà agafa de debò, així que una caixa amb la forma
  del cub vell agafa aire.

---

## Pas 8 · Build i instal·lació

`File > Build Settings` → comprova que la teva escena és a la llista **Scenes
In Build**.

Abans de fer la build: visor connectat per **USB-C**, **mode desenvolupador
activat** i **Always allow USB debugging** acceptat al visor.

**Opció A — des d'Unity.** `File > Build Profiles` → **Android** (o Meta Quest)
→ a **Run Device** prem **Refresh** i tria la teva Quest 3 → **Build And Run**.
S'instal·la i s'obre sola.

**Opció B — si el visor no apareix.** Obre **Meta Quest Developer Hub**, prem
**Add Build**, tria el teu `.apk` i llança'l des del visor:
**Library > Unknown Sources**.

---

## Si alguna cosa no funciona

- **L'app arrenca però no traqueja res** → l'Oculus XR Plugin està instal·lat al
  costat d'OpenXR (pas 3). Aquest és el que no dóna cap error.
- **Android no surt a Build Settings** → falta el mòdul de l'Editor (pas 1).
- **«Add to My Assets» no fa res** → no estàs connectat a Unity (pas 2).
- **L'escena es veu negra, o la veus des de terra** → no vas esborrar la Main
  Camera, o no vas afegir el Camera Rig (pas 4).
- **L'objecte penja de la mà tort** → el pivot no és a la part agafable (pas 5).
- **No agafes res** → el Box Collider encara té la forma del cub (pas 7).
- **El visor no mostra res en donar-li a Play** → el Meta XR Simulator continua
  activat.
- **El visor no apareix mai a Run Device** → fes servir l'opció B (pas 8).
