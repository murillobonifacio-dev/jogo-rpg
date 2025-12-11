/*
  ELEMENTAL LEGENDS: EVOLVED
  -------------------------------------
  Features:
  - NEW: "Normal" Class (Neutral, no passive).
  - NEW: "Type" Stat (Max 3). Level 3 unlocks Evolved Passives.
  - NEW: Red/Black Lightning VFX for Crits (Stun).
  - Infinite World Map & Camera.
  - 6 Classes, RPG Stats, Shop, Relics.
  - 2 Power-ups per stage.
*/

// ==========================================
// 1. CONFIGURATION & GLOBALS
// ==========================================

const WORLD_W = 1600;
const WORLD_H = 1200;
const STAT_CAP = 10;
const TYPE_CAP = 3;
const STAGE_TYPES = ["Fire", "Water", "Plant", "Light", "Dark"]; // Map biomes

let gameState = "MENU"; 
let previousState = ""; 
let difficulty = "Medium";
let gameMode = "Campaign";
let maxStages = 20;

let cam;
let shakeAmount = 0;

let player;
let enemies = [];
let projectiles = [];
let powerups = [];
let particles = [];
let floatText = [];

let playerColor;
let playerType = ""; 
let playerRelic = "";
let inventory = { gold: 0 };

let currentStage = 1;
let enemiesToSpawn = 0;

// ==========================================
// 2. SETUP & MAIN LOOP
// ==========================================

function setup() {
  createCanvas(800, 600);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  noStroke();
  
  cam = createVector(0, 0);
  playerColor = color(0, 255, 255);
  player = new Player();
}

function draw() {
  updateShake();
  
  switch (gameState) {
    case "MENU": drawMenu(); break;
    case "HOW_TO": drawHowTo(); break;
    case "CUSTOMIZE": drawCustomize(); break;
    case "DIFFICULTY": drawDifficultySelect(); break;
    case "MODE": drawModeSelect(); break;
    case "SELECT_TYPE": drawTypeSelect(); break;
    case "SELECT_RELIC": drawRelicSelect(); break;
    case "GAME": runGameLogic(); break;
    case "LEVEL_UP": runGameLogic(true); drawLevelUpOverlay(); break;
    case "SHOP": drawShop(); break;
    case "GAME_OVER": drawGameOver(); break;
    case "VICTORY": drawVictory(); break;
  }
  
  drawCustomCursor();
}

// ==========================================
// 3. GAMEPLAY ENGINE
// ==========================================

function startGame() {
  currentStage = 1;
  inventory.gold = 0;
  
  player = new Player();
  player.color = playerColor;
  
  // Relics
  if (playerRelic === "Life") {
    player.stats.maxHp += 2;
    player.hp = player.stats.maxHp;
    player.levels.maxHp = "RELIC"; 
  }
  if (playerRelic === "Death") {
    player.stats.critChance += 0.10;
  }
  
  // Plant Base Passive: Start with +1 Max HP
  if (playerType === "Plant") {
    player.upgradeStat("maxHp");
    player.hp = player.stats.maxHp;
  }
  
  startStage();
  gameState = "GAME";
}

function startStage() {
  enemies = [];
  projectiles = [];
  particles = [];
  powerups = [];
  
  player.pos = createVector(WORLD_W/2, WORLD_H/2);
  
  // Plant Passive: Healing per Wave
  if (playerType === "Plant" && currentStage > 1) {
    let healAmt = 1;
    // Evolved: Heals 1/4 of Total HP
    if (player.levels.typeLvl >= TYPE_CAP) {
      healAmt = floor(player.stats.maxHp / 4);
      if (healAmt < 1) healAmt = 1;
    }
    
    if (player.hp < player.stats.maxHp) {
      player.hp = min(player.hp + healAmt, player.stats.maxHp);
      createFloatText(`+${healAmt} HP`, width/2, height/2 - 100, color(50, 255, 50), true);
    }
  }
  
  // Spawn 2 Powerups
  for (let i = 0; i < 2; i++) powerups.push(new PowerUp());
  
  enemiesToSpawn = 5 + floor(currentStage * 1.5);
}

function runGameLogic(paused = false) {
  // Camera
  let targetX = player.pos.x - width/2;
  let targetY = player.pos.y - height/2;
  cam.x = lerp(cam.x, targetX, 0.1);
  cam.y = lerp(cam.y, targetY, 0.1);
  cam.x = constrain(cam.x, 0, WORLD_W - width);
  cam.y = constrain(cam.y, 0, WORLD_H - height);
  
  let sx = random(-shakeAmount, shakeAmount);
  let sy = random(-shakeAmount, shakeAmount);
  
  push();
  translate(-cam.x + sx, -cam.y + sy);
  
  drawWorldGrid();
  
  // Entities
  for (let i = powerups.length - 1; i >= 0; i--) {
    let p = powerups[i];
    p.show();
    if (!paused && p.checkCollision(player)) {
      powerups.splice(i, 1);
      previousState = "GAME";
      gameState = "LEVEL_UP";
    }
  }
  
  player.show();
  if (!paused) player.update();
  
  if (!paused && enemiesToSpawn > 0 && frameCount % 60 === 0) {
    spawnEnemy();
    enemiesToSpawn--;
  }
  
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    e.show();
    if (!paused) {
      e.update();
      if (e.checkCollision(player)) {
        player.takeDamage(1);
        e.pushBack(200); 
      }
    }
  }
  
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.show();
    if (!paused) {
      p.update();
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (p.checkCollision(enemies[j])) {
          handleCombat(p, enemies[j]);
          projectiles.splice(i, 1);
          break;
        }
      }
      if (p.toDelete && projectiles[i] === p) projectiles.splice(i, 1);
    }
  }
  
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].show();
    if (!paused) particles[i].update();
    if (particles[i].life <= 0) particles.splice(i, 1);
  }
  
  for (let i = floatText.length - 1; i >= 0; i--) {
    if (!floatText[i].isUI) {
      floatText[i].show();
      if (!paused) floatText[i].update();
      if (floatText[i].life <= 0) floatText.splice(i, 1);
    }
  }
  
  pop();
  
  // UI
  drawHUD();
  for (let i = floatText.length - 1; i >= 0; i--) {
    if (floatText[i].isUI) {
      floatText[i].show();
      if (!paused) floatText[i].update();
      if (floatText[i].life <= 0) floatText.splice(i, 1);
    }
  }
  
  if (!paused) {
    if (enemies.length === 0 && enemiesToSpawn === 0 && powerups.length === 0) {
      completeStage();
    }
    if (player.hp <= 0) {
      gameState = "GAME_OVER";
    }
  }
}

// ==========================================
// 4. COMBAT & PASSIVES
// ==========================================

function handleCombat(proj, target) {
  // 1. Calculate Multipliers
  let calc = calculateDamage(playerType, getCurrentStageType());
  
  // Dark Passive: Stacking Crit
  let actualCritChance = player.stats.critChance;
  if (playerType === "Dark") {
    actualCritChance += (player.darkStacks * 0.10);
  }
  
  let isCrit = random() < actualCritChance;
  
  // Dark Stacking Logic
  if (playerType === "Dark") {
    if (isCrit) player.darkStacks = min(player.darkStacks + 1, 4);
    else player.darkStacks = 0;
  }
  
  // 2. Handle Critical Hits
  if (isCrit) {
    // Ignore disadvantage
    if (calc.modifier < 1.0) calc.modifier = 1.0;
    
    // Dark Evolved: HitKill
    if (playerType === "Dark" && player.levels.typeLvl >= TYPE_CAP) {
      target.takeDamage(99999);
      createExplosion(target.pos.x, target.pos.y, color(0), "CRIT");
      screenShake(10);
      return; // Stop processing
    }

    // Standard Crit Effects
    target.stun(60); // 1 sec stun + lightning
    screenShake(5);
  }
  
  // 3. Apply Damage
  let dmg = player.stats.damage * calc.modifier;
  if (isCrit) dmg *= player.stats.critDamage;
  
  target.takeDamage(dmg);
  
  // Visuals
  if (!isCrit) {
    if (calc.modifier > 1.0) createExplosion(target.pos.x, target.pos.y, color(255, 200, 0), "ADV");
    else if (calc.modifier < 1.0) createExplosion(target.pos.x, target.pos.y, color(150), "DIS");
    else createExplosion(target.pos.x, target.pos.y, playerColor, "NORMAL");
  }

  // 4. Apply Passives
  let evolved = player.levels.typeLvl >= TYPE_CAP;

  // FIRE: Burn
  if (playerType === "Fire") {
    let burnDmg = 1 + (player.levels.damage * 0.5);
    target.ignite(burnDmg);
    // Evolved: Spread
    if (evolved) {
      for (let e of enemies) {
        if (e !== target && dist(e.pos.x, e.pos.y, target.pos.x, target.pos.y) < 150) {
          e.ignite(burnDmg);
        }
      }
    }
  }
  
  // WATER: Splash
  if (playerType === "Water") {
    let splashRad = evolved ? 180 : 60; // 3x larger if evolved
    createExplosion(target.pos.x, target.pos.y, color(100, 100, 255), "AOE");
    
    // Draw Splash Ring
    fill(100, 100, 255, 100);
    ellipse(target.pos.x, target.pos.y, splashRad * 2);
    
    for (let e of enemies) {
      if (e !== target && dist(e.pos.x, e.pos.y, target.pos.x, target.pos.y) < splashRad) {
        e.takeDamage(dmg * 0.5);
        createFloatText("Splash", e.pos.x, e.pos.y - 10, color(100, 200, 255));
      }
    }
  }

  // LIGHT: Pushback
  if (playerType === "Light") {
    // Evolved: AoE Push
    if (evolved) {
      for (let e of enemies) {
        if (dist(e.pos.x, e.pos.y, target.pos.x, target.pos.y) < 150) {
           e.pushBack(60);
        }
      }
      createExplosion(target.pos.x, target.pos.y, color(255, 255, 200), "AOE");
    } else {
      target.pushBack(40);
    }
  }

  // PLANT: Poison (Evolved only)
  if (playerType === "Plant" && evolved) {
    let poisonDmg = 1 + (player.levels.damage * 0.5);
    target.poison(poisonDmg);
  }
}

function calculateDamage(atk, def) {
  let m = 1.0;
  if (atk === "Normal") return { modifier: 1.0 };
  
  // Advantages (+20%)
  if (atk === "Water" && (def === "Water" || def === "Fire")) m = 1.2;
  if (atk === "Fire" && (def === "Fire" || def === "Plant")) m = 1.2;
  if (atk === "Plant" && (def === "Plant" || def === "Water")) m = 1.2;
  if (atk === "Light" && (def === "Water" || def === "Fire" || def === "Plant")) m = 1.2;
  if (atk === "Dark" && (def === "Water" || def === "Fire" || def === "Plant")) m = 1.2;
  
  // Disadvantages
  if (atk === "Water" && ["Plant", "Light", "Dark"].includes(def)) m = 0.8;
  if (atk === "Fire" && ["Water", "Light", "Dark"].includes(def)) m = 0.8;
  if (atk === "Plant" && ["Fire", "Light", "Dark"].includes(def)) m = 0.8;
  if (atk === "Light" && ["Light", "Dark"].includes(def)) m = 0.25;
  if (atk === "Dark" && ["Light", "Dark"].includes(def)) m = 0.25;
  
  return { modifier: m };
}

// ==========================================
// 5. CLASSES
// ==========================================

class Player {
  constructor() {
    this.pos = createVector(WORLD_W/2, WORLD_H/2);
    this.size = 32;
    this.hp = 3;
    this.darkStacks = 0;
    
    this.stats = {
      maxHp: 3, damage: 5, speed: 4, range: 150, // Reduced base range
      critChance: 0.05, critDamage: 1.5, atkSpeed: 1
    };
    
    this.levels = {
      maxHp: 0, damage: 0, speed: 0, range: 0, 
      critChance: 0, critDamage: 0, atkSpeed: 0, typeLvl: 0
    };
    
    this.cooldown = 0;
    this.invuln = 0;
  }
  
  update() {
    let move = createVector(0,0);
    if (keyIsDown(87)) move.y -= 1; 
    if (keyIsDown(83)) move.y += 1; 
    if (keyIsDown(65)) move.x -= 1; 
    if (keyIsDown(68)) move.x += 1; 
    
    if (move.mag() > 0) {
      move.normalize().mult(this.stats.speed);
      this.pos.add(move);
    }
    
    this.pos.x = constrain(this.pos.x, this.size, WORLD_W - this.size);
    this.pos.y = constrain(this.pos.y, this.size, WORLD_H - this.size);
    
    if (this.cooldown > 0) this.cooldown--;
    if (this.invuln > 0) this.invuln--;
    
    let fireRate = 60 / (1 + (this.stats.atkSpeed * 0.2));
    if (this.cooldown <= 0) {
      if (keyIsDown(UP_ARROW)) this.shoot(0, -1, fireRate);
      else if (keyIsDown(DOWN_ARROW)) this.shoot(0, 1, fireRate);
      else if (keyIsDown(LEFT_ARROW)) this.shoot(-1, 0, fireRate);
      else if (keyIsDown(RIGHT_ARROW)) this.shoot(1, 0, fireRate);
    }
  }
  
  shoot(dx, dy, delay) {
    projectiles.push(new Projectile(this.pos.x, this.pos.y, dx, dy, this.stats.range));
    this.cooldown = delay;
  }
  
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(0, 100); ellipse(0, 18, 32, 12); // Shadow
    
    if (this.invuln > 0 && frameCount % 6 < 3) fill(255);
    else fill(playerColor);
    
    rect(0, 0, this.size, this.size, 6);
    
    // Visual for Type Level 3 (Evolved)
    if (this.levels.typeLvl >= TYPE_CAP) {
      noFill(); stroke(255); strokeWeight(2);
      rect(0, 0, this.size+8, this.size+8, 4);
    }
    pop();
  }
  
  takeDamage(amt) {
    if (this.invuln > 0) return;
    this.hp -= amt;
    
    // Light Passive: Invuln
    if (playerType === "Light") {
      // Evolved: 10s, Normal: 5s
      let dur = (this.levels.typeLvl >= TYPE_CAP) ? 600 : 300;
      this.invuln = dur;
      createFloatText("SHIELD!", this.pos.x, this.pos.y - 40, color(255, 255, 200));
    } else {
      this.invuln = 90; // 1.5s default
    }
    
    createFloatText("-" + amt, this.pos.x, this.pos.y - 30, color(255, 50, 50));
    screenShake(10);
  }
  
  upgradeStat(key) {
    let limit = (key === "typeLvl") ? TYPE_CAP : STAT_CAP;
    if (this.levels[key] >= limit) return false;
    
    this.levels[key]++;
    
    let s = this.stats;
    switch(key) {
      case "maxHp": s.maxHp += 1; this.hp += 1; break;
      case "damage": s.damage += 2; break;
      case "speed": s.speed += 0.4; break;
      case "range": s.range += 30; break;
      case "critChance": s.critChance += 0.05; break;
      case "critDamage": s.critDamage += 0.25; break;
      case "atkSpeed": s.atkSpeed += 1; break;
      case "typeLvl": 
        createFloatText("EVOLVING...", this.pos.x, this.pos.y-50, color(255,215,0), true);
        break;
    }
    return true;
  }
}

class Enemy {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.size = 28;
    this.maxHp = 15 + (currentStage * 8);
    this.hp = this.maxHp;
    this.baseSpeed = 2.2 + (currentStage * 0.1);
    
    this.type = getCurrentStageType();
    this.col = getTypeColor(this.type);
    
    this.stunTimer = 0;
    this.burnTime = 0;
    this.burnDmg = 0;
    this.poisonTime = 0;
    this.poisonDmg = 0;
  }
  
  update() {
    // Burn (1/5 dmg calc is done at trigger)
    if (this.burnTime > 0) {
      this.burnTime--;
      if (this.burnTime % 60 === 0) { 
        this.takeDamage(this.burnDmg);
        createFloatText("Burn", this.pos.x, this.pos.y - 20, color(255, 100, 0));
      }
    }

    // Poison (Grass Evolved)
    if (this.poisonTime > 0) {
      this.poisonTime--;
      if (this.poisonTime % 60 === 0) {
        this.takeDamage(this.poisonDmg);
        createFloatText("Psn", this.pos.x, this.pos.y - 20, color(100, 255, 100));
      }
    }
    
    if (this.stunTimer > 0) {
      this.stunTimer--;
      return; // Stunned
    }
    
    let dir = p5.Vector.sub(player.pos, this.pos);
    dir.normalize().mult(this.baseSpeed);
    this.pos.add(dir);
    
    for (let other of enemies) {
      if (other !== this) {
        let d = dist(this.pos.x, this.pos.y, other.pos.x, other.pos.y);
        if (d < this.size) {
          let push = p5.Vector.sub(this.pos, other.pos).setMag(1);
          this.pos.add(push);
        }
      }
    }
  }
  
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(0, 100); ellipse(0, 15, 26, 8);
    
    noStroke(); fill(this.col);
    ellipse(0, 0, this.size);
    
    // Visual Status
    if (this.burnTime > 0 && frameCount % 10 < 5) {
      fill(255, 100, 0); ellipse(0, -5, 10);
    }
    if (this.poisonTime > 0 && frameCount % 10 < 5) {
      fill(50, 255, 50); ellipse(5, -5, 8);
    }

    // Lightning VFX (Stun/Crit)
    if (this.stunTimer > 0) {
      this.drawLightning();
    }
    
    // HP Bar
    let pct = constrain(this.hp / this.maxHp, 0, 1);
    fill(50); rect(0, -25, 30, 4);
    fill(255, 50, 50); rect(-15 + (15*pct), -25, 30*pct, 4);
    
    pop();
  }

  drawLightning() {
    strokeWeight(2);
    noFill();
    for(let i=0; i<3; i++) {
      let angle = random(TWO_PI);
      let len = this.size * 1.5;
      let startX = cos(angle) * (this.size/2);
      let startY = sin(angle) * (this.size/2);
      
      // Black/Red Lightning
      stroke(random() > 0.5 ? color(255, 0, 0) : color(0));
      
      beginShape();
      vertex(startX, startY);
      vertex(startX + random(-5,5), startY + random(-5,5) - 10);
      vertex(startX + random(-10,10), startY + random(-10,10) - 20);
      endShape();
    }
    noStroke();
  }
  
  checkCollision(target) {
    return dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y) < (this.size/2 + target.size/2);
  }
  
  pushBack(force) {
    let dir = p5.Vector.sub(this.pos, player.pos).normalize().mult(force);
    this.pos.add(dir);
    this.pos.x = constrain(this.pos.x, 20, WORLD_W-20);
    this.pos.y = constrain(this.pos.y, 20, WORLD_H-20);
  }
  
  takeDamage(val) {
    this.hp -= val;
    createFloatText(floor(val), this.pos.x, this.pos.y - 10, color(255));
    if (this.hp <= 0) {
      let idx = enemies.indexOf(this);
      if (idx > -1) enemies.splice(idx, 1);
    }
  }
  
  stun(frames) {
    this.stunTimer = frames;
  }
  
  ignite(dmg) {
    this.burnTime = 180; 
    // Passive says "1/5 of the damage" for spread, but usually apply full burn calc in handleCombat
    // Here we store the tick damage.
    this.burnDmg = dmg / 5; 
    if (this.burnDmg < 1) this.burnDmg = 1;
  }

  poison(dmg) {
    this.poisonTime = 180;
    this.poisonDmg = dmg / 5;
    if (this.poisonDmg < 1) this.poisonDmg = 1;
  }
}

class Projectile {
  constructor(x, y, dx, dy, rng) {
    this.start = createVector(x, y);
    this.pos = createVector(x, y);
    this.vel = createVector(dx, dy).mult(9);
    this.range = rng;
    this.toDelete = false;
  }
  update() {
    this.pos.add(this.vel);
    if (this.pos.dist(this.start) > this.range) this.toDelete = true;
    if (this.pos.x < 0 || this.pos.x > WORLD_W || this.pos.y < 0 || this.pos.y > WORLD_H) this.toDelete = true;
  }
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(255, 255, 150); ellipse(0, 0, 14);
    pop();
  }
  checkCollision(e) { return this.pos.dist(e.pos) < (7 + e.size/2); }
}

class PowerUp {
  constructor() {
    this.pos = createVector(random(100, WORLD_W-100), random(100, WORLD_H-100));
    this.angle = 0;
  }
  show() {
    this.angle += 0.05;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    fill(50, 255, 50);
    triangle(0, -12, -10, 8, 10, 8);
    pop();
  }
  checkCollision(p) { return this.pos.dist(p.pos) < 25; }
}

class Particle {
  constructor(x, y, col, type) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 4));
    this.col = col;
    this.life = 255;
    this.type = type;
  }
  update() { this.pos.add(this.vel); this.life -= 12; }
  show() {
    noStroke();
    let c = color(this.col); c.setAlpha(this.life); fill(c);
    if (this.type === "CRIT") rect(this.pos.x, this.pos.y, 6, 6);
    else ellipse(this.pos.x, this.pos.y, 5);
  }
}

class FloatText {
  constructor(msg, x, y, col, isUI=false) {
    this.msg = msg; this.pos = createVector(x, y); this.col = col; this.life = 60; this.isUI = isUI;
  }
  update() { this.pos.y -= 0.8; this.life--; }
  show() {
    let alpha = map(this.life, 0, 60, 0, 255);
    let c = color(this.col); c.setAlpha(alpha); fill(c);
    textSize(this.isUI ? 24 : 14); textStyle(BOLD);
    text(this.msg, this.pos.x, this.pos.y); textStyle(NORMAL);
  }
}

// ==========================================
// 6. UI & MENUS
// ==========================================

function drawMenu() {
  drawMenuBg();
  fill(255); textSize(50); textStyle(BOLD);
  text("ELEMENTAL LEGENDS", width/2, 120);
  textStyle(NORMAL);
  let y = 280;
  drawBtn("PLAY", width/2, y, 200, 50, () => gameState = "DIFFICULTY");
  drawBtn("CUSTOMIZE", width/2, y+70, 200, 50, () => gameState = "CUSTOMIZE");
  drawBtn("HOW TO PLAY", width/2, y+140, 200, 50, () => gameState = "HOW_TO");
}

function drawDifficultySelect() {
  drawMenuBg(); drawTitle("DIFFICULTY");
  drawBtn("EASY (10 Stages)", width/2, 220, 300, 60, () => { difficulty="Easy"; maxStages=10; gameState="MODE"; });
  drawBtn("MEDIUM (20 Stages)", width/2, 300, 300, 60, () => { difficulty="Medium"; maxStages=20; gameState="MODE"; });
  drawBtn("HARD (30 Stages)", width/2, 380, 300, 60, () => { difficulty="Hard"; maxStages=30; gameState="MODE"; });
  drawBack("MENU");
}

function drawModeSelect() {
  drawMenuBg(); drawTitle("GAME MODE");
  drawBtn("CAMPAIGN\n(Reach end)", width/2, 250, 300, 80, () => { gameMode="Campaign"; gameState="SELECT_TYPE"; });
  drawBtn("ENDLESS\n(Survival)", width/2, 350, 300, 80, () => { gameMode="Endless"; gameState="SELECT_TYPE"; });
  drawBack("DIFFICULTY");
}

function drawTypeSelect() {
  drawMenuBg(); drawTitle("CHOOSE CLASS");
  let types = ["Fire", "Water", "Plant", "Light", "Dark", "Normal"];
  let y = 140;
  
  for (let t of types) {
    let desc = "";
    if (t==="Fire") desc = "(Burn)";
    if (t==="Water") desc = "(AoE)";
    if (t==="Plant") desc = "(Regen)";
    if (t==="Light") desc = "(Shield)";
    if (t==="Dark") desc = "(Crit)";
    if (t==="Normal") desc = "(Neutral)";
    
    drawBtn(`${t} ${desc}`, width/2, y, 400, 40, () => { playerType = t; gameState = "SELECT_RELIC"; }, getTypeColor(t));
    y += 50;
  }
  drawBack("MODE");
}

function drawRelicSelect() {
  drawMenuBg(); drawTitle("CHOOSE RELIC");
  drawBtn("RELIC OF LIFE\n(+2 Max HP)", width/2, 220, 300, 60, () => { playerRelic="Life"; startGame(); });
  drawBtn("RELIC OF DEATH\n(+10% Crit Chance)", width/2, 300, 300, 60, () => { playerRelic="Death"; startGame(); });
  drawBtn("RELIC OF GREED\n(Luck for Gold)", width/2, 380, 300, 60, () => { playerRelic="Greed"; startGame(); });
  drawBack("SELECT_TYPE");
}

function drawCustomize() {
  drawMenuBg(); drawTitle("COLOR");
  let colors = [color(0,255,255), color(255,50,50), color(50,255,50), color(255,255,0), color(255,0,255), color(255)];
  for(let i=0; i<colors.length; i++) {
    let x = (width/2 - 150) + (i*60);
    fill(colors[i]);
    if (dist(mouseX, mouseY, x, height/2) < 20) {
      stroke(255); strokeWeight(3);
      if (mouseIsPressed) { playerColor = colors[i]; player.color = playerColor; }
    } else noStroke();
    ellipse(x, height/2, 40);
  }
  player.pos.set(width/2, 450); player.show();
  drawBack("MENU");
}

function drawShop() {
  background(30, 20, 20); drawTitle("MERCHANT");
  fill(255, 215, 0); textSize(24); text(`GOLD: ${inventory.gold}`, width/2, 140);
  
  let healCost = 2;
  let canHeal = inventory.gold >= healCost && player.hp < player.stats.maxHp;
  drawBtn(`FULL HEAL\n${healCost} Gold`, width/2 - 150, 300, 200, 100, () => {
    if (canHeal) { inventory.gold -= healCost; player.hp = player.stats.maxHp; }
  }, canHeal ? color(50, 150, 50) : color(100));
  
  let upCost = 1;
  let canUp = inventory.gold >= upCost;
  drawBtn(`UPGRADE\n${upCost} Gold`, width/2 + 150, 300, 200, 100, () => {
    if (canUp) { inventory.gold -= upCost; previousState = "SHOP"; gameState = "LEVEL_UP"; }
  }, canUp ? color(50, 100, 200) : color(100));
  
  drawBtn("NEXT STAGE", width/2, 500, 200, 60, () => { startStage(); gameState = "GAME"; });
}

function drawLevelUpOverlay() {
  fill(0, 0, 0, 220); rect(width/2, height/2, width, height);
  fill(255); textSize(30); text("LEVEL UP!", width/2, 60);
  textSize(16); text("Select Upgrade", width/2, 90);
  
  let stats = [
    {k:"maxHp", n:"Max HP"}, {k:"damage", n:"Damage"}, 
    {k:"speed", n:"Speed"}, {k:"range", n:"Range"},
    {k:"atkSpeed", n:"Atk Spd"}, {k:"critChance", n:"Crit %"},
    {k:"critDamage", n:"Crit Dmg"}, {k:"typeLvl", n:"Type"}
  ];
  
  // Grid: 2 columns, 4 rows
  let startY = 140;
  for(let i=0; i<stats.length; i++) {
    let s = stats[i];
    
    // Normal Type cannot upgrade "Type"
    if (s.k === "typeLvl" && playerType === "Normal") continue;

    let lvl = player.levels[s.k];
    let limit = (s.k === "typeLvl") ? TYPE_CAP : STAT_CAP;
    let isMax = lvl >= limit;
    
    let txt = isMax ? `${s.n} (MAX)` : `${s.n} ${lvl}`;
    if (s.k === "typeLvl" && lvl >= TYPE_CAP) txt = `${s.n} (EVOLVED)`;
    
    let col = (i % 2); 
    let row = floor(i / 2);
    let x = (col === 0) ? width/2 - 110 : width/2 + 110;
    let y = startY + row * 65;
    
    if (isMax) {
      fill(80); rect(x, y, 200, 50, 8); fill(150); textSize(14); text(txt, x, y);
    } else {
      drawBtn(txt, x, y, 200, 50, () => {
        player.upgradeStat(s.k);
        gameState = (previousState === "SHOP") ? "SHOP" : "GAME";
      });
    }
  }
}

function drawHUD() {
  fill(0, 150); rect(width/2, 35, width, 70);
  fill(255); textSize(20); textAlign(LEFT, CENTER);
  text(`HP: ${player.hp} / ${player.stats.maxHp}`, 20, 35);
  text(`GOLD: ${inventory.gold}`, 160, 35);
  textAlign(CENTER, CENTER);
  text(`STAGE ${currentStage}`, width/2, 25);
  fill(getTypeColor(getCurrentStageType())); textSize(14);
  text(`BIOME: ${getCurrentStageType()}`, width/2, 50);
  textAlign(RIGHT, CENTER); fill(255); textSize(18);
  text(gameMode, width-20, 25);
  textSize(14);
  text(`${playerType} (T${player.levels.typeLvl})`, width-20, 50);
}

function drawGameOver() {
  fill(0, 200); rect(width/2, height/2, width, height);
  fill(255, 50, 50); textSize(60); text("DEFEAT", width/2, 250);
  fill(255); textSize(24); text(`Stage: ${currentStage}`, width/2, 320);
  drawBtn("MENU", width/2, 450, 200, 60, () => gameState = "MENU");
}

function drawVictory() {
  background(20, 50, 20); fill(50, 255, 50); textSize(60); text("VICTORY", width/2, 250);
  drawBtn("MENU", width/2, 450, 200, 60, () => gameState = "MENU");
}

// ==========================================
// 7. UTILS & HELPERS
// ==========================================

function completeStage() {
  let g = 1;
  if (playerRelic === "Greed" && random() < 0.33) g = 2;
  inventory.gold += g;
  createFloatText(`+${g} GOLD`, width/2, height/2-50, color(255,215,0), true);
  if (gameMode === "Campaign" && currentStage >= maxStages) { gameState = "VICTORY"; return; }
  currentStage++;
  if ((currentStage - 1) % 5 === 0) gameState = "SHOP";
  else startStage();
}

function spawnEnemy() {
  let r = random(400, 600); let a = random(TWO_PI);
  let x = player.pos.x + cos(a)*r; let y = player.pos.y + sin(a)*r;
  x = constrain(x, 50, WORLD_W-50); y = constrain(y, 50, WORLD_H-50);
  enemies.push(new Enemy(x, y));
}

function drawWorldGrid() {
  let t = getCurrentStageType();
  let c1, c2;
  if (t === "Fire") { c1=color(50,20,20); c2=color(40,15,15); }
  else if (t === "Water") { c1=color(20,30,50); c2=color(15,20,40); }
  else if (t === "Plant") { c1=color(20,40,20); c2=color(15,30,15); }
  else if (t === "Light") { c1=color(60,60,50); c2=color(50,50,40); }
  else { c1=color(40,20,50); c2=color(30,15,40); }
  background(c1); fill(c2); let s = 100;
  for(let x=0; x<WORLD_W; x+=s) { for(let y=0; y<WORLD_H; y+=s) { if ((x+y)%(s*2)===0) rect(x+s/2, y+s/2, s, s); } }
  noFill(); stroke(255, 50); strokeWeight(10); rect(WORLD_W/2, WORLD_H/2, WORLD_W, WORLD_H);
}

function createExplosion(x, y, col, type) {
  for(let i=0; i<8; i++) particles.push(new Particle(x, y, col, type));
}

function createFloatText(msg, x, y, col, isUI=false) {
  floatText.push(new FloatText(msg, x, y, col, isUI));
}

function drawBtn(label, x, y, w, h, cb, col=color(60,60,80)) {
  let hover = mouseX > x-w/2 && mouseX < x+w/2 && mouseY > y-h/2 && mouseY < y+h/2;
  push();
  if (hover) {
    fill(lerpColor(col, color(255), 0.2)); cursor('pointer');
    if (mouseIsPressed && !mouseWasPressed) { cb(); mouseWasPressed = true; }
  } else fill(col);
  rect(x, y, w, h, 8);
  fill(255); noStroke(); 
  textSize(14); // Smaller text to prevent overflow
  text(label, x, y);
  pop();
}

function drawBack(state) {
  drawBtn("BACK", width/2, height-60, 150, 40, () => gameState = state);
}

function drawTitle(t) {
  fill(255); textSize(36); textStyle(BOLD); text(t, width/2, 80); textStyle(NORMAL);
}

function drawHowTo() {
  drawMenuBg(); drawTitle("INSTRUCTIONS");
  textAlign(LEFT, TOP); fill(200); textSize(15);
  let txt = 
`WASD to Move, ARROWS to Shoot.

PASSIVES (Evolve at Type Lv3):
- Fire: Burn (Evolved: Spreads).
- Water: AoE (Evolved: 3x Size).
- Plant: Regen (Evolved: Poison + Heal 1/4 HP).
- Light: Shield (Evolved: 10s + AoE Push).
- Dark: Crit Stack (Evolved: Insta-Kill).
- Normal: No passive, no advantages.

MECHANICS:
- Water>Fire>Plant>Water.
- Light/Dark beat others.
- Crits STUN enemies.`;
  text(txt, width/2 - 200, 160);
  textAlign(CENTER, CENTER);
  drawBack("MENU");
}

function drawMenuBg() {
  background(30); stroke(255, 10);
  for(let i=0; i<width; i+=40) line(i,0,i,height);
  for(let i=0; i<height; i+=40) line(0,i,width,i);
  noStroke();
}

function getTypeColor(t) {
  if (t==="Fire") return color(255, 80, 80);
  if (t==="Water") return color(80, 80, 255);
  if (t==="Plant") return color(80, 255, 80);
  if (t==="Light") return color(255, 255, 200);
  if (t==="Dark") return color(160, 50, 255);
  if (t==="Normal") return color(200);
  return color(200);
}

function getCurrentStageType() { return STAGE_TYPES[(currentStage - 1) % 5]; }
function screenShake(amt) { shakeAmount = amt; }
function updateShake() { if (shakeAmount > 0) shakeAmount *= 0.9; if (shakeAmount < 0.5) shakeAmount = 0; }
let mouseWasPressed = false;
function mouseReleased() { mouseWasPressed = false; }
function drawCustomCursor() { noCursor(); fill(255); noStroke(); circle(mouseX, mouseY, 10); }