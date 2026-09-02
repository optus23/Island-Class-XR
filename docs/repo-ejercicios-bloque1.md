# Repositorio de ejercicios del bloque 1 (AR Foundation)

**Este repositorio no existe todavía.** Esto es la referencia de cómo tiene que
quedar cuando se cree, y el sitio donde se enlaza desde la isla.

---

## Es un repositorio aparte, y se queda aparte

El código Unity del bloque 1 **no entra en `Island-Class-XR`**. La isla es un
sitio estático de ~650 kB que se despliega en Pages en menos de un minuto; un
proyecto de Unity con sus `Library/`, sus paquetes y sus modelos lo convertiría
en otra cosa.

La relación entre los dos es **un enlace**, no una dependencia:

```jsonc
// src/data/levels.json — en w1-arf-01, w1-arf-02 y w1-arf-03
"starterRepo": { "url": null, "branch": "01-plane-detection" }
```

`url` está en `null` hasta que el repositorio exista. En cuanto exista, se rellena
en los tres nodos y el portal pasa a mostrar el enlace en vez de
«pendiente de publicar». Es la única edición que hace falta: no hay que tocar
código.

Nombre propuesto: **`optus23/xr-arfoundation-blue-goblin`**. Público, para que un
alumno pueda clonarlo sin cuenta de la universidad.

---

## Estructura de ramas: una por ejercicio, acumulativas

El brief pide «una rama por ejercicio, y la última con el conjunto completo». Es
decir, cada rama sale de la anterior, no de `main`:

```
main                     proyecto base + Blue Goblin en la escena
  └── 01-plane-detection      ejercicio 1
        └── 02-image-tracking      ejercicio 1 + 2
              └── 03-libre              ejercicio 1 + 2 + 3  ← conjunto completo
```

| Rama | Contiene | Nodo de la isla |
| --- | --- | --- |
| `main` | Proyecto Unity con AR Foundation y el proveedor instalados, Blue Goblin ya instanciado. El punto de partida. | — |
| `01-plane-detection` | Toque → raycast → instanciado sobre plano detectado. | `w1-arf-01` |
| `02-image-tracking` | Lo anterior + *Reference Image Library* con 2 marcadores y sus prefabs. | `w1-arf-02` |
| `03-libre` | Lo anterior + la feature libre de los samples. **Es el conjunto completo.** | `w1-arf-03` |

Que sean acumulativas es lo que permite que el alumno entregue un solo APK en el
ejercicio 3 con el bloque entero dentro, tal y como pide el enunciado.

> Ojo con **(b)** en [decisiones-abiertas.md](decisiones-abiertas.md): si al final
> se decide que los alumnos generan el proyecto desde cero, `main` deja de ser el
> proyecto montado y pasa a ser solo el `README` con los pasos de instalación.

---

## Qué debería llevar cada rama

- `README.md` propio, con qué se ha añadido respecto a la rama anterior.
- El proyecto Unity con `.gitignore` de Unity **de verdad** (sin `Library/`,
  `Temp/`, `Logs/`, `Builds/`).
- Ningún APK compilado dentro del repositorio: las entregas van por el canal de
  la asignatura, no por Git.
- Los modelos 3D del profesor (Blue Goblin y sus primos verdes) con su licencia
  anotada. Los alumnos añaden los suyos y anotan la licencia igual.

---

## Cuando exista

1. Crear el repositorio y las cuatro ramas con el proyecto montado.
2. Rellenar `starterRepo.url` en `w1-arf-01`, `w1-arf-02` y `w1-arf-03`.
3. `npm run validate` (comprueba que la URL es https) y desplegar.

El portal ya sabe pintarlo: `assessmentStrip()` en
[`src/ui/portal.js`](../src/ui/portal.js) muestra el enlace en cuanto `url` deja
de ser `null`.
