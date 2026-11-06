import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Model, Part } from "./types";

const low = new THREE.Color("#2b6cb0");
const high = new THREE.Color("#f6ad55");

export function colorFor(value = 0.5): THREE.Color {
  return low.clone().lerp(high, Math.min(1, Math.max(0, value)));
}

/** Build one InstancedMesh per model: fast even with many thousands of parts. */
export function buildModelMesh(model: Model): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 });
  const mesh = new THREE.InstancedMesh(geometry, material, model.parts.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  model.parts.forEach((p: Part, i) => {
    quat.setFromAxisAngle(up, p.ry ?? 0);
    matrix.compose(new THREE.Vector3(p.x, p.y, p.z), quat, new THREE.Vector3(p.w, p.h, p.d));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, colorFor(p.value));
  });
  mesh.userData.model = model;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createViewer(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1720");

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(14, 12, 14);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight("#ffffff", "#334155", 1.2));
  const sun = new THREE.DirectionalLight("#ffffff", 2);
  sun.position.set(10, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
  scene.add(sun);

  const grid = new THREE.GridHelper(60, 60, "#334155", "#1e293b");
  scene.add(grid);

  const content = new THREE.Group();
  scene.add(content);

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  /** Point the camera at whatever is in `content`. */
  function frame() {
    const box = new THREE.Box3().setFromObject(content);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    controls.target.copy(center);
    const dir = new THREE.Vector3(1, 0.8, 1).normalize();
    camera.position.copy(center).addScaledVector(dir, size * 1.5);
    controls.update();
  }

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { scene, camera, renderer, content, frame };
}
