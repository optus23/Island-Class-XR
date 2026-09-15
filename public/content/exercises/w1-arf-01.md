---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 1 · Plane Detection

Create an AR app with Unity AR Foundation
that spawns **a 3D solution to deal with the blue goblin**

**Block 1 — AR Foundation** · **Individual** · eight steps, no scripting

---

## No code today

You are starting from Unity's **AR Mobile** template, which already contains
the spawning logic, the UI and the object menu. Everything you do today happens
in the **Inspector**:

duplicate a prefab · swap a mesh and a material · drag it into a list ·
duplicate a button · change one number.

Writing the raycast and the instantiate by hand is a later conversation. Today
is about getting a real AR build onto a real phone, and putting **your** object
in it.

---

## Step 1 · The AR Mobile template

Unity Hub → **New project** → **AR Mobile**, under *Core*.

Before that, check your Editor install. You need a **2022 LTS** with:

- **Android Build Support**, and inside it **OpenJDK** and **Android SDK & NDK
  Tools**, or
- **iOS Build Support**.

If the module is missing, the platform will not even show up in Build Settings
later, and you will be debugging the wrong thing. Add it from Unity Hub →
*Installs* → **Add modules**.

---

## Step 2 · Packages, then platform

`Window > Package Manager`, switch the dropdown to **Packages: In Project**,
and make sure everything is up to date — in particular **AR Foundation** and
the **Google ARCore XR Plugin** (or **Apple ARKit XR Plugin**).

Then `File > Build Settings` → select **Android** (or **iOS**) → **Switch
Platform**.

Do the platform switch **now**, while the project is still just the template.
Switching reimports every asset in the project: seconds today, several minutes
once your model and its textures are in there.

---

## Step 3 · Player settings

`Project Settings > Player > Other Settings`:

- **Scripting Backend → IL2CPP**
- untick **Auto Graphics API**, and leave **OpenGLES3** as the only entry
- **Minimum API Level → 24** (Android 7.0) · on iOS, minimum version **11**

**ARCore does not run on Vulkan.** Leave it in the Graphics APIs list and the
app compiles, installs, opens — and shows a **black screen**, with no error
anywhere. It is the hardest failure of the day to diagnose, and it is one
checkbox.

---

## Step 4 · XR Plug-in Management

`Project Settings > XR Plug-in Management` → **Android** tab → confirm
**Google ARCore** is ticked. On iOS, **Apple ARKit**.

The package being in the project and the provider being **enabled** are two
different things. The template puts the packages there; this checkbox is what
switches AR on.

If the Android tab is not there at all, go back to step 1 — you are missing the
Android module.

---

## Review · Build it once and look at what you got

Everything is configured now, so **build and install the APK before changing
anything**.

Two reasons, and the second is the important one:

1. If the phone, the cable, USB debugging or the modules are not lined up, you
   find out now — with nothing of your own in the project to suspect.
2. The template's demo **is** the thing you are about to modify. Tap around it,
   spawn the cubes, open the object menu. You are about to add an item to that
   menu, and it helps to have used it first.

---

## Know how · What the template gives you

Five things worth recognising in the Hierarchy, because you will be opening
them in a moment:

- **AR Session** — the lifecycle of the AR app: plane detection, image
  tracking, raycasts, meshing, point clouds.
- **XR Origin** *(AR Session Origin)* — converts AR session coordinates into
  Unity world coordinates.
- **AR Camera Manager** — auto focus, light estimation, and **Facing
  Direction**: towards the world, or towards the user.
- **Tracked Pose Driver** — turns real camera movement into scene camera
  movement.
- **AR Input Manager** — tracks user input.

---

## Step 5 · Your prefab

In `Assets > MobileARTemplateAssets > Prefabs`, **duplicate `CubeVariant`** and
rename it after your object. (You can build one from scratch instead — it just
has to have the same structure.)

Open it, and inside its **`Visuals`** child:

- swap the **Mesh Filter**'s mesh for your model,
- swap the **Material**,
- redo the **Mesh Collider**, with **Convex** ticked.

---

## Step 5 · …and the pivot

**Put the parent's pivot at the floor of the model.**

That pivot is the point the spawner places on the detected plane. With it in
the middle of the mesh — which is where an imported model usually has it — half
your object ends up buried in the table, and the other half hovers.

The fix is the same one that fixes most model problems: nest the model inside
an empty GameObject, move the child up until its feet sit at the parent's
origin, and use the parent as the prefab.

---

## Step 6 · Object Spawner

Expand the **XR Origin** prefab in the Hierarchy. Inside it there is a
GameObject called **`Object Spawner`** — select it and look at the Inspector.

Its **Object Spawner** script holds every prefab the demo can spawn, in the
**Object Prefabs** list. Press **+** to add one more element, and **drag your
prefab** into the new slot.

**Write down the index it lands on.** The next step needs that number, and it
is the one thing here that is easy to get wrong.

---

## Step 7 · Your button

Under `UI > Object Menu Animator > Object Menu > Scroll View > Viewport >
Content`, **duplicate `Button (Cube)`** and rename it.

In its **Button** component, under **On Click**:

- on the `ARTemplateMenuManager.SetObjectToSpawn` event, set the parameter to
  **your prefab's index** in the Object Prefabs list;
- **add a second event**: drag in the **`SelectionBox`** object, choose
  **GameObject.SetActive**, and tick its checkbox.

---

## Step 7 · …about that number

In the example the parameter is **7**.

That is the **eighth** element of the Object Prefabs list, because the list
counts from **zero**. If your object was the ninth thing you dragged in, your
number is 8.

Get this wrong and nothing looks broken: the button works, the menu closes, and
you spawn somebody else's cube. If that is what happens, come back here and
count the list again.

---

## Step 8 · Build the APK

`File > Build Settings`:

- check your scene is in the **Scenes In Build** list — *Add Open Scenes* if it
  is not;
- press **Build** and pick a destination folder.

That is your APK. Install it on your phone.

Test it on a **real surface with some texture** — a table with things on it,
not a bare white desk. ARCore finds planes by tracking feature points, and a
smooth uniform surface gives it nothing to hold on to.

---

## If something does not work

- **Black screen** → Vulkan is still in Graphics APIs (step 3).
- **The build has no AR at all** → the ARCore provider is not ticked (step 4).
- **The platform is not in Build Settings** → the Editor module is missing
  (step 1).
- **Nothing gets detected** → not enough light, or a smooth uniform surface;
  ARCore needs texture (step 8).
- **Half the object is inside the table** → the pivot is not at its floor
  (step 5).
- **The button spawns the wrong object** → the index in `SetObjectToSpawn`
  (step 7).
