---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercici 1 · Plane Detection

Crea una app d'AR amb Unity AR Foundation
que instanciï **una solució 3D per encarar el blue goblin**

**Bloc 1 — AR Foundation** · **Individual** · vuit passos, sense codi

---

## Avui no s'escriu codi

Parteixes de la plantilla **AR Mobile** d'Unity, que ja porta la lògica
d'instanciació, la UI i el menú d'objectes. Tot el que faràs avui passa a
l'**Inspector**:

duplicar un prefab · canviar un mesh i un material · arrossegar-lo a una llista
· duplicar un botó · canviar un número.

Escriure el raycast i l'instantiate a mà és una conversa per més endavant. Avui
va de posar una build d'AR de debò en un mòbil de debò, i de ficar-hi **el teu**
objecte.

---

## Pas 1 · La plantilla AR Mobile

Unity Hub → **New project** → **AR Mobile**, dins de *Core*.

Abans d'això, revisa la instal·lació de l'Editor. Necessites un **2022 LTS**
amb:

- **Android Build Support**, i a dins **OpenJDK** i **Android SDK & NDK
  Tools**, o
- **iOS Build Support**.

Si falta el mòdul, la plataforma ni tan sols apareixerà després a Build
Settings, i estaràs depurant el que no toca. Afegeix-lo des d'Unity Hub →
*Installs* → **Add modules**.

---

## Pas 2 · Paquets, i després plataforma

`Window > Package Manager`, canvia el desplegable a **Packages: In Project**, i
comprova que tot està actualitzat — en particular **AR Foundation** i el
**Google ARCore XR Plugin** (o **Apple ARKit XR Plugin**).

Després `File > Build Settings` → selecciona **Android** (o **iOS**) →
**Switch Platform**.

Fes el canvi de plataforma **ara**, mentre el projecte és només la plantilla.
Canviar reimporta tots els assets del projecte: segons avui, uns quants minuts
quan ja hi siguin el teu model i les seves textures.

---

## Pas 3 · Ajustos de Player

`Project Settings > Player > Other Settings`:

- **Scripting Backend → IL2CPP**
- desmarca **Auto Graphics API**, i deixa **OpenGLES3** com a única entrada
- **Minimum API Level → 24** (Android 7.0) · a iOS, versió mínima **11**

**ARCore no funciona amb Vulkan.** Deixa'l a la llista de Graphics APIs i l'app
compila, s'instal·la, obre — i mostra una **pantalla negra**, sense cap error
enlloc. És l'errada més difícil de diagnosticar del dia, i és una casella.

---

## Pas 4 · XR Plug-in Management

`Project Settings > XR Plug-in Management` → pestanya **Android** → confirma
que **Google ARCore** està marcat. A iOS, **Apple ARKit**.

Que el paquet sigui al projecte i que el proveïdor estigui **activat** són dues
coses diferents. La plantilla hi posa els paquets; aquesta casella és la que
encén l'AR.

Si la pestanya d'Android no hi és, torna al pas 1: et falta el mòdul d'Android.

---

## Repàs · Fes una build i mira què tens

Ja està tot configurat, així que **fes la build i instal·la l'APK abans de tocar
res**.

Dos motius, i el segon és l'important:

1. Si el mòbil, el cable, la depuració USB o els mòduls no encaixen, te
   n'assabentes ara — sense res teu al projecte a qui culpar.
2. La demo de la plantilla **és** allò que modificaràs. Toca-hi, instancia els
   cubs, obre el menú d'objectes. Hi afegiràs un element, i ajuda haver-lo fet
   servir abans.

---

## Know how · Què et dóna la plantilla

Cinc coses que val la pena reconèixer a la Hierarchy, perquè les obriràs d'aquí
a un moment:

- **AR Session** — el cicle de vida de l'app d'AR: plane detection, image
  tracking, raycasts, meshing, point clouds.
- **XR Origin** *(AR Session Origin)* — converteix les coordenades de la sessió
  AR en coordenades de món d'Unity.
- **AR Camera Manager** — auto focus, light estimation, i **Facing Direction**:
  cap al món, o cap a l'usuari.
- **Tracked Pose Driver** — converteix el moviment real de la càmera en
  moviment de la càmera de l'escena.
- **AR Input Manager** — segueix l'entrada de l'usuari.

---

## Pas 5 · El teu prefab

A `Assets > MobileARTemplateAssets > Prefabs`, **duplica `CubeVariant`** i
reanomena'l amb el nom del teu objecte. (També en pots fer un de zero — només
cal que tingui la mateixa estructura.)

Obre'l, i dins del seu fill **`Visuals`**:

- canvia el mesh del **Mesh Filter** pel teu model,
- canvia el **Material**,
- refés el **Mesh Collider**, amb **Convex** marcat.

---

## Pas 5 · …i el pivot

**Posa el pivot del pare al terra del model.**

Aquest pivot és el punt que el spawner col·loca sobre el pla detectat. Si és al
mig del mesh —que és on sol ser en un model importat— mig objecte acaba enterrat
a la taula i l'altra meitat surant.

L'arreglo és el mateix que arregla gairebé tots els problemes de model: fica el
model dins d'un GameObject buit, puja el fill fins que els peus quedin a l'origen
del pare, i fes servir el pare com a prefab.

---

## Pas 6 · Object Spawner

Desplega el prefab **XR Origin** a la Hierarchy. A dins hi ha un GameObject
anomenat **`Object Spawner`** — selecciona'l i mira l'Inspector.

El seu script **Object Spawner** guarda tots els prefabs que la demo pot
instanciar, a la llista **Object Prefabs**. Prem **+** per afegir un element
més, i **arrossega-hi el teu prefab**.

**Apunta l'índex on cau.** El pas següent necessita aquest número, i és l'única
cosa d'aquí que és fàcil d'equivocar.

---

## Pas 7 · El teu botó

A `UI > Object Menu Animator > Object Menu > Scroll View > Viewport > Content`,
**duplica `Button (Cube)`** i reanomena'l.

Al seu component **Button**, dins d'**On Click**:

- a l'esdeveniment `ARTemplateMenuManager.SetObjectToSpawn`, posa el paràmetre
  amb **l'índex del teu prefab** a la llista Object Prefabs;
- **afegeix un segon esdeveniment**: arrossega l'objecte **`SelectionBox`**,
  tria **GameObject.SetActive**, i marca la seva casella.

---

## Pas 7 · …sobre aquest número

A l'exemple el paràmetre és **7**.

Aquest és el **vuitè** element de la llista Object Prefabs, perquè la llista
compta des de **zero**. Si el teu objecte va ser el novè que hi vas arrossegar,
el teu número és el 8.

Si t'equivoques aquí no sembla que hi hagi res trencat: el botó funciona, el
menú es tanca, i el que instancies és el cub d'algú altre. Si et passa això,
torna aquí i compta la llista un altre cop.

---

## Pas 8 · Fes l'APK

`File > Build Settings`:

- comprova que la teva escena és a la llista **Scenes In Build** — *Add Open
  Scenes* si no hi és;
- prem **Build** i tria una carpeta de destinació.

Aquest és el teu APK. Instal·la'l al mòbil.

Prova'l sobre una **superfície real amb una mica de textura** — una taula amb
coses a sobre, no un escriptori blanc i llis. ARCore troba plans seguint feature
points, i una superfície llisa i uniforme no li dóna res on agafar-se.

---

## Si alguna cosa no funciona

- **Pantalla negra** → Vulkan encara és a Graphics APIs (pas 3).
- **La build no té AR** → el proveïdor ARCore no està marcat (pas 4).
- **La plataforma no surt a Build Settings** → falta el mòdul de l'Editor
  (pas 1).
- **No detecta res** → falta llum, o la superfície és llisa i uniforme; ARCore
  necessita textura (pas 8).
- **Mig objecte dins de la taula** → el pivot no és al seu terra (pas 5).
- **El botó instancia l'objecte equivocat** → l'índex de `SetObjectToSpawn`
  (pas 7).
