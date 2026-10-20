---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 2 · Locomotion and passthrough

Create a **mixed reality app** with Meta Building Blocks
to **find the giant robot** — move in VR, then switch to MR with a button

**Block 2 — Meta Building Blocks** · **Group** · eight steps, no scripting

---

## The robot has disappeared

It is not in the virtual world any more. **It is in the physical one**, so you
are going to have to look around your actual room for it.

That is the whole exercise in one line: **move around in VR**, and then
**switch to passthrough with a button** to see where you really are.

**No code today either.** The mode switch is done with Building Blocks and
events in the Inspector, not with a script.

---

## Know how · There is no passthrough in the simulator

The Meta XR Simulator is excellent for steps 5 and 6 — teleport, slide, turn —
and **useless for step 7**, because it cannot show you your room.

So plan for it: build the locomotion in the simulator if you like, but **the
mode switch has to be tested on the headset over Link or in a build.**

And the usual trap: **disable the Meta XR Simulator before pressing Play** with
the headset connected, or Unity talks to the simulator and the headset stays
dark.

---

## Steps 1 to 4 · The same as last day

You already know these from exercise 1. If your project from that class still
works, open it and skip to step 5.

1. **Unity Hub → New project → Universal 3D**, with the **Android module**.
2. **Asset Store → Meta XR SDK → Add to My Assets** (signed in to Unity).
3. **Package Manager** → the Meta packages; **XR Plug-in Management → OpenXR**;
   **Project Validation → Fix All**; **Meta XR → Apply All**.
   **The Oculus XR Plugin must NOT be installed** — with it you get no tracking
   and no error.
4. **New scene, delete the `Main Camera`**, then `Meta XR Tools > Building
   Blocks`.

---

## Step 4 · …but three different blocks

This time drag in:

- **Camera Rig**
- **Interaction Rig** — hands and controllers
- **Passthrough** — the one that is new today

And build something to move around in: **add a cube and create a floor**
(`GameObject > 3D Object > Plane`). Without a floor there is nowhere to
teleport to, and step 5 has nothing to work on.

---

## Step 5 · Teleport on a plane

Go to **`OVRInteractionComprehensive`**, **right-click** → **Interaction SDK**
→ change the interaction type to **Plane**. Then press **Create**.

That turns your floor into a surface you can teleport onto. If a warning
appears first, press **Fix All** and then Create.

**The plane is what you teleport onto**, so if nothing happens when you point
at the ground, this is the step to come back to.

---

## Step 6 · Swap the controller mode

In **both** the left and the right interactors:

- **disable** `ControllerSliderInteraction`
- **enable** `TeleportControllerInteraction`

**Do it on both sides.** Doing one is the commonest mistake here, and it gives
you a headset where one hand teleports and the other slides — which reads as a
bug in the SDK rather than as a checkbox you missed.

---

## Know how · The locomotion the SDK gives you

Seven types. You use the first three today:

| Type | What it does |
| --- | --- |
| **Teleport** | Puts you instantly at a distant point |
| **Turn** | Changes your facing without moving you |
| **Slide** | Free movement with the joystick |
| Step | Quick steps to adjust your position |
| Telepath | Moves you smoothly to a distant point |
| Climbing | You pull yourself along surfaces |
| Walking Stick | You push virtual sticks against the floor |

The sample scene **`LocomotionExamples`** demonstrates the rest.

---

## Step 7 · The button that switches mode

Passthrough is already in the scene from step 4. Now make it switchable.

Add the Building Block **Controller Buttons Mapper**, then:

- **Add a Button Click action**; in the **input manager** pick the button you
  want.
- Add a **callback**: drag the **passthrough GameObject** in → `enabled` →
  **false**.
- **Repeat with a second button**, with `enabled` → **true**, so you can get
  back.

One button takes you to VR, the other to passthrough.

---

## Step 7 · …and stop moving in your own room

Optional, and it is the detail that makes it feel finished: while you are in
passthrough you are standing in your actual room, so sliding and teleporting
make no sense.

Same mechanism, no script: on the **passthrough** button's events, also set the
locomotion GameObjects → `GameObject > SetActive > false`, and on the **VR**
button's events set them back to **true**.

---

## Know how · Connecting the Quest over Link

1. In the headset: `Settings > System > Quest Link` → on.
2. On the PC: open **Meta Horizon Link**, sign in, connect the **USB-C** cable.
   **At CITM, do not install it** — run `oculus-reg.bat` from the desktop.
3. In Meta Horizon Link: **set it as the active OpenXR runtime**, turn on
   **Developer Runtime Features**, and inside it **Passthrough over Meta Quest
   Link**.
4. In the Quest's **Quick settings**, press **Link (PC)**, then **Play** in
   Unity.

**Black instead of your room?** Point 3 is why: passthrough over Link is its
own switch, and it is off by default.

---

## Step 8 · Build and install

`File > Build Settings` → your scene in the **Scenes In Build** list.

Headset on **USB-C**, **developer mode on**, **Always allow USB debugging**
accepted in the headset.

**Option A — from Unity.** `File > Build Profiles` → **Android** (or Meta
Quest) → **Run Device** → **Refresh** → your Quest 3 → **Build And Run**.

**Option B — if the headset does not appear.** **Meta Quest Developer Hub** →
**Add Build** → your `.apk`, then **Library > Unknown Sources** in the headset.

Test all of it in the build: teleport, turn, slide, and both buttons.

---

## If something does not work

- **Nothing tracks** → the Oculus XR Plugin is installed next to OpenXR
  (step 3). No error message anywhere.
- **Teleport does nothing** → the plane was never created (step 5), or the
  floor has no collider.
- **One hand teleports and the other slides** → you only did step 6 on one
  side.
- **Passthrough shows black** → *Passthrough over Meta Quest Link* is off, or
  the Skybox Material is not **None**.
- **Passthrough never appears in the simulator** → it cannot. Use the headset.
- **The headset stays dark on Play** → the Meta XR Simulator is still enabled.
- **The button event cannot find `enabled`** → pick the passthrough GameObject
  itself, not its parent.
