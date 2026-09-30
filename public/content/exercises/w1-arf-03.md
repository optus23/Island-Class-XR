---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Exercise 3 · AR Foundation Samples

The problem is **solved** — so now you are free to use the samples

Create an app from Unity's **AR Foundation Samples**
and **test every feature** in it

**Block 1 — AR Foundation** · **Group** · three steps, no scripting

---

## What today is

The first two exercises had you build a scene by hand, one manager at a time.
Today you open the **official samples project** instead: a single Unity project
that already contains a working scene for every feature AR Foundation has.

You are not integrating anything into your own project today. You are opening
theirs, running it on your phone, and finding out **what the platform can
actually do** — which is the part you need before block 2.

---

## If you are behind

Exercises 1 and 2 have a solved project:

**[`github.com/pomedas/ArMobile`](https://github.com/pomedas/ArMobile)**

Use it two ways:

- as the **solution** to exercises 1 and 2, to compare against what you built;
- as the **starting point** for this block's hand-in, if you did not manage to
  finish them.

Nobody should be blocked on the hand-in because exercise 1 or 2 did not come
out. Take the project and carry on.

---

## Step 1 · Download the samples

Get the open source project from Unity's GitHub: **`arfoundation-samples`**.

**Make sure you pick the right branch.** This is the whole step and it is the
one that goes wrong: the repository keeps one branch per AR Foundation version,
and a branch that does not match your Editor gives you a project full of
compile errors before you have done anything.

**Check which AR Foundation version your project uses, and take the branch
named after it.** The branches are named for the version they target, and the
list moves with every release — the right one today is not the right one next
year.

---

## Step 2 · Open it from disk

Unity Hub → **Add** → **Add project from disk**, and point it at the folder you
just downloaded.

**Check your Android modules are installed** before opening it — Unity Hub →
*Installs* → **Add modules** → *Android Build Support*, with **OpenJDK** and
**Android SDK & NDK Tools** inside.

It is the same check as exercises 1 and 2, and it fails the same way: without
the module, Android never appears in Build Settings.

---

## Know how · Check all the features

Open the sample scenes and try them:

- **Face Tracking**
- **Body Tracking** — *iPhone only*
- **Simple Occlusion**
- **Ambient Intensity**

Not everything runs on every phone. A feature that does nothing on your device
is usually the device, not your build.

---

## Know how · And more

- **Point Cloud**
- **Configuration**
- **Anchors**
- **Plane detection** — the one you already built by hand in exercise 1

Seeing it here next to the others is the point: what you spent a session
wiring up is one scene in a catalogue, and the catalogue is what block 2
starts from.

---

## Know how · Test in editor mode

Before making a build, run it in the Editor.

Search for **`menuloader`** in the project search bar and open that scene.

**That scene is what links all the other ones together.** Open any single
sample scene on its own and you get that one feature with no way back to the
menu; open `menuloader` and you get the app as it is meant to be navigated.

---

## Step 3 · Test, then build

**Test in Play Mode with the XR Simulator first.**

Then `File > Build Settings`:

- make sure your scene is in the **Scenes In Build** list;
- press **Build** and pick a destination folder.

That is your APK. Install it on your phone.

Congratulations — that is the block finished.

---

## If something does not work

- **The project is full of compile errors on first open** → wrong branch
  (step 1). Check it against your Editor version.
- **Android is not in Build Settings** → the Editor module is missing (step 2).
- **A sample scene opens but there is no menu** → you opened the scene
  directly instead of `menuloader`.
- **Body tracking does nothing** → it is iPhone only. Not your build.
- **A feature does nothing on your phone** → not every device supports every
  feature; try another sample before assuming it is broken.
