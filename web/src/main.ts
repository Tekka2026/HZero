import * as THREE from "three";
import { buildModelMesh, createViewer } from "./scene";
import type { Model, ModelData } from "./types";

const viewport = document.getElementById("viewport")!;
const list = document.getElementById("model-list")!;
const info = document.getElementById("info")!;
const meta = document.getElementById("meta")!;
const tooltip = document.getElementById("tooltip")!;
const viewAllBtn = document.getElementById("view-all")!;

const viewer = createViewer(viewport);
const meshes = new Map<string, THREE.InstancedMesh>();
let selected: string | null = null;

const SPACING = 7;

function layoutAll() {
  const cols = Math.ceil(Math.sqrt(meshes.size));
  [...meshes.values()].forEach((mesh, i) => {
    mesh.visible = true;
    mesh.position.set((i % cols) * SPACING, 0, Math.floor(i / cols) * SPACING);
  });
}

function showAll() {
  selected = null;
  layoutAll();
  info.hidden = true;
  updateActive();
  viewer.frame();
}

function select(id: string) {
  selected = id;
  for (const [key, mesh] of meshes) {
    mesh.visible = key === id;
    mesh.position.set(0, 0, 0);
  }
  const model = meshes.get(id)!.userData.model as Model;
  info.hidden = false;
  info.innerHTML =
    `<h2>${model.id}</h2><dl>` +
    Object.entries(model.params)
      .map(([k, v]) => `<dt>${k}</dt><dd>${String(v)}</dd>`)
      .join("") +
    `<dt>parts</dt><dd>${model.parts.length}</dd></dl>`;
  updateActive();
  viewer.frame();
}

function updateActive() {
  viewAllBtn.classList.toggle("active", selected === null);
  list.querySelectorAll("li").forEach((li) => li.classList.toggle("active", li.dataset.id === selected));
}

// Hover: show details of the part under the cursor.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
viewport.addEventListener("pointermove", (e) => {
  const rect = viewport.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, viewer.camera);
  const hit = raycaster.intersectObjects([...meshes.values()].filter((m) => m.visible))[0];
  if (!hit || hit.instanceId === undefined) {
    tooltip.hidden = true;
    viewport.style.cursor = "";
    return;
  }
  const model = hit.object.userData.model as Model;
  const part = model.parts[hit.instanceId];
  const fields = Object.entries(part)
    .filter(([k]) => !["x", "y", "z", "w", "h", "d", "ry"].includes(k))
    .map(([k, v]) => `${k}: ${String(v)}`);
  tooltip.innerHTML = `<strong>${model.id}</strong><br>part #${hit.instanceId}<br>${fields.join("<br>")}`;
  tooltip.style.left = `${e.clientX - rect.left + 14}px`;
  tooltip.style.top = `${e.clientY - rect.top + 14}px`;
  tooltip.hidden = false;
  viewport.style.cursor = selected ? "" : "pointer";
});

// Click a model in the overview to open it.
viewport.addEventListener("click", () => {
  if (selected) return;
  raycaster.setFromCamera(pointer, viewer.camera);
  const hit = raycaster.intersectObjects([...meshes.values()])[0];
  if (hit) select((hit.object.userData.model as Model).id);
});

viewAllBtn.addEventListener("click", showAll);

async function load() {
  const res = await fetch(`${import.meta.env.BASE_URL}models.json`);
  if (!res.ok) throw new Error(`Could not load models.json (${res.status}). Run the notebook first.`);
  const data: ModelData = await res.json();

  meta.textContent = `${data.models.length} models · generated ${new Date(data.generated_at).toLocaleString()}`;
  for (const model of data.models) {
    const mesh = buildModelMesh(model);
    meshes.set(model.id, mesh);
    viewer.content.add(mesh);

    const li = document.createElement("li");
    li.dataset.id = model.id;
    li.innerHTML = `<span>${model.id}</span><small>${Object.entries(model.params)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" · ")}</small>`;
    li.addEventListener("click", () => select(model.id));
    list.appendChild(li);
  }
  showAll();
}

load().catch((err) => {
  meta.textContent = String(err.message ?? err);
  meta.classList.add("error");
});
