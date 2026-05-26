class RemotePlayer extends GameObject3D {
    constructor(scene, playerIndex, team) {
        super(scene);
        this.name        = 'RemotePlayer';
        this.playerIndex = playerIndex;
        this.team        = team || 'blue';
        this.targetPos   = new THREE.Vector3();
        this.targetRotY  = 0;
        this.health      = 100;
        this.maxHealth   = 100;
        this.isDead      = false;
        this.score       = 0;
        this.kills       = 0;
        this.headHeight  = 1.6;
        this.bodyHeight  = 1.75;
        this.radius      = 0.4;
        this.respawnTimer = 0;
        this.displayName = '';
        this._lastPos    = new THREE.Vector3();
        this._moving     = false;
        this._mixer      = null;
        this._actions    = {};
        this._currentAnim = null;
        this._skinnedMeshes = [];

        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);

        this._buildModel();
    }

    _buildModel() {
        const isRed   = this.team === 'red';
        const teamHex = isRed ? 0xcc2222 : 0x2255cc;

        // ─────────────────────────────────────────────────────────────────────
        // WHY NOT SkeletonUtils.clone?
        // Babylon exports the character as multiple sibling SkinnedMeshes (body,
        // hands, feet) sharing ONE skeleton. SkeletonUtils.clone only remaps the
        // skeleton for SkinnedMeshes that are *children* of the cloned root; any
        // sibling meshes stay bound to the ORIGINAL skeleton and fly off to their
        // bind-pose world position — producing the "floating hands/feet" bug.
        //
        // WHY fresh GLTFLoader.load?
        // Each call returns a fully independent scene+skeleton. No remap needed.
        // The browser caches the GLB after the first load, so every subsequent
        // call is instant (no extra network traffic).
        // ─────────────────────────────────────────────────────────────────────
        // GLTFLoader is a global addon — NOT THREE.GLTFLoader.
        const loader = new GLTFLoader();
        loader.load('dummy3.glb', (gltf) => {
            const model = gltf.scene;

            // Do NOT apply any position offsets to the raw GLTF scene.
            // Moving SkinnedMeshes locally can break their bind matrices 
            // if exported improperly from Babylon.
            model.scale.set(1, 1, 1);
            model.rotation.y = Math.PI;

            // Color every SkinnedMesh; hide any static geometry
            model.traverse(child => {
                if (child.isSkinnedMesh) {

                    child.frustumCulled = false;
                    child.castShadow    = true;
                    if (child.material) {
                        const tint = m => {
                            const c = m.clone();
                            c.color.setHex(teamHex);
                            if (c.isMeshStandardMaterial || c.isMeshPhysicalMaterial) {
                                c.metalness = 0.0;
                                c.roughness = 1.0;
                            }
                            return c;
                        };
                        child.material = Array.isArray(child.material)
                            ? child.material.map(tint)
                            : tint(child.material);
                    }
                } else if (child.isMesh) {
                    child.visible = false; // hide baked ground-plane / other static geo
                }
            });

            // Name tag
            this._nameTag = this._makeNameTag();
            this._nameTag.scale.set(1.5, 0.375, 1);
            this._nameTag.position.set(0, 0.5, 0);
            this.mesh.add(this._nameTag);

            this.mesh.add(model);
            this._model = model;

            // Ground ring
            const ringGeo = new THREE.RingGeometry(0.50, 0.62, 24);
            const ringMat = new THREE.MeshBasicMaterial({
                color: teamHex, side: THREE.DoubleSide, transparent: true, opacity: 0.8
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -1.48;
            this.mesh.add(ring);
            // AnimationMixer on the fresh model — clips are also from this fresh gltf,
            // so bone track paths resolve correctly with no cross-scene ambiguity.
            // CRITICAL FIX: Mixamo animations include position data for EVERY bone.
            // If the animation rig has different proportions than dummy3, these position
            // tracks rip the limbs apart, causing hands and feet to float away from wrists.
            // We must delete all position tracks EXCEPT the root 'Hips' bone.
            gltf.animations.forEach(clip => {
                clip.tracks = clip.tracks.filter(track => {
                    const isPositionTrack = track.name.endsWith('.position');
                    const isHips = track.name.includes('Hips');
                    // Keep track if it's NOT a position track, OR if it's the Hips position track
                    return !isPositionTrack || isHips;
                });
            });

            this._mixer   = new THREE.AnimationMixer(model);
            this._actions = {};
            for (const clip of gltf.animations) {
                const action = this._mixer.clipAction(clip);
                action.loop  = THREE.LoopRepeat;
                this._actions[clip.name] = action;
            }

            this._animIdle = this._resolveAnimName(['YBot_Idle', 'idle', 'Idle']);
            this._animWalk = this._resolveAnimName(['YBot_Walk', 'walk', 'Walk']);
            this._animRun  = this._resolveAnimName(['YBot_Run',  'run',  'Run']);
            this._playAnim(this._animIdle);

        }, undefined, err => {
            console.error('[RemotePlayer] GLB load failed, using fallback', err);
            this._buildFallback();
        });
    }

    _resolveAnimName(candidates) {
        for (const c of candidates) {
            if (this._actions[c]) return c;
        }
        const keys = Object.keys(this._actions);
        for (const c of candidates) {
            const lower = c.toLowerCase();
            const found = keys.find(k => k.toLowerCase().includes(lower));
            if (found) return found;
        }
        return keys[0] || null;
    }

    _buildFallback() {
        const isRed   = this.team === 'red';
        const teamCol = isRed ? 0xcc2222 : 0x2255cc;
        const skinCol = 0xf0c090;
        const sm = col => new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
        const box = (w,h,d,col) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), sm(col));
        const cyl = (r,h,col)   => new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8), sm(col));

        const torso = box(0.5, 0.65, 0.25, teamCol); torso.position.y = 1.1; this.mesh.add(torso);
        const head  = new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8), sm(skinCol));
        head.position.y = 1.65; this.mesh.add(head);
        [-0.13, 0.13].forEach(x => {
            const leg = cyl(0.07, 0.75, 0x222244); leg.position.set(x, 0.38, 0); this.mesh.add(leg);
        });
        [-0.33, 0.33].forEach(x => {
            const arm = cyl(0.055, 0.55, teamCol); arm.position.set(x, 1.05, 0); this.mesh.add(arm);
        });
        this._mixer = null;
        console.log('[RemotePlayer] using procedural fallback for', this.team);
    }

    _playAnim(name) {
        if (this._currentAnim === name) return;
        const next = this._actions[name];
        if (!next) return;
        if (this._currentAnim && this._actions[this._currentAnim]) {
            const prev = this._actions[this._currentAnim];
            next.reset().setEffectiveWeight(1).fadeIn(0.25);
            prev.fadeOut(0.25);
        } else {
            next.reset().setEffectiveWeight(1).play();
        }
        next.play();
        this._currentAnim = name;
    }

    _makeNameTag() {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 128);
        ctx.fillStyle = this.team === 'red' ? '#ff4444' : '#4488ff';
        ctx.font = 'bold 52px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.displayName || this.botName || this.team.toUpperCase(), 256, 80);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        return new THREE.Sprite(mat);
    }

    takeDamage(amount, attackerTeam) {
        if (this.isDead) return false;
        if (attackerTeam === this.team) return false;
        this.health -= amount;
        if (this.health <= 0) { this.health = 0; this.die(); return true; }
        return false;
    }

    die() {
        this.isDead = true;
        this.respawnTimer = 3;
        if (this.mesh) this.mesh.visible = false;
        for (const sm of this._skinnedMeshes) sm.visible = false;
    }

    respawn(spawnPos) {
        this.position.copy(spawnPos);
        this.targetPos.copy(spawnPos);
        this.health = this.maxHealth;
        this.isDead = false;
        if (this.mesh) this.mesh.visible = true;
        for (const sm of this._skinnedMeshes) sm.visible = true;
        this._playAnim(this._animIdle || 'YBot_Idle');
    }

    update(dt) {
        if (this.isDead) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0 && window.game && window.game.arenaMap)
                this.respawn(window.game.arenaMap.getSpawn(this.team));
            return;
        }

        const moved = this.position.distanceTo(this._lastPos);
        this._lastPos.copy(this.position);

        let animState;
        if (moved < 0.01)       animState = 'idle';
        else if (moved < 0.08)  animState = 'walk';
        else                    animState = 'run';

        if (animState !== this._animState) {
            this._animState = animState;
            if (animState === 'idle')
                this._playAnim(this._animIdle || 'YBot_Idle');
            else if (animState === 'walk')
                this._playAnim(this._animWalk || 'YBot_Walk');
            else
                this._playAnim(this._animRun || this._animWalk || 'YBot_Run');
        }

        this.position.lerp(this.targetPos, 0.15);
        this.rotation.y += (this.targetRotY - this.rotation.y) * 0.15;
        super.update(dt);
        
        this.mesh.position.y = this.position.y - 1.5;

        if (this._mixer) {
            this._mixer.update(dt);
        }

        if (this.weapon) this.weapon.update(dt, this.position, this.rotation);

        if (this._nameTag && window.game && window.game.camera)
            this._nameTag.lookAt(window.game.camera.position);
    }

    isHeadshot(hitPoint) {
        if (!hitPoint) return false;
        return hitPoint.y > this.position.y + 1.35;
    }

    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
        this._skinnedMeshes = [];
    }
}
