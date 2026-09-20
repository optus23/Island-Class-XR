---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Activitat · Mono / Estereoscòpic

Grava la mateixa presa 360° dues vegades —una de plana i una en estèreo—
i **mira la diferència amb unes ulleres**

**Voluntària** · setze passos · Unity Recorder

---

## Què en treus

En acabar sabràs:

- gravar un **vídeo 360° directament des d'Unity**, sense plugins i sense
  muntar-te cap rig de càmeres;
- gravar **la mateixa presa en estèreo**, de manera que cada ull vegi l'escena
  des d'un lloc lleugerament diferent;
- ficar els dos fitxers en unes **Meta Quest 3** i sentir, en comptes de llegir,
  què hi afegeix de debò l'estereoscòpia.

L'important no és la gravació. L'important és la **comparació**: dos fitxers de
la mateixa escena que es diferencien en exactament una cosa.

**Unity és la via que es recorre aquí, no l'única permesa.** Val qualsevol
software capaç de renderitzar aquests dos vídeos 360 amb les seves metadades
espacials — els setze passos de sota simplement prenen el camí que tothom a
l'aula ja té instal·lat.

---

## ⚠ Llegeix això abans de crear el projecte

*(Només per a la via d'Unity — si els renderitzes en un altre lloc, salta al pas 15.)*

**Tria la plantilla `3D (Built-In Render Pipeline)`.** Ni Universal 3D, ni HDRP.

Unity Recorder **no suporta captura 360 estereoscòpica en cap Scriptable Render
Pipeline**. Amb URP o HDRP la casella *Record in Stereo* es marca igualment, el
fitxer surt igual a dalt-a baix — i **les dues meitats són idèntiques**. Et queda
un fitxer amb forma d'estèreo i sense estèreo a dins.

No t'avisa res. Te n'assabentaries amb les ulleres posades, que és el pitjor
moment possible.

---

## Pas 1 · Projecte nou, Built-In

Unity Hub → **New project** → **3D (Built-In Render Pipeline)**.

Posa-li un nom que reconeguis d'aquí a una setmana.

Aquest és un projecte d'usar i llençar la feina del qual és només ser gravat,
així que no reaprofitis el d'AR Foundation: aquell és URP, i la diapositiva
anterior explica per què importa.

Si ja tens una escena Built-In bonica d'una altra assignatura, fes-la servir:
com millor l'escena, més obvi el resultat.

---

## Pas 2 · Instal·la el Recorder

`Window > Package Manager` → desplegable de dalt a l'esquerra → **Unity
Registry** → busca **Recorder** → **Install**.

La línia actual és **Recorder 5.1.x**. No ve amb l'Editor; s'ha d'instal·lar per
projecte.

Una limitació que convé saber ja: el Recorder **només funciona a l'Editor, en
Play mode**. No és res que puguis ficar dins d'una build.

---

## Pas 3 · Obre la finestra del Recorder

`Window > General > Recorder > Recorder window`.

Acobla-la on la puguis veure mentre corre el joc — al costat del Game view és
l'habitual. L'estaràs llegint durant la reproducció.

Unity restaura el que vas deixar posat l'últim cop que vas gravar, la qual cosa
és còmoda fins al moment en què dónes per fet que un camp és buit. Llegeix el
panell en comptes de fiar-te de la memòria.

---

## Pas 4 · Add Recorder → Movie

Prem **+ Add Recorder** i tria **Movie**.

Un Recorder és una sortida. La llista en pot tenir uns quants alhora —podries
gravar la versió plana i l'estèreo en una sola passada— però no ho facis: dos
Recorders sobre una captura 360 es barallen per la mateixa càmera.

Un Recorder, dues passades. És més lent i és la versió que funciona.

---

## Pas 5 · Frame Rate: Constant

Al panell de sessió de gravació de dalt, posa **Playback** a **Constant** i
**Target FPS** a **30**.

**Constant** li diu al Recorder que produeixi un fitxer exactament a aquesta
taxa de frames, frenant l'Editor si no dóna l'abast. **Variable** fa el
contrari: manté l'Editor a tota velocitat i descarta frames.

Una captura 360 és pesada — renderitza la teva escena sis vegades per frame.
Constant és el que impedeix que això acabi en un vídeo a batzegades.

---

## Pas 6 · Source: 360 View

A **Capture**, posa **Source** a **360 View**, i **Camera** a **MainCamera**.

`MainCamera` vol dir "l'objecte que porti el tag MainCamera". Fes servir la que
l'escena ja té; afegir una segona càmera només per gravar no t'aporta res i et
dóna un xoc de tags per depurar.

---

## Pas 6 · …què fa realment 360 View

**No** necessita una càmera especial ni un rig de 360.

Per a cada frame, el Recorder apunta la teva càmera normal en sis direccions,
renderitza un **cube map** amb aquestes sis vistes, i després desplega aquest cub
en la imatge plana 2:1 que espera un reproductor 360 (una projecció
*equirectangular*).

Dues conseqüències que et trobaràs després:

- la **rotació de la càmera la governa el Recorder** mentre captura — vegeu el
  pas 13;
- la gravació costa sis renders per frame, així que és lenta.

---

## Pas 7 · Output Dimensions 4096 × 2048

Posa **W** a `4096` i **H** a `2048`.

**L'amplada ha de ser exactament el doble de l'alçada.** Una imatge
equirectangular cobreix 360° d'ample i 180° de dalt a baix, així que un frame 2:1
és el format, no una preferència. Si t'equivoques, tots els reproductors estiren
el resultat.

4096 × 2048 és un compromís raonable per a classe. Recorda que aquesta resolució
s'embolica al voltant de tot el teu cap: només una fracció d'aquests píxels és
davant dels teus ulls en cada moment, i per això el vídeo 360 sempre es veu més
tou del que esperes.

---

## Pas 7 · …i Cube Map Size

Deixa **Cube Map Size** a **2048**.

És el costat, en píxels, de cadascuna de les sis cares del cub que el Recorder
renderitza abans de desplegar-les. És la resolució *real* de la captura — les
Output Dimensions de dalt són només la mida a la qual s'aplana aquest cub.

- Massa petit, i el 360 es veu tou per gran que sigui la sortida.
- Massa gran, i la gravació va a rossec sense guany visible.

Una cara d'aproximadament **la meitat de l'amplada de sortida** és la regla
habitual, i d'aquí surt el 2048.

---

## Pas 8 · Primera presa: Record in Stereo apagat

Busca **Record in Stereo** i deixa'l **sense marcar**.

Aquest primer fitxer és el **monoscòpic**: una sola imatge, enviada als dos ulls.
Amb les ulleres es veurà com ser dins d'una fotografia — pots mirar al voltant,
però tot és a la mateixa distància plana.

Aquest és el control. El necessites per tenir contra què comparar, així que
aguanta les ganes de saltar directament a l'interessant.

---

## Pas 9 · Format: H.264 MP4, High

A **Output Format**, tria **H.264 MP4** i posa **Quality** a **High**.

H.264 és la resposta segura aquí: YouTube l'ingesta sense sorpreses de
recodificació, i les Quest el reprodueixen per maquinari. Un còdec exòtic et
costarà una tarda de feina sense cap guany visible.

Marca **Include Audio** només si la teva escena té so de debò. Per a aquesta
comparació no hi afegeix res.

---

## Pas 10 · Nom de fitxer: fes servir un comodí

A **Output File**, posa el **File Name**, obre el menú **+ Wildcards** i afegeix
**`<Take>`**.

**No et saltis això.** El Recorder escriu sempre a la mateixa ruta, així que
sense comodí la teva segona presa sobreescriu la primera en silenci — i la
primera és el vídeo monoscòpic que necessites per comparar.

`<Take>` és un comptador que el Recorder incrementa després de cada gravació,
així que `MonoEstereo_<Take>` et dóna `MonoEstereo_001`, `MonoEstereo_002`, i res
perdut. `<Time>` i `<Date>` també valen.

Posa **Path** en un lloc que sàpigues trobar des de l'explorador.

---

## Pas 11 · Marca Exit Play Mode

A dalt de tot, just sota **START RECORDING**, marca **Exit Play Mode**.

Amb això activat, aturar la gravació també surt del Play mode. Sense això, el
joc continua corrent després de tancar-se el fitxer i és fàcil creure que la
gravació segueix.

És una petitesa. Elimina una manera d'acabar amb un clip de deu segons que
creies d'un minut.

---

## Pas 12 · Alguna cosa que valgui la pena mirar

Necessites una escena amb **profunditat**: objectes a prop de la càmera **i**
lluny.

Un sol cub sobre un pla buit n'hi ha prou per aprovar, però és una prova pobra:
la profunditat estèreo es nota sobretot en coses a un parell de metres, i
gairebé no existeix en un horitzó llunyà. Si l'únic que hi ha és lluny, els teus
dos fitxers es veuran idèntics i conclouràs que l'exercici ha fallat.

Així que: uns quants objectes a distàncies diferents, com a mínim un a prop. Un
entorn que ja tinguis d'una altra assignatura guanya a qualsevol cosa que
muntis en cinc minuts.

---

## Pas 13 · Grava la primera presa

Prem **START RECORDING** i mou la càmera per l'escena — passa a prop d'alguna
cosa, i després allunya-te'n. Atura't als vint o trenta segons.

Pots arrossegar el Transform de la càmera al Scene view mentre corre el Play
mode, o moure un personatge si l'escena en té un. Qualsevol de les dues val.

**Mou-te a poc a poc.** Una velocitat que sembla normal en un monitor fa
mareig amb les ulleres, on el moviment ocupa tot el teu camp de visió.

---

## Pas 13 · …no giris mai la càmera

**Translació sí. Rotació mai.** Aquesta és la regla que importa.

En un vídeo 360 el cap de l'espectador *és* la càmera. Gira-la a Unity i la
imatge gira mentre el coll de qui mira no — i això es llegeix exactament com algú
agafant-te el cap amb les mans i girant-lo. És una de les maneres més ràpides de
marejar una persona en VR.

Hi ha a més una raó tècnica: 360 View ja està girant aquesta càmera per construir
el seu cube map (pas 6). La teva rotació es baralla amb la seva.

---

## Pas 14 · Segona presa: Record in Stereo encès

Marca **Record in Stereo** i grava **el mateix moviment un altre cop**, tan
semblant com puguis.

Ara el Recorder renderitza dues vistes i les apila en un sol frame: **ull esquerre
a dalt, ull dret a baix**. Aquest és el *top/bottom layout* pel qual et preguntarà
després l'eina de metadades, així que queda't amb l'expressió.

**Stereo Separation** és la distància entre aquests dos ulls — la distància
interpupil·lar. El valor per defecte **0.065** són 65 mm, la mitjana humana.
Puja'l i la profunditat s'exagera fins a semblar una maqueta; baixa'l i l'escena
s'aplana de nou cap al mono.

---

## Pas 14 · …dues coses que aquí es confonen

**Flip Vertical no és el layout de l'estèreo.** Volteja tota la imatge de sortida
del revés, i existeix per a sistemes que escriuen el vídeo a l'inrevés. Deixa'l
apagat; si la teva gravació surt invertida, aquest és l'interruptor.

**Les dues preses s'han d'assemblar.** La comparació només diu alguna cosa si la
càmera recorre el mateix camí a la mateixa velocitat. Si els teus dos fitxers es
diferencien també en el recorregut, no pots saber quina diferència estàs mirant.

---

## Pas 15 · Spatial Media Metadata Injector

Descarrega'l del repositori **spatial-media** de Google, pàgina de releases — la
**360 Video Metadata Tool** per a Windows o Mac.

Un fitxer 360 és un MP4 normal. Res dins dels píxels diu "això és esfèric"; això
viu en una etiqueta de metadades, i Unity no l'escriu. Puja el fitxer tal qual i
YouTube t'ensenyarà un rectangle pla i deformat.

Per a cada vídeo: **Open** → marca les caselles → **Inject metadata** → desa el
fitxer nou que escriu al costat de l'original.

---

## Pas 15 · …quines caselles marcar

**Els dos fitxers:** `My video is spherical (360)`.

**Només el fitxer estèreo, i a més:**
`My video is stereoscopic 3D (top/bottom layout)` — que és exactament com el
Recorder va apilar els dos ulls al pas 14.

Deixa en pau el **spatial audio (ambiX ACN/SN3D)**. Això és per a so ambisònic, i
no en tens.

Injecta també al fitxer monoscòpic. Sense l'etiqueta esfèrica no és un vídeo 360,
és una fotografia molt ampla d'un.

---

## Pas 16 · Fica'ls a les ulleres

**Via A — YouTube (recomanada).** Puja els dos fitxers injectats al teu canal,
com a no llistats si vols. Obre YouTube dins de les Quest 3 i mira cadascun.

**Via B — sideload.** Copia els dos fitxers directament a l'emmagatzematge de les
ulleres per USB, obre **Biblioteca → Vídeos** (o un reproductor com DeoVR) i
digues-li al reproductor que són 360, mono o estèreo. **Per aquesta via no cal
l'injector** — li ho estàs dient al reproductor en comptes d'etiquetar el fitxer.

Cada reproductor de VR posa aquests controls en un lloc diferent. Compta amb
buscar-los.

---

## Pas 16 · …com saps que ha funcionat

**En un navegador d'escriptori**, obre el teu vídeo pujat i **arrossega'l amb el
ratolí**. Si la vista gira, YouTube ha llegit l'etiqueta esfèrica i la injecció
va funcionar. Si el que veus és un rectangle deformat i quiet, no — torna al pas
15.

Dóna-li a YouTube uns minuts després de pujar-lo: el tractament 360 només apareix
quan acaba el processament, així que un vídeo que es veu pla just després de
pujar-lo pot ser simplement que encara no està llest.

---

## I ara compara'ls de debò

Posa't les ulleres i mira'ls tots dos, un darrere l'altre, parant atenció als
objectes **propers**.

- On se situa cadascun a l'espai?
- Pots saber a quina distància és alguna cosa al fitxer monoscòpic?
- Quin et fa venir ganes d'allargar la mà?
- Quin és més còmode passats un parell de minuts?

Apunta què has notat. Aquesta observació és l'objectiu de l'activitat — els dos
fitxers són només l'aparell de mesura.

---

## Si alguna cosa no funciona

- **Els dos ulls es veuen idèntics al fitxer estèreo** → el projecte és URP o
  HDRP. Recorder no fa estèreo 360 sobre un SRP (pas 1).
- **YouTube ensenya un rectangle pla i deformat** → falten metadades, o encara
  està processant (pas 15).
- **La imatge surt estirada** → les Output Dimensions no són 2:1 (pas 7).
- **La teva primera presa ha desaparegut** → sense comodí, la segona la va
  sobreescriure (pas 10).
- **El vídeo es veu tou** → Cube Map Size massa baix (pas 7).
- **Et mareja** → la càmera va girar, o es va moure massa ràpid (pas 13).
- **Costures visibles al 360** → un projecte HDRP amb post-processament; una
  altra raó per a Built-In.
