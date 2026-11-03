---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercici 3 · Mixed Reality Utility Kit

Construïu una **app de realitat mixta** amb el **Meta Mixed Reality Utility
Kit**: escanegeu la vostra sala real, poseu-la dins d'Unity i trieu un dels
samples d'MRUK per portar-lo al projecte del grup

**Bloc 2: Meta Building Blocks** · **En grup** · vuit passos

---

## El robot ja no hi és, la sala sí

El robot gegant és fora de joc, així que l'aventura pot continuar. El que canvia
avui és **on** continua: no en una escena virtual que heu muntat vosaltres,
sinó **a la sala on sou drets**.

Per això hi ha el **Mixed Reality Utility Kit**. Escanegeu la sala un cop amb
el visor i MRUK passa a Unity les parets, el terra, el sostre i els mobles com
a geometria que la vostra app pot fer servir: les coses reboten contra la
vostra taula real, s'amaguen darrere del vostre sofà real, o la vostra paret
real se substitueix per una de virtual.

---

## Know how · Què us dona MRUK de debò

MRUK s'aguanta sobre la Scene API i us estalvia escriure la lampisteria a mà.
Tres grups de coses:

- **Consultes sobre l'escena**: on és el terra, quines superfícies són parets,
  si hi cap aquest objecte aquí.
- **Ajudes gràfiques**, les que feu servir avui: `EffectMesh` construeix una
  malla sobre la sala real, i els spawners col·loquen prefabs sobre superfícies
  reals.
- **Eines de desenvolupament**: vistes de debug, i sales falses per poder
  treballar sense posar-se el visor.

**No és un Building Block.** És el seu propi paquet, `Meta MR Utility Kit`,
instal·lat al costat del Meta XR SDK.

---

## Passos 1 a 3 · Igual que els dos últims dies

Si el vostre projecte de l'exercici 2 encara obre i funciona, feu-lo servir i
salteu al pas 4.

1. **Unity Hub → New project → Universal 3D**, amb el **mòdul d'Android**.
2. **Asset Store → Meta XR SDK → Add to My Assets** (connectats a Unity), i
   després instal·leu-lo des del **Package Manager**.
3. **Package Manager** → comproveu que hi ha els paquets de Meta; **Project
   Settings → XR Plug-in Management → OpenXR**; **Project Validation → Fix
   All**; **Meta XR → Apply All**.
   **L'Oculus XR Plugin NO pot estar instal·lat**: amb ell no hi ha tracking i
   no hi ha missatge d'error.

---

## Pas 3 · …i les versions que hauríeu de veure

Al projecte de referència els paquets de Meta marquen **201.0.0**: All-in-One SDK,
Core SDK, Interaction SDK, Interaction SDK Essentials, Haptics SDK, Platform
SDK i **Meta MR Utility Kit**. L'Audio SDK i el Voice SDK van per 85.0.0, i
això és normal.

**No cal instal·lar tots els paquets de Meta.** El que avui es necessita és
l'All-in-One SDK (o el Core) i el **MR Utility Kit**.

Apunteu-vos la versió que us quedi. El pas 7 té un error la causa més probable
del qual és un desfasament de versions, i voldreu saber la vostra.

---

## Pas 4 · Tots els toggles de desenvolupador de Meta Horizon Link

Al PC, obriu **Meta Horizon Link → Desenvolupador** i activeu **els set**:

1. Permetre actualitzacions de programari automàtiques de Meta Horizon Link
2. Funcions d'entorn d'execució per a desenvolupadors
3. Enfocament exterior mitjançant Meta Horizon Link (el passthrough)
4. Permisos de l'enfocament exterior de l'API de càmera
5. Seguiment d'ulls mitjançant Meta Horizon Link
6. Expressions facials naturals mitjançant Meta Horizon Link
7. **Dades de l'entorn mitjançant Meta Horizon Link**

**El 7 és del qual depèn la classe d'avui.** És el que deixa que l'editor
llegeixi la sala que heu escanejat. Sense ell MRUK no troba cap sala i la
vostra escena surt buida, sense res a la consola que us digui per què.

---

## Pas 5 · El visor en mode desenvolupador

Això ho vau fer a la classe 1, així que és una comprovació més que feina:
**mode desenvolupador activat**, el **cable de dades USB-C** connectat i
**Always allow USB debugging** acceptat dins del visor.

**Al CITM no instal·leu Meta Horizon Link**: executeu `oculus-reg.bat` de
l'escriptori.

El pas següent el feu amb el visor posat, així que connecteu-lo ja.

---

## Pas 6 · Escanegeu la sala (Space Setup)

**Al visor**, no des del PC:

`Configuració` → `Environment Setup` → **Space Setup**

Recorreu la sala i marqueu les parets, el terra, el sostre i els mobles grans.
D'aquí surt el **Scene Model**, i és l'única font de la geometria que fa servir
tot el que hi ha a sota.

**Escanegeu la sala on ho ensenyareu.** Un escaneig vell d'una altra sala és el
motiu més comú de tots que un sample sembli trencat: la malla hi és, el que
passa és que no es correspon amb el lloc on sou.

---

## Pas 7 · Importeu els samples d'MRUK

No vénen amb el paquet. Viuen al seu propi repositori:

**`github.com/oculus-samples/Unity-MRUtilityKitSample`**

Descarregueu-lo o clonar-lo, i després **copieu la carpeta `MRUKSamples` dins
de la carpeta `Assets` del vostre projecte**. Al de referència acaba a
`Assets/Samples/MRUKSamples`.

Arriben catorze carpetes: `Basic`, `BouncingBall`, `DestructibleMesh`,
`EnvironmentPanelPlacement`, `FloorZone`, `KeyboardTracker`, `MultiSpawn`,
`NavMesh`, `PassthroughRelighting`, `QRCodeDetection`, `SharedAssets`,
`SpaceMap`, `StartScene`, `VirtualHome`.

---

## Pas 7 · L'error de compilació, i la paraula que l'arregla

Tan bon punt aterren, Unity es posa vermell:

```
Assets/Samples/MRUKSamples/BouncingBall/Scripts/BouncingBallMgr.cs(35,43):
error CS0117: 'OVRInput' does not contain a definition for
'GetLocalControllerAngularVelocityCw'
```

**Obriu l'script, aneu a la línia 35 i esborreu el `Cw`:**

- abans: `OVRInput.GetLocalControllerAngularVelocityCw(...)`
- després: `OVRInput.GetLocalControllerAngularVelocity(...)`

**Un error de compilació bloqueja el projecte sencer**, no només aquella
escena, així que res del que ve després funciona fins que la consola estigui a
zero errors.

---

## Know how · Per què hi ha aquest error

El repositori de samples està fet contra un **SDK més nou que el que heu
instal·lat**: aquí el projecte va per 201.0.0 i l'última release del repositori
apunta a 207.0.0. Meta va canviar el nom del mètode pel camí.

És l'única vegada de tot el bloc que obriu un `.cs`, i és una paraula. Si
preferiu no tocar-lo, les alternatives són: **demanar a classe l'script ja
corregit**, o **esborrar la carpeta `BouncingBall`** si no fareu servir aquell
sample.

---

## Pas 7 · Obriu `MRUKBase` i apunteu-lo a la vostra sala

Obriu `Assets/Samples/MRUKSamples/Basic/MRUKBase`. A la Hierarchy teniu
`OVRCameraRig`, `MRUK`, `EffectMesh`, `[BuildingBlock] Passthrough` i
`[BuildingBlock] Real Hands`.

Seleccioneu l'objecte **`MRUK`** → **Scene Settings** → **Data Source** →
**`Device`**.

| Opció | D'on surt la sala |
| --- | --- |
| **Device** | Del vostre escaneig. **Aquesta.** |
| Prefab | Una sala enllaunada del paquet |
| Device With Prefab Fallback | La que ve per defecte: el vostre escaneig, i una d'enllaunada si no n'hi ha |
| Json | Una sala desada en un fitxer |
| Device With Json Fallback | El vostre escaneig, i el fitxer si no n'hi ha |

---

## Pas 7 · Els quatre samples

Passeu-los en aquest ordre. Cadascun és una resposta diferent a "què faig amb
una sala".

| Escena | Què mirar |
| --- | --- |
| **MRUK Base** | `EffectMesh` pinta volums sobre les vostres parets i mobles reals |
| **Bouncing Ball** | La mateixa malla feta servir com a **colliders**: la pilota rebota a la vostra sala |
| **Virtual Home** | La vostra sala **substituïda** per una de virtual amb la mateixa forma. VR amb les vostres parets |
| **Destructible Mesh** | El mateix, però es pot trencar |

A **Bouncing Ball** el gallet de la mà dreta agafa i el gallet de l'índex dret
llança.

---

## Pas 7 · Canvieu una cosa al que trieu

**Trieu un dels quatre** i feu-lo vostre. Tot això és feina d'Inspector, sense
script:

- **MRUK Base**: canvieu el material de l'`EffectMesh` per un de
  semitransparent perquè es vegi el passthrough per sota, o canvieu quines
  superfícies cobreix.
- **Virtual Home**: canvieu els prefabs que el spawner deixa sobre cada tipus
  de superfície, per moblar la sala virtual a la vostra manera.
- **Bouncing Ball**: canvieu la pilota, el seu material, el seu physics
  material.
- **Destructible Mesh**: canvieu la pinta que tenen els trossos trencats.

El que trieu és el que va a la build del grup.

---

## Pas 8 · Build i instal·lació

`File > Build Settings` → la vostra escena és a la llista **Scenes In Build**.
Visor per **USB-C**, mode desenvolupador activat, **Always allow USB debugging**
acceptat.

**Opció A: des d'Unity.** `File > Build Profiles` → **Android** (o Meta
Quest) → **Run Device** → **Refresh** → la vostra Quest 3 → **Build And Run**.

**Opció B: si el visor no apareix mai.** **Meta Quest Developer Hub** → **Add
Build** → el vostre `.apk`, i després **Library > Unknown Sources** al visor.

**Proveu-ho en una sala diferent d'aquella on el vau muntar.** Si allà encara
té sentit, està acabat.

---

## L'entrega del bloc

Aquest és l'últim exercici del bloc, així que el que entregueu és **el bloc**,
no aquesta classe: **una APK per grup amb les tres activitats a dins**, més la
documentació. L'entrega en si va per Atenea, a la sessió on hi ha el seu
banderí, no aquí.

Digueu a la documentació **quin sample vau triar** i **què li vau canviar**, i
apunteu la **versió dels paquets de Meta** contra la qual vau compilar.

---

## Si alguna cosa no funciona

- **La consola és vermella i no arrenca res** → l'arranjament del `Cw` del pas
  7. Bloqueja el projecte sencer.
- **L'escena carrega però la sala és buida** → `Data Source` no és `Device`, o
  *Dades de l'entorn mitjançant Meta Horizon Link* està apagat (pas 4), o no hi
  ha escaneig en aquest visor (pas 6).
- **La sala hi és, però té la forma equivocada** → un Space Setup vell.
  Escanegeu una altra vegada, a la sala on sou de debò.
- **No hi ha tracking** → l'Oculus XR Plugin està instal·lat al costat
  d'OpenXR (pas 3). No hi ha missatge d'error enlloc.
- **El visor es queda negre en donar a Play** → el Meta XR Simulator continua
  activat.
- **El visor no apareix a Run Device** → Opció B, i comproveu que vau acceptar
  *Always allow USB debugging* dins del visor.
