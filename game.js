const canvas = document.getElementById("game");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b9dcff");

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(12, 14, 6);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-8, 6, -10);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(45, 64),
  new THREE.MeshStandardMaterial({ color: "#7abf6b" })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.35;
scene.add(ground);

const airplane = new THREE.Group();

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: "#f0f2f6",
  metalness: 0.25,
  roughness: 0.55,
});
const accentMaterial = new THREE.MeshStandardMaterial({
  color: "#1d3557",
  metalness: 0.15,
  roughness: 0.5,
});
const engineMaterial = new THREE.MeshStandardMaterial({
  color: "#404553",
  metalness: 0.4,
  roughness: 0.4,
});
const windowMaterial = new THREE.MeshStandardMaterial({
  color: "#7fb3ff",
  roughness: 0.25,
  metalness: 0.1,
});

const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 11, 40), bodyMaterial);
fuselage.rotation.z = Math.PI / 2;
airplane.add(fuselage);

const upperDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.46, 4.2, 28), bodyMaterial);
upperDeck.rotation.z = Math.PI / 2;
upperDeck.position.set(1.0, 0.68, 0);
airplane.add(upperDeck);

const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 32), bodyMaterial);
noseCone.rotation.z = Math.PI / 2;
noseCone.position.x = 6.0;
airplane.add(noseCone);

const noseCap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 32), bodyMaterial);
noseCap.position.x = 6.6;
airplane.add(noseCap);

const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 28), bodyMaterial);
tailCone.rotation.z = -Math.PI / 2;
tailCone.position.x = -6.2;
airplane.add(tailCone);

const wingGeometry = new THREE.BoxGeometry(8.4, 0.2, 2.0);
const wingLeft = new THREE.Mesh(wingGeometry, accentMaterial);
wingLeft.position.set(0.6, 0.0, 2.7);
wingLeft.rotation.y = -0.3;
wingLeft.rotation.z = 0.08;
airplane.add(wingLeft);

const wingRight = wingLeft.clone();
wingRight.position.z = -2.7;
wingRight.rotation.y = 0.3;
wingRight.rotation.z = -0.08;
airplane.add(wingRight);

const wingTipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.2), accentMaterial);
wingTipLeft.position.set(5.0, 0.7, 3.6);
wingTipLeft.rotation.z = 0.4;
airplane.add(wingTipLeft);

const wingTipRight = wingTipLeft.clone();
wingTipRight.position.z = -3.6;
wingTipRight.rotation.z = -0.4;
airplane.add(wingTipRight);

const tailWing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.1), accentMaterial);
tailWing.position.set(-5.4, 0.35, 0);
tailWing.rotation.y = 0.15;
airplane.add(tailWing);

const tailWingLeft = tailWing.clone();
tailWingLeft.position.z = 0.9;
airplane.add(tailWingLeft);

const tailWingRight = tailWing.clone();
tailWingRight.position.z = -0.9;
airplane.add(tailWingRight);

const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 1.3), accentMaterial);
tailFin.position.set(-6.0, 1.4, 0);
airplane.add(tailFin);

const engineGeometry = new THREE.CylinderGeometry(0.32, 0.35, 1.8, 26);
const enginePylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.55), accentMaterial);
const engineIntake = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 12, 20), windowMaterial);

const createEngine = (x, y, z) => {
  const engine = new THREE.Mesh(engineGeometry, engineMaterial);
  engine.rotation.z = Math.PI / 2;
  engine.position.set(x, y, z);
  const pylon = enginePylon.clone();
  pylon.position.set(x - 0.2, y + 0.25, z);
  const intake = engineIntake.clone();
  intake.rotation.y = Math.PI / 2;
  intake.position.set(x + 0.85, y, z);
  airplane.add(pylon);
  airplane.add(engine);
  airplane.add(intake);
};

createEngine(0.6, -0.55, 1.7);
createEngine(2.0, -0.55, 2.3);
createEngine(0.6, -0.55, -1.7);
createEngine(2.0, -0.55, -2.3);

const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), windowMaterial);
cockpit.position.set(4.7, 0.75, 0.45);
airplane.add(cockpit);

const cockpit2 = cockpit.clone();
cockpit2.position.z = -0.45;
airplane.add(cockpit2);

const stripe = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.1, 0.12), accentMaterial);
stripe.position.set(0.8, -0.08, 0.92);
airplane.add(stripe);

const stripe2 = stripe.clone();
stripe2.position.z = -0.92;
airplane.add(stripe2);

const windows = new THREE.Group();
for (let i = -4; i <= 4; i += 1) {
  const window = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), windowMaterial);
  window.position.set(i * 0.75 + 1.0, 0.2, 0.82);
  windows.add(window);
  const windowRight = window.clone();
  windowRight.position.z = -0.82;
  windows.add(windowRight);
}
airplane.add(windows);

airplane.position.set(0, 2.2, 0);
scene.add(airplane);

const cameraViews = [
  { position: new THREE.Vector3(12, 6, 12), target: new THREE.Vector3(0, 2, 0) },
  { position: new THREE.Vector3(-14, 7, 6), target: new THREE.Vector3(-1, 2, 0) },
  { position: new THREE.Vector3(6, 10, -14), target: new THREE.Vector3(0, 1.5, 0) },
];
let viewIndex = 0;
let lastViewSwitch = -6;

const resizeRenderer = () => {
  const { clientWidth, clientHeight } = canvas;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
};

const applyCameraView = () => {
  const view = cameraViews[viewIndex];
  camera.position.copy(view.position);
  camera.lookAt(view.target);
};

resizeRenderer();
applyCameraView();
window.addEventListener("resize", resizeRenderer);

const clock = new THREE.Clock();

const tick = () => {
  const elapsed = clock.getElapsedTime();
  airplane.position.y = 2.1 + Math.sin(elapsed * 1.2) * 0.25;
  airplane.rotation.y = Math.sin(elapsed * 0.4) * 0.35;
  airplane.rotation.z = Math.sin(elapsed * 0.6) * 0.1;

  if (elapsed - lastViewSwitch >= 6) {
    viewIndex = (viewIndex + 1) % cameraViews.length;
    applyCameraView();
    lastViewSwitch = elapsed;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};

tick();
