---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 1 · Plane Detection

**Block 1 — AR Foundation**
**Individual** · eighteen steps, from an empty project to a phone

---

## Step 1 · New project, and the platform first

Create a new Unity project with the 3D template we use in class.

Before installing anything else: `File > Build Settings`, select **Android**
(or **iOS**) and press **Switch Platform**.

Do it now, not at the end. Switching platform reimports every asset in the
project. On an empty project that takes seconds; once your model, your textures
and your prefabs are in there it can cost you several minutes of class time.

---

## Step 2 · Install AR Foundation

`Window > Package Manager`, select **Unity Registry** at the top left, and
find:

- **AR Foundation** — the common layer, the one you write code against.
- **Google ARCore XR Plugin** (Android) or **Apple ARKit XR Plugin** (iOS) —
  the provider, the one that actually talks to the phone.

AR Foundation on its own **does no AR**: it defines the interface, and the
provider implements it. That is why you need both. We use the **5.1** line,
which is what the manual linked in this session's bibliography documents.

---

## Step 3 · Enable the XR provider

`Edit > Project Settings > XR Plug-in Management` → **Android** (or **iOS**)
tab → tick the provider's checkbox.

Two things to watch:

- The Android tab **only appears** if you installed the Android module from
  Unity Hub. If you cannot see it, that is why.
- Ticking the box here **installs the package if you are missing it**.
  Installing it from the Package Manager, on the other hand, does **not**
  enable it. Installed and enabled are two different things, and this is the
  single most common slip of the day.

---

## Step 4 · Player settings (Android)

`Edit > Project Settings > Player > Other Settings`:

- Under **Rendering**: untick *Auto Graphics API* and **remove Vulkan** from
  the list. ARCore only works with **OpenGLES3**.
- Under **Configuration**: **Scripting Backend → IL2CPP**, and tick **ARM64**
  in *Target Architectures*. ARM64 needs IL2CPP, in that order.

Leave Vulkan in and the app compiles, installs, and starts up **black**: dead
camera, not one error on screen. It is the hardest failure of the whole session
to diagnose.

---

## Step 5 · Check it with Project Validation

`Project Settings > XR Plug-in Management > Project Validation`, **Android**
tab.

It is a list of checks Unity runs against your own project, and most of them
come with a **Fix** button that corrects the setting for you. Among them is the
minimum Android version your combination of Editor and plug-in requires — which
changes between versions, so do not trust a number you read somewhere: read
what your project says.

Turn on *Show all* to see the checks that already pass.

---

## Step 6 · The minimum scene

Delete the **Main Camera** the default scene ships with.

Right-click in the Hierarchy and add:

- `XR > AR Session` — switches AR on and configures it on the device.
- `XR > XR Origin (Mobile AR)` — turns the phone's tracking into Unity
  coordinates. It contains `Camera Offset > Main Camera`, and **that** is the
  camera you will be looking through.

Without either one, AR never starts. And if you leave both cameras in, you end
up watching the scene through the one that does not move.

---

## Step 7 · Put Blue Goblin in

Import the Blue Goblin model and leave him placed in the scene.

He has to be there **from the first frame**, before the user touches anything:
the story opens with him already present, not with him appearing.

Put him a couple of metres from the origin, not on top of it. The XR Origin
starts wherever the phone is when the app opens, so an object at (0,0,0) lands
in the face of whoever opens it.

---

## Step 8 · AR Plane Manager

Select the **XR Origin** in the Hierarchy → `Add Component` → **AR Plane
Manager**.

This component scans what the camera sees and creates one GameObject per flat
surface it recognises: the table, the floor, a wall. They are called
*trackables*, and they grow and merge into each other as you move.

It goes on the XR Origin, not on the camera and not on some loose object,
because the planes have to be born in the same coordinate space as the
tracking.

---

## Step 9 · Plane Prefab: see what it sees

In the AR Plane Manager, drag a plane prefab into the **Plane Prefab** field.
You can use the one from the samples.

This draws the detected planes on screen, and it is a **requirement of the
exercise**, not a debugging aid: whoever looks at your build has to see what
the device is recognising.

It also saves you half an hour. Without it, when a tap spawns nothing, you have
no way of telling whether your code is broken or that table was never detected.

---

## Step 10 · AR Raycast Manager

On the same XR Origin, `Add Component` → **AR Raycast Manager**.

An ordinary physics raycast hits *colliders*. This one does not: it casts
against the AR **trackables** — the planes the previous step just found — which
have no collider at all.

It is the piece that translates "the user touched this pixel of the screen"
into "that pixel lands on this point of the real table".

---

## Step 11 · The script

Create a script (say `TapToPlace.cs`) and attach it to a GameObject in the
scene — an empty called `Placement` will do, or the XR Origin itself.

Inside it you need, as a minimum:

- a reference to the **AR Raycast Manager**, dragged in from the Inspector,
- the **prefab** you are going to spawn,
- one reusable `List<ARRaycastHit>`, created once as a field of the class and
  not inside `Update`.

---

## Step 12 · Read the tap

Read the finger with the **Input System**: `Touchscreen.current`, or
`UnityEngine.InputSystem.EnhancedTouch.Touch` if you want several fingers.

Two things that save you strange bugs:

- Check `Touchscreen.current` is not `null` before using it — there is no touch
  screen in the editor, and that is exactly where it falls over.
- Act on the frame the finger **goes down** (`wasPressedThisFrame`), not while
  it stays down, or you will spawn one object per frame.

---

## Step 13 · The raycast against the plane

With the screen position of the tap:

```csharp
if (raycastManager.Raycast(pos, hits, TrackableType.PlaneWithinPolygon))
{
    var pose = hits[0].pose;
    // pose.position and pose.rotation are the real point and orientation
}
```

`PlaneWithinPolygon` limits the hit to the **surface actually detected**. With
`PlaneEstimated`, the ray hits the infinite mathematical plane instead and will
put objects floating out past the edge of the table.

---

## Step 14 · Spawn it

```csharp
Instantiate(prefab, pose.position, pose.rotation);
```

The pose's rotation already comes aligned with the plane, so your object rests
on the table instead of lying down or facing sideways.

If your model comes out sideways, the problem is almost never the code — it is
the model's pivot. Fix it by nesting the model inside an empty GameObject, with
the child rotated and centred, and use the parent as your prefab.

---

## Step 15 · Real-world scale

Put a 1×1×1 cube in the scene as a reference — in Unity **1 unit = 1 metre** —
and size your model against it.

This is the step most people skip and the one that shows most: a model
downloaded off the internet can arrive at centimetre scale or at kilometre
scale, and in AR that does not go unnoticed. On a real table, your object is
**centimetres** across.

Check the scale on the **prefab**, not just on the model in the folder.

---

## Step 16 · Do not stack copies

As it stands, every tap spawns another object. Ten taps and you have a tower.

Decide what you want and write it down in code:

- **Just one**: keep the reference to the one that exists and move it with
  `transform.SetPositionAndRotation` instead of creating another.
- **Several, up to a limit**: count them and block past N.

Either is fine. What is not fine is not having decided.

---

## Step 17 · The story

Connect the object you spawn to Blue Goblin visually: let it come at him,
scare him, light him up, trap him, talk him round.

This is the step that separates a submitted exercise from a good one, and it
takes no new code: it is where you put things, what faces what, and what
happens in the two seconds after the tap.

The test is simple: **if it needs explaining alongside, it does not count.**

---

## Step 18 · Onto the phone

`File > Build Settings` → **Build and Run**, phone connected by cable with USB
debugging on.

Test it **on the physical device**, and leave yourself time for it: the first
build of an IL2CPP project is slow, and that is not the moment to find out.

The editor's Play Mode does not simulate real plane detection. In there it
always looks like it works.

---

## If something does not work

- **Black screen** → Vulkan is still in Graphics APIs (step 4).
- **Nothing gets detected** → not enough light, or the surface is smooth and
  uniform; ARCore needs texture. Try a table with things on it.
- **The object is huge, or invisible** → scale (step 15).
- **It lands in the centre instead of where you tapped** → you are not using
  `hits[0].pose`.
- **It builds but will not start** → go through Project Validation (step 5).
