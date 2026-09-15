---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Ejercicio 1 · Plane Detection

**Bloque 1 — AR Foundation** · entrega evaluable
**Individual** · **Entrega: build (APK)**

---

## La historia

Un goblin azul se ha colado en el despacho del profesor. Nadie sabe cómo entró.
De momento se limita a estar ahí, mirándote desde la mesa a través de la cámara
del móvil.

En clase has visto un vídeo en el que el profesor toca la pantalla y aparece un
objeto sobre la superficie que la cámara ha detectado. **Ese vídeo es el
enunciado**: tienes que llegar al mismo resultado con tu propia idea.

---

## Qué tienes que hacer

El proyecto lo montas hoy en clase desde cero: Unity nuevo, AR Foundation
instalado y Blue Goblin puesto en la escena. Sobre eso, añade la mecánica:

> Al tocar un plano detectado, se instancia un modelo 3D en ese punto.

El modelo lo eliges tú, de donde quieras (Sketchfab, Poly Pizza, el asset store,
lo que tengas). Lo único que se te pide es que **represente cómo te enfrentas a
Blue Goblin o cómo lo camelas**, según la historia que quieras contar. Una espada,
una jaula, un pastel, un altavoz enorme: da igual, mientras se entienda.

---

## Requisitos mínimos

- Detección de planos activa y **visible**: hay que ver en pantalla qué está
  reconociendo el dispositivo.
- El objeto aparece **donde tocas**, no en el centro de la pantalla ni en el
  origen del mundo.
- Escala real. Sobre una mesa, tu objeto mide centímetros.
- Blue Goblin sigue en escena y pasa algo entre él y lo que instancias.

---

## El camino de hoy

Dieciocho pasos, en cuatro tramos. Si te pierdes, mira en qué tramo estás.

1. **El proyecto** (pasos 1–7) — Unity, AR Foundation y la escena mínima.
2. **Ver el mundo** (8–10) — detectar planos y poder lanzar rayos contra ellos.
3. **El toque** (11–14) — leer el dedo y poner un objeto donde ha caído.
4. **Que se lo crea** (15–18) — escala, limpieza, historia y móvil.

Los tres primeros tramos son mecánicos. El cuarto es donde se decide la nota.

---

## Paso 1 · Proyecto nuevo y plataforma

Crea un proyecto Unity nuevo con la plantilla 3D que usemos en clase.

Lo primero de todo, antes de instalar nada: `File > Build Settings`, selecciona
**Android** (o **iOS**) y pulsa **Switch Platform**.

Hazlo ahora y no al final. Cambiar de plataforma reimporta todos los assets del
proyecto, y hacerlo con el proyecto vacío tarda segundos; hacerlo cuando ya
tienes tu modelo, tus texturas y tus prefabs dentro puede costarte varios
minutos de reloj de clase.

---

## Paso 2 · Instalar AR Foundation

`Window > Package Manager`, arriba a la izquierda selecciona **Unity Registry**,
y busca:

- **AR Foundation** — la capa común, la que usarás desde el código.
- **Google ARCore XR Plugin** (Android) o **Apple ARKit XR Plugin** (iOS) — el
  proveedor, quien habla de verdad con el sistema del móvil.

AR Foundation por sí sola **no hace AR**: define la interfaz, y el proveedor la
implementa. Por eso hacen falta las dos. Usamos la línea **5.1**, que es la que
documenta el manual enlazado en la bibliografía de la sesión.

---

## Paso 3 · Activar el proveedor XR

`Edit > Project Settings > XR Plug-in Management` → pestaña **Android** (o
**iOS**) → marca la casilla del proveedor.

Dos cuidados:

- La pestaña de Android **solo aparece** si tienes el módulo de Android
  instalado desde el Unity Hub. Si no la ves, ese es el motivo.
- Activar aquí la casilla **instala el paquete si te falta**. Instalarlo desde
  el Package Manager, en cambio, **no** lo activa. Instalado y activado son dos
  cosas distintas, y este es el despiste número uno del día.

---

## Paso 4 · Ajustes de Player (Android)

`Edit > Project Settings > Player > Other Settings`:

- En **Rendering**: desmarca *Auto Graphics API* y **quita Vulkan** de la lista.
  ARCore solo funciona con **OpenGLES3**.
- En **Configuration**: **Scripting Backend → IL2CPP**, y marca **ARM64** en
  *Target Architectures*. ARM64 necesita IL2CPP, en ese orden.

Con Vulkan puesto, la app compila y arranca **en negro**: cámara muerta y ni un
error en pantalla. Es el fallo más difícil de diagnosticar de toda la sesión.

---

## Paso 5 · Comprobarlo con Project Validation

`Project Settings > XR Plug-in Management > Project Validation`, pestaña
**Android**.

Es una lista de comprobaciones que Unity hace sola sobre tu proyecto, y la
mayoría trae un botón **Fix** que corrige el ajuste por ti. Ahí sale, entre
otras, la versión mínima de Android que pide tu combinación de Editor y
plug-in — que cambia según versiones, así que no te fíes de un número leído por
ahí: mira lo que dice tu proyecto.

Activa *Show all* para ver también las comprobaciones que ya pasan.

---

## Paso 6 · La escena mínima

Borra la **Main Camera** que trae la escena por defecto.

Clic derecho en la Hierarchy y añade:

- `XR > AR Session` — enciende y configura el AR en el dispositivo.
- `XR > XR Origin (Mobile AR)` — es quien convierte el tracking del móvil en
  coordenadas de Unity. Trae dentro `Camera Offset > Main Camera`, y **esa** es
  la cámara que verás por pantalla.

Sin cualquiera de los dos, el AR no arranca. Y si dejas las dos cámaras, acabas
viendo la escena desde la que no se mueve.

---

## Paso 7 · Poner a Blue Goblin

Importa el modelo de Blue Goblin y déjalo colocado en la escena.

Tiene que estar ahí **desde el primer frame**, antes de que el usuario toque
nada: la historia empieza con él ya presente, no con él apareciendo.

Colócalo a un par de metros del origen, no encima de él. El XR Origin arranca
donde esté el móvil al abrir la app, así que un objeto en (0,0,0) sale pegado a
la cara de quien la abre.

---

## Paso 8 · AR Plane Manager

Selecciona el **XR Origin** en la Hierarchy → `Add Component` → **AR Plane
Manager**.

Este componente escanea lo que ve la cámara y va creando un GameObject por cada
superficie plana que reconoce: la mesa, el suelo, una pared. Se llaman
*trackables*, y crecen y se fusionan entre ellos mientras te mueves.

Va sobre el XR Origin, y no sobre la cámara ni sobre un objeto suelto, porque
los planos tienen que nacer en el mismo espacio de coordenadas que el tracking.

---

## Paso 9 · Plane Prefab: ver lo que ve

En el AR Plane Manager, arrastra un prefab de plano al campo **Plane Prefab**.
Puedes usar el que traen los samples.

Esto dibuja en pantalla los planos detectados, y **es un requisito del
ejercicio**, no una ayuda de depuración: quien corrija tiene que ver qué está
reconociendo el dispositivo.

Además te ahorra media hora. Sin esto, cuando un toque no ponga nada, no sabrás
si falla tu código o es que esa mesa nunca llegó a detectarse.

---

## Paso 10 · AR Raycast Manager

Sobre el mismo XR Origin, `Add Component` → **AR Raycast Manager**.

Un raycast normal de física choca con *colliders*. Este no: lanza el rayo contra
los **trackables** de AR — los planos que acaba de encontrar el paso anterior —
que no tienen ningún collider.

Es la pieza que traduce «el usuario ha tocado este píxel de la pantalla» a «ese
píxel cae sobre este punto de la mesa de verdad».

---

## Paso 11 · El script

Crea un script (por ejemplo `TapToPlace.cs`) y engánchalo a un GameObject de la
escena — vale un objeto vacío llamado `Placement`, o el propio XR Origin.

Dentro necesitas, como mínimo:

- una referencia al **AR Raycast Manager**, arrastrada desde el Inspector,
- el **prefab** que vas a instanciar,
- una `List<ARRaycastHit>` reutilizable, creada una sola vez como campo de la
  clase y no dentro del `Update`.

---

## Paso 12 · Leer el toque

Lee el dedo con el **Input System**: `Touchscreen.current`, o
`UnityEngine.InputSystem.EnhancedTouch.Touch` si quieres varios dedos.

Dos cuidados que ahorran bugs raros:

- Comprueba que `Touchscreen.current` no es `null` antes de usarlo — en el
  editor no hay pantalla táctil, y ahí es donde se te cae.
- Actúa en el frame en que el dedo **empieza** a tocar (`wasPressedThisFrame`),
  no mientras sigue apoyado, o instanciarás un objeto por frame.

---

## Paso 13 · El raycast contra el plano

Con la posición de pantalla del toque:

```csharp
if (raycastManager.Raycast(pos, hits, TrackableType.PlaneWithinPolygon))
{
    var pose = hits[0].pose;
    // pose.position y pose.rotation son el punto y la orientación reales
}
```

`PlaneWithinPolygon` limita el impacto a la **superficie realmente detectada**.
Con `PlaneEstimated`, el rayo choca con el plano matemático infinito y te pondrá
objetos flotando más allá del borde de la mesa.

---

## Paso 14 · Instanciar

```csharp
Instantiate(prefab, pose.position, pose.rotation);
```

La rotación de la pose ya viene alineada con el plano, así que tu objeto se
apoya sobre la mesa en vez de quedarse tumbado o girado.

Si tu modelo sale de lado, el problema casi nunca es el código: es el pivote del
modelo. Arréglalo metiéndolo dentro de un GameObject vacío, con el hijo rotado y
centrado, y usa el padre como prefab.

---

## Paso 15 · Escala real

Pon en la escena un cubo de 1×1×1 como referencia — en Unity **1 unidad = 1
metro** — y ajusta tu modelo contra él.

Es el paso que más gente se salta y el que más canta al corregir: un modelo
descargado de internet puede venir a escala de centímetros o de kilómetros, y en
AR eso no se disimula. Sobre una mesa de verdad, tu objeto tiene que medir
**centímetros**.

Comprueba la escala del **prefab**, no solo la del modelo en la carpeta.

---

## Paso 16 · No apilar copias

Tal como está, cada toque instancia otro objeto. A los diez toques tienes una
torre.

Decide qué quieres y escríbelo:

- **Uno solo**: guarda la referencia del que ya existe y muévelo con
  `transform.SetPositionAndRotation`, en vez de crear otro.
- **Varios, con límite**: lleva la cuenta y bloquea a partir de N.

Cualquiera de las dos vale. Lo que no vale es no haberlo decidido.

---

## Paso 17 · La historia

Conecta visualmente el objeto que instancias con Blue Goblin: que se le acerque,
que lo asuste, que lo ilumine, que lo atrape, que lo convenza.

Este es el paso que separa un ejercicio entregado de un ejercicio bueno, y no
lleva código nuevo: es dónde colocas las cosas, qué mira a qué, y qué pasa en
los dos segundos siguientes al toque.

La prueba es sencilla: **si hay que explicarlo al lado, no cuenta**.

---

## Paso 18 · Al móvil

`File > Build Settings` → **Build and Run**, con el móvil conectado por cable y
la depuración USB activada.

Pruébalo **en el dispositivo físico**, y déjate tiempo para ello: la primera
build de un proyecto con IL2CPP es lenta, y no es el momento de descubrirlo.

El Play Mode del editor no simula detección real de planos. Ahí siempre parece
que funciona.

---

## Si algo no funciona

- **Pantalla negra** → Vulkan sigue en Graphics APIs (paso 4).
- **No detecta nada** → falta luz, o la superficie es lisa y uniforme; ARCore
  necesita textura. Prueba sobre una mesa con cosas encima.
- **El objeto sale gigante, o no se ve** → escala (paso 15).
- **Sale en el centro y no donde tocas** → no estás usando `hits[0].pose`.
- **Compila pero no arranca** → pasa por Project Validation (paso 5).

---

## Entrega

**Un APK**, no un vídeo. Se instala en un móvil para corregirlo, así que tiene
que arrancar solo. Nómbralo `bloque1-ej1-<apellido>.apk`.

En un `README` junto al APK, tres líneas: qué modelo has usado, de dónde sale y
con qué licencia, y qué le hace a Blue Goblin.

---

## Cómo se evalúa

Que la mecánica funcione en un móvil real. Que la escala y el anclaje sean
creíbles. Que la escena cuente algo sin que tengas que explicarlo al lado.
