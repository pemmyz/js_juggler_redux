/**
 * AMIGA JUGGLER REDUX - MULTIVERSE & GLASS RAYTRACE RECREATION
 */

// ==========================================
// CONSTANTS & PALETTES
// ==========================================
const SKY_COLOR = 0x9885C2;
const CHECKER_GREEN = '#187A24';
const CHECKER_GOLD  = '#D4AF0E';

const TORSO_COLOR = 0xC81414;
const HEAD_COLOR  = 0x111215;
const LIMB_COLOR  = 0xBAC1CE;
const JOINT_COLOR = 0x8892A2;

const BALL_HUES = [
  { color: 0x00FF44, glow: 0x00E030 }, // Emerald Glass
  { color: 0xFFDD00, glow: 0xF0B800 }, // Topaz Glass
  { color: 0x00B0FF, glow: 0x0088FF }  // Sapphire Glass
];

const JUGGLE_PERIOD = 2.4;

// ==========================================
// STATE
// ==========================================
let scene, camera, renderer, clock;
let envCubeMap;
let isPaused = false;

// Dynamic simulation parameters
const config = {
  cols: 1,
  rows: 1,
  spacing: 3.2,
  waveDelay: 0.15,
  glassOpacity: 0.65,
  refraction: 0.85,
  innerGlow: 1.2,
  flyCam: true,
  flySpeed: 1.0,
  pixelated: true
};

// Character instances list
let jugglerInstances = [];

// Shared Geometries & Materials
let sharedGeos = {};
let sharedMats = {};
let glassBallMats = [];

// Camera State (Solo default distance)
let camRadius = 8.5;
let camTheta = 0.0;
let camPhi = 0.25;
let camTarget = new THREE.Vector3(0, 1.85, 0);
let isDragging = false;
let mousePos = { x: 0, y: 0 };
let flyTime = 0;

// Performance Counters
let fpsCounter = 0;
let lastFpsUpdate = 0;

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
  const canvas = document.getElementById('webgl-canvas');

  // 1. Scene & Atmosphere
  scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOR);
  scene.fog = new THREE.FogExp2(SKY_COLOR, 0.012);

  // 2. Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  applyResolution();

  clock = new THREE.Clock();

  // 4. Procedural Environment Map
  envCubeMap = createProceduralEnvCube();
  scene.environment = envCubeMap;

  // 5. Lighting, Floor, Materials
  setupLighting();
  createCheckerFloor();
  initSharedResources();

  // 6. Spawn Jugglers
  rebuildJugglerGrid();

  // 7. Setup UI & Event Listeners
  setupUI();
  setupUserControls(canvas);
  window.addEventListener('resize', onWindowResize);

  // 8. Start Loop
  animate();
}

// ==========================================
// RAYTRACE ENVIRONMENT CUBE MAP GENERATOR
// ==========================================
function createProceduralEnvCube() {
  const cubeCanvas = document.createElement('canvas');
  cubeCanvas.width = 128;
  cubeCanvas.height = 128;
  const ctx = cubeCanvas.getContext('2d');

  function getFace(type) {
    ctx.fillStyle = '#9885C2';
    ctx.fillRect(0, 0, 128, 128);

    if (type === 'bottom') {
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          ctx.fillStyle = (x + y) % 2 === 0 ? CHECKER_GREEN : CHECKER_GOLD;
          ctx.fillRect(x * 32, y * 32, 32, 32);
        }
      }
    } else if (type === 'side') {
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#7560a8');
      grad.addColorStop(0.65, '#9885C2');
      grad.addColorStop(0.66, '#187A24');
      grad.addColorStop(1, '#0e4815');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const img = new Image();
    img.src = cubeCanvas.toDataURL();
    return img;
  }

  const cubeTex = new THREE.CubeTexture([
    getFace('side'), getFace('side'),
    getFace('top'),  getFace('bottom'),
    getFace('side'), getFace('side')
  ]);
  cubeTex.needsUpdate = true;
  cubeTex.mapping = THREE.CubeRefractionMapping;
  return cubeTex;
}

// ==========================================
// LIGHTING
// ==========================================
function setupLighting() {
  const ambient = new THREE.AmbientLight(0x726490, 0.9);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.35);
  sun.position.set(25, 45, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 160;
  const d = 40;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  const skyFill = new THREE.DirectionalLight(0xa5c2ff, 0.45);
  skyFill.position.set(-20, 20, -20);
  scene.add(skyFill);
}

// ==========================================
// CHECKERBOARD FLOOR
// ==========================================
function createCheckerFloor() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? CHECKER_GREEN : CHECKER_GOLD;
      ctx.fillRect(x * 64, y * 64, 64, 64);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(250, 250);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;

  const floorGeo = new THREE.PlaneGeometry(1000, 1000);
  const floorMat = new THREE.MeshLambertMaterial({
    map: texture,
    reflectivity: 0.35
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);
}

// ==========================================
// SHARED GEOMETRIES & GLASS MATERIALS
// ==========================================
function initSharedResources() {
  sharedGeos.head = new THREE.SphereGeometry(0.55, 18, 14);
  sharedGeos.torsoBody = new THREE.CylinderGeometry(0.55, 0.48, 1.25, 16, 1);
  sharedGeos.torsoCapTop = new THREE.SphereGeometry(0.55, 16, 10);
  sharedGeos.torsoCapBottom = new THREE.SphereGeometry(0.48, 16, 10);

  sharedGeos.jointShoulder = new THREE.SphereGeometry(0.14, 10, 8);
  sharedGeos.jointElbow = new THREE.SphereGeometry(0.11, 10, 8);
  sharedGeos.jointHand = new THREE.SphereGeometry(0.12, 10, 8);

  sharedGeos.jointHip = new THREE.SphereGeometry(0.13, 10, 8);
  sharedGeos.jointKnee = new THREE.SphereGeometry(0.11, 10, 8);
  sharedGeos.jointFoot = new THREE.SphereGeometry(0.12, 10, 8);

  sharedGeos.armBone = new THREE.CylinderGeometry(0.065, 0.065, 1, 10);
  sharedGeos.legBone = new THREE.CylinderGeometry(0.062, 0.062, 1, 10);
  sharedGeos.ball = new THREE.SphereGeometry(0.35, 20, 16);
  sharedGeos.innerBall = new THREE.SphereGeometry(0.24, 16, 12);

  sharedMats.torso = new THREE.MeshPhongMaterial({
    color: TORSO_COLOR,
    specular: 0xffaaaa,
    shininess: 45
  });

  sharedMats.head = new THREE.MeshPhongMaterial({
    color: HEAD_COLOR,
    specular: 0xffffff,
    shininess: 100
  });

  sharedMats.limb = new THREE.MeshPhongMaterial({
    color: LIMB_COLOR,
    specular: 0xffffff,
    shininess: 65
  });

  sharedMats.joint = new THREE.MeshPhongMaterial({
    color: JOINT_COLOR,
    specular: 0xffffff,
    shininess: 50
  });

  glassBallMats = BALL_HUES.map(item => {
    return {
      outer: new THREE.MeshPhysicalMaterial({
        color: item.color,
        emissive: item.glow,
        emissiveIntensity: 0.25,
        metalness: 0.1,
        roughness: 0.05,
        transmission: 0.85,
        ior: 1.52,
        reflectivity: 0.9,
        transparent: true,
        opacity: config.glassOpacity,
        envMap: envCubeMap,
        envMapIntensity: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      }),
      innerCore: new THREE.MeshBasicMaterial({
        color: item.color,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
      })
    };
  });
}

function updateGlassMaterials() {
  glassBallMats.forEach(matGroup => {
    matGroup.outer.opacity = config.glassOpacity;
    matGroup.outer.transmission = config.refraction;
    matGroup.outer.emissiveIntensity = config.innerGlow * 0.3;
    matGroup.innerCore.opacity = config.innerGlow * 0.35;
  });
}

// ==========================================
// JUGGLER RIG FACTORY
// ==========================================
function createJugglerEntity(posX, posZ, indexOffset) {
  const root = new THREE.Group();
  root.position.set(posX, 0, posZ);

  // 1. Torso
  const torsoGroup = new THREE.Group();
  const body = new THREE.Mesh(sharedGeos.torsoBody, sharedMats.torso);
  body.position.y = 2.05;
  body.castShadow = true;
  body.receiveShadow = true;

  const topCap = new THREE.Mesh(sharedGeos.torsoCapTop, sharedMats.torso);
  topCap.position.y = 2.65;
  topCap.scale.set(1, 0.4, 1);
  topCap.castShadow = true;

  const btmCap = new THREE.Mesh(sharedGeos.torsoCapBottom, sharedMats.torso);
  btmCap.position.y = 1.45;
  btmCap.scale.set(1, 0.4, 1);
  btmCap.castShadow = true;

  torsoGroup.add(body, topCap, btmCap);
  root.add(torsoGroup);

  // 2. Head
  const head = new THREE.Mesh(sharedGeos.head, sharedMats.head);
  head.position.set(0, 3.25, 0.05);
  head.castShadow = true;
  root.add(head);

  // 3. Static Legs
  buildLeg(root, -0.42);
  buildLeg(root, 0.42);

  // 4. Dynamic Arm Rigs
  const leftArm = buildArm(root, -0.75, 2.55);
  const rightArm = buildArm(root, 0.75, 2.55);

  // 5. Glass Translucent Balls
  const ballMeshes = [];
  for (let i = 0; i < 3; i++) {
    const ballGroup = new THREE.Group();
    const outerMesh = new THREE.Mesh(sharedGeos.ball, glassBallMats[i].outer);
    outerMesh.castShadow = true;

    const innerMesh = new THREE.Mesh(sharedGeos.innerBall, glassBallMats[i].innerCore);
    ballGroup.add(outerMesh, innerMesh);

    scene.add(ballGroup);
    ballMeshes.push(ballGroup);
  }

  scene.add(root);

  return {
    root,
    head,
    torsoGroup,
    leftArm,
    rightArm,
    balls: ballMeshes,
    timeOffset: indexOffset
  };
}

function buildLeg(parent, x) {
  const pA = new THREE.Vector3(x, 1.4, 0);
  const pB = new THREE.Vector3(x * 1.2, 0.75, 0.1);
  const pC = new THREE.Vector3(x * 1.35, 0.05, -0.05);

  const hip = new THREE.Mesh(sharedGeos.jointHip, sharedMats.joint);
  hip.position.copy(pA);

  const thigh = createCylinderBone(pA, pB, sharedGeos.legBone, sharedMats.limb);
  const knee = new THREE.Mesh(sharedGeos.jointKnee, sharedMats.joint);
  knee.position.copy(pB);

  const calf = createCylinderBone(pB, pC, sharedGeos.legBone, sharedMats.limb);
  const foot = new THREE.Mesh(sharedGeos.jointFoot, sharedMats.joint);
  foot.position.copy(pC);
  foot.scale.set(1, 0.6, 1.6);

  parent.add(hip, thigh, knee, calf, foot);
}

function buildArm(parent, x, y) {
  const group = new THREE.Group();

  const shoulder = new THREE.Mesh(sharedGeos.jointShoulder, sharedMats.joint);
  shoulder.position.set(x, y, 0);
  group.add(shoulder);

  const upperArm = new THREE.Mesh(sharedGeos.armBone, sharedMats.limb);
  upperArm.castShadow = true;
  group.add(upperArm);

  const elbow = new THREE.Mesh(sharedGeos.jointElbow, sharedMats.joint);
  elbow.castShadow = true;
  group.add(elbow);

  const foreArm = new THREE.Mesh(sharedGeos.armBone, sharedMats.limb);
  foreArm.castShadow = true;
  group.add(foreArm);

  const hand = new THREE.Mesh(sharedGeos.jointHand, sharedMats.joint);
  hand.castShadow = true;
  group.add(hand);

  parent.add(group);

  return {
    shoulderOrigin: new THREE.Vector3(x, y, 0),
    upperArm,
    elbow,
    foreArm,
    hand,
    handTarget: new THREE.Vector3()
  };
}

function createCylinderBone(pA, pB, geo, mat) {
  const vec = new THREE.Vector3().subVectors(pB, pA);
  const len = vec.length();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(1, len, 1);
  mesh.position.copy(pA).addScaledVector(vec, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize());
  mesh.castShadow = true;
  return mesh;
}

function updateArmIK(armRig) {
  const pA = armRig.shoulderOrigin;
  const pC = armRig.handTarget;
  const outwardSign = pA.x < 0 ? -1 : 1;

  const mid = new THREE.Vector3().addVectors(pA, pC).multiplyScalar(0.5);
  const elbowPos = mid.clone().add(new THREE.Vector3(outwardSign * 0.28, -0.15, -0.32));

  armRig.elbow.position.copy(elbowPos);
  armRig.hand.position.copy(pC);

  orientBone(armRig.upperArm, pA, elbowPos);
  orientBone(armRig.foreArm, elbowPos, pC);
}

function orientBone(boneMesh, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.01, dir.length());
  boneMesh.scale.set(1, len, 1);
  boneMesh.position.copy(from).addScaledVector(dir, 0.5);
  boneMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

// ==========================================
// GRID BUILDER & MULTIVERSE MANAGEMENT
// ==========================================
function rebuildJugglerGrid() {
  jugglerInstances.forEach(j => {
    scene.remove(j.root);
    j.balls.forEach(b => scene.remove(b));
  });
  jugglerInstances = [];

  const cols = config.cols;
  const rows = config.rows;
  const spacing = config.spacing;

  const offsetX = -((cols - 1) * spacing) / 2;
  const offsetZ = -((rows - 1) * spacing) / 2;

  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = offsetX + c * spacing;
      const pz = offsetZ + r * spacing;
      const delay = (c + r) * config.waveDelay;
      const juggler = createJugglerEntity(px, pz, delay);
      jugglerInstances.push(juggler);
      total++;
    }
  }

  // Update HUD
  document.getElementById('juggler-count-display').innerText = total;
  document.getElementById('ball-count-display').innerText = total * 3;

  // Keep camera distance identical to Solo
  camTarget.set(0, 1.85, 0);
  if (!config.flyCam) {
    camRadius = 8.5;
    updateCameraOrbit();
  }
}

// ==========================================
// TRAJECTORY & RIG ANIMATION
// ==========================================
function getBallFlight(tNorm) {
  const xLeftThrow = -0.65, yThrow = 2.1, zThrow = 0.55;
  const xRightThrow = 0.65;
  const xLeftCatch = -1.15, yCatch = 1.85, zCatch = 0.35;
  const xRightCatch = 1.15;
  const peakHeight = 4.25;

  let x, y, z;
  if (tNorm < 0.5) {
    const s = tNorm / 0.5;
    x = THREE.MathUtils.lerp(xLeftThrow, xRightCatch, s);
    const arc = 4 * s * (1 - s);
    y = THREE.MathUtils.lerp(yThrow, yCatch, s) + arc * (peakHeight - Math.max(yThrow, yCatch));
    z = THREE.MathUtils.lerp(zThrow, zCatch, s) + Math.sin(s * Math.PI) * 0.15;
  } else {
    const s = (tNorm - 0.5) / 0.5;
    x = THREE.MathUtils.lerp(xRightThrow, xLeftCatch, s);
    const arc = 4 * s * (1 - s);
    y = THREE.MathUtils.lerp(yThrow, yCatch, s) + arc * (peakHeight - Math.max(yThrow, yCatch));
    z = THREE.MathUtils.lerp(zThrow, zCatch, s) + Math.sin(s * Math.PI) * 0.15;
  }
  return { x, y, z };
}

function updateJugglers(time) {
  const omega = (Math.PI * 2) / (JUGGLE_PERIOD / 3);

  for (let j = 0; j < jugglerInstances.length; j++) {
    const item = jugglerInstances[j];
    const t = time + item.timeOffset;
    const rootPos = item.root.position;

    // 1. Juggling Balls
    for (let b = 0; b < 3; b++) {
      const phase = (b * JUGGLE_PERIOD) / 3;
      const tNorm = ((t + phase) % JUGGLE_PERIOD) / JUGGLE_PERIOD;
      const localBall = getBallFlight(tNorm);
      item.balls[b].position.set(
        rootPos.x + localBall.x,
        rootPos.y + localBall.y,
        rootPos.z + localBall.z
      );
      item.balls[b].rotation.y = t * 2 + b;
      item.balls[b].rotation.x = t * 1.5;
    }

    // 2. Arms Scoop IK
    const leftX = -0.9 + 0.32 * Math.cos(t * omega);
    const leftY = 1.95 + 0.22 * Math.sin(t * omega);
    const leftZ = 0.45 + 0.15 * Math.sin(t * omega);
    item.leftArm.handTarget.set(leftX, leftY, leftZ);

    const rightX = 0.9 - 0.32 * Math.cos(t * omega + Math.PI);
    const rightY = 1.95 + 0.22 * Math.sin(t * omega + Math.PI);
    const rightZ = 0.45 + 0.15 * Math.sin(t * omega + Math.PI);
    item.rightArm.handTarget.set(rightX, rightY, rightZ);

    updateArmIK(item.leftArm);
    updateArmIK(item.rightArm);

    // 3. Body Rhythm
    const bounce = Math.sin(t * omega * 2) * 0.025;
    item.torsoGroup.position.y = bounce;
    item.head.position.y = 3.25 + bounce;
    item.head.rotation.y = Math.sin(t * omega) * 0.08;
    item.head.rotation.x = -0.06 + Math.cos(t * omega * 2) * 0.03;
  }
}

// ==========================================
// FLYING CAMERA SYSTEM (Solo Distance & Moves)
// ==========================================
function updateFlyingCamera(delta) {
  flyTime += delta * config.flySpeed * 0.35;

  // Fixed Solo orbit distance & flight curve
  const orbitR = 7.0;

  const camX = Math.sin(flyTime) * (orbitR + 2.5);
  const camZ = Math.cos(flyTime * 0.8) * (orbitR + 3.0);
  const camY = 2.8 + Math.sin(flyTime * 1.6) * 2.2 + Math.cos(flyTime * 0.5) * 1.5;

  camera.position.set(camX, Math.max(0.6, camY), camZ);

  // Fixed Solo look tracking
  const lookX = Math.sin(flyTime * 0.5) * 0.48;
  const lookZ = Math.cos(flyTime * 0.5) * 0.48;
  camTarget.set(lookX, 1.8, lookZ);

  camera.lookAt(camTarget);
}

function updateCameraOrbit() {
  const x = camTarget.x + camRadius * Math.sin(camTheta) * Math.cos(camPhi);
  const y = camTarget.y + camRadius * Math.sin(camPhi);
  const z = camTarget.z + camRadius * Math.cos(camTheta) * Math.cos(camPhi);

  camera.position.set(x, y, z);
  camera.lookAt(camTarget);
}

// ==========================================
// UI & CONTROLS BINDING
// ==========================================
function setupUI() {
  const panel = document.getElementById('control-panel');
  document.getElementById('panel-toggle').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    document.querySelector('.toggle-icon').innerText = panel.classList.contains('collapsed') ? '[+]' : '[−]';
  });

  // Grid Sliders
  bindSlider('slider-cols', 'val-cols', v => { config.cols = parseInt(v); rebuildJugglerGrid(); });
  bindSlider('slider-rows', 'val-rows', v => { config.rows = parseInt(v); rebuildJugglerGrid(); });
  bindSlider('slider-spacing', 'val-spacing', v => { config.spacing = parseFloat(v); rebuildJugglerGrid(); });
  bindSlider('slider-wave', 'val-wave', v => { config.waveDelay = parseFloat(v); rebuildJugglerGrid(); });

  // Glass Sliders
  bindSlider('slider-opacity', 'val-opacity', v => { config.glassOpacity = parseFloat(v); updateGlassMaterials(); });
  bindSlider('slider-refract', 'val-refract', v => { config.refraction = parseFloat(v); updateGlassMaterials(); });
  bindSlider('slider-chroma', 'val-chroma', v => { config.innerGlow = parseFloat(v); updateGlassMaterials(); });

  // Cam Speed
  bindSlider('slider-flyspeed', 'val-flyspeed', v => { config.flySpeed = parseFloat(v); });

  // Checkboxes
  document.getElementById('chk-flycam').addEventListener('change', (e) => {
    config.flyCam = e.target.checked;
    if (!config.flyCam) updateCameraOrbit();
  });

  document.getElementById('chk-crt').addEventListener('change', (e) => {
    document.getElementById('crt-overlay').style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('chk-retro-res').addEventListener('change', (e) => {
    config.pixelated = e.target.checked;
    applyResolution();
  });
}

function bindSlider(id, labelId, callback) {
  const el = document.getElementById(id);
  const label = document.getElementById(labelId);
  el.addEventListener('input', (e) => {
    label.innerText = e.target.value;
    callback(e.target.value);
  });
}

window.applyPreset = function(cols, rows) {
  document.getElementById('slider-cols').value = cols;
  document.getElementById('val-cols').innerText = cols;
  document.getElementById('slider-rows').value = rows;
  document.getElementById('val-rows').innerText = rows;
  config.cols = cols;
  config.rows = rows;
  rebuildJugglerGrid();
};

function applyResolution() {
  const canvas = document.getElementById('webgl-canvas');
  if (config.pixelated) {
    renderer.setSize(320, 240, false);
    canvas.classList.add('pixelated');
  } else {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    canvas.classList.remove('pixelated');
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (!config.pixelated) {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
}

function setupUserControls(canvas) {
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    mousePos = { x: e.clientX, y: e.clientY };
    if (config.flyCam) {
      config.flyCam = false;
      document.getElementById('chk-flycam').checked = false;
    }
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - mousePos.x;
    const dy = e.clientY - mousePos.y;

    camTheta -= dx * 0.008;
    camPhi = Math.max(-0.25, Math.min(1.4, camPhi + dy * 0.008));

    updateCameraOrbit();
    mousePos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('wheel', (e) => {
    if (config.flyCam) {
      config.flyCam = false;
      document.getElementById('chk-flycam').checked = false;
    }
    camRadius = Math.max(3.0, Math.min(80.0, camRadius + e.deltaY * 0.015));
    updateCameraOrbit();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      isPaused = !isPaused;
      e.preventDefault();
    } else if (e.code === 'KeyC') {
      config.flyCam = !config.flyCam;
      document.getElementById('chk-flycam').checked = config.flyCam;
      if (!config.flyCam) updateCameraOrbit();
    } else if (e.code === 'KeyR') {
      camRadius = 8.5;
      camTheta = 0;
      camPhi = 0.25;
      updateCameraOrbit();
    } else if (e.code === 'KeyF') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  });
}

// ==========================================
// MAIN LOOP & BENCHMARK
// ==========================================
let elapsedTime = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  fpsCounter++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 500) {
    const currentFps = Math.round((fpsCounter * 1000) / (now - lastFpsUpdate));
    document.getElementById('fps-display').innerText = currentFps;
    fpsCounter = 0;
    lastFpsUpdate = now;
  }

  if (!isPaused) {
    elapsedTime += delta;
    updateJugglers(elapsedTime);

    if (config.flyCam) {
      updateFlyingCamera(delta);
    }
  }

  renderer.render(scene, camera);
}

window.addEventListener('DOMContentLoaded', init);
