---
marp: true
theme: xr-island
paginate: true
---

<!-- _class: lead -->

# Activity · Mono / Stereoscopic

Record the same 360° shot twice — once flat, once in stereo —
and **watch the difference in a headset**

**Voluntary** · sixteen steps · Unity Recorder

---

## What you get out of this

By the end you will be able to:

- record a **360° video straight out of Unity**, with no plugin and no camera
  rig of your own;
- record the **same shot in stereo**, so each eye sees the scene from a
  slightly different place;
- get both files into a **Meta Quest 3** and feel, rather than read, what
  stereoscopy actually adds.

The point is not the recording. The point is the **comparison**: two files of
the same scene that differ in exactly one thing.

---

## ⚠ Read this before you create the project

**Pick the `3D (Built-In Render Pipeline)` template.** Not Universal 3D, not
HDRP.

Unity Recorder **does not support stereoscopic 360 capture on any Scriptable
Render Pipeline**. Under URP or HDRP the *Record in Stereo* checkbox still
ticks, the file still comes out top-and-bottom — and **both halves are
identical**. You get a stereo-shaped file with no stereo in it.

Nothing warns you. You would only find out with the headset on, which is the
worst possible moment.

---

## Step 1 · A new project, Built-In

Unity Hub → **New project** → **3D (Built-In Render Pipeline)**.

Call it something you will recognise in a week.

This is a throwaway project whose only job is to be recorded, so do not reuse
your AR Foundation one: that is URP, and the previous slide is why that
matters.

If you already have a nice-looking Built-In scene from another subject, use
that instead — the better the scene, the more obvious the result.

---

## Step 2 · Install the Recorder

`Window > Package Manager` → top-left dropdown → **Unity Registry** → search
**Recorder** → **Install**.

The current line is **Recorder 5.1.x**. It is not shipped with the Editor; it
has to be installed per project.

One limitation worth knowing now: the Recorder **only works in the Editor, in
Play mode**. It is not something you can ship inside a build.

---

## Step 3 · Open the Recorder window

`Window > General > Recorder > Recorder window`.

Dock it somewhere you can see while the game runs — next to the Game view is
the usual choice. You will be reading it during playback.

Unity restores whatever you set last time you recorded, which is convenient
right up until the moment you assume a field is empty. Read the panel rather
than trusting your memory of it.

---

## Step 4 · Add Recorder → Movie

Press **+ Add Recorder** and choose **Movie**.

A Recorder is one output. The list can hold several at once — you could record
the flat and the stereo versions in one pass — but do not: two Recorders on a
360 capture will fight for the same camera.

One Recorder, two passes. It is slower and it is the version that works.

---

## Step 5 · Frame Rate: Constant

In the recording-session panel at the top, set **Playback** to **Constant** and
**Target FPS** to **30**.

**Constant** tells the Recorder to produce a file at exactly that frame rate,
slowing the Editor down if it cannot keep up. **Variable** does the opposite:
it keeps the Editor at full speed and drops frames.

A 360 capture is heavy — it renders your scene six times per frame. Constant is
what stops that turning into a stuttering video.

---

## Step 6 · Source: 360 View

Under **Capture**, set **Source** to **360 View**, and **Camera** to
**MainCamera**.

`MainCamera` means "whatever object carries the MainCamera tag". Use the one
the scene already has; adding a second camera just to record buys you nothing
and gives you a tag clash to debug.

---

## Step 6 · …what 360 View actually does

It does **not** need a special camera or a 360 rig.

For every frame, the Recorder points your ordinary camera in six directions,
renders a **cube map** out of those six views, and then unwraps that cube into
the flat 2:1 image a 360 player expects (an *equirectangular* projection).

Two consequences you will meet later:

- the camera's **own rotation is being driven by the Recorder** while it
  captures — see step 13;
- the recording costs six renders a frame, so it is slow.

---

## Step 7 · Output Dimensions 4096 × 2048

Set **W** to `4096` and **H** to `2048`.

**The width must be exactly twice the height.** An equirectangular image covers
360° across and 180° top to bottom, so a 2:1 frame is the format, not a
preference. Get it wrong and every player stretches the result.

4096 × 2048 is a sensible classroom compromise. Remember that this resolution
is wrapped around your whole head: only a fraction of those pixels is in front
of your eyes at any moment, which is why 360 video always looks softer than
you expect.

---

## Step 7 · …and Cube Map Size

Leave **Cube Map Size** at **2048**.

This is the side length, in pixels, of each of the six cube faces the Recorder
renders before unwrapping them. It is the *real* resolution of the capture —
the Output Dimensions above are just what that cube gets flattened into.

- Too small, and the 360 looks soft however large the output is.
- Too large, and the recording crawls, with no visible gain.

A face roughly **half the output width** is the usual rule of thumb, which is
where 2048 comes from.

---

## Step 8 · First take: Record in Stereo OFF

Find **Record in Stereo** and leave it **unchecked**.

This first file is the **monoscopic** one: one image, sent to both eyes. In the
headset it will look like standing inside a photograph — you can look around,
but everything sits at the same flat distance.

That is the control. You need it to have something to compare against, so
resist the urge to skip straight to the interesting one.

---

## Step 9 · Format: H.264 MP4, High

Under **Output Format**, choose **H.264 MP4** and set **Quality** to **High**.

H.264 is the safe answer here: YouTube ingests it without re-encoding
surprises, and the Quest plays it back in hardware. An exotic codec will cost
you a working afternoon for no visible gain.

**Include Audio** only if your scene actually has sound. For this comparison it
adds nothing.

---

## Step 10 · File name: use a wildcard

Under **Output File**, set the **File Name**, then open the **+ Wildcards**
menu and add **`<Take>`**.

**Do not skip this.** The Recorder writes to the same path every time, so
without a wildcard your second take silently overwrites your first — and your
first take is the monoscopic video you need for the comparison.

`<Take>` is a counter the Recorder increments after every recording, so
`MonoStereo_<Take>` gives you `MonoStereo_001`, `MonoStereo_002`, and no
lost work. `<Time>` and `<Date>` work too.

Set **Path** to somewhere you can find from a file browser.

---

## Step 11 · Tick Exit Play Mode

At the top of the window, just under **START RECORDING**, tick **Exit Play
Mode**.

With it on, stopping the recording also leaves Play mode. Without it, the game
keeps running after the file closes and it is easy to think the recording is
still going.

Small thing. It removes one way of ending up with a ten-second clip you thought
was a minute.

---

## Step 12 · Something worth looking at

You need a scene with **depth**: objects close to the camera **and** far away.

A single cube on an empty plane is enough to pass, but it is a poor test —
stereo depth is most obvious on things within a couple of metres, and barely
present on a distant horizon. If the only object is far away, your two files
will look identical and you will conclude the exercise failed.

So: a few objects at different distances, at least one of them near. An
existing environment from another subject beats anything you assemble in five
minutes.

---

## Step 13 · Record the first take

Press **START RECORDING**, then move the camera through the scene — pass close
to something, then pull away. Stop after twenty or thirty seconds.

You can drag the camera's Transform in the Scene view while Play mode runs, or
drive a character if the scene has one. Either is fine.

**Move slowly.** Speed that looks normal on a monitor is nauseating in a
headset, where the motion fills your whole field of view.

---

## Step 13 · …never rotate the camera

**Translation yes. Rotation never.** This is the one rule that matters.

In a 360 video the viewer's head *is* the camera. Rotate it in Unity and the
image turns while the wearer's neck does not — which reads exactly like
somebody taking your head in their hands and turning it. It is one of the
fastest ways to make a person feel ill in VR.

There is a technical reason too: 360 View is already rotating that camera to
build its cube map (step 6). Your own rotation fights it.

---

## Step 14 · Second take: Record in Stereo ON

Tick **Record in Stereo** and record **the same move again**, as closely as you
can.

The Recorder now renders two views and stacks them in one frame: **left eye on
top, right eye on the bottom**. That is the *top/bottom layout* the metadata
tool will ask you about later, so remember the phrase.

**Stereo Separation** is the gap between those two eyes — the interpupillary
distance. The default **0.065** is 65 mm, the human average. Push it up and
depth is exaggerated into a toy-town look; pull it down and the scene flattens
back towards mono.

---

## Step 14 · …two things people get wrong here

**Flip Vertical is not the stereo layout.** It flips the whole output image
upside down, and exists for systems that write video the other way up. Leave it
off; if your footage comes out inverted, that is the switch.

**The two takes have to match.** The comparison only says something if the
camera travels the same path at the same speed. If your two files differ in
route as well as in stereo, you cannot tell which difference you are looking
at.

---

## Step 15 · Spatial Media Metadata Injector

Download it from Google's **spatial-media** repository, releases page — the
**360 Video Metadata Tool** for Windows or Mac.

A 360 file is an ordinary MP4. Nothing inside the pixels says "this is
spherical"; that lives in a metadata tag, and Unity does not write it. Upload
the file as it is and YouTube shows you a flat, distorted rectangle.

For each video: **Open** → tick the boxes → **Inject metadata** → save the new
file it writes beside the original.

---

## Step 15 · …which boxes to tick

**Both files:** `My video is spherical (360)`.

**The stereo file only, and additionally:**
`My video is stereoscopic 3D (top/bottom layout)` — which is exactly how the
Recorder stacked the two eyes in step 14.

Leave **spatial audio (ambiX ACN/SN3D)** alone. That is for ambisonic sound,
and you have none.

Inject into the monoscopic file too. Without the spherical tag it is not a 360
video, it is a very wide photograph of one.

---

## Step 16 · Get them into the headset

**Route A — YouTube (recommended).** Upload both injected files to your
channel, unlisted is fine. Open YouTube inside the Quest 3 and watch each one.

**Route B — sideload.** Copy both files straight onto the headset's storage
over USB, then open **Library → Videos** (or a player such as DeoVR) and tell
the player they are 360, mono or stereo. **No injector needed on this route** —
you are telling the player directly instead of tagging the file.

Every VR player puts those controls somewhere different. Expect to hunt.

---

## Step 16 · …how you know it worked

**On a desktop browser**, open your uploaded video and **drag it with the
mouse**. If the view turns, YouTube read the spherical tag and the injection
worked. If you are looking at a static distorted rectangle, it did not — go
back to step 15.

Give YouTube a few minutes after upload: the 360 treatment appears only once
processing finishes, so a video that looks flat immediately after upload may
simply not be ready.

---

## Now actually compare them

Put the headset on and watch both, one after the other, paying attention to the
**near** objects.

- Where does each one sit in space?
- Can you tell how far away anything is in the monoscopic file?
- Which one makes you want to reach out?
- Which is more comfortable over a couple of minutes?

Write down what you noticed. That observation is the point of the activity —
the two files are only the apparatus.

---

## If something does not work

- **Both eyes look identical in the stereo file** → the project is URP or
  HDRP. Recorder cannot do stereo 360 on an SRP (step 1).
- **YouTube shows a flat distorted rectangle** → metadata missing, or still
  processing (step 15).
- **The image is stretched** → Output Dimensions are not 2:1 (step 7).
- **Your first take disappeared** → no wildcard, second take overwrote it
  (step 10).
- **The video looks soft** → Cube Map Size too low (step 7).
- **It makes you feel ill** → the camera rotated, or moved too fast (step 13).
- **Visible seams in the 360** → an HDRP project with post-processing; another
  reason for Built-In.
