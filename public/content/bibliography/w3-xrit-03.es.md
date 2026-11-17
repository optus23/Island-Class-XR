# Bibliografía y enlaces de interés

La documentación que hay detrás de esta sesión, sacada del deck de la sesión.
Las páginas de Unity van por versiones: las marcadas como *latest* abren
siempre la versión actual, y cada entrada dice cuándo se consultó.

## La plantilla Mixed Reality

- [Mixed Reality Template Quick Start Guide 1.0](https://docs.unity3d.com/Packages/com.unity.template.mixed-reality@1.0/manual/index.html), Unity Technologies · 18/11/2026
  La plantilla de la que arranca el proyecto, qué trae y sus límites: el Space Setup hay que hacerlo antes en el visor, solo se clasifican superficies horizontales mirando hacia arriba, y la detección de planos y el passthrough solo funcionan en una build, no dándole a Play.

## Los paquetes sobre los que está hecha la plantilla

- [OpenXR Plugin (latest)](https://docs.unity3d.com/Packages/com.unity.xr.openxr@latest/index.html), Unity Technologies · 18/11/2026
- [AR Foundation (latest)](https://docs.unity3d.com/Packages/com.unity.xr.arfoundation@latest/index.html), Unity Technologies · 18/11/2026
- [XR Interaction Toolkit (latest)](https://docs.unity3d.com/Packages/com.unity.xr.interaction.toolkit@latest/index.html), Unity Technologies · 18/11/2026

## Ejemplos

- [XR Interaction Toolkit Examples](https://github.com/Unity-Technologies/XR-Interaction-Toolkit-Examples), Unity Technologies en GitHub · 18/11/2026
  De donde salen las funcionalidades extra, incluidos los socket interactors del ejemplo del inventario (`XRI_Examples > SocketInteractors > Prefabs > Simple Socket`).

## Citados en el deck, sin enlace

Vale la pena saberse los nombres; el deck los enseña pero no los enlaza.

- **XR Hands**, el paquete que añade el hand tracking (`com.unity.xr.hands`, se añade por nombre desde el Package Manager), con sus samples **HandVisualizer** y **Hand Interaction Demo**.
- **Hand Tracking with Unity XR Interaction Toolkit**, un vídeo tutorial de Valem Tutorials en YouTube, incrustado en el deck.
