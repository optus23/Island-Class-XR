---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercici 3 · AR Foundation Samples

El problema està **resolt** — així que ja podeu fer servir els samples

Crea una app a partir dels **AR Foundation Samples** d'Unity
i **prova'n totes les features**

**Bloc 1 — AR Foundation** · **En grup** · tres passos, sense codi

---

## Què és el dia d'avui

Els dos primers exercicis us feien muntar una escena a mà, un manager cada
vegada. Avui obriu en comptes d'això el **projecte oficial de samples**: un únic
projecte d'Unity que ja porta una escena funcionant per cada feature que té l'AR
Foundation.

Avui no integreu res al vostre projecte. Obriu el seu, l'executeu al mòbil i
descobriu **què sap fer la plataforma de debò** — que és el que necessiteu abans
del bloc 2.

---

## Si aneu endarrerits

Els exercicis 1 i 2 tenen un projecte resolt:

**[`github.com/pomedas/ArMobile`](https://github.com/pomedas/ArMobile)**

Feu-lo servir de dues maneres:

- com a **solució** dels exercicis 1 i 2, per comparar-la amb el que vau
  construir;
- com a **punt de partida** per a l'entrega del bloc, si no els vau poder
  acabar.

Ningú s'hauria de quedar encallat a l'entrega perquè l'exercici 1 o el 2 no van
sortir. Agafeu el projecte i continueu.

---

## Pas 1 · Descarrega els samples

Agafa el projecte open source del GitHub d'Unity: **`arfoundation-samples`**.

**Assegura't de triar la branca correcta.** Aquest és tot el pas i és el que surt
malament: el repositori manté una branca per versió d'AR Foundation, i una branca
que no coincideix amb el teu Editor et dóna un projecte ple d'errors de
compilació abans d'haver fet res.

**Mira quina versió d'AR Foundation fa servir el teu projecte i agafa la branca
que porta aquest nom.** Les branques es diuen com la versió a la qual apunten, i
la llista canvia amb cada release: la correcta avui no és la correcta d'aquí a
un any.

---

## Pas 2 · Obre'l des del disc

Unity Hub → **Add** → **Add project from disk**, i apunta a la carpeta que acabes
de descarregar.

**Comprova que tens els mòduls d'Android instal·lats** abans d'obrir-lo — Unity
Hub → *Installs* → **Add modules** → *Android Build Support*, amb **OpenJDK** i
**Android SDK & NDK Tools** a dins.

És la mateixa comprovació que als exercicis 1 i 2, i falla igual: sense el mòdul,
Android no apareix mai a Build Settings.

---

## Know how · Prova totes les features

Obre les escenes d'exemple i prova-les:

- **Face Tracking**
- **Body Tracking** — *només a iPhone*
- **Simple Occlusion**
- **Ambient Intensity**

No tot funciona a tots els mòbils. Una feature que no fa res al teu dispositiu
sol ser el dispositiu, no la teva build.

---

## Know how · I més

- **Point Cloud**
- **Configuration**
- **Anchors**
- **Plane detection** — la que ja vas muntar a mà a l'exercici 1

Veure-la aquí al costat de les altres és justament l'objectiu: el que et va
costar una sessió cablejar és una escena dins d'un catàleg, i aquest catàleg és
d'on arrenca el bloc 2.

---

## Know how · Prova en mode editor

Abans de fer una build, executa'l a l'Editor.

Busca **`menuloader`** a la barra de cerca del projecte i obre aquesta escena.

**Aquesta escena és la que enllaça totes les altres.** Si obres una escena
d'exemple solta, tens aquella única feature i cap manera de tornar al menú; si
obres `menuloader`, tens l'app tal com està pensada per navegar-s'hi.

---

## Pas 3 · Prova i després build

**Prova primer en Play Mode amb l'XR Simulator.**

Després `File > Build Settings`:

- assegura't que la teva escena és a la llista **Scenes In Build**;
- prem **Build** i tria la carpeta de destinació.

Aquesta és la teva APK. Instal·la-la al mòbil.

Enhorabona — amb això el bloc està acabat.

---

## Si alguna cosa no funciona

- **El projecte s'obre ple d'errors de compilació** → branca equivocada (pas 1).
  Contrasta-la amb la teva versió de l'Editor.
- **Android no surt a Build Settings** → falta el mòdul de l'Editor (pas 2).
- **Una escena d'exemple s'obre però no hi ha menú** → has obert l'escena
  directament en comptes de `menuloader`.
- **El body tracking no fa res** → és només per a iPhone. No és la teva build.
- **Una feature no fa res al teu mòbil** → no tots els dispositius suporten totes
  les features; prova un altre sample abans de donar-ho per trencat.
