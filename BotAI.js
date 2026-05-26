class BotAI extends RemotePlayer {
    constructor(scene, playerIndex, team, botName) {
        super(scene, playerIndex, team);
        this.name = 'BotAI';
        this.botName = botName || `Bot_${team}_${playerIndex}`;
        this.displayName = this.botName;
        this.isBot = true;

        // AI State
        this.aiState = 'patrol'; // patrol, chase, cover, attack
        this.stateTimer = 0;
        this.targetEnemy = null;
        this.patrolTarget = new THREE.Vector3();
        this.coverTarget = null;
        this.shootCooldown = 0;
        this.reactionTime = 0.1 + Math.random() * 0.2;
        this.reactionTimer = 0;
        this.accuracy = 0.65 + Math.random() * 0.35;
        this.sightRange = 50;
        this.attackRange = 40;
        this.moveSpeed = 7.5;
        this.lastSeenEnemyPos = null;
        this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        this.strafeTimer = 0;
        this.burstCount = 0;
        this.burstCooldown = 0;
        this.headHeight = 1.55; // Matches RemotePlayer head sphere center
        this.weapon = new Weapon('rifle');
        this.pickNewPatrolTarget();
    }

    respawn(spawnPos) {
        super.respawn(spawnPos);
        // FIX (Bug 8): Reset the bot's weapon state on respawn so it doesn't
        // start the next life stuck mid-reload with zero ammo.
        if (this.weapon) {
            this.weapon.currentAmmo = this.weapon.magSize;
            this.weapon.isReloading = false;
            this.weapon.reloadTimer = 0;
            this.weapon.fireCooldown = 0;
        }
        this.shootCooldown = 0;
        this.burstCooldown = 0;
        this.burstCount = 0;
        this.targetEnemy = null;
        this.lastSeenEnemyPos = null;
    }

    pickNewPatrolTarget(forceRandom = false) {
        const WAYPOINTS = [
            new THREE.Vector3( 0, 1.5,  0), new THREE.Vector3( 25, 1.5,  25), new THREE.Vector3(-25, 1.5,  25),
            new THREE.Vector3( 25, 1.5, -25), new THREE.Vector3(-25, 1.5, -25), new THREE.Vector3( 25, 1.5,  0),
            new THREE.Vector3(-25, 1.5,  0), new THREE.Vector3(  0, 1.5,  25), new THREE.Vector3(  0, 1.5, -25)
        ];
        if (!this.patrolTarget) this.patrolTarget = this.position.clone();
        
        let bestTarget = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
        
        if (!forceRandom) {
            bestTarget = this.patrolTarget.clone();
            for(let attempt=0; attempt<5; attempt++) {
                const potential = WAYPOINTS[Math.floor(Math.random() * WAYPOINTS.length)];
                if(potential.distanceTo(this.position) > 5) {
                    // Safely check path obstruction
                    const arena = window.game && window.game.arenaMap;
                    if (!arena || !arena.isPathObstructed || !arena.isPathObstructed(this.position, potential, 0.5)) {
                        bestTarget = potential;
                        break;
                    }
                }
            }
        }
        
        this.patrolTarget.copy(bestTarget);
    }

    findNearestEnemy() {
        if (!window.game) return null;
        const enemies = window.game.getAllTargets(this.team);
        let nearest = null;
        let nearestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead) continue;
            const dist = this.position.distanceTo(enemy.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }
        return nearest;
    }

    canSeeTarget(target) {
        if (!window.game || !window.game.arenaMap) return false;
        const dist = this.position.distanceTo(target.position);
        if (dist > this.sightRange) return false;
        
        const dir = target.position.clone().sub(this.position).normalize();
        
        // FIX (Bug 7): In Three.js the default forward direction is -Z.
        // A Y-rotation of 0 should give forward = (0,0,-1), so Z must be
        // -cos(angle).  The original +cos(angle) pointed the cone *backwards*,
        // meaning bots could only "see" enemies behind them.
        if (!this._fwd) { this._fwd = new THREE.Vector3(); this._flatDir = new THREE.Vector3(); }
        this._fwd.set(Math.sin(this.targetRotY), 0, -Math.cos(this.targetRotY));
        this._flatDir.set(dir.x, 0, dir.z).normalize();
        const forward = this._fwd;
        const flatDir = this._flatDir;
        if (forward.dot(flatDir) < 0.5) return false;
        
        const eyePos = this.position.clone();
        eyePos.y += 1.2;
        const result = window.game.arenaMap.raycast(eyePos, dir, dist);
        return !result.hit || result.distance >= dist - 1;
    }

    findNearestCover(fromThreat) {
        if (!window.game || !window.game.arenaMap) return null;
        const covers = window.game.arenaMap.coverPositions;
        let bestCover = null;
        let bestScore = -Infinity;

        for (const cover of covers) {
            const distToSelf = this.position.distanceTo(cover);
            if (distToSelf > 20) continue; // Too far

            // Prefer cover that's close to us but away from threat
            const dirToCover = cover.clone().sub(this.position).normalize();
            const dirToThreat = fromThreat.clone().sub(this.position).normalize();
            const awayFromThreat = -dirToCover.dot(dirToThreat); // Higher = more behind us
            const score = awayFromThreat * 10 - distToSelf;
            if (score > bestScore) {
                bestScore = score;
                bestCover = cover.clone();
                bestCover.y = 1.5;
            }
        }
        return bestCover;
    }

    moveToward(target, dt) {
        if (!window.game || !window.game.arenaMap) return;
        const dir = target.clone().sub(this.position);
        dir.y = 0;
        if (dir.length() < 1) return;
        dir.normalize();

        const oldPos = this.position.clone();
        const newPos = this.position.clone();
        newPos.x += dir.x * this.moveSpeed * dt;
        newPos.z += dir.z * this.moveSpeed * dt;

        const resolved = window.game.arenaMap.resolveCollision(oldPos, newPos, this.radius);
        this.position.x = resolved.x;
        this.position.z = resolved.z;

        // Stuck detection
        if (this.position.distanceTo(oldPos) < (this.moveSpeed * dt * 0.1)) {
            this.stuckTimer = (this.stuckTimer || 0) + dt;
        } else {
            this.stuckTimer = 0;
        }

        if (this.stuckTimer > 0.5) {
            this.stuckTimer = 0;
            if (this.aiState === 'chase' && this.lastSeenEnemyPos) {
                this.lastSeenEnemyPos = null;
                this.aiState = 'patrol';
            }
            this.pickNewPatrolTarget(true); // Force pick a random waypoint without checking LOS to guarantee we turn around
        }

        // Face movement direction
        this.targetRotY = Math.atan2(dir.x, dir.z);
    }

    strafeAround(target, dt) {
        if (!window.game || !window.game.arenaMap) return;
        const toTarget = target.clone().sub(this.position);
        toTarget.y = 0;
        toTarget.normalize();

        // Strafe perpendicular
        const strafeVec = new THREE.Vector3(-toTarget.z * this.strafeDir, 0, toTarget.x * this.strafeDir);
        const moveVec = toTarget.clone().multiplyScalar(0.3).add(strafeVec);
        moveVec.normalize();

        const oldPos = this.position.clone();
        const newPos = this.position.clone();
        newPos.x += moveVec.x * this.moveSpeed * 0.6 * dt;
        newPos.z += moveVec.z * this.moveSpeed * 0.6 * dt;

        const resolved = window.game.arenaMap.resolveCollision(oldPos, newPos, this.radius);
        this.position.x = resolved.x;
        this.position.z = resolved.z;

        // Face enemy
        this.targetRotY = Math.atan2(toTarget.x, toTarget.z);
    }

    tryShoot(target) {
        if (this.shootCooldown > 0 || this.burstCooldown > 0) return;
        if (!this.weapon.canShoot()) {
            this.weapon.startReload();
            return;
        }

        // Accuracy check
        if (Math.random() > this.accuracy) {
            this.shootCooldown = 0.15;
            return;
        }

        this.weapon.shoot();
        this.burstCount++;

        // Create hitscan from bot
        if (window.game) {
            const eyePos = this.position.clone();
            eyePos.y += 1.2; // bot eye height above feet

            // Aim at the enemy body centre (feet + 0.75), not their feet.
            // This matches the body sphere centre used in raycastEntity.
            const aimTarget = target.position.clone();
            // Randomise vertical aim between feet (0.3) and top of head (1.7)
            // so headshots are incidental, not guaranteed.
            aimTarget.y += 0.3 + Math.random() * 1.4;

            const dir = aimTarget.sub(eyePos).normalize();
            // Add lateral + vertical inaccuracy spread
            const inaccuracy = (1 - this.accuracy) * 0.12;
            dir.x += (Math.random() - 0.5) * inaccuracy;
            dir.y += (Math.random() - 0.5) * inaccuracy;
            dir.z += (Math.random() - 0.5) * inaccuracy;
            dir.normalize();
            window.game.performBotHitscan(this, eyePos, dir);
        }

        this.shootCooldown = 0.08 + Math.random() * 0.05;

        // Burst fire then pause
        if (this.burstCount >= 5 + Math.floor(Math.random() * 5)) {
            this.burstCount = 0;
            this.burstCooldown = 0.2 + Math.random() * 0.3;
        }
    }

    updateAI(dt) {
        if (this.isDead) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0 && window.game && window.game.arenaMap) {
                this.respawn(window.game.arenaMap.getSpawn(this.team));
                this.aiState = 'patrol';
                this.pickNewPatrolTarget();
            }
            return;
        }

        this.weapon.update(dt);
        this.shootCooldown = Math.max(0, this.shootCooldown - dt);
        this.burstCooldown = Math.max(0, this.burstCooldown - dt);
        this.strafeTimer -= dt;
        this.stateTimer -= dt;

        if (this.strafeTimer <= 0) {
            this.strafeDir = Math.random() > 0.5 ? 1 : -1;
            this.strafeTimer = 1 + Math.random() * 2;
        }

        const enemy = this.findNearestEnemy();
        const canSee = enemy && this.canSeeTarget(enemy);
        const distToEnemy = enemy ? this.position.distanceTo(enemy.position) : Infinity;

        switch (this.aiState) {
            case 'patrol':
                this.moveToward(this.patrolTarget, dt);
                if (this.position.distanceTo(this.patrolTarget) < 3) {
                    this.pickNewPatrolTarget();
                }
                if (canSee) {
                    this.targetEnemy = enemy;
                    this.reactionTimer = this.reactionTime;
                    this.aiState = 'chase';
                }
                break;

            case 'chase':
                if (!enemy || enemy.isDead) {
                    this.aiState = 'patrol';
                    this.pickNewPatrolTarget();
                    break;
                }
                this.reactionTimer -= dt;
                if (canSee && distToEnemy < this.attackRange) {
                    if (this.reactionTimer <= 0) {
                        this.aiState = 'attack';
                    }
                }
                if (canSee) {
                    this.lastSeenEnemyPos = enemy.position.clone();
                    this.moveToward(enemy.position, dt);
                } else if (this.lastSeenEnemyPos) {
                    this.moveToward(this.lastSeenEnemyPos, dt);
                    // Re-check: moveToward() can null lastSeenEnemyPos when bot is stuck
                    if (this.lastSeenEnemyPos && this.position.distanceTo(this.lastSeenEnemyPos) < 3) {
                        this.lastSeenEnemyPos = null;
                        this.aiState = 'patrol';
                        this.pickNewPatrolTarget();
                    }
                } else {
                    this.aiState = 'patrol';
                    this.pickNewPatrolTarget();
                }
                break;

            case 'attack':
                if (!enemy || enemy.isDead) {
                    this.aiState = 'patrol';
                    this.pickNewPatrolTarget();
                    break;
                }
                if (!canSee) {
                    this.lastSeenEnemyPos = enemy.position.clone();
                    this.aiState = 'chase';
                    break;
                }
                // Strafe while shooting
                this.strafeAround(enemy.position, dt);
                this.tryShoot(enemy);

                // Seek cover if low health
                if (this.health < 40) {
                    const cover = this.findNearestCover(enemy.position);
                    if (cover) {
                        this.coverTarget = cover;
                        this.aiState = 'cover';
                        this.stateTimer = 3;
                    }
                }
                break;

            case 'cover':
                if (!this.coverTarget || this.stateTimer <= 0) {
                    this.aiState = 'patrol';
                    this.pickNewPatrolTarget();
                    break;
                }
                this.moveToward(this.coverTarget, dt);
                if (this.position.distanceTo(this.coverTarget) < 2) {
                    // Peek and shoot if enemy visible
                    if (canSee && enemy && !enemy.isDead) {
                        this.tryShoot(enemy);
                        const toEnemy = enemy.position.clone().sub(this.position);
                        toEnemy.y = 0;
                        toEnemy.normalize();
                        this.targetRotY = Math.atan2(toEnemy.x, toEnemy.z);
                    }
                }
                break;
        }

        this.targetPos.copy(this.position);
    }

    update(dt) {
        this.updateAI(dt);
        
        // Let RemotePlayer handle the animation speed logic (idle/walk/run),
        // the mixer ticking, name tag billboarding, and mesh updates.
        super.update(dt);
    }
}
