---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 3 · Mixed Reality Utility Kit

Construid una **app de realidad mixta** con el **Meta Mixed Reality Utility
Kit**: escanead vuestra sala real, metedla en Unity y escoged uno de los
samples de MRUK para llevarlo al proyecto del grupo

**Bloque 2: Meta Building Blocks** · **En grupo** · ocho pasos

---

## El robot ya no está, la sala sí

El robot gigante está fuera de juego, así que la aventura puede continuar. Lo
que cambia hoy es **dónde** continúa: no en una escena virtual que habéis
montado vosotros, sino **en la sala en la que estáis de pie**.

Para eso está el **Mixed Reality Utility Kit**. Escaneáis la sala una vez con
el visor y MRUK le pasa a Unity las paredes, el suelo, el techo y los muebles
como geometría que vuestra app puede usar: las cosas rebotan contra vuestra
mesa real, se esconden detrás de vuestro sofá real, o vuestra pared real se
sustituye por una virtual.

---

## Know how · Qué os da MRUK de verdad

MRUK se apoya en la Scene API y os ahorra escribir la fontanería a mano. Tres
grupos de cosas:

- **Consultas sobre la escena**: dónde está el suelo, qué superficies son
  paredes, si cabe este objeto aquí.
- **Ayudas gráficas**, las que usáis hoy: `EffectMesh` construye una malla
  sobre la sala real, y los spawners colocan prefabs sobre superficies reales.
- **Herramientas de desarrollo**: vistas de debug, y salas falsas para poder
  trabajar sin ponerse el visor.

**No es un Building Block.** Es su propio paquete, `Meta MR Utility Kit`,
instalado al lado del Meta XR SDK.

---

## Pasos 1 a 3 · Igual que los dos últimos días

Si vuestro proyecto del ejercicio 2 todavía abre y funciona, usadlo y saltad al
paso 4.

1. **Unity Hub → New project → Universal 3D**, con el **módulo de Android**.
2. **Asset Store → Meta XR SDK → Add to My Assets** (logueados en Unity), y
   después instaladlo desde el **Package Manager**.
3. **Package Manager** → comprobad que están los paquetes de Meta; **Project
   Settings → XR Plug-in Management → OpenXR**; **Project Validation → Fix
   All**; **Meta XR → Apply All**.
   **El Oculus XR Plugin NO puede estar instalado**: con él no hay tracking y
   no hay mensaje de error.

---

## Paso 3 · …y las versiones que deberíais ver

En el proyecto de referencia los paquetes de Meta marcan **201.0.0**: All-in-One SDK,
Core SDK, Interaction SDK, Interaction SDK Essentials, Haptics SDK, Platform
SDK y **Meta MR Utility Kit**. El Audio SDK y el Voice SDK van por 85.0.0, y
eso es normal.

**No hace falta instalar todos los paquetes de Meta.** Lo que hoy se necesita
es el All-in-One SDK (o el Core) y el **MR Utility Kit**.

Apuntaos la versión que os quede. El paso 7 tiene un error cuya causa más
probable es un desfase de versiones, y vais a querer saber la vuestra.

---

## Paso 4 · Todos los toggles de desarrollador de Meta Horizon Link

En el PC, abrid **Meta Horizon Link → Desarrollador** y activad **los siete**:

1. Permitir actualizaciones de software automáticas de Meta Horizon Link
2. Funciones de entorno de ejecución para desarrolladores
3. Enfoque exterior mediante Meta Horizon Link (el passthrough)
4. Permisos del enfoque exterior de la API de cámara
5. Seguimiento de ojos mediante Meta Horizon Link
6. Expresiones faciales naturales mediante Meta Horizon Link
7. **Datos del entorno mediante Meta Horizon Link**

**El 7 es del que depende la clase de hoy.** Es el que deja que el editor lea
la sala que habéis escaneado. Sin él MRUK no encuentra ninguna sala y vuestra
escena sale vacía, sin nada en la consola que os diga por qué.

---

## Paso 5 · El visor en modo desarrollador

Esto lo hicisteis en la clase 1, así que es una comprobación más que trabajo:
**modo desarrollador activado**, el **cable de datos USB-C** conectado y
**Always allow USB debugging** aceptado dentro del visor.

**En el CITM no instaléis Meta Horizon Link**: ejecutad `oculus-reg.bat` del
escritorio.

El paso siguiente lo hacéis con el visor puesto, así que conectadlo ya.

---

## Paso 6 · Escanead la sala (Space Setup)

**En el visor**, no desde el PC:

`Configuración` → `Environment Setup` → **Space Setup**

Recorred la sala y marcad las paredes, el suelo, el techo y los muebles
grandes. De aquí sale el **Scene Model**, y es la única fuente de la geometría
que usa todo lo de abajo.

**Escanead la sala en la que vais a enseñarlo.** Un escaneo viejo de otra sala
es el motivo más común con diferencia de que un sample parezca roto: la malla
está, lo que pasa es que no se corresponde con el sitio en el que estáis.

---

## Paso 7 · Importad los samples de MRUK

No vienen con el paquete. Viven en su propio repositorio:

**`github.com/oculus-samples/Unity-MRUtilityKitSample`**

Descargadlo o clonadlo, y después **copiad la carpeta `MRUKSamples` dentro de
la carpeta `Assets` de vuestro proyecto**. En el de referencia acaba en
`Assets/Samples/MRUKSamples`.

Llegan catorce carpetas: `Basic`, `BouncingBall`, `DestructibleMesh`,
`EnvironmentPanelPlacement`, `FloorZone`, `KeyboardTracker`, `MultiSpawn`,
`NavMesh`, `PassthroughRelighting`, `QRCodeDetection`, `SharedAssets`,
`SpaceMap`, `StartScene`, `VirtualHome`.

---

## Paso 7 · El error de compilación, y la palabra que lo arregla

En cuanto aterrizan, Unity se pone rojo:

```
Assets/Samples/MRUKSamples/BouncingBall/Scripts/BouncingBallMgr.cs(35,43):
error CS0117: 'OVRInput' does not contain a definition for
'GetLocalControllerAngularVelocityCw'
```

**Abrid el script, id a la línea 35 y borrad el `Cw`:**

- antes: `OVRInput.GetLocalControllerAngularVelocityCw(...)`
- después: `OVRInput.GetLocalControllerAngularVelocity(...)`

**Un error de compilación bloquea el proyecto entero**, no solo esa escena, así
que nada de lo que viene después funciona hasta que la consola esté a cero
errores.

---

## Know how · Por qué está ahí ese error

El repositorio de samples está hecho contra un **SDK más nuevo que el que
habéis instalado**: aquí el proyecto va por 201.0.0 y la última release del
repositorio apunta a 207.0.0. Meta renombró el método por el camino.

Es la única vez en todo el bloque que abrís un `.cs`, y es una palabra. Si
preferís no tocarlo, las alternativas son: **pedir en clase el script ya
corregido**, o **borrar la carpeta `BouncingBall`** si no vais a usar ese
sample.

---

## Paso 7 · Abrid `MRUKBase` y apuntadlo a vuestra sala

Abrid `Assets/Samples/MRUKSamples/Basic/MRUKBase`. En la Hierarchy tenéis
`OVRCameraRig`, `MRUK`, `EffectMesh`, `[BuildingBlock] Passthrough` y
`[BuildingBlock] Real Hands`.

Seleccionad el objeto **`MRUK`** → **Scene Settings** → **Data Source** →
**`Device`**.

| Opción | De dónde sale la sala |
| --- | --- |
| **Device** | De vuestro escaneo. **Esta.** |
| Prefab | Una sala enlatada del paquete |
| Device With Prefab Fallback | La que viene por defecto: vuestro escaneo, y una enlatada si no hay |
| Json | Una sala guardada en un fichero |
| Device With Json Fallback | Vuestro escaneo, y el fichero si no hay |

---

## Paso 7 · Los cuatro samples

Pasadlos en este orden. Cada uno es una respuesta distinta a "qué hago con una
sala".

| Escena | Qué mirar |
| --- | --- |
| **MRUK Base** | `EffectMesh` pinta volúmenes sobre vuestras paredes y muebles reales |
| **Bouncing Ball** | La misma malla usada como **colliders**: la pelota rebota en vuestra sala |
| **Virtual Home** | Vuestra sala **sustituida** por una virtual con la misma forma. VR con vuestras paredes |
| **Destructible Mesh** | Lo mismo, pero se puede romper |

En **Bouncing Ball** el gatillo de la mano derecha agarra y el gatillo del
índice derecho lanza.

---

## Paso 7 · Cambiad una cosa en el que escojáis

**Escoged uno de los cuatro** y hacedlo vuestro. Todo esto es trabajo de
Inspector, sin script:

- **MRUK Base**: cambiad el material del `EffectMesh` por uno semitransparente
  para que se vea el passthrough por debajo, o cambiad qué superficies cubre.
- **Virtual Home**: cambiad los prefabs que el spawner deja sobre cada tipo de
  superficie, para amueblar la sala virtual a vuestra manera.
- **Bouncing Ball**: cambiad la pelota, su material, su physics material.
- **Destructible Mesh**: cambiad la pinta que tienen los trozos rotos.

El que escojáis es el que va a la build del grupo.

---

## Paso 8 · Build e instalación

`File > Build Settings` → vuestra escena está en la lista **Scenes In Build**.
Visor por **USB-C**, modo desarrollador activado, **Always allow USB debugging**
aceptado.

**Opción A: desde Unity.** `File > Build Profiles` → **Android** (o Meta
Quest) → **Run Device** → **Refresh** → vuestra Quest 3 → **Build And Run**.

**Opción B: si el visor no aparece nunca.** **Meta Quest Developer Hub** →
**Add Build** → vuestro `.apk`, y después **Library > Unknown Sources** en el
visor.

**Probadlo en una sala distinta de aquella en la que lo montasteis.** Si allí
sigue teniendo sentido, está acabado.

---

## La entrega del bloque

Este es el último ejercicio del bloque, así que lo que entregáis es **el
bloque**, no esta clase: **una APK por grupo con las tres actividades dentro**,
más la documentación. La entrega en sí va por Atenea, en la sesión en la que
está su banderín, no aquí.

Decid en la documentación **qué sample escogisteis** y **qué le cambiasteis**, y
apuntad la **versión de los paquetes de Meta** contra la que compilasteis.

---

## Si algo no funciona

- **La consola está roja y no arranca nada** → el arreglo del `Cw` del paso 7.
  Bloquea el proyecto entero.
- **La escena carga pero la sala está vacía** → `Data Source` no está en
  `Device`, o *Datos del entorno mediante Meta Horizon Link* está apagado
  (paso 4), o no hay escaneo en este visor (paso 6).
- **La sala está, pero tiene la forma equivocada** → un Space Setup viejo.
  Escanead otra vez, en la sala en la que estáis de verdad.
- **No hay tracking** → el Oculus XR Plugin está instalado junto a OpenXR
  (paso 3). No hay mensaje de error en ningún sitio.
- **El visor se queda negro al dar a Play** → el Meta XR Simulator sigue
  activado.
- **El visor no aparece en Run Device** → Opción B, y comprobad que aceptasteis
  *Always allow USB debugging* dentro del visor.
