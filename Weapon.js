class Weapon {
    constructor(type) {
        this.type = type;
        if (type === 'rifle') {
            this.damage = 25;
            this.headshotMultiplier = 2;
            this.fireRate = 0.1; // seconds between shots
            this.magSize = 30;
            this.reserveAmmo = 120;
            this.reloadTime = 2.0;
            this.automatic = true;
            this.spread = 0.015;
        } else if (type === 'knife') {
            this.damage = 75;           // high melee damage
            this.headshotMultiplier = 1; // no headshot bonus for melee
            this.fireRate = 0.6;         // swing cooldown
            this.magSize = Infinity;     // no ammo
            this.reserveAmmo = Infinity;
            this.reloadTime = 0;
            this.automatic = false;
            this.spread = 0;
            this.meleeRange = 3.5;       // metres
            this.isKnife = true;
        } else {
            // pistol
            this.damage = 30;
            this.headshotMultiplier = 2;
            this.fireRate = 0.25;
            this.magSize = 12;
            this.reserveAmmo = 48;
            this.reloadTime = 1.5;
            this.automatic = false;
            this.spread = 0.01;
        }
        this.currentAmmo = this.magSize;
        this.isReloading = false;
        this.reloadTimer = 0;
        this.fireCooldown = 0;
        this.name = type;
    }

    canShoot() {
        if (this.isKnife) return this.fireCooldown <= 0;
        return this.currentAmmo > 0 && !this.isReloading && this.fireCooldown <= 0;
    }

    shoot() {
        if (!this.canShoot()) return false;
        if (!this.isKnife) this.currentAmmo--;
        this.fireCooldown = this.fireRate;
        return true;
    }

    startReload() {
        if (this.isKnife) return false;
        if (this.isReloading || this.currentAmmo === this.magSize || this.reserveAmmo <= 0) return false;
        this.isReloading = true;
        this.reloadTimer = this.reloadTime;
        if (window.game && window.game.audio && window.game.audio.playMagSwap) {
            window.game.audio.playMagSwap();
        }
        return true;
    }

    update(dt) {
        if (this.fireCooldown > 0) this.fireCooldown -= dt;
        if (this.isReloading) {
            this.reloadTimer -= dt;
            if (this.reloadTimer <= 0) {
                const needed = this.magSize - this.currentAmmo;
                const canReload = Math.min(needed, this.reserveAmmo);
                this.currentAmmo += canReload;
                this.reserveAmmo -= canReload;
                this.isReloading = false;
                if (window.game && window.game.audio && window.game.audio.playChamber) {
                    window.game.audio.playChamber();
                }
            }
        }
    }

    getReloadProgress() {
        if (!this.isReloading) return 0;
        return 1 - (this.reloadTimer / this.reloadTime);
    }
}
