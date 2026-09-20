---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 1 · Plane Detection

Crea una app de AR con Unity AR Foundation
que instancie **una solución 3D para lidiar con el blue goblin**

**Bloque 1 — AR Foundation** · **Individual** · ocho pasos, sin código

---

## Hoy no se escribe código

Partes de la plantilla **AR Mobile** de Unity, que ya trae la lógica de
instanciado, la UI y el menú de objetos. Todo lo que harás hoy pasa en el
**Inspector**:

duplicar un prefab · cambiar un mesh y un material · arrastrarlo a una lista ·
duplicar un botón · cambiar un número.

Escribir el raycast y el instantiate a mano es una conversación para más
adelante. Hoy va de meter una build de AR de verdad en un móvil de verdad, y de
poner **tu** objeto dentro.

---

## Paso 1 · La plantilla AR Mobile

Unity Hub → **New project** → **AR Mobile**, dentro de *Core*.

Antes de eso, revisa tu instalación del Editor. Necesitas un **2022 LTS** con:

- **Android Build Support**, y dentro **OpenJDK** y **Android SDK & NDK
  Tools**, o
- **iOS Build Support**.

Si falta el módulo, la plataforma ni siquiera aparecerá luego en Build
Settings, y estarás depurando lo que no es. Añádelo desde Unity Hub →
*Installs* → **Add modules**.

---

## Paso 2 · Paquetes, y después plataforma

`Window > Package Manager`, cambia el desplegable a **Packages: In Project**, y
comprueba que todo está actualizado — en particular **AR Foundation** y el
**Google ARCore XR Plugin** (o **Apple ARKit XR Plugin**).

Después `File > Build Settings` → selecciona **Android** (o **iOS**) →
**Switch Platform**.

Haz el cambio de plataforma **ahora**, mientras el proyecto es solo la
plantilla. Cambiar reimporta todos los assets del proyecto: segundos hoy,
varios minutos cuando ya estén dentro tu modelo y sus texturas.

---

## Paso 3 · Ajustes de Player

`Project Settings > Player > Other Settings`:

- **Scripting Backend → IL2CPP**
- desmarca **Auto Graphics API**, y deja **OpenGLES3** como única entrada
- **Minimum API Level → 24** (Android 7.0) · en iOS, versión mínima **11**

**ARCore no funciona con Vulkan.** Déjalo en la lista de Graphics APIs y la app
compila, se instala, abre — y muestra una **pantalla negra**, sin ningún error
en ninguna parte. Es el fallo más difícil de diagnosticar del día, y es una
casilla.

---

## Paso 4 · XR Plug-in Management

`Project Settings > XR Plug-in Management` → pestaña **Android** → confirma que
**Google ARCore** está marcado. En iOS, **Apple ARKit**.

Que el paquete esté en el proyecto y que el proveedor esté **activado** son dos
cosas distintas. La plantilla pone los paquetes; esta casilla es la que
enciende el AR.

Si la pestaña de Android no aparece, vuelve al paso 1: te falta el módulo de
Android.

---

## Repaso · Haz una build y mira lo que tienes

Ya está todo configurado, así que **haz la build e instala el APK antes de
tocar nada**.

Dos motivos, y el segundo es el importante:

1. Si el móvil, el cable, la depuración USB o los módulos no encajan, te
   enteras ahora — sin nada tuyo en el proyecto a lo que echarle la culpa.
2. La demo de la plantilla **es** lo que vas a modificar. Toca por ahí,
   instancia los cubos, abre el menú de objetos. Vas a añadir un elemento a ese
   menú, y ayuda haberlo usado antes.

---

## Know how · Qué te da la plantilla

Cinco cosas que conviene reconocer en la Hierarchy, porque las vas a abrir
dentro de un momento:

- **AR Session** — el ciclo de vida de la app de AR: plane detection, image
  tracking, raycasts, meshing, point clouds.
- **XR Origin** *(AR Session Origin)* — convierte las coordenadas de la sesión
  AR en coordenadas de mundo de Unity.
- **AR Camera Manager** — auto focus, light estimation, y **Facing
  Direction**: hacia el mundo, o hacia el usuario.
- **Tracked Pose Driver** — convierte el movimiento real de la cámara en
  movimiento de la cámara de la escena.
- **AR Input Manager** — sigue la entrada del usuario.

---

## Paso 5 · Tu prefab

En `Assets > MobileARTemplateAssets > Prefabs`, **duplica `CubeVariant`** y
renómbralo con el nombre de tu objeto. (También puedes crear uno desde cero —
solo tiene que tener la misma estructura.)

Ábrelo, y dentro de su hijo **`Visuals`**:

- cambia el mesh del **Mesh Filter** por tu modelo,
- cambia el **Material**,
- rehaz el **Mesh Collider**, con **Convex** marcado.

---

## Paso 5 · …y el pivote

**Pon el pivote del padre en el suelo del modelo.**

Ese pivote es el punto que el spawner coloca sobre el plano detectado. Si está
en mitad del mesh —que es donde suele estar en un modelo importado— medio
objeto acaba enterrado en la mesa y la otra mitad flotando.

El arreglo es el mismo que arregla casi todos los problemas de modelo: mete el
modelo dentro de un GameObject vacío, sube el hijo hasta que sus pies queden en
el origen del padre, y usa el padre como prefab.

---

## Paso 6 · Object Spawner

Despliega el prefab **XR Origin** en la Hierarchy. Dentro hay un GameObject
llamado **`Object Spawner`** — selecciónalo y mira el Inspector.

Su script **Object Spawner** guarda todos los prefabs que la demo puede
instanciar, en la lista **Object Prefabs**. Pulsa **+** para añadir un elemento
más, y **arrastra tu prefab** al hueco nuevo.

**Apunta el índice en el que cae.** El paso siguiente necesita ese número, y es
lo único aquí que es fácil equivocar.

---

## Paso 7 · Tu botón

En `UI > Object Menu Animator > Object Menu > Scroll View > Viewport >
Content`, **duplica `Button (Cube)`** y renómbralo.

En su componente **Button**, dentro de **On Click**:

- en el evento `ARTemplateMenuManager.SetObjectToSpawn`, pon el parámetro con
  **el índice de tu prefab** en la lista Object Prefabs;
- **añade un segundo evento**: arrastra el objeto **`SelectionBox`**, elige
  **GameObject.SetActive**, y marca su casilla.

---

## Paso 7 · …sobre ese número

En el ejemplo el parámetro es **7**.

Ese es el **octavo** elemento de la lista Object Prefabs, porque la lista
cuenta desde **cero**. Si tu objeto fue el noveno que arrastraste, tu número es
el 8.

Si te equivocas aquí no parece que haya nada roto: el botón funciona, el menú
se cierra, y lo que instancias es el cubo de otro. Si te pasa eso, vuelve aquí
y cuenta la lista otra vez.

---

## Paso 8 · Haz el APK

`File > Build Settings`:

- comprueba que tu escena está en la lista **Scenes In Build** — *Add Open
  Scenes* si no lo está;
- pulsa **Build** y elige una carpeta de destino.

Ese es tu APK. Instálalo en tu móvil.

Pruébalo sobre una **superficie real con algo de textura** — una mesa con cosas
encima, no un escritorio blanco y liso. ARCore encuentra planos siguiendo
feature points, y una superficie lisa y uniforme no le da nada a lo que
agarrarse.

---

## Si algo no funciona

- **Pantalla negra** → Vulkan sigue en Graphics APIs (paso 3).
- **La build no tiene AR** → el proveedor ARCore no está marcado (paso 4).
- **La plataforma no sale en Build Settings** → falta el módulo del Editor
  (paso 1).
- **No detecta nada** → falta luz, o la superficie es lisa y uniforme; ARCore
  necesita textura (paso 8).
- **Medio objeto dentro de la mesa** → el pivote no está en su suelo (paso 5).
- **El botón instancia el objeto equivocado** → el índice de
  `SetObjectToSpawn` (paso 7).
