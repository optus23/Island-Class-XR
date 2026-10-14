---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 1 · Meta Building Blocks

Create a **virtual reality app** with Meta Building Blocks
to **interact with a 3D solution to deal with the giant robot**

**Block 2 — Meta Building Blocks** · **Group** · eight steps, no scripting

---

## The goblin is on your side now

A giant robot turned up, and the blue goblin has changed sides: you are
teaming up with it.

What you build is **your** 3D object — the thing you bring into VR and pick up
with your own hands. Any model you like. The choice is the exercise.

**No code today either.** Everything happens in the Unity Inspector and in the
Building Blocks window: drop a block into the scene and it works.

---

## Know how · What is in the Meta XR SDK

The All-in-One SDK is several packages, and you do not need all of them:

- **Core SDK** — rendering, tracking, mixed-reality primitives
- **Interaction SDK** — hand, controller and gaze interactions
- **Haptics**, **Audio**, **Platform**, **MR Utility Kit**

**The Meta XR Simulator is NOT in the SDK.** It installs separately — which is
what step 6 is about, and why it can refuse.

---

## Step 1 · A new project

Unity Hub → **New project** → the **Universal 3D** template.

**Make sure the Android module is installed** before you start. It is the same
check as block 1 and it fails the same way: without it, Android never appears
in Build Settings and you find out at the very end.

---

## Step 2 · The Meta XR SDK from the Asset Store

Open the **Asset Store** and search for **Meta XR SDK**.

Press **Add to My Assets**.

You have to be **signed in to your Unity account** for that button to do
anything — if nothing seems to happen, that is why.

---

## Step 3 · Packages, provider, validation

Three things, in this order:

1. `Window > Package Manager` → find the **Meta** packages. **You do not need
   to install every one of them.**
2. `Project Settings > XR Plug-in Management` → set the provider to **OpenXR**.
3. **Project Validation → Fix All**, then **Meta XR → Apply All**.

---

## Step 3 · …and the one that breaks everything

**Check that the Oculus XR Plugin is NOT installed.**

It is the single most expensive mistake of the day: with it in the project
alongside OpenXR, the build runs, the headset shows your scene, and **nothing
tracks** — no head movement, no hands. There is no error message anywhere.

If your project has it, remove it before going on.

---

## Step 4 · A new scene, and three blocks

**Create a new scene and delete the `Main Camera`.** The Camera Rig brings its
own, and two cameras is a confusing scene.

Then `Meta XR Tools > Building Blocks`, and drag in **three**:

- **Camera Rig** — follows head and body; this is what replaces Main Camera
- **Interaction Rig** — brings hand tracking *and* the controllers
- **Grab Interaction** — drops in a cube you can pick up

---

## Step 5 · Wire the grab

Open the **`[BuildingBlock] Cube`** and select
**`[BuildingBlock] HandGrab Installation Routine AND`**.

Drag that selected object into **Grab Source**, inside the **Grab Interactable**
component.

**Put the pivot on the grabbable part of the model.** It is the point the hand
closes on, so a pivot in the middle of a long object makes it hang off your
fist at an angle that looks broken.

---

## Step 6 · Try the XR Simulator first

`Meta XR Tools` → enable the **Meta XR Simulator**.

It may ask to **install** itself first — accept, and open it. It is not part of
the SDK you added in step 2, so this is a separate download.

**If it will not install, skip straight to step 7.** The simulator is a
convenience, not a dependency: everything after this works on the headset
without it.

---

## Know how · Connecting the Quest over Link

1. Connect the headset to the PC with a **USB-C** cable.
2. Open **Meta Horizon Link** on the PC.
   **At CITM, do NOT try to install it** — run the **`oculus-reg.bat`** file on
   the desktop instead.
3. In the Quest's **Quick settings**, press **Link (PC)**.
4. Wait for the virtual environment, then press **Play** in Unity.

**Disable the Meta XR Simulator before you press Play.** Left on, Unity talks
to the simulator and the headset shows nothing.

---

## Step 7 · Make it your object

Swap the cube for the thing you are actually bringing:

- **Import your model** and assign it to the cube's **Mesh Filter**.
- **Create its material** if the model does not come with one, and change the
  material on the object too.
- Press **Edit Collider** on the **Box Collider** and **adjust it to the new
  model** — the collider is what your hand actually grabs, so a box still
  shaped like the old cube grabs thin air.

---

## Step 8 · Build and install

`File > Build Settings` → check your scene is in the **Scenes In Build** list.

Before building: headset connected by **USB-C**, **developer mode on**, and
**Always allow USB debugging** accepted in the headset.

**Option A — from Unity.** `File > Build Profiles` → **Android** (or Meta
Quest) → in **Run Device** press **Refresh** and pick your Quest 3 → **Build
And Run**. It installs and opens by itself.

**Option B — if the headset does not appear.** Open **Meta Quest Developer
Hub**, press **Add Build**, choose your `.apk`, and launch it from the headset:
**Library > Unknown Sources**.

---

## If something does not work

- **The app runs but nothing tracks** → the Oculus XR Plugin is installed
  alongside OpenXR (step 3). This is the one with no error message.
- **Android is not in Build Settings** → the Editor module is missing (step 1).
- **"Add to My Assets" does nothing** → you are not signed in to Unity (step 2).
- **The scene is black, or you see it from the floor** → Main Camera was not
  deleted, or Camera Rig was not added (step 4).
- **The object hangs off your hand at an angle** → the pivot is not on the
  grabbable part (step 5).
- **You grab nothing** → the Box Collider still has the cube's shape (step 7).
- **Headset shows nothing on Play** → the Meta XR Simulator is still enabled.
- **The headset never appears in Run Device** → use Option B (step 8).
