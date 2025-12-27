import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World } from './World';
import { ItemEntity } from './ItemEntity';
import { MobManager } from './MobManager';
import './style.css';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
  document.body.classList.add('is-mobile');
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // Sky blue
scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';
camera.position.set(8, 20, 20);
camera.lookAt(8, 8, 8);

let isMobileGameStarted = false;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Controls
const controls = new PointerLockControls(camera, document.body);

const blocker = document.getElementById('blocker')!;
const instructions = document.getElementById('instructions')!;

instructions.addEventListener('click', () => {
  if (!isInventoryOpen && !isMobile) {
    controls.lock();
  }
});

controls.addEventListener('lock', () => {
  instructions.style.display = 'none';
  blocker.style.display = 'none';
  if (isInventoryOpen) toggleInventory(); // Close inventory if locking (e.g. clicking back in)
});

controls.addEventListener('unlock', () => {
  if (!isInventoryOpen) {
    blocker.style.display = 'flex';
    instructions.style.display = 'block';
  }
});

scene.add(controls.object);

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isOnGround = false;

const GRAVITY = 20.0;
const JUMP_HEIGHT = 1.25;
const JUMP_IMPULSE = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);

const velocity = new THREE.Vector3();

const onKeyDown = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
    case 'Space':
      if (isOnGround) {
        velocity.y = JUMP_IMPULSE;
        isOnGround = false;
      }
      break;
    case 'KeyE':
      toggleInventory();
      break;
  }
};

const onKeyUp = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// World Generation
const world = new World(scene);
const entities: ItemEntity[] = [];
const mobManager = new MobManager(world, scene, entities);

// Block Data
const BLOCK_NAMES: Record<number, string> = {
  1: 'Блок травы',
  2: 'Земля',
  3: 'Камень',
  4: 'Бедрок',
  5: 'Дерево',
  6: 'Листва'
};

// Inventory State
const inventorySlots = Array.from({ length: 36 }, () => ({ id: 0, count: 0 }));
let selectedSlot = 0;
let isInventoryOpen = false;
let touchStartSlotIndex: number | null = null;

// Drag and Drop State
let draggedItem: { id: number, count: number } | null = null;
const dragIcon = document.getElementById('drag-icon')!;

// UI Elements
const hotbarContainer = document.getElementById('hotbar')!;
const inventoryMenu = document.getElementById('inventory-menu')!;
const inventoryGrid = document.getElementById('inventory-grid')!;
const tooltip = document.getElementById('tooltip')!;
const hotbarLabel = document.getElementById('hotbar-label')!;

let hotbarLabelTimeout: number;

// Generate CSS Noise
const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const ctx = canvas.getContext('2d')!;
for (let i = 0; i < 64 * 64; i++) {
  const x = i % 64;
  const y = Math.floor(i / 64);
  const v = Math.floor(Math.random() * 50 + 200); // Light noise
  ctx.fillStyle = `rgba(${v},${v},${v},0.5)`; // Semi-transparent
  ctx.fillRect(x, y, 1, 1);
}
document.body.style.setProperty('--noise-url', `url(${canvas.toDataURL()})`);

function getBlockColor(id: number) {
  if (id === 1) return '#559955';
  if (id === 2) return '#8B4513';
  if (id === 3) return '#808080';
  if (id === 5) return '#654321';
  if (id === 6) return '#228B22';
  return '#fff';
}

function showHotbarLabel(text: string) {
  hotbarLabel.innerText = text;
  hotbarLabel.style.opacity = '1';
  clearTimeout(hotbarLabelTimeout);
  hotbarLabelTimeout = setTimeout(() => {
    hotbarLabel.style.opacity = '0';
  }, 2000);
}

function initSlotElement(index: number, isHotbar: boolean) {
  const div = document.createElement('div');
  div.classList.add('slot');
  div.setAttribute('data-index', index.toString());
  
  const icon = document.createElement('div');
  icon.classList.add('block-icon');
  icon.style.display = 'none';
  div.appendChild(icon);

  const count = document.createElement('div');
  count.classList.add('slot-count');
  count.innerText = '';
  div.appendChild(count);

  div.addEventListener('mouseenter', () => {
    const slot = inventorySlots[index];
    if (isInventoryOpen && slot.id !== 0) {
      tooltip.innerText = BLOCK_NAMES[slot.id] || 'Блок';
      tooltip.style.display = 'block';
    }
  });
  
  div.addEventListener('mousemove', (e) => {
    if (isInventoryOpen) {
      tooltip.style.left = (e.clientX + 10) + 'px';
      tooltip.style.top = (e.clientY + 10) + 'px';
    }
  });

  div.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });

  div.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (isInventoryOpen) {
      handleSlotClick(index);
    }
  });
  
  div.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault(); 

    if (isInventoryOpen) {
      touchStartSlotIndex = index;
      handleSlotClick(index);
      
      const touch = e.changedTouches[0];
      if (draggedItem) {
          dragIcon.style.left = touch.clientX + 'px';
          dragIcon.style.top = touch.clientY + 'px';
      }
      
    } else if (isHotbar) {
      selectedSlot = index;
      onHotbarChange();
    }
  });

  return div;
}

function updateSlotVisuals(index: number) {
  const slot = inventorySlots[index];
  const elements = document.querySelectorAll(`.slot[data-index="${index}"]`);
  
  elements.forEach(el => {
      if (el.parentElement === hotbarContainer) {
          if (index === selectedSlot) el.classList.add('active');
          else el.classList.remove('active');
      }

      const icon = el.querySelector('.block-icon') as HTMLElement;
      const countEl = el.querySelector('.slot-count') as HTMLElement;

      if (slot.id !== 0 && slot.count > 0) {
        icon.style.display = 'block';
        icon.style.backgroundColor = getBlockColor(slot.id);
        countEl.innerText = slot.count.toString();
      } else {
        icon.style.display = 'none';
        countEl.innerText = '';
      }
  });
}

function initInventoryUI() {
  hotbarContainer.innerHTML = '';
  inventoryGrid.innerHTML = '';

  // Hotbar Container (0-8)
  for (let i = 0; i < 9; i++) {
    hotbarContainer.appendChild(initSlotElement(i, true));
  }

  // Inventory Grid: Main (9-35)
  for (let i = 9; i < 36; i++) {
    inventoryGrid.appendChild(initSlotElement(i, false));
  }
  
  // Separator
  const separator = document.createElement('div');
  separator.className = 'slot-hotbar-separator';
  separator.style.gridColumn = '1 / -1';
  inventoryGrid.appendChild(separator);

  // Inventory Grid: Hotbar Copy (0-8)
  for (let i = 0; i < 9; i++) {
    inventoryGrid.appendChild(initSlotElement(i, false));
  }
}

function refreshInventoryUI() {
    for(let i=0; i<36; i++) {
        updateSlotVisuals(i);
    }
}

function toggleInventory() {
  isInventoryOpen = !isInventoryOpen;
  
  if (isInventoryOpen) {
    controls.unlock();
    inventoryMenu.style.display = 'flex';
    refreshInventoryUI();
  } else {
    // Auto-save on close
    world.saveWorld({
        position: controls.object.position,
        inventory: inventorySlots
    });

    controls.lock();
    inventoryMenu.style.display = 'none';
    tooltip.style.display = 'none';  
    
    if (draggedItem) {
      for (let i = 0; i < 36; i++) {
        if (inventorySlots[i].id === 0) {
          inventorySlots[i] = draggedItem;
          break;
        } else if (inventorySlots[i].id === draggedItem.id) {
            inventorySlots[i].count += draggedItem.count;
            break;
        }
      }
      draggedItem = null;
      updateDragIcon();
    }
  }
}

function handleSlotClick(index: number) {
  const slot = inventorySlots[index];

  if (!draggedItem) {
    if (slot.id !== 0) {
      draggedItem = { ...slot };
      slot.id = 0;
      slot.count = 0;
    }
  } else {
    if (slot.id === 0) {
      slot.id = draggedItem.id;
      slot.count = draggedItem.count;
      draggedItem = null;
    } else if (slot.id === draggedItem.id) {
      slot.count += draggedItem.count;
      draggedItem = null;
    } else {
      const temp = { ...slot };
      slot.id = draggedItem.id;
      slot.count = draggedItem.count;
      draggedItem = temp;
    }
  }
  
  refreshInventoryUI();
  updateDragIcon();
}

function updateDragIcon() {
  dragIcon.innerHTML = '';
  if (draggedItem && draggedItem.id !== 0) {
    dragIcon.style.display = 'block';
    const icon = document.createElement('div');
    icon.className = 'block-icon';
    icon.style.width = '32px';
    icon.style.height = '32px';
    icon.style.backgroundColor = getBlockColor(draggedItem.id);
    
    const count = document.createElement('div');
    count.className = 'slot-count';
    count.style.fontSize = '12px';
    count.innerText = draggedItem.count.toString();
    
    icon.appendChild(count);
    dragIcon.appendChild(icon);
  } else {
    dragIcon.style.display = 'none';
  }
}

window.addEventListener('mousemove', (e) => {
  if (draggedItem) {
    dragIcon.style.left = e.clientX + 'px';
    dragIcon.style.top = e.clientY + 'px';
  }
});

window.addEventListener('touchmove', (e) => {
  if (draggedItem && isInventoryOpen) {
    const touch = e.changedTouches[0];
    dragIcon.style.left = touch.clientX + 'px';
    dragIcon.style.top = touch.clientY + 'px';
  }
}, { passive: false });

window.addEventListener('touchend', (e) => {
  if (draggedItem && isInventoryOpen && touchStartSlotIndex !== null) {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const slotEl = target?.closest('.slot');
    if (slotEl) {
      const targetIndex = parseInt(slotEl.getAttribute('data-index') || '-1');
      if (targetIndex !== -1 && targetIndex !== touchStartSlotIndex) {
        handleSlotClick(targetIndex);
      }
    }
    touchStartSlotIndex = null;
  }
});

initInventoryUI();
refreshInventoryUI();

function onHotbarChange() {
  refreshInventoryUI();
  const slot = inventorySlots[selectedSlot];
  if (slot && slot.id !== 0) {
    showHotbarLabel(BLOCK_NAMES[slot.id] || 'Unknown Block');
  } else {
    hotbarLabel.style.opacity = '0';
  }
}

window.addEventListener('wheel', (event) => {
  if (event.deltaY > 0) {
    selectedSlot = (selectedSlot + 1) % 9;
  } else {
    selectedSlot = (selectedSlot - 1 + 9) % 9;
  }
  onHotbarChange();
});

window.addEventListener('keydown', (event) => {
  const key = parseInt(event.key);
  if (key >= 1 && key <= 9) {
    selectedSlot = key - 1;
    onHotbarChange();
  }
});

// Interaction
const raycaster = new THREE.Raycaster();
const cursorGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
const cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
cursorMesh.visible = false;
scene.add(cursorMesh);

// Player Health System
let playerHP = 20;
let isInvulnerable = false;
const damageOverlay = document.getElementById('damage-overlay')!;
const healthBar = document.getElementById('health-bar')!;

// Init Health Bar
for (let i = 0; i < 20; i++) {
  const div = document.createElement('div');
  div.className = 'hp-unit';
  healthBar.appendChild(div);
}

function updateHealthUI() {
  const units = healthBar.children;
  for (let i = 0; i < 20; i++) {
    const unit = units[i] as HTMLElement;
    if (i < playerHP) {
      unit.classList.remove('empty');
    } else {
      unit.classList.add('empty');
    }
  }
}

function takeDamage(amount: number) {
  if (isInvulnerable) return;

  playerHP -= amount;
  if (playerHP < 0) playerHP = 0;
  updateHealthUI();
  
  isInvulnerable = true;
  
  // Red Flash Effect
  damageOverlay.style.transition = 'none';
  damageOverlay.style.opacity = '0.3';
  
  // Camera Shake
  const originalPos = camera.position.clone();
  const shakeIntensity = 0.2;
  
  // Apply shake
  camera.position.x += (Math.random() - 0.5) * shakeIntensity;
  camera.position.y += (Math.random() - 0.5) * shakeIntensity;
  camera.position.z += (Math.random() - 0.5) * shakeIntensity;
  
  // Verify valid position
  if (checkCollision(camera.position)) {
    camera.position.copy(originalPos);
  }
  
  // Restore
  requestAnimationFrame(() => {
     damageOverlay.style.transition = 'opacity 0.5s ease-out';
     damageOverlay.style.opacity = '0';
  });

  if (playerHP <= 0) {
    respawn();
  }

  setTimeout(() => {
    isInvulnerable = false;
  }, 500);
}

function respawn() {
  playerHP = 20;
  updateHealthUI();
  isInvulnerable = false;
  
  // Teleport to spawn
  controls.object.position.set(8, 20, 8);
  velocity.set(0, 0, 0);
  
  console.log("Respawned!");
}

// Combat Constants
const ATTACK_RANGE = 2.5;
const PUNCH_DAMAGE = 1;
const ATTACK_COOLDOWN = 500;
let lastPlayerAttackTime = 0;

function performAttack() {
     const now = Date.now();
     if (now - lastPlayerAttackTime < ATTACK_COOLDOWN) return;
     lastPlayerAttackTime = now;

     raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
     const intersects = raycaster.intersectObjects(scene.children, true); // Recursive to hit mob parts
     
     // Find first mob hit
     const mobHit = intersects.find(i => {
         // Check if object or any parent is a mob
         let obj = i.object;
         while(obj) {
             if (obj.userData && obj.userData.mob) return true;
             obj = obj.parent!;
         }
         return false;
     });

     if (mobHit && mobHit.distance < ATTACK_RANGE) { 
         let obj = mobHit.object;
         while(obj && !obj.userData.mob) {
             obj = obj.parent!;
         }
         if (obj && obj.userData.mob) {
             obj.userData.mob.takeDamage(PUNCH_DAMAGE, controls.object.position); 
             return; // Don't break blocks if we hit a mob
         }
     }
  
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = raycaster.intersectObjects(scene.children).find(i => i.object !== cursorMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);

    if (hit && hit.distance < 6) {
      // Break Block
      const p = hit.point.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.1));
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      const z = Math.floor(p.z);
      
      const blockId = world.getBlock(x, y, z);
      if (blockId !== 0) {
        entities.push(new ItemEntity(world, scene, x, y, z, blockId, world.noiseTexture));
        world.setBlock(x, y, z, 0); // AIR
      }
    }
}

function performInteract() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(scene.children);
  const hit = intersects.find(i => i.object !== cursorMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);

  if (hit && hit.distance < 6) {
      // Place Block
      const slot = inventorySlots[selectedSlot];
      if (slot.id !== 0 && slot.count > 0) {
        if (hit.face) {
          const p = hit.point.clone().add(hit.face.normal.clone().multiplyScalar(0.1));
          const x = Math.floor(p.x);
          const y = Math.floor(p.y);
          const z = Math.floor(p.z);
          
          world.setBlock(x, y, z, slot.id);
          
          // Decrement Inventory
          slot.count--;
          if (slot.count <= 0) {
            slot.id = 0;
            slot.count = 0;
          }
          refreshInventoryUI();
        }
      }
  }
}

document.addEventListener('mousedown', (event) => {
  if (!controls.isLocked && !isMobile) return;
  if (isInventoryOpen) return;
  
  if (event.button === 0) performAttack();
  else if (event.button === 2) performInteract();
});

const playerHalfWidth = 0.3;
const playerHeight = 1.8;
const eyeHeight = 1.6;

function checkCollision(position: THREE.Vector3): boolean {
  const minX = Math.floor(position.x - playerHalfWidth);
  const maxX = Math.floor(position.x + playerHalfWidth);
  const minY = Math.floor(position.y - eyeHeight);
  const maxY = Math.floor(position.y - eyeHeight + playerHeight);
  const minZ = Math.floor(position.z - playerHalfWidth);
  const maxZ = Math.floor(position.z + playerHalfWidth);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (world.hasBlock(x, y, z)) {
          // Precise AABB check
          // Block AABB (blocks are centered at integer coordinates)
          const blockMinX = x;
          const blockMaxX = x + 1;
          const blockMinY = y;
          const blockMaxY = y + 1;
          const blockMinZ = z;
          const blockMaxZ = z + 1;

          // Player AABB
          const playerMinX = position.x - playerHalfWidth;
          const playerMaxX = position.x + playerHalfWidth;
          const playerMinY = position.y - eyeHeight;
          const playerMaxY = position.y - eyeHeight + playerHeight;
          const playerMinZ = position.z - playerHalfWidth;
          const playerMaxZ = position.z + playerHalfWidth;

          if (
            playerMinX < blockMaxX &&
            playerMaxX > blockMinX &&
            playerMinY < blockMaxY &&
            playerMaxY > blockMinY &&
            playerMinZ < blockMaxZ &&
            playerMaxZ > blockMinZ
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Animation Loop
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  world.update(controls.object.position);
  
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  // Update Entities & Pickup
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    entity.update(time / 1000, delta);

    if (entity.isDead) {
      entities.splice(i, 1);
      continue;
    }

    if (entity.mesh.position.distanceTo(controls.object.position) < 2.5) {
      // Pickup logic
      const type = entity.type;
      
      // 1. Try to find existing slot with same type
      let targetSlot = inventorySlots.find(s => s.id === type);
      
      // 2. If not found, find first empty slot
      if (!targetSlot) {
        targetSlot = inventorySlots.find(s => s.id === 0);
        if (targetSlot) {
            targetSlot.id = type;
            targetSlot.count = 0;
        }
      }

      // 3. Add to slot if found
      if (targetSlot) {
        targetSlot.count++;
        entity.dispose();
        entities.splice(i, 1);
        
        // Update Hotbar label if picking up to active slot
        if (targetSlot === inventorySlots[selectedSlot]) {
            onHotbarChange();
        } else {
            refreshInventoryUI();
        }
      }
    }
  }

  // Update Mob Manager
  mobManager.update(delta, controls.object.position, takeDamage);

  // Cursor Update
  if (controls.isLocked || isMobileGameStarted) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(scene.children);
    const hit = intersects.find(i => i.object !== cursorMesh && i.object !== controls.object && (i.object as any).isMesh && !(i.object as any).isItem && !(i.object.parent as any)?.isMob);

    if (hit && hit.distance < 6) {
      cursorMesh.visible = true;
      const p = hit.point.clone().add(raycaster.ray.direction.clone().multiplyScalar(0.1));
      cursorMesh.position.set(
        Math.floor(p.x) + 0.5,
        Math.floor(p.y) + 0.5,
        Math.floor(p.z) + 0.5
      );
    } else {
      cursorMesh.visible = false;
    }
  }
  
  if (controls.isLocked || isMobileGameStarted) {
    // Safety: Don't apply physics if the current chunk isn't loaded yet
    // This prevents falling through the world upon load/teleport
    if (!world.isChunkLoaded(controls.object.position.x, controls.object.position.z)) {
         // Still update entities/mobs even if player is frozen, but skip player physics
         // Actually, if we return here, we skip player movement code below.
         // We rely on the global world.update() at start of animate() to keep loading chunks.
        return; 
    }

    // Input Vector (Local)
    const inputX = Number(moveRight) - Number(moveLeft);
    const inputZ = Number(moveForward) - Number(moveBackward);

    // Get Camera Direction (World projected to flat plane)
    const forward = new THREE.Vector3();
    controls.getDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // Wish Direction (World)
    const moveDir = new THREE.Vector3()
        .addScaledVector(forward, inputZ)
        .addScaledVector(right, inputX);
    
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    // Acceleration & Friction
    const speed = 50.0; // Acceleration force
    const friction = 10.0; // Friction factor

    if (moveForward || moveBackward || moveLeft || moveRight) {
        velocity.x += moveDir.x * speed * delta;
        velocity.z += moveDir.z * speed * delta;
    }

    velocity.x -= velocity.x * friction * delta;
    velocity.z -= velocity.z * friction * delta;
    velocity.y -= GRAVITY * delta;

    // Apply & Collide X
    controls.object.position.x += velocity.x * delta;
    if (checkCollision(controls.object.position)) {
        controls.object.position.x -= velocity.x * delta;
        velocity.x = 0;
    }

    // Apply & Collide Z
    controls.object.position.z += velocity.z * delta;
    if (checkCollision(controls.object.position)) {
        controls.object.position.z -= velocity.z * delta;
        velocity.z = 0;
    }

    // Apply & Collide Y
    controls.object.position.y += velocity.y * delta;
    
    // Assume we are in air until we hit ground
    isOnGround = false;

    if (checkCollision(controls.object.position)) {
      // Collision detected on Y axis
      if (velocity.y < 0) {
        // Falling, hit ground
        isOnGround = true;
        controls.object.position.y -= velocity.y * delta;
        velocity.y = 0;
      } else {
        // Jumping, hit ceiling
        controls.object.position.y -= velocity.y * delta;
        velocity.y = 0;
      }
    }
    
    // Fallback for falling out of world
    if (controls.object.position.y < -50) {
        controls.object.position.set(8, 20, 20);
        velocity.set(0, 0, 0);
    }
  }

  prevTime = time;

  renderer.render(scene, camera);
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Mobile Controls Implementation

if (isMobile) {

  // Joystick Logic

  const joystickZone = document.getElementById('joystick-zone')!;

  const joystickStick = document.getElementById('joystick-stick')!;

  

  let stickStartX = 0;

  let stickStartY = 0;

  let isDraggingStick = false;

  let joystickTouchId: number | null = null;

  

  joystickZone.addEventListener('touchstart', (e) => {

    e.preventDefault();

    // If already dragging, ignore new touches in zone

    if (isDraggingStick) return;



    const touch = e.changedTouches[0];

    joystickTouchId = touch.identifier;

    

    // Set center based on the zone

    const rect = joystickZone.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;

    const centerY = rect.top + rect.height / 2;

    

    stickStartX = centerX;

    stickStartY = centerY;

    isDraggingStick = true;

  });



  joystickZone.addEventListener('touchmove', (e) => {

    e.preventDefault();

    if (!isDraggingStick || joystickTouchId === null) return;

    

    // Find the specific touch for the joystick

    let touch: Touch | undefined;

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === joystickTouchId) {

            touch = e.changedTouches[i];

            break;

        }

    }

    

    if (!touch) return; // The moving touch is not the joystick one

    

    const dx = touch.clientX - stickStartX;

    const dy = touch.clientY - stickStartY;

    

    // Clamp stick visual

    const maxDist = 40;

    const distance = Math.sqrt(dx*dx + dy*dy);

    const clampedDist = Math.min(distance, maxDist);

    const angle = Math.atan2(dy, dx);

    

    const stickX = Math.cos(angle) * clampedDist;

    const stickY = Math.sin(angle) * clampedDist;

    

    joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

    

    // Update movement flags

    const threshold = 10;

    moveForward = dy < -threshold;

    moveBackward = dy > threshold;

    moveLeft = dx < -threshold;

    moveRight = dx > threshold;

  });



  const resetStick = (e: TouchEvent) => {

    if (!isDraggingStick || joystickTouchId === null) return;



    // Check if the ending touch is the joystick touch

    let touchFound = false;

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === joystickTouchId) {

            touchFound = true;

            break;

        }

    }



    if (touchFound) {

        isDraggingStick = false;

        joystickTouchId = null;

        joystickStick.style.transform = `translate(-50%, -50%)`;

        moveForward = false;

        moveBackward = false;

        moveLeft = false;

        moveRight = false;

    }

  };



  joystickZone.addEventListener('touchend', resetStick);

  joystickZone.addEventListener('touchcancel', resetStick);



  // Buttons

  document.getElementById('btn-jump')!.addEventListener('touchstart', (e) => {

    e.preventDefault();

    if (isOnGround) {

        velocity.y = JUMP_IMPULSE;

        isOnGround = false;

    }

  });



  document.getElementById('btn-attack')!.addEventListener('touchstart', (e) => {

    e.preventDefault();

    performAttack();

  });



  document.getElementById('btn-place')!.addEventListener('touchstart', (e) => {

    e.preventDefault();

    performInteract();

  });

  

  document.getElementById('btn-inv')!.addEventListener('touchstart', (e) => {

      e.preventDefault();

      toggleInventory();

  });



  // Camera Look (Touch Drag on background)

  let lastLookX = 0;

  let lastLookY = 0;

  let lookTouchId: number | null = null;

  

  document.addEventListener('touchstart', (e) => {

    if (lookTouchId !== null) return; // Already looking with a finger



    const target = e.target as HTMLElement;

    if (target.closest('#joystick-zone') || target.closest('.mob-btn') || target.closest('#inventory-menu') || target.closest('#hotbar') || target.closest('#btn-inv')) return;

    

    const touch = e.changedTouches[0];

    lookTouchId = touch.identifier;

    lastLookX = touch.clientX;

    lastLookY = touch.clientY;

  });



  document.addEventListener('touchmove', (e) => {

    if (lookTouchId === null) return;

    

     const target = e.target as HTMLElement;

    if (target.closest('#joystick-zone') || target.closest('.mob-btn') || target.closest('#inventory-menu') || target.closest('#hotbar') || target.closest('#btn-inv')) return;



    // Find the look touch

    let touch: Touch | undefined;

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === lookTouchId) {

            touch = e.changedTouches[i];

            break;

        }

    }

    

    if (!touch) return;



    const dx = touch.clientX - lastLookX;

    const dy = touch.clientY - lastLookY;

    

    lastLookX = touch.clientX;

    lastLookY = touch.clientY;

    

    // Sensitivity

    const SENSITIVITY = 0.005;

    

    controls.object.rotation.y -= dx * SENSITIVITY;

    camera.rotation.x -= dy * SENSITIVITY;

    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

  });



  const endLook = (e: TouchEvent) => {

    if (lookTouchId === null) return;

    

    for (let i = 0; i < e.changedTouches.length; i++) {

        if (e.changedTouches[i].identifier === lookTouchId) {

            lookTouchId = null;

            break;

        }

    }

  };



  document.addEventListener('touchend', endLook);

  document.addEventListener('touchcancel', endLook);



  // Fullscreen Prompt

  const btnStart = document.getElementById('btn-start-mobile')!;

  const fsPrompt = document.getElementById('fs-prompt')!;

  

  btnStart.addEventListener('touchstart', () => {

    isMobileGameStarted = true;

    document.documentElement.requestFullscreen().catch(err => {

        console.log("Fullscreen denied", err);

    });

    fsPrompt.style.display = 'none';

  });

}



async function initGame() {
    console.log("Initializing game...");
    try {
        const data = await world.loadWorld();
        if (data.playerPosition) {
            controls.object.position.copy(data.playerPosition);
            velocity.set(0, 0, 0); 
        }
        if (data.inventory) {
            for(let i=0; i<36; i++) {
                if (data.inventory[i]) {
                    inventorySlots[i] = data.inventory[i];
                }
            }
            refreshInventoryUI();
        }
    } catch (e) {
        console.error("Failed to load world:", e);
    }

    // Auto-save loop
    setInterval(() => {
        world.saveWorld({
            position: controls.object.position,
            inventory: inventorySlots
        });
    }, 30000);

    animate();
}

initGame();
