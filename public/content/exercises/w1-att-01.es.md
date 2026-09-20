---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Actividad · Mono / Estereoscópico

Graba la misma toma 360° dos veces —una plana y otra en estéreo—
y **mira la diferencia con unas gafas**

**Voluntaria** · dieciséis pasos · Unity Recorder

---

## Qué sacas de esto

Al terminar sabrás:

- grabar un **vídeo 360° directamente desde Unity**, sin plugins y sin montarte
  ningún rig de cámaras;
- grabar **la misma toma en estéreo**, de forma que cada ojo vea la escena desde
  un sitio ligeramente distinto;
- meter los dos ficheros en unas **Meta Quest 3** y sentir, en vez de leer, qué
  añade de verdad la estereoscopía.

Lo importante no es la grabación. Lo importante es la **comparación**: dos
ficheros de la misma escena que se diferencian en exactamente una cosa.

**Unity es la vía que se recorre aquí, no la única permitida.** Vale cualquier
software capaz de renderizar esos dos vídeos 360 con sus metadatos espaciales —
los dieciséis pasos de abajo simplemente toman el camino que todo el mundo en el
aula ya tiene instalado.

---

## ⚠ Lee esto antes de crear el proyecto

*(Solo para la vía de Unity — si los renderizas en otro sitio, salta al paso 15.)*

**Elige la plantilla `3D (Built-In Render Pipeline)`.** Ni Universal 3D, ni HDRP.

Unity Recorder **no soporta captura 360 estereoscópica en ningún Scriptable
Render Pipeline**. Con URP o HDRP la casilla *Record in Stereo* se marca igual,
el fichero sale igual arriba-abajo — y **las dos mitades son idénticas**. Te
queda un fichero con forma de estéreo y sin estéreo dentro.

No te avisa nada. Te enterarías con las gafas puestas, que es el peor momento
posible.

---

## Paso 1 · Proyecto nuevo, Built-In

Unity Hub → **New project** → **3D (Built-In Render Pipeline)**.

Ponle un nombre que reconozcas dentro de una semana.

Este es un proyecto de usar y tirar cuyo único trabajo es ser grabado, así que
no reutilices el de AR Foundation: aquel es URP, y la diapositiva anterior
explica por qué importa.

Si ya tienes una escena Built-In bonita de otra asignatura, úsala: cuanto mejor
la escena, más obvio el resultado.

---

## Paso 2 · Instala el Recorder

`Window > Package Manager` → desplegable arriba a la izquierda → **Unity
Registry** → busca **Recorder** → **Install**.

La línea actual es **Recorder 5.1.x**. No viene con el Editor; hay que
instalarlo por proyecto.

Una limitación que conviene saber ya: el Recorder **solo funciona en el Editor,
en Play mode**. No es algo que puedas meter dentro de una build.

---

## Paso 3 · Abre la ventana del Recorder

`Window > General > Recorder > Recorder window`.

Acóplala donde puedas verla mientras corre el juego — al lado del Game view es
lo habitual. Vas a estar leyéndola durante la reproducción.

Unity restaura lo que dejaste puesto la última vez que grabaste, lo cual es
cómodo hasta el momento en que das por hecho que un campo está vacío. Lee el
panel en vez de fiarte de tu memoria.

---

## Paso 4 · Add Recorder → Movie

Pulsa **+ Add Recorder** y elige **Movie**.

Un Recorder es una salida. La lista puede tener varios a la vez —podrías grabar
la versión plana y la estéreo en una sola pasada— pero no lo hagas: dos
Recorders sobre una captura 360 se pelean por la misma cámara.

Un Recorder, dos pasadas. Es más lento y es la versión que funciona.

---

## Paso 5 · Frame Rate: Constant

En el panel de sesión de grabación de arriba, pon **Playback** en **Constant** y
**Target FPS** en **30**.

**Constant** le dice al Recorder que produzca un fichero exactamente a esa tasa
de frames, frenando el Editor si no da abasto. **Variable** hace lo contrario:
mantiene el Editor a toda velocidad y descarta frames.

Una captura 360 es pesada — renderiza tu escena seis veces por frame. Constant
es lo que impide que eso acabe en un vídeo a tirones.

---

## Paso 6 · Source: 360 View

En **Capture**, pon **Source** en **360 View**, y **Camera** en **MainCamera**.

`MainCamera` significa "el objeto que lleve el tag MainCamera". Usa la que la
escena ya tiene; añadir una segunda cámara solo para grabar no te aporta nada y
te da un choque de tags que depurar.

---

## Paso 6 · …qué hace en realidad 360 View

**No** necesita una cámara especial ni un rig de 360.

Para cada frame, el Recorder apunta tu cámara normal en seis direcciones,
renderiza un **cube map** con esas seis vistas, y después despliega ese cubo en
la imagen plana 2:1 que espera un reproductor 360 (una proyección
*equirectangular*).

Dos consecuencias que te encontrarás luego:

- la **rotación de la cámara la está gobernando el Recorder** mientras captura —
  ver paso 13;
- la grabación cuesta seis renders por frame, así que es lenta.

---

## Paso 7 · Output Dimensions 4096 × 2048

Pon **W** en `4096` y **H** en `2048`.

**El ancho tiene que ser exactamente el doble del alto.** Una imagen
equirectangular cubre 360° a lo ancho y 180° de arriba abajo, así que un frame
2:1 es el formato, no una preferencia. Si te equivocas, todos los reproductores
estiran el resultado.

4096 × 2048 es un compromiso razonable para clase. Recuerda que esa resolución
se envuelve alrededor de toda tu cabeza: solo una fracción de esos píxeles está
delante de tus ojos en cada momento, y por eso el vídeo 360 siempre se ve más
blando de lo que esperas.

---

## Paso 7 · …y Cube Map Size

Deja **Cube Map Size** en **2048**.

Es el lado, en píxeles, de cada una de las seis caras del cubo que el Recorder
renderiza antes de desplegarlas. Es la resolución *real* de la captura — las
Output Dimensions de arriba son solo el tamaño al que se aplana ese cubo.

- Demasiado pequeño, y el 360 se ve blando por grande que sea la salida.
- Demasiado grande, y la grabación va a rastras sin ganancia visible.

Una cara de aproximadamente **la mitad del ancho de salida** es la regla
habitual, y de ahí sale el 2048.

---

## Paso 8 · Primera toma: Record in Stereo apagado

Busca **Record in Stereo** y déjalo **sin marcar**.

Este primer fichero es el **monoscópico**: una sola imagen, enviada a los dos
ojos. Con las gafas se verá como estar dentro de una fotografía — puedes mirar
alrededor, pero todo está a la misma distancia plana.

Ese es el control. Lo necesitas para tener contra qué comparar, así que aguanta
las ganas de saltar directamente al interesante.

---

## Paso 9 · Formato: H.264 MP4, High

En **Output Format**, elige **H.264 MP4** y pon **Quality** en **High**.

H.264 es la respuesta segura aquí: YouTube lo ingesta sin sorpresas de
recodificación, y las Quest lo reproducen por hardware. Un códec exótico te
costará una tarde de trabajo sin ninguna ganancia visible.

Marca **Include Audio** solo si tu escena tiene sonido de verdad. Para esta
comparación no añade nada.

---

## Paso 10 · Nombre de fichero: usa un comodín

En **Output File**, pon el **File Name**, abre el menú **+ Wildcards** y añade
**`<Take>`**.

**No te saltes esto.** El Recorder escribe siempre en la misma ruta, así que sin
comodín tu segunda toma sobrescribe la primera en silencio — y la primera es el
vídeo monoscópico que necesitas para comparar.

`<Take>` es un contador que el Recorder incrementa después de cada grabación,
así que `MonoEstereo_<Take>` te da `MonoEstereo_001`, `MonoEstereo_002`, y nada
perdido. `<Time>` y `<Date>` también valen.

Pon **Path** en un sitio que sepas encontrar desde el explorador.

---

## Paso 11 · Marca Exit Play Mode

Arriba del todo, justo debajo de **START RECORDING**, marca **Exit Play Mode**.

Con eso activado, parar la grabación también sale del Play mode. Sin eso, el
juego sigue corriendo después de cerrarse el fichero y es fácil creer que la
grabación continúa.

Es una tontería. Elimina una manera de acabar con un clip de diez segundos que
creías de un minuto.

---

## Paso 12 · Algo que merezca la pena mirar

Necesitas una escena con **profundidad**: objetos cerca de la cámara **y**
lejos.

Un solo cubo sobre un plano vacío basta para aprobar, pero es una prueba pobre:
la profundidad estéreo se nota sobre todo en cosas a un par de metros, y apenas
existe en un horizonte lejano. Si lo único que hay está lejos, tus dos ficheros
se verán idénticos y concluirás que el ejercicio ha fallado.

Así que: unos cuantos objetos a distintas distancias, al menos uno cerca. Un
entorno que ya tengas de otra asignatura gana a cualquier cosa que montes en
cinco minutos.

---

## Paso 13 · Graba la primera toma

Pulsa **START RECORDING** y mueve la cámara por la escena — pasa cerca de algo,
y luego aléjate. Para a los veinte o treinta segundos.

Puedes arrastrar el Transform de la cámara en el Scene view mientras corre el
Play mode, o mover un personaje si la escena tiene uno. Cualquiera de las dos
vale.

**Muévete despacio.** Una velocidad que parece normal en un monitor da náuseas
con las gafas, donde el movimiento ocupa todo tu campo de visión.

---

## Paso 13 · …no rotes nunca la cámara

**Traslación sí. Rotación nunca.** Esta es la regla que importa.

En un vídeo 360 la cabeza del espectador *es* la cámara. Rótala en Unity y la
imagen gira mientras el cuello de quien mira no — y eso se lee exactamente como
alguien cogiéndote la cabeza con las manos y girándola. Es una de las formas más
rápidas de marear a una persona en VR.

Hay además una razón técnica: 360 View ya está rotando esa cámara para construir
su cube map (paso 6). Tu rotación se pelea con la suya.

---

## Paso 14 · Segunda toma: Record in Stereo encendido

Marca **Record in Stereo** y graba **el mismo movimiento otra vez**, lo más
parecido que puedas.

Ahora el Recorder renderiza dos vistas y las apila en un solo frame: **ojo
izquierdo arriba, ojo derecho abajo**. Ese es el *top/bottom layout* por el que
te preguntará después la herramienta de metadatos, así que quédate con la
expresión.

**Stereo Separation** es la distancia entre esos dos ojos — la distancia
interpupilar. El valor por defecto **0.065** son 65 mm, la media humana. Súbelo y
la profundidad se exagera hasta parecer una maqueta; bájalo y la escena se
aplana de nuevo hacia el mono.

---

## Paso 14 · …dos cosas que aquí se confunden

**Flip Vertical no es el layout del estéreo.** Voltea toda la imagen de salida
del revés, y existe para sistemas que escriben el vídeo al contrario. Déjalo
apagado; si tu grabación sale invertida, ese es el interruptor.

**Las dos tomas tienen que parecerse.** La comparación solo dice algo si la
cámara recorre el mismo camino a la misma velocidad. Si tus dos ficheros se
diferencian también en el recorrido, no puedes saber qué diferencia estás
mirando.

---

## Paso 15 · Spatial Media Metadata Injector

Descárgalo del repositorio **spatial-media** de Google, página de releases — la
**360 Video Metadata Tool** para Windows o Mac.

Un fichero 360 es un MP4 normal. Nada dentro de los píxeles dice "esto es
esférico"; eso vive en una etiqueta de metadatos, y Unity no la escribe. Sube el
fichero tal cual y YouTube te enseñará un rectángulo plano y deformado.

Para cada vídeo: **Open** → marca las casillas → **Inject metadata** → guarda el
fichero nuevo que escribe al lado del original.

---

## Paso 15 · …qué casillas marcar

**Los dos ficheros:** `My video is spherical (360)`.

**Solo el fichero estéreo, y además:**
`My video is stereoscopic 3D (top/bottom layout)` — que es exactamente como el
Recorder apiló los dos ojos en el paso 14.

Deja en paz el **spatial audio (ambiX ACN/SN3D)**. Eso es para sonido
ambisónico, y no tienes.

Inyecta también en el fichero monoscópico. Sin la etiqueta esférica no es un
vídeo 360, es una fotografía muy ancha de uno.

---

## Paso 16 · Méteselos a las gafas

**Vía A — YouTube (recomendada).** Sube los dos ficheros inyectados a tu canal,
como no listados si quieres. Abre YouTube dentro de las Quest 3 y mira cada uno.

**Vía B — sideload.** Copia los dos ficheros directamente al almacenamiento de
las gafas por USB, abre **Biblioteca → Vídeos** (o un reproductor como DeoVR) y
dile al reproductor que son 360, mono o estéreo. **Por esta vía no hace falta el
injector** — se lo estás diciendo al reproductor en vez de etiquetar el fichero.

Cada reproductor de VR pone esos controles en un sitio distinto. Cuenta con
buscarlos.

---

## Paso 16 · …cómo sabes que ha funcionado

**En un navegador de escritorio**, abre tu vídeo subido y **arrástralo con el
ratón**. Si la vista gira, YouTube ha leído la etiqueta esférica y la inyección
funcionó. Si lo que ves es un rectángulo deformado y quieto, no — vuelve al paso
15.

Dale a YouTube unos minutos después de subirlo: el tratamiento 360 solo aparece
cuando termina el procesado, así que un vídeo que se ve plano justo después de
subirlo puede ser simplemente que aún no está listo.

---

## Y ahora compáralos de verdad

Ponte las gafas y mira los dos, uno detrás de otro, prestando atención a los
objetos **cercanos**.

- ¿Dónde se sitúa cada uno en el espacio?
- ¿Puedes saber a qué distancia está algo en el fichero monoscópico?
- ¿Cuál te da ganas de alargar la mano?
- ¿Cuál es más cómodo pasados un par de minutos?

Apunta lo que has notado. Esa observación es el objetivo de la actividad — los
dos ficheros son solo el aparato de medida.

---

## Si algo no funciona

- **Los dos ojos se ven idénticos en el fichero estéreo** → el proyecto es URP o
  HDRP. Recorder no hace estéreo 360 sobre un SRP (paso 1).
- **YouTube enseña un rectángulo plano y deformado** → faltan metadatos, o
  todavía está procesando (paso 15).
- **La imagen sale estirada** → las Output Dimensions no son 2:1 (paso 7).
- **Tu primera toma ha desaparecido** → sin comodín, la segunda la sobrescribió
  (paso 10).
- **El vídeo se ve blando** → Cube Map Size demasiado bajo (paso 7).
- **Te marea** → la cámara rotó, o se movió demasiado rápido (paso 13).
- **Costuras visibles en el 360** → un proyecto HDRP con post-procesado; otra
  razón para Built-In.
