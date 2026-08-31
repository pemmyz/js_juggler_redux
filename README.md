# js_juggler_redux

## Play it now: https://pemmyz.github.io/js_juggler_redux/


# Amiga Juggler Redux

A retro-inspired real-time 3D juggling demo built with **Three.js**. The scene recreates an Amiga-style juggler with reflective balls, a blue retro sky, a green/gold checkerboard floor, CRT scanlines, pixelated rendering, and an interactive control panel.

## Features

- Real-time 3D juggler animation
- Three juggling balls per juggler
- Procedural arm animation using simple IK
- Dynamic multi-juggler grid formations
- Real-time cubemap reflections
- Opaque, mirror-like reflective juggling balls
- Blue sky reflections on the upper portions of the balls
- Checkerboard floor reflections on the lower portions
- Adjustable reflection intensity and surface roughness
- Adjustable transmission and opacity
- Automatic flying camera
- Manual orbit camera controls
- Retro 320×240 pixelated rendering mode
- CRT scanline overlay and vignette
- FPS, juggler-count, ball-count, and cubemap HUD
- Preset formations from a single juggler up to 400 jugglers
- Fullscreen support

## Project Structure

The project is intended to use three files:

```text
amiga-juggler-redux/
├── index.html
├── style.css
├── script.js
└── README.md
```

### `index.html`

Contains the page structure, WebGL canvas, retro HUD, simulation controls, and keyboard/mouse control hints.

### `style.css`

Contains the visual styling for the CRT effect, HUD, control panel, buttons, sliders, vignette, and responsive layout.

### `script.js`

Contains the Three.js scene, juggler geometry, animation system, dynamic cubemap reflection pipeline, camera system, UI controls, and render loop.

## Requirements

- A modern web browser with WebGL support
- Internet access for the Three.js CDN used by `index.html`

The project currently loads Three.js r128 from cdnjs:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

No build system, package manager, or server-side runtime is required.

## Running the Demo

The simplest method is to open `index.html` in a modern browser.

For best compatibility, especially with browser security restrictions, use a local HTTP server.

### Python

From the project directory:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

### Node.js

If you have a simple static server available:

```bash
npx serve .
```

Then open the URL shown by the server.

## Controls

### Mouse

| Input | Action |
|---|---|
| Left mouse drag | Orbit camera |
| Mouse wheel | Zoom |

Using the mouse automatically disables Flying 3D Camera mode so the camera can be controlled manually.

### Keyboard

| Key | Action |
|---|---|
| `Space` | Pause / resume animation |
| `C` | Toggle Flying 3D Camera |
| `R` | Reset camera |
| `F` | Toggle fullscreen |

## Simulation Controls

### Multiverse Presets

The control panel provides several predefined grid sizes:

| Preset | Formation | Total Jugglers |
|---|---|---:|
| 1 (Solo) | 1×1 | 1 |
| 25 (5×5) | 5×5 | 25 |
| 20 (Row) | 20×1 | 20 |
| 100 (10×10) | 10×10 | 100 |
| 400 (Stress) | 20×20 | 400 |

Each juggler has three balls, so the 400-juggler preset creates **1,200 balls**.

The demo also automatically switches from the initial 1×1 formation to the 5×5 formation approximately four seconds after startup.

### Grid Configuration

- **Columns (X):** 1–25
- **Rows (Z):** 1–25
- **Spacing:** 2.0–6.0 m
- **Wave Delay:** 0.00–0.50 s

The wave delay offsets the animation between jugglers, creating a coordinated wave effect across the grid.

### Mirror Reflection Optics

- **Reflection Power:** 0.20×–2.50×
- **Surface Roughness:** 0.00–0.50
- **Glass Transmission:** 0.00–1.00
- **Base Opacity:** 0.20–1.00

The default configuration uses a fully opaque, mirror-like appearance:

```text
Opacity:       1.00
Transmission:  0.00
Metalness:     0.90
Roughness:     0.00
IOR:           1.52
Reflection:    1.05
```

Although the UI calls the material "glass," the default material is deliberately opaque rather than transparent.

## Camera & Display

### Flying 3D Camera

The automatic camera continuously flies around the juggler formation while dynamically adapting its orbit radius to the size of the grid.

The flight speed can be adjusted from:

```text
0.2× to 3.0×
```

### Retro Resolution

When **320×240 Pixelate** is enabled, the renderer internally renders at:

```text
320 × 240
```

The canvas is displayed using pixelated image rendering to create a low-resolution retro aesthetic.

When disabled, the renderer uses the browser window dimensions.

### CRT Effects

The CRT overlay adds horizontal scanlines across the screen, while the vignette darkens the edges of the image.

## Rendering & Reflection System

The demo uses a `THREE.WebGLCubeRenderTarget` with a resolution of:

```text
256 × 256 × 6 faces
```

A `THREE.CubeCamera` captures the environment around the primary juggling ball.

Before the cubemap is rendered, all juggling balls are temporarily hidden. This prevents the balls from recursively reflecting themselves and each other during the cubemap capture.

After the cubemap has been updated, the balls are made visible again and the final scene is rendered.

The reflective ball material uses `THREE.MeshPhysicalMaterial` with:

- High metalness
- Zero default roughness
- Zero default transmission
- Full opacity
- Dynamic cubemap environment mapping
- Clearcoat

This produces polished, opaque reflective spheres rather than transparent glass balls.

## Scene

The environment consists of several main components.

### Sky

A large inverted sphere creates a procedural blue gradient sky.

The gradient transitions from a deeper blue overhead to a much lighter blue near the horizon.

### Checkerboard Floor

The floor uses a procedurally generated 2×2 texture with:

- Green
- Gold

The texture is repeated across a large 1000×1000 unit plane.

Nearest-neighbor filtering is used to retain the hard-edged retro appearance.

### Lighting

The scene uses:

- Ambient light
- A directional sunlight source with shadows
- A blue directional fill light

The blue fill light helps emphasize the blue environment reflected by the juggling balls.

## Juggler Model

The juggler is assembled procedurally from simple Three.js primitives.

### Body

- Cylindrical torso
- Spherical torso caps
- Spherical head

### Limbs

Arms and legs are constructed from cylindrical bones and spherical joints.

The arms use a lightweight two-segment inverse-kinematics system to continuously move the hands toward animated target positions.

### Colors

The default palette includes:

- Red torso
- Very dark head
- Light gray limbs
- Blue-gray joints
- White reflective balls

## Juggling Animation

Each juggler continuously throws three balls in a looping cascade pattern.

The juggling cycle is:

```text
2.4 seconds
```

Ball trajectories are calculated procedurally using interpolated positions and an arc function.

The balls travel between the left and right sides of the juggler while rising to a peak height of approximately:

```text
4.25 m
```

Each juggler can have a different animation phase using the configurable wave delay.

This creates a synchronized but offset animation when multiple jugglers are present.

## Performance

The demo is designed around a retro low-resolution rendering style, but the number of objects can become substantial at large formations.

The stress preset creates:

```text
20 × 20 = 400 jugglers
400 × 3 = 1,200 juggling balls
```

Performance can vary significantly depending on the browser and GPU.

The dynamic cubemap is updated every frame at 256×256 resolution with six cube faces, so reflection rendering can become a significant workload.

For better performance:

- Use 320×240 pixelated mode
- Reduce the number of jugglers
- Reduce reflection intensity if desired
- Use a lower grid size
- Disable unnecessary browser extensions or GPU-heavy applications

## Dependencies

The project has no local JavaScript dependencies.

It relies on:

- [Three.js](https://threejs.org/)
- Three.js r128 loaded from cdnjs

Because Three.js is loaded from a CDN, an internet connection is normally required when opening the page.

## Browser Compatibility

A browser with WebGL support is required.

Recommended browsers include recent versions of:

- Chromium / Chrome
- Firefox
- Microsoft Edge
- Safari

Performance depends heavily on GPU capabilities, particularly when using large juggler formations and dynamic cubemap reflections.

## Technical Notes

### Shared Resources

Most character geometry and materials are shared between instances to reduce unnecessary resource duplication.

### Dynamic Grid

Changing the grid settings destroys the current juggler instances and rebuilds the formation using the new configuration.

### Camera Adaptation

When Flying 3D Camera mode is disabled, the camera automatically increases its distance for larger formations.

### Shadows

Shadow mapping is enabled using `THREE.BasicShadowMap`.

The directional light uses a 1024×1024 shadow map.

## Customization

The main visual and simulation constants are located near the beginning of `script.js`.

For example:

```javascript
const SKY_COLOR = 0x6E9DE5;
const CHECKER_GREEN = '#187A24';
const CHECKER_GOLD  = '#D4AF0E';

const TORSO_COLOR = 0xC81414;
const HEAD_COLOR  = 0x111215;
const LIMB_COLOR  = 0xBAC1CE;
const JOINT_COLOR = 0x8892A2;

const JUGGLE_PERIOD = 2.4;
```

The main runtime configuration is stored in the `config` object.

This makes it relatively easy to change:

- Grid dimensions
- Spacing
- Animation delay
- Reflection intensity
- Roughness
- Transmission
- Opacity
- Camera behavior
- Flight speed
- Pixelated rendering

## Credits

Created as a browser-based retro 3D experiment inspired by the classic **Amiga Juggler** aesthetic.

Built with **Three.js** and standard HTML, CSS, and JavaScript.

## License

No license is specified by the supplied project files.

If this project is published publicly, add an explicit license file such as `LICENSE` and update this section accordingly.
