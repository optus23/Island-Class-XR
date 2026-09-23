---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 2 · Image Tracking

Create an image tracking app with Unity AR Foundation
that spawns **a 3D solution to deal with the green goblins**

**Block 1 — AR Foundation** · **Individual** · eight steps, no scripting

---

## Still no code

Exercise 1 put a real AR build on your phone. This one changes what triggers
it: instead of a detected **plane**, your object appears on a detected
**image** — a marker.

Everything again happens in the **Inspector**. What is new today is the **XR
Simulator**, which lets you test image tracking inside the Editor, without
building and without printing anything.

The goblins are green this time, and there are several of them. What you spawn
to deal with them is still entirely your choice.

---

## Know how · What image tracking is

The **AR Tracked Image Manager** creates a GameObject for every image it
detects in the environment.

It cannot detect anything on its own. You have to hand it a **reference image
library**: a compiled set of the images you want it to look for. It detects
those and nothing else.

The library can be swapped at runtime, but while the manager is enabled the
library must never be null.

---

## Step 1 · The AR Mobile template

Unity Hub → **New project** → **AR Mobile**, under *Core*.

**Make sure the Android module is installed** in your Editor — Unity Hub →
*Installs* → **Add modules** → *Android Build Support*, with **OpenJDK** and
**Android SDK & NDK Tools** inside it.

If that module is missing, Android will not even appear in Build Settings in
the next step, and you will be looking for the problem in the wrong place.

---

## Step 2 · Platform and provider

Two things, and they are not the same thing:

1. `File > Build Settings` → select **Android** → **Switch Platform**.
2. `Project Settings > XR Plug-in Management` → **Android** tab → confirm the
   **ARCore** checkbox is ticked.

Switching the platform reimports the whole project, so do it now while the
project is still empty. And the ARCore package being installed is not the same
as ARCore being **enabled** — the checkbox is what switches AR on.

---

## Step 3 · A new scene

**Create a new scene.** You are not modifying the template's demo this time;
you are building the scene yourself.

- **Delete the `Main Camera`** object. The AR rig brings its own camera, and
  two cameras is a confusing scene.
- Add **`AR Session`** and **`XR Origin (AR)`**.
- Then select the **XR Origin** and **Add Component → `AR Tracked Image
  Manager`**.

Leave the manager's fields empty for now. Step 4 makes the thing that goes in
them.

---

## Step 4 · The reference image library

In the Project window, right-click in `Assets` →
**`Create > XR > Reference Image Library`**.

Select the asset, press **Add Image**, and drop in an ordinary texture — PNG,
JPG, whatever you have.

**Pick an image with contrast and irregular detail.** The editor scores each
one as it processes it. A low score means a marker that only tracks in perfect
light at a perfect angle, and you will end up blaming the code for it.

---

## Step 5 · The XR Simulator

`Window > XR > AR Foundation > XR Environment`.

This opens a simulated room you can play the scene inside — image tracking
included — so you can test today's exercise **without building the APK and
without printing a marker**.

Go to the **XR Environment** tab and **Edit Environment**. If it will not let
you edit the one that is there, **duplicate the default environment** and edit
your copy.

---

## Step 6 · Put your marker in the simulated room

The environment already contains an image, hanging in the room.

- Select the **`Logo Quad`** object and **change its material** so it shows
  **the same image you added to your library** in step 4.
- Then — and this is the one everybody forgets — set that same image on the
  **Simulated Tracked Image** component as well.

The quad is what you *see*; the Simulated Tracked Image component is what the
simulator actually *tracks*. Change only the first and the room looks right
while nothing is ever detected.

---

## Step 7 · What spawns

Back to the **XR Origin** in the Hierarchy, and the **AR Tracked Image
Manager** you added in step 3.

- Drag your **reference image library** into its library field.
- Set the **prefab** it should spawn when the image is tracked.

That prefab is your answer to the green goblins. Any 3D object you like — build
it, download it, reuse the one from exercise 1.

**If the marker will be moving**, raise **Max Number Of Moving Images** to at
least 1. Left at 0, a marker held in the hand is detected once and then stops
following.

---

## Step 8 · Test, then build

**Test in Play Mode with the XR Simulator first.** It costs seconds; a build
costs minutes. Do not discover a wrong material by way of an APK.

Then `File > Build Settings`:

- check your scene is in the **Scenes In Build** list — *Add Open Scenes* if it
  is not, and this is the step people skip;
- press **Build** and pick a destination folder.

That is your APK. Install it on your phone and point it at the marker — on
paper or on another screen.

---

## If something does not work

- **Android is not in Build Settings** → the Editor module is missing (step 1).
- **The build has no AR at all** → the ARCore checkbox is not ticked (step 2).
- **The scene shows nothing** → you deleted the Main Camera but did not add
  `XR Origin (AR)` (step 3).
- **Nothing is ever detected in the simulator** → the image is on the quad's
  material but not on the **Simulated Tracked Image** component (step 6).
- **Detected, but the object never appears** → no prefab set on the manager
  (step 7).
- **Detected once, then it stops following** → **Max Number Of Moving Images**
  is 0 (step 7).
- **It only works in perfect light** → low-contrast marker; go back to step 4
  and check the quality score.
