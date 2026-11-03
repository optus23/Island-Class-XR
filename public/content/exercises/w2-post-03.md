---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 3 · Mixed Reality Utility Kit

Build a **mixed reality app** with the **Meta Mixed Reality Utility Kit**:
scan your real room, bring it into Unity, and pick one of the MRUK samples
to carry into your group's project

**Block 2: Meta Building Blocks** · **Group** · eight steps

---

## The robot has gone, and the room is still here

The giant robot is out of the way, so the adventure can go on. What changes
today is **where** it goes on: not in a virtual scene you built, but **in the
room you are standing in**.

That is what the **Mixed Reality Utility Kit** is for. You scan the room once
with the headset, and MRUK hands Unity the walls, the floor, the ceiling and
the furniture as geometry your app can use: things can bounce off your real
table, hide behind your real sofa, or replace your real wall with a virtual one.

---

## Know how · What MRUK actually gives you

MRUK sits on top of the Scene API and saves you writing the plumbing yourself.
Three groups of things:

- **Scene queries**: where is the floor, which surfaces are walls, is there
  room for this object here.
- **Graphical helpers**, the ones you use today: `EffectMesh` builds a mesh
  over the real room, and the spawners place prefabs on real surfaces.
- **Development tools**: debug views, and fake rooms so you can work without
  putting the headset on.

**It is not a Building Block.** It is its own package, `Meta MR Utility Kit`,
installed next to the Meta XR SDK.

---

## Steps 1 to 3 · The same as the last two days

If your project from exercise 2 still opens and runs, use it and skip to step 4.

1. **Unity Hub → New project → Universal 3D**, with the **Android module**.
2. **Asset Store → Meta XR SDK → Add to My Assets** (signed in to Unity), then
   install it from the **Package Manager**.
3. **Package Manager** → check the Meta packages are there; **Project Settings
   → XR Plug-in Management → OpenXR**; **Project Validation → Fix All**;
   **Meta XR → Apply All**.
   **The Oculus XR Plugin must NOT be installed**: with it you get no tracking
   and no error message.

---

## Step 3 · …and the versions you should see

In the reference project the Meta packages read **201.0.0**: All-in-One SDK, Core SDK,
Interaction SDK, Interaction SDK Essentials, Haptics SDK, Platform SDK and
**Meta MR Utility Kit**. Audio SDK and Voice SDK sit at 85.0.0, which is normal.

**Not every Meta package has to be installed.** What today needs is the
All-in-One SDK (or Core) and the **MR Utility Kit**.

Write down the version you end up with. Step 7 has an error whose likeliest
cause is a version mismatch, and you will want to know yours.

---

## Step 4 · Every developer toggle in Meta Horizon Link

On the PC, open **Meta Horizon Link → Desarrollador** and turn on **all seven**:

1. Automatic Meta Horizon Link software updates
2. Developer runtime features
3. Passthrough over Meta Horizon Link
4. Camera API passthrough permissions
5. Eye tracking over Meta Horizon Link
6. Natural facial expressions over Meta Horizon Link
7. **Environment data over Meta Horizon Link**

**Number 7 is the one today depends on.** It is what lets the editor read the
room you scanned. Without it MRUK finds no room and your scene comes up empty,
with nothing in the console to tell you why.

---

## Step 5 · The headset in developer mode

You did this in class 1, so this is a check rather than work: **developer mode
on**, the **USB-C data cable** connected, and **Always allow USB debugging**
accepted inside the headset.

**At CITM, do not install Meta Horizon Link**: run `oculus-reg.bat` from the
desktop.

You need the headset on your head for the next step, so get it connected now.

---

## Step 6 · Scan the room (Space Setup)

**On the headset**, not through the PC:

`Settings` → `Environment Setup` → **Space Setup**

Walk the room and mark the walls, the floor, the ceiling and the large pieces
of furniture. What comes out of this is the **Scene Model**, and it is the only
source of the geometry everything below uses.

**Scan the room you are going to demo in.** An old scan of a different room is
the single commonest reason a sample looks broken: the mesh is there, it just
does not match the place you are standing in.

---

## Step 7 · Import the MRUK samples

They do not come with the package. They live in their own repository:

**`github.com/oculus-samples/Unity-MRUtilityKitSample`**

Download or clone it, then **copy the `MRUKSamples` folder into your project's
`Assets` folder**. In the reference project it ends up at `Assets/Samples/MRUKSamples`.

Fourteen folders arrive: `Basic`, `BouncingBall`, `DestructibleMesh`,
`EnvironmentPanelPlacement`, `FloorZone`, `KeyboardTracker`, `MultiSpawn`,
`NavMesh`, `PassthroughRelighting`, `QRCodeDetection`, `SharedAssets`,
`SpaceMap`, `StartScene`, `VirtualHome`.

---

## Step 7 · The compile error, and the one word that fixes it

As soon as they land, Unity goes red:

```
Assets/Samples/MRUKSamples/BouncingBall/Scripts/BouncingBallMgr.cs(35,43):
error CS0117: 'OVRInput' does not contain a definition for
'GetLocalControllerAngularVelocityCw'
```

**Open the script, go to line 35, and delete the `Cw`:**

- before: `OVRInput.GetLocalControllerAngularVelocityCw(...)`
- after: `OVRInput.GetLocalControllerAngularVelocity(...)`

**A compile error blocks the whole project**, not just that one scene, so
nothing else in this list works until the console is at zero errors.

---

## Know how · Why that error is there at all

The samples repository is built against a **newer SDK than the one you
installed**: the project here is on 201.0.0 and the repository's latest release
targets 207.0.0. Meta renamed the method in between.

This is the only time in the whole block you open a `.cs` file, and it is one
word. If you would rather not touch it at all, the alternatives are: **ask in class for the
fixed script**, or **delete the `BouncingBall` folder** if you are not
going to use that sample.

---

## Step 7 · Open `MRUKBase` and point it at your room

Open `Assets/Samples/MRUKSamples/Basic/MRUKBase`. In the Hierarchy you get
`OVRCameraRig`, `MRUK`, `EffectMesh`, `[BuildingBlock] Passthrough` and
`[BuildingBlock] Real Hands`.

Select the **`MRUK`** object → **Scene Settings** → **Data Source** →
**`Device`**.

| Option | Where the room comes from |
| --- | --- |
| **Device** | Your own scan. **This one.** |
| Prefab | A canned room from the package |
| Device With Prefab Fallback | The default: your scan, a canned room if there is none |
| Json | A room saved to a file |
| Device With Json Fallback | Your scan, the file if there is none |

---

## Step 7 · The four samples

Run them in this order. Each one is a different answer to "what do I do with a
room".

| Scene | What to look at |
| --- | --- |
| **MRUK Base** | `EffectMesh` paints volumes over your real walls and furniture |
| **Bouncing Ball** | The same mesh used as **colliders**: the ball bounces off your real room |
| **Virtual Home** | Your room **replaced** by a virtual one, same shape. VR with your own walls |
| **Destructible Mesh** | The same again, except you can break it |

In **Bouncing Ball** the right hand trigger grabs and the right index trigger
throws.

---

## Step 7 · Change one thing in the one you pick

**Pick one of the four** and make it yours. All of these are Inspector work, no
script:

- **MRUK Base**: swap the `EffectMesh` material for a semitransparent one so
  the passthrough shows through, or change which surfaces it covers.
- **Virtual Home**: change the prefabs the spawner drops onto each kind of
  surface, so the virtual room is furnished your way.
- **Bouncing Ball**: change the ball, its material, its physics material.
- **Destructible Mesh**: change what the broken pieces look like.

The one you pick is what goes into the group's build.

---

## Step 8 · Build and install

`File > Build Settings` → your scene is in the **Scenes In Build** list.
Headset on **USB-C**, developer mode on, **Always allow USB debugging**
accepted.

**Option A: from Unity.** `File > Build Profiles` → **Android** (or Meta
Quest) → **Run Device** → **Refresh** → your Quest 3 → **Build And Run**.

**Option B: if the headset never appears.** **Meta Quest Developer Hub** →
**Add Build** → your `.apk`, then **Library > Unknown Sources** in the headset.

**Try it in a different room than the one you built it in.** If it still makes
sense there, it is finished.

---

## The block's hand-in

This is the last exercise of the block, so what you hand in is **the block**,
not this class: **one APK per group with the three activities in it**, plus the
documentation. The hand-in itself goes on Atenea, on the session its flag
stands on, not here.

Say in the documentation **which sample you picked** and **what you changed in
it**, and note the **Meta package version** you built against.

---

## If something does not work

- **The console is red and nothing runs** → the `Cw` fix in step 7. It blocks
  the whole project.
- **The scene loads but the room is empty** → `Data Source` is not `Device`, or
  *Environment data over Meta Horizon Link* is off (step 4), or there is no
  scan on this headset (step 6).
- **The room is there but it is the wrong shape** → an old Space Setup. Scan
  again, in the room you are actually in.
- **Nothing tracks** → the Oculus XR Plugin is installed next to OpenXR
  (step 3). No error message anywhere.
- **The headset stays dark on Play** → the Meta XR Simulator is still enabled.
- **The headset does not appear in Run Device** → Option B, and check *Always
  allow USB debugging* was accepted inside the headset.
