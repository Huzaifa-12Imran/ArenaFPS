class Player extends GameObject3D {
    constructor(scene, camera, playerIndex, team) {
        super(scene);
        this.name = 'Player';
        this.camera = camera;
        this.playerIndex = playerIndex;
        this.team = team;
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.respawnTimer = 0;
        this.score = 0;
        this.kills = 0;
        this.deaths = 0;

        // Movement
        this.moveSpeed = 8;
        this.sprintMultiplier = 1.6;
        this.jumpVelocity = 8;
        this.gravity = -20;
        this.onGround = true;
        this.radius = 0.5;
        this.isSprinting = false;
        this.headBob = 0;
        this.headBobSpeed = 0;
        this.footstepTimer = 0;

        // Camera
        this.yaw = 0;
        this.pitch = 0;
        this.cameraHeight = 1.5;

        // Weapons
        this.weapons = [new Weapon('rifle'), new Weapon('pistol'), new Weapon('knife')];
        this.currentWeaponIndex = 0;
        this.isShooting = false;
        this.justClicked = false;

        // Melee animation state
        this.meleeSwinging = false;
        this.meleeSwingTimer = 0;

        // Muzzle flash
        this.muzzleFlashTimer = 0;

        // Input state
        this.keys = {};
        this.mouseDX = 0;
        this.mouseDY = 0;
        this.sensitivity = 0.002;

        this.createMesh();
    }

    get currentWeapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    createMesh() {
        // Third-person body (hidden for local player, used for shadow/hitbox)
        const teamColor = this.team === 'red' ? 0xff3333 : 0x3366ff;
        const bodyMat = new THREE.MeshStandardMaterial({ color: teamColor });
        this.mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 8), bodyMat);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), bodyMat);
        head.position.y = 1.0;
        this.mesh.add(body, head);
        this.mesh.visible = false;
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        // First-person view arm + weapon group
        this.weaponGroup = new THREE.Group();
        this.createWeaponModel();
    }

    createWeaponModel() {
        // Clear previous model
        while (this.weaponGroup.children.length)
            this.weaponGroup.remove(this.weaponGroup.children[0]);

        const wep = this.currentWeapon;

        // Shared materials
        const metalMat   = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.95, roughness: 0.15 });
        const darkMat    = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.5,  roughness: 0.6  });
        const gripMat    = new THREE.MeshStandardMaterial({ color: 0x1a0f0f, metalness: 0.1,  roughness: 0.95 });
        const accentMat  = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8,  roughness: 0.2  });
        const teamColor  = this.team === 'red' ? 0xcc3311 : 0x1144cc;
        const armMat     = new THREE.MeshStandardMaterial({ color: 0xf0c090, roughness: 0.65, metalness: 0.0 });  // skin
        const sleeveColor = this.team === 'red' ? 0xcc2222 : 0x2255cc;
        const armorMat   = new THREE.MeshStandardMaterial({ color: sleeveColor, roughness: 0.55, metalness: 0.05 }); // shirt sleeve

        // Helper: add a box mesh
        const box = (w, h, d, mat, x, y, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            m.position.set(x, y, z);
            return m;
        };
        const cyl = (rt, rb, h, seg, mat, x, y, z, rx = 0) => {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
            m.position.set(x, y, z);
            if (rx) m.rotation.x = rx;
            return m;
        };

        if (wep.type === 'rifle') {
            // ── Assault Rifle ────────────────────────────────────────────
            const G = new THREE.Group();
            G.position.set(0.22, -0.26, -0.18);

            // Receiver body
            G.add(box(0.055, 0.085, 0.38, metalMat,  0,      0,      0     ));
            // Top rail
            G.add(box(0.038, 0.018, 0.44, accentMat,  0,      0.053, -0.03 ));
            // Handguard (slimmer, longer)
            G.add(box(0.048, 0.07,  0.26, darkMat,    0,      0.005, -0.30 ));
            // Handguard vents (sides)
            G.add(box(0.005, 0.04,  0.20, accentMat, -0.027,  0.005, -0.30 ));
            G.add(box(0.005, 0.04,  0.20, accentMat,  0.027,  0.005, -0.30 ));
            // Barrel
            G.add(cyl(0.016, 0.016, 0.38, 8, metalMat, 0, 0.025, -0.56, Math.PI/2));
            // Muzzle brake
            G.add(cyl(0.024, 0.024, 0.05, 8, accentMat, 0, 0.025, -0.76, Math.PI/2));
            // Charging handle
            G.add(box(0.012, 0.02,  0.04, accentMat,  0.034, 0.025,  0.04 ));
            // Magazine
            G.add(box(0.038, 0.15,  0.055, gripMat,   0,     -0.115, -0.01 ));
            // Magwell curve hint
            G.add(box(0.038, 0.03,  0.055, darkMat,   0,     -0.042, -0.01 ));
            // Pistol grip
            G.add(box(0.038, 0.12,  0.048, gripMat,   0,     -0.115,  0.10 ));
            // Stock body
            G.add(box(0.044, 0.065, 0.20,  darkMat,   0,     -0.008,  0.27 ));
            // Stock cheekpiece
            G.add(box(0.044, 0.045, 0.10,  accentMat, 0,      0.025,  0.31 ));
            // Front sight post
            G.add(box(0.007, 0.03,  0.007, accentMat, 0,      0.072, -0.43 ));
            // Rear sight
            G.add(box(0.028, 0.022, 0.012, accentMat, 0,      0.068,  0.01 ));

            this.weaponGroup.add(G);

            // ── First-person arm (right) — human skin ────────────────────
            const arm = new THREE.Group();
            arm.position.set(0.22, -0.30, 0.10);
            // Sleeve (shirt colour, upper arm)
            const slvM = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.060, 0.22, 10), armorMat);
            slvM.rotation.x = Math.PI / 2; slvM.position.set(0, 0, -0.11); arm.add(slvM);
            // Elbow skin bump
            const elbM = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), armMat);
            elbM.position.set(0, 0, -0.23); arm.add(elbM);
            // Forearm (skin)
            const foreM = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.050, 0.24, 10), armMat);
            foreM.rotation.x = Math.PI / 2; foreM.position.set(0, 0, -0.35); arm.add(foreM);
            // Hand
            const handM = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.09), armMat);
            handM.position.set(0, -0.008, -0.49); arm.add(handM);
            this.weaponGroup.add(arm);

            // Muzzle flash light at barrel tip
            this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 8);
            this.muzzleLight.position.set(0.22, -0.235, -0.78);
            this.weaponGroup.add(this.muzzleLight);

        } else if (wep.type === 'knife') {
            // ── Custom Scythe Model (Blockbench JSON) ────────────────────────
            const G = new THREE.Group();
            G.position.set(0.10, -0.25, -0.40); // Bottom-right viewmodel position

            if (!window.loadBlockbenchWeapon) {
                window.loadBlockbenchWeapon = async (jsonUrl, texUrl) => {
                    if (!window.blockbenchCache) window.blockbenchCache = {};
                    if (window.blockbenchCache[jsonUrl]) return window.blockbenchCache[jsonUrl].clone();

                    const group = new THREE.Group();
                    try {
                        const response = await fetch(jsonUrl);
                        const data = await response.json();
                        const tex = new THREE.TextureLoader().load(texUrl);
                        tex.magFilter = THREE.NearestFilter;
                        tex.minFilter = THREE.NearestFilter;
                        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
                        const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1, roughness: 0.8, metalness: 0.1 });
                        
                        const texW = data.texture_size ? data.texture_size[0] : 16;
                        const texH = data.texture_size ? data.texture_size[1] : 16;

                        data.elements.forEach(el => {
                            const w = el.to[0] - el.from[0];
                            const h = el.to[1] - el.from[1];
                            const d = el.to[2] - el.from[2];
                            if (w===0 && h===0 && d===0) return;
                            
                            const geom = new THREE.BoxGeometry(w || 0.01, h || 0.01, d || 0.01);
                            
                            const facesMap = ['east', 'west', 'up', 'down', 'south', 'north'];
                            const uvAttr = geom.attributes.uv;
                            
                            for (let i = 0; i < 6; i++) {
                                const faceName = facesMap[i];
                                const faceData = el.faces && el.faces[faceName];
                                const vIdx = i * 4;
                                if (faceData && faceData.uv) {
                                    const uMin = faceData.uv[0] / texW;
                                    const uMax = faceData.uv[2] / texW;
                                    const vMax = 1.0 - (faceData.uv[1] / texH);
                                    const vMin = 1.0 - (faceData.uv[3] / texH);
                                    
                                    uvAttr.setXY(vIdx + 0, uMin, vMax);
                                    uvAttr.setXY(vIdx + 1, uMax, vMax);
                                    uvAttr.setXY(vIdx + 2, uMin, vMin);
                                    uvAttr.setXY(vIdx + 3, uMax, vMin);
                                } else {
                                    for(let v=0;v<4;v++) uvAttr.setXY(vIdx+v, 0, 0);
                                }
                            }
                            
                            const mesh = new THREE.Mesh(geom, mat);
                            const cx = (el.from[0] + el.to[0]) / 2;
                            const cy = (el.from[1] + el.to[1]) / 2;
                            const cz = (el.from[2] + el.to[2]) / 2;
                            mesh.position.set(cx, cy, cz);
                            
                            if (el.rotation) {
                                const origin = el.rotation.origin;
                                mesh.position.set(cx - origin[0], cy - origin[1], cz - origin[2]);
                                const wrapper = new THREE.Group();
                                wrapper.position.set(origin[0], origin[1], origin[2]);
                                wrapper.add(mesh);
                                const angle = el.rotation.angle * Math.PI / 180;
                                if (el.rotation.axis === 'x') wrapper.rotation.x = angle;
                                if (el.rotation.axis === 'y') wrapper.rotation.y = angle;
                                if (el.rotation.axis === 'z') wrapper.rotation.z = angle;
                                group.add(wrapper);
                            } else {
                                group.add(mesh);
                            }
                        });
                        
                        group.position.set(-8, -8, -8);
                        const outer = new THREE.Group();
                        outer.scale.set(0.009, 0.009, 0.009); // Medium scale
                        outer.add(group);
                        
                        window.blockbenchCache[jsonUrl] = outer;
                        return outer.clone();
                    } catch (e) {
                        console.error('Failed to load blockbench model', e);
                        return new THREE.Group();
                    }
                };
            }

            window.loadBlockbenchWeapon('Scythe.json', 'scythe.png').then(scytheModel => {
                // X=-PI/2: convert Y-up blockbench to Z-forward three.js
                // Z=+PI/2: swing staff from vertical to horizontal (pointing right)
                // Y=PI: face correctly, not mirrored
                scytheModel.rotation.x = -Math.PI / 2;
                scytheModel.rotation.y = Math.PI;
                scytheModel.rotation.z = Math.PI / 2;   // lay it flat/horizontal
                G.add(scytheModel);
            });
            
            this.weaponGroup.add(G);

            // Arm (human)
            const arm = new THREE.Group();
            arm.position.set(0.18, -0.35, -0.05); // Pulled back to match weapon position
            const slvK = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.060, 0.20, 10), armorMat);
            slvK.rotation.x = Math.PI / 2; slvK.position.set(0, 0, -0.10); arm.add(slvK);
            const elbK = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), armMat);
            elbK.position.set(0, 0, -0.21); arm.add(elbK);
            const foreK = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.050, 0.22, 10), armMat);
            foreK.rotation.x = Math.PI / 2; foreK.position.set(0, 0, -0.32); arm.add(foreK);
            const handK = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.08), armMat);
            handK.position.set(0, -0.008, -0.44); arm.add(handK);
            this.weaponGroup.add(arm);

            this.muzzleLight = new THREE.PointLight(0xffffff, 0, 0);
            this.weaponGroup.add(this.muzzleLight);

        } else {
            // ── Heavy Pistol (Desert Eagle style) ───────────────────────────────────────────────────
            const G = new THREE.Group();
            G.position.set(0.15, -0.15, -0.30); // Pushed back into view to avoid near-plane clipping

            const silverMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.85, roughness: 0.25 });
            const blackMat  = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2, roughness: 0.8 });

            // Massive Slide
            G.add(box(0.05, 0.06, 0.28, silverMat, 0, 0.04, -0.05));
            // Triangle cut on slide (signature look)
            G.add(cyl(0.02, 0.02, 0.28, 3, silverMat, 0, 0.07, -0.05, Math.PI/2));
            
            // Frame / Lower
            G.add(box(0.046, 0.03, 0.24, silverMat, 0, 0.0, -0.03));
            
            // Big Barrel opening
            G.add(cyl(0.016, 0.016, 0.02, 12, blackMat, 0, 0.05, -0.19, Math.PI/2));

            // Heavy trigger guard
            G.add(box(0.046, 0.015, 0.08, silverMat, 0, -0.04, -0.02)); // bottom
            G.add(box(0.046, 0.04, 0.015, silverMat, 0, -0.02, -0.05)); // front
            
            // Trigger
            G.add(box(0.01, 0.03, 0.015, blackMat, 0, -0.02, 0.01));
            
            // Chunky Grip
            const gripG = new THREE.Group();
            gripG.position.set(0, -0.08, 0.06);
            gripG.add(box(0.044, 0.12, 0.06, silverMat, 0, 0, 0)); // grip frame
            gripG.add(box(0.05, 0.11, 0.05, blackMat, 0, 0, 0)); // rubber grip panels
            gripG.rotation.x = 0.15;
            G.add(gripG);
            
            // Magazine Base
            G.add(box(0.046, 0.015, 0.06, blackMat, 0, -0.14, 0.08));
            
            // Iron Sights (blocky)
            G.add(box(0.01, 0.015, 0.015, blackMat, 0, 0.075, -0.17)); // front
            G.add(box(0.04, 0.015, 0.02, blackMat, 0, 0.075, 0.08)); // rear

            this.weaponGroup.add(G);

            // ── First-person arm (right) ────────────────────
            const arm = new THREE.Group();
            arm.position.set(0.15, -0.30, 0.0); // Pushed back to match weapon
            const slvP = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.060, 0.20, 10), armorMat);
            slvP.rotation.x = Math.PI / 2; slvP.position.set(0, 0, -0.10); arm.add(slvP);
            const elbP = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 6), armMat);
            elbP.position.set(0, 0, -0.21); arm.add(elbP);
            const foreP = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.050, 0.22, 10), armMat);
            foreP.rotation.x = Math.PI / 2; foreP.position.set(0, 0, -0.32); arm.add(foreP);
            const handP = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.08), armMat);
            handP.position.set(0, -0.008, -0.44); arm.add(handP);
            this.weaponGroup.add(arm);

            // Muzzle flash light
            this.muzzleLight = new THREE.PointLight(0xffaa33, 0, 6);
            this.muzzleLight.position.set(0.15, -0.10, -0.50);
            this.weaponGroup.add(this.muzzleLight);
        }

        // ── Body-armor plate on the left forearm (shown when armor active) ──
        this.armorPlate = box(0.10, 0.06, 0.18,
            new THREE.MeshStandardMaterial({
                color: this.team === 'red' ? 0x881111 : 0x112288,
                metalness: 0.9, roughness: 0.2,
                emissive: this.team === 'red' ? 0x440000 : 0x001144,
                emissiveIntensity: 0.5
            }),
            -0.18, -0.26, -0.10
        );
        this.armorPlate.visible = false;
        this.weaponGroup.add(this.armorPlate);

        this.camera.add(this.weaponGroup);
    }

    // Call this when armor is purchased/consumed so the plate appears/disappears
    updateArmorVisual() {
        if (!this.armorPlate) return;
        const hasArmor = window.game && window.game.armor > 0;
        this.armorPlate.visible = hasArmor;
    }

    switchWeapon(index) {
        if (index === this.currentWeaponIndex) return;
        if (this.currentWeapon.isReloading) return;
        this.currentWeaponIndex = index;
        this.createWeaponModel();
    }

    takeDamage(amount, attackerTeam) {
        if (this.isDead) return false;
        if (attackerTeam === this.team) return false; // No friendly fire

        // Option C: Invulnerability in Terminal Pillar zones
        let isInvulnerable = false;
        if (window.game && window.game.arenaMap && window.game.arenaMap.buyPillars) {
            for (const p of window.game.arenaMap.buyPillars) {
                if (Math.hypot(p.x - this.position.x, p.z - this.position.z) <= 5.0) {
                    isInvulnerable = true;
                    break;
                }
            }
        }

        if (isInvulnerable) {
            // Give an audio cue that the shield absorbed it
            if (window.game && window.game.audio) window.game.audio.playHit();
            return false;
        }

        // FIX (Bug 5): Apply purchased Body Armor damage reduction.
        // game.armor holds remaining armor HP; it absorbs damage first.
        if (window.game && window.game.armor > 0) {
            const absorbed = Math.min(amount, window.game.armor);
            window.game.armor -= absorbed;
            amount -= absorbed;
            // Update the arm plate visibility when armor depletes
            this.updateArmorVisual();
            if (amount <= 0) {
                if (window.game.audio) window.game.audio.playHit();
                return false;
            }
        }

        this.health -= amount;

        // Damage flash
        const overlay = document.getElementById('damageOverlay');
        if (overlay) {
            overlay.style.opacity = '0.6';
            setTimeout(() => overlay.style.opacity = '0', 150);
        }

        if (window.game && window.game.audio) window.game.audio.playHit();

        // Mobile shopping vulnerability: auto-close shop on damage (if they walked out of zone while shopping)
        if (window.game && window.game.shopOpen) {
            window.game.toggleShop();
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
            return true; // killed
        }
        return false;
    }

    die() {
        this.isDead = true;
        this.deaths++;
        this.respawnTimer = 3;
        if (window.game && window.game.audio) window.game.audio.playDeath();
        const overlay = document.getElementById('respawnOverlay');
        if (overlay) overlay.style.display = 'flex';
    }

    respawn(spawnPos) {
        this.position.copy(spawnPos);
        this.velocity.set(0, 0, 0);
        this.health = this.maxHealth;
        this.isDead = false;
        this.onGround = true;
        // FIX (Bug 6): Immediately snap the camera to the spawn position so
        // there is no one-frame jump from the death location to the respawn point.
        if (this.camera) {
            this.camera.position.set(spawnPos.x, spawnPos.y + this.cameraHeight, spawnPos.z);
        }
        this.weapons.forEach(w => {
            w.currentAmmo = w.magSize;
            w.isReloading = false;
        });
        const overlay = document.getElementById('respawnOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    update(dt, arenaMap) {
        if (this.isDead) {
            this.respawnTimer -= dt;
            const text = document.getElementById('respawnText');
            if (text) text.textContent = `Respawning in ${Math.ceil(this.respawnTimer)}...`;
            if (this.respawnTimer <= 0 && arenaMap) {
                this.respawn(arenaMap.getSpawn(this.team));
            }
            return;
        }

        // Mouse look
        this.yaw -= this.mouseDX * this.sensitivity;
        this.pitch -= this.mouseDY * this.sensitivity;
        this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
        this.mouseDX = 0;
        this.mouseDY = 0;

        // Camera rotation (reuse euler to avoid allocation)
        if (!this._euler) this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this._euler.set(this.pitch, this.yaw, 0);
        this.camera.quaternion.setFromEuler(this._euler);

        // Movement (cached vectors - no per-frame allocation)
        if (!this._fwdVec) {
            this._fwdVec = new THREE.Vector3();
            this._rightVec = new THREE.Vector3();
            this._yawQuat = new THREE.Quaternion();
            this._yawEuler = new THREE.Euler(0, 0, 0, 'YXZ');
            this._moveDir = new THREE.Vector3();
        }
        this._yawEuler.set(0, this.yaw, 0);
        this._yawQuat.setFromEuler(this._yawEuler);
        this._fwdVec.set(0, 0, -1).applyQuaternion(this._yawQuat);
        this._rightVec.set(1, 0, 0).applyQuaternion(this._yawQuat);
        const forward = this._fwdVec;
        const right = this._rightVec;

        const moveDir = this._moveDir;
        moveDir.set(0, 0, 0);
        if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDir.add(forward);
        if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDir.sub(forward);
        if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.add(right);
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir.sub(right);

        this.isSprinting = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            // Head bob
            this.headBobSpeed += dt * (this.isSprinting ? 18 : 12);
            this.headBob = Math.sin(this.headBobSpeed) * (this.isSprinting ? 0.06 : 0.03);
            // Footsteps
            this.footstepTimer -= dt;
            if (this.footstepTimer <= 0 && this.onGround && window.game && window.game.audio) {
                window.game.audio.playFootstep();
                this.footstepTimer = this.isSprinting ? 0.3 : 0.45;
            }
        } else {
            this.headBob *= 0.9;
        }

        // Apply horizontal movement
        const oldPos = this.position.clone();
        const newPos = this.position.clone();
        newPos.x += moveDir.x * speed * dt;
        newPos.z += moveDir.z * speed * dt;

        // Collision resolution
        if (arenaMap) {
            const resolved = arenaMap.resolveCollision(oldPos, newPos, this.radius);
            this.position.x = resolved.x;
            this.position.z = resolved.z;
        } else {
            this.position.x = newPos.x;
            this.position.z = newPos.z;
        }

        // Gravity & Jump
        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = this.jumpVelocity;
            this.onGround = false;
        }

        this.velocity.y += this.gravity * dt;
        this.position.y += this.velocity.y * dt;

        if (this.position.y <= 1.5) {
            this.position.y = 1.5;
            this.velocity.y = 0;
            this.onGround = true;
        }

        // Update camera
        this.camera.position.set(
            this.position.x,
            this.position.y + this.headBob,
            this.position.z
        );

        // Weapon update
        this.currentWeapon.update(dt);

        // Melee swing animation
        if (this.meleeSwinging) {
            this.meleeSwingTimer -= dt;
            const t = 1 - Math.max(0, this.meleeSwingTimer) / 0.3;
            if (this.weaponGroup) {
                // Stab forward then retract
                const stab = t < 0.5 ? t * 2 : (1 - t) * 2;
                this.weaponGroup.position.z = -stab * 0.18;
                this.weaponGroup.position.y = stab * 0.05;
                this.weaponGroup.rotation.x = -stab * 0.4;
            }
            if (this.meleeSwingTimer <= 0) {
                this.meleeSwinging = false;
                if (this.weaponGroup) {
                    this.weaponGroup.rotation.x = 0;
                }
            }
        }

        // Shooting
        if (this.isShooting) {
            if (this.currentWeapon.isKnife) {
                if (this.justClicked) this.tryMelee();
            } else if (this.currentWeapon.automatic || this.justClicked) {
                this.tryShoot();
            }
        }
        this.justClicked = false;

        // Muzzle flash
        if (this.muzzleFlashTimer > 0) {
            this.muzzleFlashTimer -= dt;
            this.muzzleLight.intensity = this.muzzleFlashTimer > 0 ? 5 : 0;
        }

        // Weapon sway
        if (this.weaponGroup) {
            const swayX = Math.sin(Date.now() * 0.001) * 0.002;
            const swayY = Math.cos(Date.now() * 0.0015) * 0.002;
            this.weaponGroup.position.set(swayX, swayY, 0);
        }

        // Auto reload
        if (!this.currentWeapon.isKnife && this.currentWeapon.currentAmmo === 0 && !this.currentWeapon.isReloading) {
            this.currentWeapon.startReload();
        }

        this.rotation.y = this.yaw;
        super.update(dt);
    }

    tryShoot() {
        if (!this.currentWeapon.canShoot()) return;
        if (!this.currentWeapon.shoot()) return;

        // Muzzle flash
        this.muzzleFlashTimer = 0.05;
        this.muzzleLight.intensity = 5;

        // Audio
        if (window.game && window.game.audio) {
            window.game.audio.playShoot(this.currentWeapon.type);
        }

        // Hitscan
        if (window.game) {
            window.game.performHitscan(this);
        }
    }

    tryMelee() {
        if (!this.currentWeapon.canShoot()) return;
        if (!this.currentWeapon.shoot()) return;

        // Trigger stab animation
        this.meleeSwinging = true;
        this.meleeSwingTimer = 0.3;

        // Audio – reuse hit sound or shoot sound
        if (window.game && window.game.audio) {
            window.game.audio.playHit && window.game.audio.playHit();
        }

        if (!window.game) return;
        const range = this.currentWeapon.meleeRange;
        const eyePos = this.camera.position.clone();
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

        // Check all enemies within melee range along the look direction
        const targets = window.game.getAllTargets(this.team);
        let hit = false;
        for (const target of targets) {
            if (target.isDead) continue;
            const toTarget = target.position.clone().sub(eyePos);
            const dist = toTarget.length();
            if (dist > range) continue;
            // Must be roughly in front (dot product check)
            const dot = toTarget.normalize().dot(dir);
            if (dot < 0.4) continue;

            const damage = this.currentWeapon.damage;
            const killed = target.takeDamage(damage, this.team, this.position.clone());

            // Damage number
            const displayPos = target.position.clone();
            displayPos.y += 1.2;
            window.game.spawnDamageNumber(displayPos, damage, false);

            if (killed) window.game.onKill(this, target, false);
            hit = true;
        }

        // Visual screen-shake hint on hit
        if (hit && window.game && window.game.audio) {
            window.game.audio.playHit && window.game.audio.playHit();
        }
    }

    getShootDirection() {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.camera.quaternion);
        // Apply spread then re-normalize so the direction vector stays unit length.
        // The spread values are small angles expressed as linear offset on the
        // unit sphere, which is accurate enough for an FPS at these magnitudes.
        const spread = this.currentWeapon.spread;
        if (spread > 0) {
            dir.x += (Math.random() - 0.5) * spread;
            dir.y += (Math.random() - 0.5) * spread;
            dir.z += (Math.random() - 0.5) * spread;
            dir.normalize();
        }
        return dir;
    }

    getEyePosition() {
        return this.camera.position.clone();
    }
}
