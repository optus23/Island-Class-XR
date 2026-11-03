# Bibliography and further reading

The documentation behind this session. Meta's pages change often, so each entry
says when it was read.

## Mixed Reality Utility Kit: the four pages to start from

These are the ones to read if you only read four.

- [MRUK: Manage scene data](https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-manage-scene-data), Meta · 03/11/2026
  Space Setup, the `MRUK` prefab, the Data Source options and the scene data model. This is the page behind step 6 and step 7.
- [MRUK samples](https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-samples), Meta · 03/11/2026
  The twelve samples and how to import them.
- [MRUK: Debug](https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-debug), Meta · 03/11/2026
  Immersive Debugger and Scene Debugger, for when the room is there but wrong.
- [Virtual Home sample](https://developers.meta.com/horizon/documentation/unity/unity-sample-mruk-virtual-home), Meta · 03/11/2026
  The sample whose spawner you can re-dress without writing a line.

## MRUK: the rest

- [MRUK: Content placement](https://developers.meta.com/horizon/documentation/unity/unity-mr-utility-kit-content-placement), Meta · 03/11/2026
  `AnchorPrefabSpawner`, `FindSpawnPositions` and `EffectMesh`.
- [MRUK: Environment raycast / Instant Content Placement](https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-environment-raycast), Meta · 03/11/2026
  Not used in class: the official workflow needs a script of your own.
- [Mixed Reality Utility Kit: Getting started](https://developers.meta.com/horizon/documentation/unity/unity-mr-utility-kit-gs/), Meta · 12/10/2026
- [MRUK overview](https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-overview), Meta
  Linked from the session deck. Only its metadata could be read, so nothing here is quoted from it.

## The samples repository

- [Unity-MRUtilityKitSample](https://github.com/oculus-samples/Unity-MRUtilityKitSample), Meta (oculus-samples) on GitHub
  Where the samples actually come from: they are not in the package. Its latest release targets a newer SDK than the one installed in class, which is the likeliest reason `BouncingBall` does not compile until you remove the `Cw`.

## Named in class, not consulted

They appear on the session deck. They are listed so they can be found again, not as sources for anything written here.

- [Meta XR SDK on the Unity Asset Store](https://assetstore.unity.com/packages/sdk/meta-xr-sdk-9022845), Unity Asset Store
- **Meta XR MR Utility Kit on the Asset Store.** The screenshot on the deck shows version 66.0.0, which is well behind the 201.0.0 the class installs.
- **Meta XR Simulator: VR Development Without Headset**, Immersive Insiders, on YouTube.
- **Meta Quest Developer Hub**, the Option B route for installing the APK.

## Background for the block

The pages behind the setup steps, carried over from the earlier sessions of block 2.

- [Meta XR SDKs overview for Unity](https://developers.meta.com/horizon/documentation/unity/unity-sdks-overview/), Meta · 12/10/2026
- [Packages and templates for Meta Quest development (Unity 6000.3)](https://docs.unity.com/en-us/engine/6000.3/manual/xr/configuring-project-for/meta-quest-develop/packages), Unity Technologies · 12/10/2026
- [Set up Unity for VR development](https://developers.meta.com/horizon/documentation/unity/unity-project-setup/), Meta · 04/10/2026
- [Building Blocks for Meta VR in Unity](https://developers.meta.com/horizon/documentation/unity/bb-overview/), Meta · 12/10/2026
- [Building Blocks overview](https://developers.meta.com/horizon/documentation/unity/unity-building-blocks-overview/), Meta · 12/10/2026
- [Passthrough overview](https://developers.meta.com/horizon/documentation/unity/unity-passthrough/), Meta · 12/10/2026
- [Depth API overview](https://developers.meta.com/horizon/documentation/unity/unity-depthapi-overview/), Meta · 12/10/2026
- [Presence Platform](https://developers.meta.com/horizon/presence-platform/), Meta · 12/10/2026
- [Meta XR Simulator: Getting started](https://developers.meta.com/horizon/documentation/unity/xrsim-getting-started/), Meta · 12/10/2026
- [Synthetic environments](https://developers.meta.com/horizon/documentation/unity/xrsim-ses/), Meta · 12/10/2026

## Secondary and unofficial sources: treat with care

Not Meta documentation. Useful for context, not for a menu path.

- [Meta Building Blocks in Unity, and Spatial Anchors (block names only)](https://www.vrwiki.cs.brown.edu/unity/meta-building-blocks-in-unity), Brown University VR Wiki · 03/10/2026
- **Developer Mode on Meta Quest devices**: ArborXR Help Center (account and verification requirements). Read in October 2026; the exact URL was not kept.
