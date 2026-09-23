---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercici 2 · Image Tracking

Crea una app d'image tracking amb Unity AR Foundation
que instanciï **una solució 3D per encarar els green goblins**

**Bloc 1 — AR Foundation** · **Individual** · vuit passos, sense codi

---

## Avui tampoc s'escriu codi

L'exercici 1 et va posar una build d'AR real al mòbil. Aquest canvia què la
dispara: en comptes d'un **pla** detectat, el teu objecte apareix sobre una
**imatge** detectada — un marcador.

Tot torna a passar a l'**Inspector**. La novetat d'avui és l'**XR Simulator**,
que et deixa provar l'image tracking dins de l'Editor, sense fer build i sense
imprimir res.

Aquesta vegada els goblins són verds i n'hi ha uns quants. El que instanciïs per
encarar-los continua sent cosa teva.

---

## Know how · Què és l'image tracking

L'**AR Tracked Image Manager** crea un GameObject per cada imatge que detecta a
l'entorn.

Tot sol no detecta res. Li has de donar una **reference image library**: un
conjunt compilat de les imatges que vols que busqui. Detecta aquestes i cap més.

La llibreria es pot canviar en temps d'execució, però mentre el manager estigui
actiu no pot quedar-se mai a null.

---

## Pas 1 · La plantilla AR Mobile

Unity Hub → **New project** → **AR Mobile**, dins de *Core*.

**Assegura't de tenir el mòdul d'Android instal·lat** a l'Editor — Unity Hub →
*Installs* → **Add modules** → *Android Build Support*, amb **OpenJDK** i
**Android SDK & NDK Tools** a dins.

Si falta aquest mòdul, al pas següent Android ni tan sols apareixerà a Build
Settings, i buscaràs el problema on no és.

---

## Pas 2 · Plataforma i proveïdor

Dues coses, i no són la mateixa:

1. `File > Build Settings` → selecciona **Android** → **Switch Platform**.
2. `Project Settings > XR Plug-in Management` → pestanya **Android** → confirma
   que el checkbox d'**ARCore** està marcat.

Canviar de plataforma reimporta el projecte sencer: fes-ho ara, que encara és
buit. I que el paquet d'ARCore estigui instal·lat no és el mateix que que ARCore
estigui **activat** — el checkbox és el que encén l'AR.

---

## Pas 3 · Una escena nova

**Crea una escena nova.** Aquesta vegada no modifiques la demo de la plantilla:
l'escena la muntes tu.

- **Esborra l'objecte `Main Camera`.** El rig d'AR porta la seva pròpia càmera, i
  dues càmeres és una escena confusa.
- Afegeix **`AR Session`** i **`XR Origin (AR)`**.
- Després selecciona l'**XR Origin** i **Add Component → `AR Tracked Image
  Manager`**.

Deixa els camps del manager buits de moment. El pas 4 fabrica el que hi va a
dins.

---

## Pas 4 · La reference image library

A la finestra Project, clic dret a `Assets` →
**`Create > XR > Reference Image Library`**.

Selecciona l'asset, prem **Add Image** i deixa-hi anar una textura normal — PNG,
JPG, el que tinguis.

**Tria una imatge amb contrast i detall irregular.** L'editor li posa una
puntuació mentre la processa. Una puntuació baixa vol dir un marcador que només
funciona amb llum perfecta i en angle perfecte, i acabaràs donant-li la culpa al
codi.

---

## Pas 5 · L'XR Simulator

`Window > XR > AR Foundation > XR Environment`.

Això obre una habitació simulada dins de la qual pots donar-li al Play —
image tracking inclòs — així que pots provar l'exercici d'avui **sense fer l'APK
i sense imprimir cap marcador**.

Ves a la pestanya **XR Environment** i a **Edit Environment**. Si no et deixa
editar el que hi ha, **duplica l'entorn per defecte** i edita la teva còpia.

---

## Pas 6 · Posa el teu marcador a l'habitació simulada

L'entorn ja porta una imatge penjada a l'habitació.

- Selecciona l'objecte **`Logo Quad`** i **canvia-li el material** perquè mostri
  **la mateixa imatge que vas afegir a la llibreria** al pas 4.
- I després — això és el que oblida tothom — posa aquesta mateixa imatge també al
  component **Simulated Tracked Image**.

El quad és el que *veus*; el component Simulated Tracked Image és el que el
simulador realment *traqueja*. Si canvies només el primer, l'habitació es veu bé
i no es detecta res mai.

---

## Pas 7 · Què s'instancia

Torna a l'**XR Origin** de la Hierarchy, i a l'**AR Tracked Image Manager** que
vas afegir al pas 3.

- Arrossega la teva **reference image library** al seu camp de llibreria.
- Assigna el **prefab** que s'ha d'instanciar quan es traquegi la imatge.

Aquest prefab és la teva resposta als green goblins. L'objecte 3D que vulguis:
modela'l, descarrega'l o reutilitza el de l'exercici 1.

**Si el marcador estarà en moviment**, puja **Max Number Of Moving Images** a 1
com a mínim. A 0, un marcador sostingut a la mà es detecta un cop i deixa de
seguir-te.

---

## Pas 8 · Prova i després build

**Prova primer en Play Mode amb l'XR Simulator.** Costa segons; una build costa
minuts. No descobreixis un material mal posat per la via d'una APK.

Després `File > Build Settings`:

- comprova que la teva escena és a la llista **Scenes In Build** — *Add Open
  Scenes* si no hi és, i aquest és el pas que la gent es salta;
- prem **Build** i tria la carpeta de destinació.

Aquesta és la teva APK. Instal·la-la al mòbil i apunta al marcador — en paper o
en una altra pantalla.

---

## Si alguna cosa no funciona

- **Android no surt a Build Settings** → falta el mòdul de l'Editor (pas 1).
- **La build no té AR** → el checkbox d'ARCore no està marcat (pas 2).
- **L'escena no mostra res** → has esborrat la Main Camera però no has afegit
  `XR Origin (AR)` (pas 3).
- **Al simulador no es detecta mai res** → la imatge és al material del quad però
  no al component **Simulated Tracked Image** (pas 6).
- **Es detecta, però l'objecte no apareix** → no hi ha prefab assignat al manager
  (pas 7).
- **Es detecta un cop i deixa de seguir** → **Max Number Of Moving Images** està
  a 0 (pas 7).
- **Només funciona amb llum perfecta** → marcador amb poc contrast; torna al
  pas 4 i mira la puntuació de qualitat.
