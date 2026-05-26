const PLAYER_DATA_DEFAULTS = {
    highScore: 0,
    totalKills: 0,
    totalDeaths: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    credits: 0,
    leaderboard: [{ field: 'highScore', label: 'Highest score' }]
};

class Game {
    constructor() {
        window.game = this;
        this.entities = [];
        this.remotePlayers = {};
        this.bots = [];
        this.projectiles = [];
        this.myPlayerIndex = -1;
        this.isConnected = false;
        this.isRunning = false;
        this.gameOver = false;
        this.matchStarted = false;

        // Scores
        this.redScore = 0;
        this.blueScore = 0;
        this.maxScore = 30;

        // Kill feed
        this.killFeedEntries = [];

        // Shop / Economy
        this.credits = 0;
        this.shopItems = [
            { id: 'armor', name: 'Body Armor', cost: 200, effect: 'armor', value: 50 },
            { id: 'speed', name: 'Speed Boost', cost: 150, effect: 'speed', value: 1.3 },
            { id: 'extraAmmo', name: 'Extra Ammo', cost: 100, effect: 'ammo', value: 60 },
        ];
        this.purchasedItems = [];
        this.armor = 0;
        this.shopOpen = false;

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d0d18);
        this.scene.fog = new THREE.Fog(0x0d0d18, 25, 70);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
        this.scene.add(this.camera);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const playfield = document.getElementById('playfield');
        playfield.appendChild(this.renderer.domElement);

        // Lighting
        const ambient = new THREE.AmbientLight(0x808080, 1.2);
        this.scene.add(ambient);
        const hemiLight = new THREE.HemisphereLight(0xccccff, 0x444444, 0.6);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(20, 30, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048);
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        dirLight.shadow.bias = -0.002;
        this.scene.add(dirLight);

        // Audio
        this.audio = new AudioManager();

        // Arena
        this.arenaMap = new ArenaMap(this.scene);
        this.entities.push(this.arenaMap);

        // Pointer lock
        this.isLocked = false;
        this.pointerLockBlocked = false;

        // Input
        this.keys = {};
        this.setupInput();

        // Clock
        this.clock = new THREE.Clock();
        this.lastTime = 0;

        // Resize
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(playfield);
        this.onResize();

        // Menu
        this.setupMenu();

        // SaveData
        this.playerData = null;
        this.initSaveData();

        // Connect multiplayer
        this.connectMultiplayer();

        this.start();
    }

    _sendInputFrame() {
        if (!this.isConnected || !this.player) return;
        const forward = this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0;
        const back = this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0;
        const left = this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0;
        const right = this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0;
        const dx = right - left;
        const dy = forward - back;
        Multiplayer.sendInput({
            dx: dx,
            dy: dy,
            keys: {
                space: this.keys['Space'] || false,
                shift: this.keys['ShiftLeft'] || this.keys['ShiftRight'] || false,
                shoot: this.player.isShooting || false
            }
        });
    }

    async initSaveData() {
        if (window.SaveData && SaveData.isAvailable()) {
            this.playerData = await SaveData.getPlayerData(PLAYER_DATA_DEFAULTS);
            this.credits = this.playerData.credits || 0;
        } else {
            this.playerData = { ...PLAYER_DATA_DEFAULTS };
        }
    }

    async savePlayerData() {
        if (window.SaveData && SaveData.isAvailable() && this.playerData) {
            await SaveData.setPlayerData(this.playerData);
        }
    }

    setupMenu() {
        const startBtn = document.getElementById('startBtn');
        startBtn.addEventListener('click', () => {
            this.audio.init();
            document.getElementById('mainMenu').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
            this.matchStarted = true;
            this.isRunning = true;
            
            // Request pointer lock; try-catch to avoid unhandled rejections in sandboxed browsers
            try {
                const lockPromise = document.body.requestPointerLock();
                if (lockPromise && lockPromise.catch) {
                    lockPromise.catch(() => {
                        console.warn("Pointer lock request rejected by browser promise.");
                        this.pointerLockBlocked = true;
                    });
                }
            } catch (err) {
                console.warn("requestPointerLock threw synchronous error:", err);
                this.pointerLockBlocked = true;
            }
        });

        // Settings Menu
        const settingsBtn = document.getElementById('settingsBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const volSlider = document.getElementById('volSlider');
        const sensSlider = document.getElementById('sensSlider');

        settingsBtn.addEventListener('click', () => {
            document.getElementById('menuContent').style.display = 'none';
            settingsPanel.style.display = 'flex';
        });

        closeSettingsBtn.addEventListener('click', () => {
            settingsPanel.style.display = 'none';
            document.getElementById('menuContent').style.display = 'block';
        });

        volSlider.addEventListener('input', (e) => {
            if (this.audio) {
                this.audio.masterVolume = parseFloat(e.target.value);
                if (this.audio.listener) {
                    this.audio.listener.setMasterVolume(this.audio.masterVolume);
                }
            }
        });

        sensSlider.addEventListener('input', (e) => {
            if (this.player) {
                this.player.sensitivity = parseFloat(e.target.value) * 0.002;
            } else {
                // Store globally until player is created
                window.gameMouseSensitivity = parseFloat(e.target.value) * 0.002;
            }
        });

        // Shop / Loadout from Main Menu
        const loadoutBtn = document.getElementById('loadoutBtn');
        loadoutBtn.addEventListener('click', () => {
            // Re-use the existing toggleShop logic but ensure it overlays the main menu
            this.toggleShop();
        });

        const restartBtn = document.getElementById('restartBtn');
        restartBtn.addEventListener('click', () => {
            this.restartMatch();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === document.body;
            // While the shop is open we intentionally have no pointer lock;
            // the cursor visibility is controlled by the shop CSS, not by
            // this event, so don't let it reset the cursor to 'default' here.
            if (!this.shopOpen) {
                document.body.style.cursor = this.isLocked ? 'none' : 'default';
            }
        });

        document.addEventListener('pointerlockerror', () => {
            console.warn("Pointer lock error encountered. Enabling drag-look fallback.");
            this.pointerLockBlocked = true;
        });

        // Click to re-lock if game is running
        this.renderer.domElement.addEventListener('click', () => {
            if (this.matchStarted && !this.isLocked && !this.gameOver && !this.pointerLockBlocked) {
                try {
                    document.body.requestPointerLock();
                } catch (e) {
                    console.warn("re-lock request failed:", e);
                }
            }
        });
    }

    setupInput() {
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // ESC closes shop
            if (e.code === 'Escape' && this.shopOpen) {
                this.toggleShop();
                return;
            }
            if (this.player && !this.player.isDead && this.matchStarted) {
                this.player.keys[e.code] = true;
                // Reload
                if (e.code === 'KeyR') {
                    this.player.currentWeapon.startReload();
                }
                // Weapon switch
                if (e.code === 'KeyQ') {
                    this.player.switchWeapon(this.player.currentWeaponIndex === 0 ? 1 : 0);
                }
                if (e.code === 'Digit1') this.player.switchWeapon(0);
                if (e.code === 'Digit2') this.player.switchWeapon(1);
                if (e.code === 'Digit3') this.player.switchWeapon(2);
                if (e.code === 'KeyF')   this.player.switchWeapon(2); // quick knife
                // Buy menu
                if (e.code === 'KeyB') this.toggleShop();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (this.player) {
                this.player.keys[e.code] = false;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.player || !this.matchStarted || this.gameOver || this.shopOpen) return;
            if (this.isLocked) {
                // Native pointer lock: use raw movement delta
                this.player.mouseDX += e.movementX;
                this.player.mouseDY += e.movementY;
            } else if (isDragging) {
                // Drag-look fallback
                const deltaX = e.clientX - lastMouseX;
                const deltaY = e.clientY - lastMouseY;
                this.player.mouseDX += deltaX;
                this.player.mouseDY += deltaY;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0 && this.player && this.matchStarted && !this.gameOver && !this.shopOpen) {
                // Always shoot on left click, regardless of pointer lock state
                this.player.isShooting = true;
                this.player.justClicked = true;

                // Fallback drag-look initiator
                if (!this.isLocked && this.pointerLockBlocked) {
                    isDragging = true;
                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                }
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0 && this.player) {
                this.player.isShooting = false;
                isDragging = false;
            }
        });
    }

    async connectMultiplayer() {
        try {
            if (typeof Multiplayer === 'undefined') throw new Error('No multiplayer module');
            await Multiplayer.connect();
            this.isConnected = true;
            this.myPlayerIndex = Multiplayer.getMyPlayerIndex();

            const myTeam = this.myPlayerIndex % 2 === 0 ? 'red' : 'blue';

            // Create local player
            this.player = new Player(this.scene, this.camera, this.myPlayerIndex, myTeam);
            this._applyUpgradesToPlayer();
            const spawnPos = this.arenaMap.getSpawn(myTeam);
            this.player.position.copy(spawnPos);
            this.camera.position.copy(spawnPos);
            this.entities.push(this.player);

            Multiplayer.registerGameConfig({
                worldBounds: { width: 80, height: 80 },
                playerSpeed: 8,
                maxPlayerSpeed: 15,
                maxEntitySpeed: 40,
                entityTypes: {
                    bullet: { behavior: 'projectile', collisionGroup: 'projectile' }
                },
                collisionRules: [
                    { groupA: 'player', groupB: 'projectile', effect: 'damage' }
                ]
            });

            Multiplayer.onPlayerJoin((player) => {
                const rpTeam = player.playerIndex % 2 === 0 ? 'red' : 'blue';
                const rp = new RemotePlayer(this.scene, player.playerIndex, rpTeam);
                rp.targetPos.set(player.x || 0, player.y || 1.5, player.z || 0);
                rp.score = player.score || 0;
                rp.health = player.health || 100;
                this.remotePlayers[player.id] = rp;
                this.entities.push(rp);

                // Remove bot from same team if we have excess
                this.rebalanceBots();

                const badge = document.getElementById('solo-badge');
                if (badge) badge.style.display = 'none';
            });

            Multiplayer.onPlayerLeave((data) => {
                const rp = this.remotePlayers[data.id];
                if (rp) {
                    const idx = this.entities.indexOf(rp);
                    if (idx !== -1) this.entities.splice(idx, 1);
                    rp.destroy();
                    delete this.remotePlayers[data.id];
                }
                this.rebalanceBots();
            });

            Multiplayer.onStateSync((state) => {
                if (!state || !state.players) return;
                state.players.forEach((p) => {
                    if (p.id === Multiplayer.getMyId()) return;
                    const rp = this.remotePlayers[p.id];
                    if (rp) {
                        rp.targetPos.set(p.x || 0, p.y || 1.5, p.z || 0);
                        rp.targetRotY = p.ry || 0;
                        if (p.score != null) rp.score = p.score;
                        if (p.health != null) rp.health = p.health;
                    }
                });
            });

            Multiplayer.on('playerUpdate', (data) => {
                const rp = this.remotePlayers[data.id];
                if (rp) {
                    rp.targetPos.set(data.x || 0, data.y || 1.5, data.z || 0);
                    rp.targetRotY = data.ry || 0;
                    if (data.score != null) rp.score = data.score;
                    if (data.health != null) rp.health = data.health;
                }
            });

            Multiplayer.onActionResult((result) => {
                if (result.type === 'kill') {
                    const d = result.data;
                    if (d.killerTeam === 'red') this.redScore = d.redScore || this.redScore;
                    else this.blueScore = d.blueScore || this.blueScore;
                }
                if (result.type === 'damage') {
                    const d = result.data;
                    if (d.targetId === 'local' && this.player) {
                        this.player.health = d.newHealth;
                    }
                }
            });

            Multiplayer.onMessage('kill', (data) => {
                this.addKillFeed(data.killerTeam, data.killerName, data.victimTeam, data.victimName, data.headshot);
                if (data.killerTeam === 'red') this.redScore = data.redScore;
                if (data.killerTeam === 'blue') this.blueScore = data.blueScore;
            });

            Multiplayer.onMessage('shoot', (data) => {
                // Show tracer from remote player
                const origin = new THREE.Vector3(data.ox, data.oy, data.oz);
                const dir = new THREE.Vector3(data.dx, data.dy, data.dz);
                const tracer = new Projectile(this.scene, origin, dir, data.team);
                this.projectiles.push(tracer);
                this.entities.push(tracer);
            });

            // Spawn bots
            this.spawnBots();

        } catch (e) {
            console.warn('Multiplayer connection failed, running offline:', e);
            // Create local player anyway
            this.player = new Player(this.scene, this.camera, 0, 'red');
            this._applyUpgradesToPlayer();
            const spawnPos = this.arenaMap.getSpawn('red');
            this.player.position.copy(spawnPos);
            this.camera.position.copy(spawnPos);
            this.entities.push(this.player);
            this.spawnBots();
        }
    }

    _applyUpgradesToPlayer() {
        if (!this.player) return;
        // Apply sensitivity from settings menu
        if (window.gameMouseSensitivity) {
            this.player.sensitivity = window.gameMouseSensitivity;
        }
        // Apply purchased items
        this.shopItems.forEach(item => {
            if (this.purchasedItems.includes(item.id)) {
                if (item.effect === 'speed') this.player.moveSpeed *= item.value;
                if (item.effect === 'ammo') {
                    this.player.weapons.forEach(w => w.reserveAmmo += item.value);
                }
            }
        });
    }

    spawnBots() {
        const botNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'];
        // 2 red bots, 2 blue bots
        for (let i = 0; i < 4; i++) {
            const team = i < 2 ? 'red' : 'blue';
            const bot = new BotAI(this.scene, 100 + i, team, botNames[i]);
            const spawnPos = this.arenaMap.getSpawn(team);
            bot.position.copy(spawnPos);
            bot.targetPos.copy(spawnPos);
            this.bots.push(bot);
            this.entities.push(bot);
        }
    }

    rebalanceBots() {
        // Count real players per team
        let realRed = 0, realBlue = 0;
        if (this.player) {
            if (this.player.team === 'red') realRed++; else realBlue++;
        }
        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            if (rp.team === 'red') realRed++; else realBlue++;
        }
        // We keep at least 2 bots per team, remove extras if real players fill slots
        // For simplicity, always keep bots for now
    }

    getAllTargets(excludeTeam) {
        const targets = [];
        if (this.player && this.player.team !== excludeTeam && !this.player.isDead) {
            targets.push(this.player);
        }
        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            if (rp.team !== excludeTeam && !rp.isDead) {
                targets.push(rp);
            }
        }
        for (const bot of this.bots) {
            if (bot.team !== excludeTeam && !bot.isDead) {
                targets.push(bot);
            }
        }
        return targets;
    }

    performHitscan(shooter) {
        const origin = shooter.getEyePosition();
        const dir = shooter.getShootDirection();
        const maxDist = 100;

        // Send tracer to other players
        if (this.isConnected) {
            Multiplayer.sendMessage('shoot', {
                ox: origin.x, oy: origin.y, oz: origin.z,
                dx: dir.x, dy: dir.y, dz: dir.z,
                team: shooter.team
            });
        }

        // Local tracer
        const tracer = new Projectile(this.scene, origin, dir, shooter.team);
        this.projectiles.push(tracer);
        this.entities.push(tracer);

        // Check hits against enemies
        const enemies = this.getAllTargets(shooter.team);
        let closestHit = null;
        let closestDist = maxDist;
        let hitPoint = null;
        let hitResult = null;

        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const result = this.raycastEntity(origin, dir, enemy);
            if (result.hit && result.distance < closestDist) {
                closestDist = result.distance;
                closestHit = enemy;
                hitPoint = result.point;
                hitResult = result;
            }
        }

        // Check if wall is closer
        const wallHit = this.arenaMap.raycast(origin, dir, closestDist);
        if (wallHit.hit && wallHit.distance < closestDist) {
            closestHit = null; // Wall blocked the shot
        }

        if (closestHit) {
            // Use the isHead flag returned directly from raycastEntity (sphere ID),
            // not the post-hoc position check which was offset-sensitive.
            const isHeadshot = closestHit === this.player ? false : (hitResult && hitResult.isHead);
            const damage = isHeadshot ? shooter.currentWeapon.damage * shooter.currentWeapon.headshotMultiplier : shooter.currentWeapon.damage;
            const killed = closestHit.takeDamage(damage, shooter.team);

            // Show hit marker if shooter is the local player
            if (shooter === this.player) {
                const marker = document.getElementById('hitMarker');
                if (marker) {
                    // Reset animation
                    marker.classList.remove('hit-marker-active');
                    void marker.offsetWidth; // trigger reflow
                    marker.classList.add('hit-marker-active');
                    
                    // Optional: hit sound
                    if (this.audio && this.audio.playHit) {
                        // this.audio.playHit(); // Already played on takeDamage, but could be specific hit marker sound
                    }
                }
            }

            if (shooter === this.player && hitPoint) {
                // Damage number floating in world space above hit point
                const displayPos = hitPoint.clone();
                displayPos.y += 0.6;
                this.spawnDamageNumber(displayPos, damage, isHeadshot);
            }
            if (killed) {
                this.onKill(shooter, closestHit, isHeadshot);
            }
        }
    }

    performBotHitscan(bot, origin, dir) {
        const maxDist = 100;

        const enemies = this.getAllTargets(bot.team);
        let closestHit = null;
        let closestDist = maxDist;
        let hitPoint = null;
        let hitResult = null;

        for (const enemy of enemies) {
            if (enemy === bot || enemy.isDead) continue;
            const result = this.raycastEntity(origin, dir, enemy);
            if (result.hit && result.distance < closestDist) {
                closestDist = result.distance;
                closestHit = enemy;
                hitPoint = result.point;
                hitResult = result;
            }
        }

        const wallHit = this.arenaMap.raycast(origin, dir, closestDist);
        if (wallHit.hit && wallHit.distance < closestDist) {
            closestHit = null;
        }

        // Tracer
        const tracer = new Projectile(this.scene, origin, dir, bot.team);
        this.projectiles.push(tracer);
        this.entities.push(tracer);

        if (closestHit) {
            const isHeadshot = hitResult ? hitResult.isHead : false;
            const damage = isHeadshot ? 50 : 25;
            const killed = closestHit.takeDamage(damage, bot.team, bot.position.clone());

            // Show damage number above victim from any bot attack
            if (hitPoint) {
                const displayPos = hitPoint.clone();
                displayPos.y += 0.5;
                // Only show numbers on enemies of the local player
                if (closestHit !== this.player) {
                    this.spawnDamageNumber(displayPos, damage, isHeadshot);
                }
            }

            if (killed) {
                this.onKill(bot, closestHit, isHeadshot);
            }
        }
    }

    raycastEntity(origin, dir, entity) {
        // ---------- cached allocations (created once, reused every shot) ----------
        if (!this._ray) {
            this._ray          = new THREE.Ray();
            this._bodySphere   = new THREE.Sphere(new THREE.Vector3(), 0.45);
            this._headSphere   = new THREE.Sphere(new THREE.Vector3(), 0.22);
            this._bodyIntersect = new THREE.Vector3();
            this._headIntersect = new THREE.Vector3();
        }

        // Build ray from caller's origin + direction (normalise here)
        this._ray.origin.copy(origin);
        this._ray.direction.copy(dir).normalize();

        // ------------------------------------------------------------------
        // Body sphere: centred at mid-torso.
        // entity.position.y is the FEET level (spawn = y 1.5).
        // The visible torso runs from +0.3 to +1.3 above feet → centre at +0.75
        // We use radius 0.55 to comfortably cover torso + arms without being
        // unfairly large (previous value 0.5 was centred at the FEET).
        // ------------------------------------------------------------------
        // entity.position.y == physics capsule centre (≈1.5 above floor).
        // Visual model is offset -1.5, so model feet are at world Y=0.
        // Body centre is at world Y≈0.85 → 0.85 - 1.5 = -0.65 offset.
        this._bodySphere.center.copy(entity.position);
        this._bodySphere.center.y -= 0.65; // puts centre at world Y≈0.85 (mid-torso)

        // Make a clean copy of the intersect vector BEFORE the call because
        // Three.js may not write to it when there is no hit (leaving stale data).
        const bI = this._bodyIntersect;
        const bodyHit = this._ray.intersectSphere(this._bodySphere, bI);

        // ------------------------------------------------------------------
        // Head sphere: centre at eye / head level.
        // For RemotePlayer/BotAI: headHeight=1.0 is defined as offset from feet.
        // The actual head mesh top is around feet+1.65; centre it at feet+1.55.
        // For the local player it doesn't matter (you can't shoot yourself).
        // ------------------------------------------------------------------
        // Head centre is at world Y≈1.55 → 1.55 - 1.5 = +0.05 offset.
        // entity.headHeight is now ignored and replaced with this fixed offset
        // so it always matches the visual model regardless of old default values.
        this._headSphere.center.copy(entity.position);
        this._headSphere.center.y += 0.05; // puts centre at world Y≈1.55 (mid-head)

        const hI = this._headIntersect;
        const headHit = this._ray.intersectSphere(this._headSphere, hI);

        // Head always wins over body — it's a smaller, deliberate target.
        // If the ray clips both, we reward the more precise aim.
        if (headHit) return { hit: true, distance: origin.distanceTo(hI), point: hI.clone(), isHead: true  };
        if (bodyHit) return { hit: true, distance: origin.distanceTo(bI), point: bI.clone(), isHead: false };
        return { hit: false, distance: Infinity, point: null };
    }

    onKill(killer, victim, headshot) {
        const killerName = killer.botName || killer.displayName || (killer === this.player ? (window.CurrentUser?.username || 'Player') : 'Player');
        const victimName = victim.botName || victim.displayName || (victim === this.player ? (window.CurrentUser?.username || 'Player') : 'Player');

        // FIX (Bug 3): Always increment score locally so the HUD updates
        // immediately.  When connected, also tell the server — but pass the
        // already-incremented values so the server and all clients agree.
        if (killer.team === 'red') this.redScore++;
        else this.blueScore++;

        if (this.isConnected) {
            Multiplayer.requestAction('kill', {
                killerTeam: killer.team,
                killerName,
                victimTeam: victim.team,
                victimName,
                headshot,
                redScore: this.redScore,
                blueScore: this.blueScore
            });
        }

        // Credits for kills
        if (killer === this.player) {
            this.credits += headshot ? 150 : 100;
            killer.kills++;
            if (this.playerData) {
                this.playerData.totalKills = (this.playerData.totalKills || 0) + 1;
                this.playerData.credits = this.credits;
                this.savePlayerData();
            }
        }

        if (victim === this.player && this.playerData) {
            this.playerData.totalDeaths = (this.playerData.totalDeaths || 0) + 1;
            this.savePlayerData();
        }

        this.addKillFeed(killer.team, killerName, victim.team, victimName, headshot);

        // Broadcast kill
        if (this.isConnected) {
            Multiplayer.sendMessage('kill', {
                killerTeam: killer.team,
                killerName,
                victimTeam: victim.team,
                victimName,
                headshot,
                redScore: this.redScore,
                blueScore: this.blueScore
            });
        }

        // Leaderboard & Kill Confirm
        if (killer === this.player) {
            // Show Kill Confirm Popup
            const killPopup = document.getElementById('killConfirm');
            if (killPopup) {
                console.log('[KILL] headshot =', headshot, '| victim =', victimName);

                // Reset
                killPopup.classList.remove('kill-confirm-active', 'kill-headshot');
                killPopup.style.animation = 'none';
                void killPopup.offsetWidth; // reflow to restart animation

                if (headshot) {
                    killPopup.textContent = '\u2605 HEADSHOT KILL';
                    killPopup.style.color = '#FF6A00';
                    killPopup.style.textShadow = '0 0 30px rgba(255,100,0,1), 0 0 60px rgba(255,40,0,0.7), 0 2px 0 #000';
                } else {
                    killPopup.textContent = 'ELIMINATED';
                    killPopup.style.color = '#FFE11A';
                    killPopup.style.textShadow = '0 0 24px rgba(255,225,26,0.9), 0 2px 0 #000';
                }

                killPopup.style.animation = '';
                killPopup.classList.add('kill-confirm-active');

                if (this._killConfirmTimer) clearTimeout(this._killConfirmTimer);
                this._killConfirmTimer = setTimeout(() => {
                    killPopup.classList.remove('kill-confirm-active');
                    killPopup.style.color = '';
                    killPopup.style.textShadow = '';
                }, 1800);
            }

            const score = killer.kills;
            if (window.Leaderboard && Leaderboard.isAvailable()) {
                Leaderboard.attest(score, { kills: killer.kills, deaths: killer.deaths });
            }
            if (this.playerData && score > this.playerData.highScore) {
                this.playerData.highScore = score;
                this.savePlayerData();
            }
        }

        // Check win condition
        if (this.redScore >= this.maxScore || this.blueScore >= this.maxScore) {
            this.endMatch();
        }
    }

    addKillFeed(killerTeam, killerName, victimTeam, victimName, headshot) {
        const feed = document.getElementById('killFeed');
        if (!feed) return;
        const entry = document.createElement('div');
        entry.className = 'killFeedEntry';
        const hsText = headshot ? ' ★' : '';
        entry.innerHTML = `<span style="color:${killerTeam === 'red' ? '#ff4444' : '#4488ff'}">${killerName}</span>${hsText} → <span style="color:${victimTeam === 'red' ? '#ff4444' : '#4488ff'}">${victimName}</span>`;
        feed.appendChild(entry);
        setTimeout(() => {
            if (entry.parentNode) entry.parentNode.removeChild(entry);
        }, 3500);
        // Keep only last 5
        while (feed.children.length > 5) feed.removeChild(feed.children[0]);
    }

    async endMatch() {
        this.gameOver = true;
        this.isRunning = false;
        document.exitPointerLock();

        const winner = this.redScore >= this.maxScore ? 'RED' : 'BLUE';
        const winColor = winner === 'RED' ? '#ff4444' : '#4488ff';

        const victoryScreen = document.getElementById('victoryScreen');
        document.getElementById('victoryTitle').style.color = winColor;
        document.getElementById('victoryTitle').textContent = 'VICTORY';
        document.getElementById('victoryTeam').innerHTML = `<span style="color:${winColor}">${winner} TEAM WINS!</span>`;
        document.getElementById('victoryScore').textContent = `RED ${this.redScore} - ${this.blueScore} BLUE`;
        
        // Generate match leaderboard
        const players = [];
        if (this.player) {
            players.push({
                name: 'You',
                team: this.player.team,
                kills: this.player.kills || 0,
                deaths: this.player.deaths || 0
            });
        }
        this.bots.forEach(bot => {
            players.push({
                name: bot.name || 'Bot',
                team: bot.team,
                kills: bot.kills || 0,
                deaths: bot.deaths || 0
            });
        });
        
        // Sort by kills (descending), then deaths (ascending)
        players.sort((a, b) => {
            if (b.kills !== a.kills) return b.kills - a.kills;
            return a.deaths - b.deaths;
        });
        
        const lbHtml = `
            <table style="width: 100%; border-collapse: collapse; font-family: 'Share Tech Mono', monospace; font-size: 16px;">
                <thead>
                    <tr style="border-bottom: 1px solid #555; text-align: left;">
                        <th style="padding: 5px; color: #aaa;">PLAYER</th>
                        <th style="padding: 5px; color: #aaa; text-align: right;">K</th>
                        <th style="padding: 5px; color: #aaa; text-align: right;">D</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.map(p => `
                        <tr>
                            <td style="padding: 5px; color: ${p.team === 'red' ? '#ff6666' : '#66aaff'}">${p.name}</td>
                            <td style="padding: 5px; text-align: right; color: #fff;">${p.kills}</td>
                            <td style="padding: 5px; text-align: right; color: #888;">${p.deaths}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.getElementById('matchLeaderboard').innerHTML = lbHtml;

        victoryScreen.style.display = 'flex';

        // Save
        if (this.playerData) {
            this.playerData.gamesPlayed = (this.playerData.gamesPlayed || 0) + 1;
            if ((winner === 'RED' && this.player && this.player.team === 'red') ||
                (winner === 'BLUE' && this.player && this.player.team === 'blue')) {
                this.playerData.gamesWon = (this.playerData.gamesWon || 0) + 1;
            }
            await this.savePlayerData();
        }

        // Leaderboard finalize
        if (this.player && window.Leaderboard && Leaderboard.isAvailable()) {
            await Leaderboard.finalize(this.player.kills, { kills: this.player.kills, deaths: this.player.deaths });
        }
    }

    restartMatch() {
        document.getElementById('victoryScreen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        this.redScore = 0;
        this.blueScore = 0;
        this.gameOver = false;
        this.isRunning = true;

        // Reset player
        if (this.player) {
            this.player.kills = 0;
            this.player.deaths = 0;
            this.player.respawn(this.arenaMap.getSpawn(this.player.team));
        }

        // Reset bots
        for (const bot of this.bots) {
            bot.health = 100;
            bot.isDead = false;
            bot.kills = 0;
            bot.respawn(this.arenaMap.getSpawn(bot.team));
            bot.aiState = 'patrol';
            bot.pickNewPatrolTarget();
            if (bot.mesh) bot.mesh.visible = true;
        }

        // FIX (Bug 4): Also purge destroyed projectiles from this.entities,
        // otherwise stale objects remain in the update list and crash when they
        // try to access their null mesh.
        for (const p of this.projectiles) {
            const idx = this.entities.indexOf(p);
            if (idx !== -1) this.entities.splice(idx, 1);
            p.destroy();
        }
        this.projectiles = [];

        // Re-acquire pointer lock via a trusted click on the canvas.
        // The restartBtn click is already a trusted gesture, so dispatching a
        // synthetic click on the renderer element works here.
        try {
            this.renderer.domElement.click();
        } catch(e) {
            // Fallback: try directly (may silently fail in some browsers)
            try { document.body.requestPointerLock(); } catch(e2) {}
        }
    }


    // ── Damage Number Indicators ──────────────────────────────────────────
    spawnDamageNumber(worldPos, damage, isHeadshot) {
        const el = document.createElement('div');
        el.className = 'dmg-number' + (isHeadshot ? ' dmg-headshot' : '');
        el.textContent = isHeadshot ? `${Math.round(damage)}!` : Math.round(damage);

        // Project world position to screen
        const vec = worldPos.clone().project(this.camera);
        const canvas = this.renderer.domElement;
        const x = (vec.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-vec.y * 0.5 + 0.5) * canvas.clientHeight;

        el.style.left = x + 'px';
        el.style.top  = y + 'px';

        const container = document.getElementById('dmgNumberLayer');
        if (!container) return;
        container.appendChild(el);

        // Animate upward then remove
        let vy = -60; // px/s upward
        let opacity = 1;
        let elapsed = 0;
        const duration = isHeadshot ? 1.0 : 0.75;
        const tick = (ts) => {
            if (!el.parentNode) return;
            elapsed += 0.016;
            vy -= 40 * 0.016;
            opacity = Math.max(0, 1 - elapsed / duration);
            el.style.transform = `translate(-50%, ${vy * elapsed}px)`;
            el.style.opacity = opacity;
            if (elapsed < duration) requestAnimationFrame(tick);
            else el.remove();
        };
        requestAnimationFrame(tick);
    }

    // Show a directional arc on the HUD to indicate where damage came from
    showDirectionalHit(attackerPos) {
        if (!this.player) return;
        const toAttacker = new THREE.Vector3().subVectors(attackerPos, this.player.position);
        toAttacker.y = 0;
        toAttacker.normalize();

        // Convert to angle relative to player facing
        const facing = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
        let angle = Math.atan2(
            facing.x * toAttacker.z - facing.z * toAttacker.x,
            facing.x * toAttacker.x + facing.z * toAttacker.z
        );
        // angle=0 means attacker is ahead; PI = behind; -PI/2 = left; PI/2 = right

        const indicator = document.getElementById('dirHitIndicator');
        if (!indicator) return;
        indicator.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
        indicator.style.opacity = '1';
        clearTimeout(this._dirHitTimer);
        this._dirHitTimer = setTimeout(() => {
            if (indicator) indicator.style.opacity = '0';
        }, 600);
    }

    toggleShop() {
        // Allow opening shop from main menu before game starts
        if (this.matchStarted && (!this.player || this.player.isDead)) return;

        const shopUI = document.getElementById('shopUI');
        
        if (shopUI.style.display === 'flex') {
            shopUI.style.display = 'none';
            this.shopOpen = false;
            // Only hide cursor if we are actually in-game
            if (this.matchStarted) {
                document.body.style.cursor = 'none';
            }
            return;
        }

        // Only enforce proximity to pillar if game is actually running
        if (this.matchStarted) {
            let nearPillar = false;
            if (this.arenaMap && this.arenaMap.buyPillars) {
                for (const p of this.arenaMap.buyPillars) {
                    const dist = Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z);
                    if (dist <= 5.0) { // 5 meter interaction radius
                        nearPillar = true;
                        break;
                    }
                }
            }

            if (!nearPillar) {
                const hint = document.getElementById('terminalHint');
                if (hint) {
                    hint.style.opacity = '1';
                    clearTimeout(this._hintTimer);
                    this._hintTimer = setTimeout(() => { hint.style.opacity = '0'; }, 2000);
                }
                return;
            }
        }

        // Open shop — keep pointer lock active; just show the cursor via CSS
        // so it appears over the shop UI without ever releasing the lock.
        shopUI.style.display = 'flex';
        this.shopOpen = true;
        document.body.style.cursor = 'default';

        // Render UI
        this.renderShopUI();
    }

    // Returns { available, label, reason } for each shop item
    _itemAvailability(item) {
        const canAfford = this.credits >= item.cost;
        switch (item.effect) {
            case 'armor':
                if (this.armor >= item.value)
                    return { available: false, label: 'ARMOR FULL', reason: 'Armor already at maximum.' };
                if (!canAfford)
                    return { available: false, label: 'OUT OF FUNDS', reason: null };
                return { available: true, label: this.armor > 0 ? 'RESTOCK ARMOR' : 'PURCHASE ARMOR', reason: null };
            case 'speed':
                if (this.purchasedItems.includes('speed'))
                    return { available: false, label: 'OWNED', reason: 'Already installed. Cannot stack.' };
                if (!canAfford)
                    return { available: false, label: 'OUT OF FUNDS', reason: null };
                return { available: true, label: 'PURCHASE UPGRADE', reason: null };
            case 'ammo': {
                const anyNeedsAmmo = this.player && this.player.weapons.some(w => w.reserveAmmo < w.magSize * 4);
                if (!anyNeedsAmmo)
                    return { available: false, label: 'AMMO FULL', reason: 'All reserves are full.' };
                if (!canAfford)
                    return { available: false, label: 'OUT OF FUNDS', reason: null };
                return { available: true, label: 'RESTOCK AMMO', reason: null };
            }
            default:
                return { available: canAfford, label: canAfford ? 'PURCHASE' : 'OUT OF FUNDS', reason: null };
        }
    }

    renderShopUI() {
        document.getElementById('shopCredits').textContent = `Available Credits: $${this.credits}`;
        const grid = document.getElementById('shopItemsGrid');
        grid.innerHTML = '';

        this.shopItems.forEach(item => {
            const { available, label, reason } = this._itemAvailability(item);

            let desc = '';
            if (item.effect === 'armor') {
                const cur = Math.ceil(this.armor);
                desc = `Reinforces combat suit. Absorbs damage (+${item.value} Armor)` +
                       (cur > 0 ? ` <span style="color:#44aaff">[Current: ${cur}]</span>` : '') + '.';
            }
            if (item.effect === 'speed') desc = `Modulates stride velocity. +${Math.round(item.value*100 - 100)}% speed. <em>One-time.</em>`;
            if (item.effect === 'ammo') {
                const reserves = this.player ? this.player.weapons.map(w => w.type + ': ' + w.reserveAmmo).join(' / ') : '';
                desc = `Replenishes tactical reserve ammo (+${item.value} rounds each).` +
                       (reserves ? ` <span style="color:#aaa">[${reserves}]</span>` : '');
            }
            if (reason) desc += ` <span style="color:#ff8844">${reason}</span>`;

            const div = document.createElement('div');
            div.className = 'shop-item' + (available ? '' : ' shop-item-unavailable');
            div.innerHTML =
                '<div class="shop-item-name">[ ' + item.name.toUpperCase() + ' ]</div>' +
                '<div class="shop-item-desc">' + desc + '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">' +
                    '<span style="font-weight:bold;color:oklch(0.75 0.01 240);">Cost: $' + item.cost + '</span>' +
                    '<button class="shop-buy-btn"' + (available ? '' : ' disabled') + '>' + label + '</button>' +
                '</div>';
            if (available) {
                div.querySelector('.shop-buy-btn').addEventListener('click', () => this.buyItem(item));
            }
            grid.appendChild(div);
        });

        const closeBtn = document.getElementById('closeShopBtn');
        closeBtn.onclick = () => { if (this.shopOpen) this.toggleShop(); };
    }

    buyItem(item) {
        const { available } = this._itemAvailability(item);
        if (!available) return;
        this.credits -= item.cost;

        switch (item.effect) {
            case 'armor':
                this.armor = item.value;
                if (this.player) this.player.updateArmorVisual();
                break;
            case 'speed':
                if (!this.purchasedItems.includes('speed')) {
                    this.purchasedItems.push('speed');
                    if (this.player) this.player.moveSpeed *= item.value;
                }
                break;
            case 'ammo':
                if (this.player) this.player.weapons.forEach(w => w.reserveAmmo += item.value);
                break;
        }

        if (this.playerData) {
            this.playerData.credits = this.credits;
            this.savePlayerData();
        }

        if (this.audio && this.audio.playShopPurchase) this.audio.playShopPurchase();
        this.renderShopUI();
    }

    updateHUD() {
        if (!this.player) return;

        document.getElementById('redScore').textContent = `RED: ${this.redScore}`;
        document.getElementById('blueScore').textContent = `BLUE: ${this.blueScore}`;

        const healthPct = (this.player.health / this.player.maxHealth) * 100;
        document.getElementById('healthBarInner').style.width = `${healthPct}%`;
        document.getElementById('healthText').textContent = Math.ceil(this.player.health);

        // Armor bar
        const armorBar = document.getElementById('armorBar');
        if (armorBar) {
            if (this.armor > 0) {
                armorBar.style.display = 'flex';
                document.getElementById('armorBarInner').style.width = `${(this.armor / 50) * 100}%`;
                document.getElementById('armorText').textContent = Math.ceil(this.armor);
            } else {
                armorBar.style.display = 'none';
            }
        }

        const wep = this.player.currentWeapon;
        document.getElementById('weaponName').textContent = `${wep.type.toUpperCase()} | $${this.credits}`;
        document.getElementById('ammoCount').textContent = wep.isKnife ? '∞  MELEE' : `${wep.currentAmmo} / ${wep.reserveAmmo}`;

        // Option C: Show terminal hint when near a Buy Pillar
        const hint = document.getElementById('terminalHint');
        if (hint && this.arenaMap && this.arenaMap.buyPillars) {
            let nearPillar = false;
            for (const p of this.arenaMap.buyPillars) {
                if (Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z) <= 5.0) {
                    nearPillar = true;
                    break;
                }
            }
            hint.style.opacity = nearPillar ? '1' : '0';
        }

        // Reload bar
        const reloadBar = document.getElementById('reloadBar');
        if (wep.isReloading) {
            reloadBar.style.display = 'block';
            document.getElementById('reloadBarInner').style.width = `${wep.getReloadProgress() * 100}%`;
        } else {
            reloadBar.style.display = 'none';
        }
    }

    update() {
        // FIX (Bug 2): getDelta() must be called every frame to keep the clock
        // ticking correctly, but we must only use the value when the game is
        // actually running — otherwise the accumulated time is wasted and the
        // first live frame gets dt≈0.
        const rawDt = this.clock.getDelta();
        if (!this.isRunning || !this.matchStarted) return;
        if (this.gameOver) return;
        const dt = Math.min(rawDt, 0.05);

        // Update player — always run during an active match; lock state only controls mouse look
        if (this.player) {
            this.player.update(dt, this.arenaMap);
        }

        // Update bots
        for (const bot of this.bots) {
            bot.update(dt);
        }

        // Update remote players
        for (const id in this.remotePlayers) {
            this.remotePlayers[id].update(dt);
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const shouldRemove = this.projectiles[i].update(dt);
            if (shouldRemove) {
                const idx = this.entities.indexOf(this.projectiles[i]);
                if (idx !== -1) this.entities.splice(idx, 1);
                this.projectiles.splice(i, 1);
            }
        }

        // Send server-authoritative input
        this._sendInputFrame();

        this.updateHUD();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const playfield = document.getElementById('playfield');
        if (!playfield) return;
        const rect = playfield.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    getObjectAt(screenX, screenY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((screenX - rect.left) / rect.width) * 2 - 1,
            -((screenY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        const meshes = this.entities.map(e => e.mesh).filter(m => m);
        const intersects = raycaster.intersectObjects(meshes, true);
        if (intersects.length > 0) {
            const hit = intersects[0].object;
            return this.entities.find(e => {
                if (!e.mesh) return false;
                if (e.mesh === hit) return true;
                let parent = hit.parent;
                while (parent) { if (parent === e.mesh) return true; parent = parent.parent; }
                return false;
            });
        }
        return null;
    }

    async start() {
        // Load saved player data - uses GameObject3D-based entities throughout
        const _baseRef = GameObject3D;
        if (window.SaveData && SaveData.isAvailable()) {
            this.playerData = await SaveData.getPlayerData(PLAYER_DATA_DEFAULTS);
            this.credits = this.playerData.credits || 0;
        }
        const gameLoop = () => {
            requestAnimationFrame(gameLoop);
            this.update();
            this.render();
        };
        gameLoop();
    }
}
