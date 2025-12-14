/*
  ELEMENTAL LEGENDS: EVOLVED (Versão Final - Baby Auto-Aim)
  -------------------------------------
  - Resolução: 1920x1080.
  - 4 Modos de Mira: Keyboard, Isaac (4-lados), Mouse, Baby (Auto-Aim).
  - Vida inicial do inimigo ajustável na classe Enemy.
*/

// ==========================================
// 1. CONFIGURATION & GLOBALS
// ==========================================

const WORLD_W = 2500; 
const WORLD_H = 2000;

const STAT_CAP = 10;
const TYPE_CAP = 3;
const STAGE_TYPES = ["Fire", "Water", "Plant", "Light", "Dark"]; 

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

let unlockedTypes = ["Fire", "Water", "Plant", "Light", "Dark", "Normal"]; 

// Modos de mira: "Keyboard", "Isaac", "Mouse", "Baby"
let aimMode = "Keyboard"; 

// ==========================================
// 2. SETUP & MAIN LOOP
// ==========================================

function setup() {
  createCanvas(1920, 1080);
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
    case "UPDATE_LOG": drawUpdateLog(); break;
    case "CUSTOMIZE": drawCustomize(); break;
    case "DIFFICULTY": drawDifficultySelect(); break;
    case "MODE": drawModeSelect(); break;
    case "SELECT_TYPE": drawTypeSelect(); break;
    case "SELECT_RELIC": drawRelicSelect(); break;
    case "CONFIGS": drawConfigs(); break; 
    case "GAME": runGameLogic(); break;
    case "LEVEL_UP": runGameLogic(true); drawLevelUpOverlay(); break;
    case "SHOP": drawShop(); break;
    case "GAME_OVER": drawGameOver(); break;
    case "VICTORY": drawVictory(); break;
  }
  
  handleCursor();
}

function handleCursor() {
  // O cursor só deve ser visível (Mouse) se o modo for Mouse OU se não estiver no GAME
  if (aimMode === "Mouse" || gameState !== "GAME") {
    cursor(ARROW); 
  } else {
    noCursor(); // Oculta o cursor durante o jogo nos modos de teclado
  }
}

// ==========================================
// 3. GAMEPLAY ENGINE (runGameLogic)
// ==========================================

function startGame() {
  currentStage = 1;
  inventory.gold = 0;
  
  player = new Player();
  player.color = playerColor;
  
  if (playerType === "Perfect") {
    player.levels.typeLvl = TYPE_CAP; 
  }
  
  if (playerRelic === "Life") {
    player.stats.maxHp += 2;
    player.hp = player.stats.maxHp;
    player.levels.maxHp = "RELIC"; 
  }
  if (playerRelic === "Death") {
    player.stats.critChance += 0.10;
  }
  
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
  
  if (playerType === "Plant" && currentStage > 1) {
    let healAmt = 1;
    if (player.levels.typeLvl >= TYPE_CAP) {
      healAmt = floor(player.stats.maxHp / 4);
      if (healAmt < 1) healAmt = 1;
    }
    if (player.hp < player.stats.maxHp) {
      player.hp = min(player.hp + healAmt, player.stats.maxHp);
      createFloatText(`+${healAmt} HP`, width/2, height/2 - 100, color(50, 255, 50), true);
    }
  }
  
  for (let i = 0; i < 2; i++) powerups.push(new PowerUp());
  
  enemiesToSpawn = 5 + floor(currentStage * 1.5);
}

function runGameLogic(paused = false) {
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
      let wasHit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (p.checkCollision(enemies[j])) {
          handleCombat(p, enemies[j]);
          projectiles.splice(i, 1);
          wasHit = true;
          break;
        }
      }
      if (!wasHit && p.toDelete) {
        projectiles.splice(i, 1);
      }
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
  
  if (!paused) drawAimIndicator(); 
  
  pop();
  
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
  let calc = calculateDamage(playerType, getCurrentStageType());
  
  let actualCritChance = player.stats.critChance;
  if (playerType === "Dark") {
    actualCritChance += (player.darkStacks * 0.10);
  }
  
  let isCrit = random() < actualCritChance;
  
  if (playerType === "Dark") {
    if (isCrit) player.darkStacks = min(player.darkStacks + 1, 4);
    else player.darkStacks = 0;
  }
  
  if (isCrit) {
    if (calc.modifier < 1.0) calc.modifier = 1.0;
    
    if (playerType === "Dark" && player.levels.typeLvl >= TYPE_CAP) {
      target.takeDamage(99999);
      createExplosion(target.pos.x, target.pos.y, color(255, 0, 0), "CRIT"); 
      screenShake(10);
      return;
    }

    target.stun(60);
    screenShake(5);
  }
  
  let dmg = player.stats.damage * calc.modifier;
  if (isCrit) dmg *= player.stats.critDamage;
  
  let finalDmg = round(dmg); 
  
  let dmgColor = color(255); 
  if (isCrit) dmgColor = color(255, 0, 0); 
  
  target.takeDamage(finalDmg, dmgColor);
  
  if (!isCrit) {
    if (calc.modifier > 1.0) createExplosion(target.pos.x, target.pos.y, color(255, 200, 0), "ADV");
    else if (calc.modifier < 1.0) createExplosion(target.pos.x, target.pos.y, color(150), "DIS");
    else createExplosion(target.pos.x, target.pos.y, playerColor, "NORMAL");
  }

  if (playerType === "Perfect") return; 
  
  let evolved = player.levels.typeLvl >= TYPE_CAP;

  if (playerType === "Fire") {
    let burnDmg = 1 + (player.levels.damage * 2); 
    target.ignite(burnDmg);
    if (evolved) {
      for (let e of enemies) {
        if (e !== target && dist(e.pos.x, e.pos.y, target.pos.x, target.pos.y) < 150) {
          e.ignite(burnDmg);
        }
      }
    }
  }
  
  if (playerType === "Water") {
    let splashRad = evolved ? 180 : 60;
    createExplosion(target.pos.x, target.pos.y, color(100, 100, 255), "AOE");
    fill(100, 100, 255, 100);
    ellipse(target.pos.x, target.pos.y, splashRad * 2);
    for (let e of enemies) {
      if (e !== target && dist(e.pos.x, e.pos.y, target.pos.x, target.pos.y) < splashRad) {
        e.takeDamage(round(finalDmg * 0.5));
        createFloatText("Splash", e.pos.x, e.pos.y - 10, color(100, 200, 255));
      }
    }
  }

  if (playerType === "Light") {
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

  if (playerType === "Plant" && evolved) {
    let poisonDmg = 1 + (player.levels.damage * 0.5);
    target.poison(poisonDmg);
  }
}

function calculateDamage(atk, def) {
  let m = 1.0;
  
  if (atk === "Perfect") return { modifier: 1.25 };
  if (atk === "Normal") return { modifier: 1.0 };
  
  if (atk === "Water" && (def === "Water" || def === "Fire")) m = 1.2;
  if (atk === "Fire" && (def === "Fire" || def === "Plant")) m = 1.2;
  if (atk === "Plant" && (def === "Plant" || def === "Water")) m = 1.2;
  if (atk === "Light" && (def === "Water" || def === "Fire" || def === "Plant")) m = 1.2;
  if (atk === "Dark" && (def === "Water" || def === "Fire" || def === "Plant")) m = 1.2;
  
  if (atk === "Water" && ["Plant", "Light", "Dark"].includes(def)) m = 0.8;
  if (atk === "Fire" && ["Water", "Light", "Dark"].includes(def)) m = 0.8;
  if (atk === "Plant" && ["Fire", "Light", "Dark"].includes(def)) m = 0.8;
  if (atk === "Light" && ["Light", "Dark"].includes(def)) m = 0.25;
  if (atk === "Dark" && ["Light", "Dark"].includes(def)) m = 0.25;
  
  return { modifier: m };
}

// ==========================================
// 5. CLASSES (Player.update e Enemy.constructor)
// ==========================================

class Player {
  constructor() {
    this.pos = createVector(WORLD_W/2, WORLD_H/2);
    this.size = 32;
    this.hp = 3;
    this.darkStacks = 0;
    
    this.stats = {
      maxHp: 3, damage: 5, speed: 4, range: 150,
      critChance: 0.05, critDamage: 1.5, atkSpeed: 1
    };
    
    this.levels = {
      maxHp: 0, damage: 0, speed: 0, range: 0, 
      critChance: 0, critDamage: 0, atkSpeed: 0, typeLvl: 0
    };
    
    this.cooldown = 0;
    this.invuln = 0;
    this.shootDir = createVector(0, -1); 
    this.isShooting = false; 
    this.mouseTarget = createVector(0, 0); 
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
    
    // --- LÓGICA DE MIRA E TIRO ---
    
    if (aimMode === "Keyboard" || aimMode === "Isaac" || aimMode === "Baby") {
      
      let aimX = 0;
      let aimY = 0;
      if (keyIsDown(LEFT_ARROW)) aimX -= 1;
      if (keyIsDown(RIGHT_ARROW)) aimX += 1;
      if (keyIsDown(UP_ARROW)) aimY -= 1;
      if (keyIsDown(DOWN_ARROW)) aimY += 1;
      
      let newDir = createVector(aimX, aimY);
      
      if (aimMode === "Keyboard") {
        
        // Modo 1: Mira com Setas, Atira com Espaço (Manual e Suave)
        if (newDir.mag() > 0) {
           let targetDir = newDir.normalize();
           this.shootDir.x = lerp(this.shootDir.x, targetDir.x, 0.2); 
           this.shootDir.y = lerp(this.shootDir.y, targetDir.y, 0.2);
           this.shootDir.normalize();
        }
        
        if (this.isShooting && this.cooldown <= 0) {
          this.shoot(this.shootDir.x, this.shootDir.y, fireRate);
        }
        
      } else if (aimMode === "Isaac") {
        
        // Modo 2: Mira e Atira Cardinalmente (The Binding of Isaac)
        if (newDir.mag() > 0 && this.cooldown <= 0) {
            let absX = abs(aimX);
            let absY = abs(aimY);
            let shootDirX = 0;
            let shootDirY = 0;

            if (absX >= absY && absX > 0) {
                shootDirX = aimX > 0 ? 1 : -1;
            } else if (absY > absX && absY > 0) {
                shootDirY = aimY > 0 ? 1 : -1;
            } else if (absX > 0) { 
              shootDirX = aimX;
              shootDirY = aimY;
            }

            if (shootDirX !== 0 || shootDirY !== 0) {
              this.shootDir.set(shootDirX, shootDirY);
              this.shoot(shootDirX, shootDirY, fireRate);
            }
        }
      } else if (aimMode === "Baby") {
        
        // Modo 4: Auto-Aim (Baby/Sentinel)
        if (this.cooldown <= 0) {
            let closestEnemy = null;
            let minDist = Infinity;
            
            for (let e of enemies) {
                let d = dist(this.pos.x, this.pos.y, e.pos.x, e.pos.y);
                if (d < minDist) {
                    minDist = d;
                    closestEnemy = e;
                }
            }
            
            if (closestEnemy) {
                let dirToEnemy = p5.Vector.sub(closestEnemy.pos, this.pos).normalize();
                this.shootDir = dirToEnemy; 
                this.shoot(dirToEnemy.x, dirToEnemy.y, fireRate);
            }
        }
      }
      
    } else { // aimMode === "Mouse"
      
      // Modo 3: Mira e Atira com Mouse (Mouse)
      let mouseX_world = mouseX + cam.x;
      let mouseY_world = mouseY + cam.y;
      
      this.mouseTarget.set(mouseX_world, mouseY_world);
      
      let dirToMouse = p5.Vector.sub(this.mouseTarget, this.pos).normalize();
      this.shootDir = dirToMouse;
      
      if (mouseIsPressed && mouseButton === LEFT && this.cooldown <= 0) {
        this.shoot(this.shootDir.x, this.shootDir.y, fireRate);
      }
    }
  }
  
  shoot(dx, dy, delay) {
    projectiles.push(new Projectile(this.pos.x, this.pos.y, dx, dy, this.stats.range));
    this.cooldown = delay;
  }
  
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(0, 100); ellipse(0, 18, 32, 12);
    
    if (this.invuln > 0 && frameCount % 6 < 3) fill(255);
    else fill(playerColor);
    
    rect(0, 0, this.size, this.size, 6);
    
    if (this.levels.typeLvl >= TYPE_CAP) {
      noFill(); stroke(255); strokeWeight(2);
      rect(0, 0, this.size+8, this.size+8, 4);
    }
    pop();
  }
  
  takeDamage(amt) {
    if (this.invuln > 0) return;
    this.hp -= amt;
    
    if (playerType === "Light") {
      let dur = (this.levels.typeLvl >= TYPE_CAP) ? 600 : 300;
      this.invuln = dur;
      createFloatText("SHIELD!", this.pos.x, this.pos.y - 40, color(255, 255, 200));
    } else {
      this.invuln = 90;
    }
    
    createFloatText("-" + amt, this.pos.x, this.pos.y - 30, color(255, 100, 100));
    screenShake(5);
    if (this.hp <= 0) gameState = "GAME_OVER";
  }
  
  upgradeStat(statKey) {
    if (statKey !== "maxHp" && this.levels[statKey] === STAT_CAP && statKey !== "typeLvl") return false;
    if (this.levels[statKey] === TYPE_CAP && statKey === "typeLvl") return false;
    
    this.levels[statKey]++;
    
    if (statKey === "maxHp") { this.stats.maxHp++; this.hp++; }
    else if (statKey === "damage") this.stats.damage += 2;
    else if (statKey === "speed") this.stats.speed += 0.5;
    else if (statKey === "range") this.stats.range += 30;
    else if (statKey === "critChance") this.stats.critChance = min(0.9, this.stats.critChance + 0.05);
    else if (statKey === "critDamage") this.stats.critDamage += 0.25;
    else if (statKey === "atkSpeed") this.stats.atkSpeed += 0.5;
    
    return true;
  }
}

class Enemy {
  constructor(x, y, type) {
    this.pos = createVector(x, y);
    this.size = 24;
    this.type = type;
    this.color = getTypeColor(type);
    
    // 🎯 LOCAL PARA ALTERAR A VIDA INICIAL DOS INIMIGOS
    // '2' é o HP base, que é escalado com o stage (currentStage * 0.5).
    this.maxHp = 10 + floor(currentStage * 1.5); 
    
    this.hp = this.maxHp;
    this.speed = 1.5 + (currentStage * 0.05);
    this.isStunned = 0;
    this.isBurning = 0;
    this.isPoisoned = 0;
    this.burnDmg = 0;
    this.poisonDmg = 0;
    this.pushVec = createVector(0, 0);
  }
  
  update() {
    if (this.pushVec.mag() > 0.5) {
      this.pos.add(this.pushVec);
      this.pushVec.mult(0.9);
      return;
    } else {
      this.pushVec = createVector(0, 0);
    }
    
    if (this.isStunned > 0) {
      this.isStunned--;
      return;
    }
  
    if (this.isBurning > 0) {
      this.isBurning--;
      if (frameCount % 30 === 0) this.takeDamage(this.burnDmg, color(255, 150, 0));
    }
    if (this.isPoisoned > 0) {
      this.isPoisoned--;
      if (frameCount % 60 === 0) this.takeDamage(this.poisonDmg, color(100, 255, 100));
    }
    
    let dir = p5.Vector.sub(player.pos, this.pos);
    dir.setMag(this.speed);
    this.pos.add(dir);
  
    this.pos.x = constrain(this.pos.x, this.size, WORLD_W - this.size);
    this.pos.y = constrain(this.pos.y, this.size, WORLD_H - this.size);
  }
  
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(this.color);
    rect(0, 0, this.size, this.size, 4);
    
    if (this.isStunned > 0 && frameCount % 10 < 5) fill(255, 255, 0); 
    else if (this.isBurning > 0) fill(255, 100, 0);
    else if (this.isPoisoned > 0) fill(50, 200, 50);
    else fill(255);
    ellipse(0, -this.size/2 - 2, 4);
    
    let hpW = (this.hp / this.maxHp) * this.size;
    fill(100); rect(0, this.size/2 + 5, this.size, 4);
    fill(255, 0, 0); rect(-this.size/2 + hpW/2, this.size/2 + 5, hpW, 4);
    
    pop();
  }
  
  takeDamage(amt, txtColor = color(255)) { 
    this.hp -= amt;
    createFloatText("-" + amt, this.pos.x, this.pos.y - 10, txtColor);
    
    if (this.hp <= 0) {
      let index = enemies.indexOf(this);
      if (index > -1) enemies.splice(index, 1);
    }
  }
  
  checkCollision(target) {
    return dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y) < (this.size + target.size) / 2;
  }
  
  stun(duration) {
    this.isStunned = duration;
  }
  
  ignite(dmg) {
    this.isBurning = 180; 
    this.burnDmg = dmg;
  }
  
  poison(dmg) {
    this.isPoisoned = 300; 
    this.poisonDmg = dmg;
  }
  
  pushBack(strength) {
    let dir = p5.Vector.sub(this.pos, player.pos);
    dir.normalize().mult(strength / 100); 
    this.pushVec.add(dir);
  }
}

class Projectile {
  constructor(x, y, dx, dy, range) {
    this.pos = createVector(x, y);
    this.dir = createVector(dx, dy).normalize();
    this.speed = 8;
    this.start = createVector(x, y);
    this.range = range;
    this.toDelete = false;
    this.color = playerColor;
  }
  
  update() {
    this.pos.add(this.dir.copy().mult(this.speed));
    if (dist(this.pos.x, this.pos.y, this.start.x, this.start.y) > this.range) {
      this.toDelete = true;
    }
  }
  
  show() {
    fill(this.color);
    ellipse(this.pos.x, this.pos.y, 10, 10);
  }
  
  checkCollision(target) {
    return dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y) < 15;
  }
}

class PowerUp {
  constructor() {
    this.pos = createVector(random(50, WORLD_W - 50), random(50, WORLD_H - 50));
    this.size = 20;
    this.angle = 0;
  }
  
  show() {
    this.angle += 0.05;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    fill(50, 255, 50); 
    noStroke();
    triangle(0, -this.size, this.size, this.size, -this.size, this.size);
    pop();
  }
  
  checkCollision(target) {
    return dist(this.pos.x, this.pos.y, target.pos.x, target.pos.y) < this.size;
  }
}

class FloatText {
  constructor(txt, x, y, clr, isUI = false) {
    this.txt = txt;
    this.pos = createVector(x, y);
    this.clr = clr;
    this.life = 120; 
    this.speed = isUI ? 0.5 : -0.5;
    this.isUI = isUI; 
    this.size = 20;
    if (txt.includes("-")) this.size = 18;
    if (txt.includes("CRIT")) this.size = 28;
  }
  
  update() {
    this.pos.y += this.speed;
    this.life--;
    this.size = lerp(this.size, 10, 0.01);
  }
  
  show() {
    fill(this.clr, map(this.life, 0, 120, 0, 255));
    textSize(this.size);
    text(this.txt, this.pos.x, this.pos.y);
  }
}

class Particle {
  constructor(x, y, clr) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 4));
    this.clr = clr;
    this.life = random(30, 60);
    this.size = random(3, 8);
  }
  
  update() {
    this.pos.add(this.vel);
    this.life--;
    this.vel.mult(0.9);
  }
  
  show() {
    fill(this.clr, map(this.life, 0, 60, 0, 255));
    ellipse(this.pos.x, this.pos.y, this.size);
  }
}

// ==========================================
// 6. UI & MENUS 
// ==========================================

function drawMenu() {
  drawMenuBg();
  fill(255); textSize(70); textStyle(BOLD);
  text("ELEMENTAL LEGENDS", width/2, 180);
  textStyle(NORMAL);
  
  let y = 350;
  drawBtn("PLAY", width/2, y, 400, 80, () => gameState = "DIFFICULTY");
  drawBtn("CUSTOMIZE", width/2, y+100, 400, 80, () => gameState = "CUSTOMIZE");
  drawBtn("CONFIGURAÇÕES", width/2, y+200, 400, 80, () => gameState = "CONFIGS");
  drawBtn("HOW TO PLAY", width/2, y+300, 400, 80, () => gameState = "HOW_TO");
  drawBtn("UPDATE LOG", width/2, y+400, 400, 80, () => gameState = "UPDATE_LOG"); 
}

function drawConfigs() {
  drawMenuBg(); drawTitle("CONFIGURAÇÕES");
  
  let modeText = "";
  if (aimMode === "Keyboard") modeText = "TECLADO (Setas: Mira Suave, Espaço: Atira)";
  else if (aimMode === "Isaac") modeText = "ISAAC (Setas: Mira e Atira | 4 Lados)";
  else if (aimMode === "Mouse") modeText = "MOUSE (Mira: Mouse, Atira: Clique Esquerdo)";
  else if (aimMode === "Baby") modeText = "BABY (Auto-Aim: Mira e Atira no inimigo mais próximo)";
  
  drawBtn(`MODO DE MIRA: ${modeText}`, width/2, 400, 700, 80, () => {
    if (aimMode === "Keyboard") aimMode = "Isaac";
    else if (aimMode === "Isaac") aimMode = "Mouse";
    else if (aimMode === "Mouse") aimMode = "Baby";
    else if (aimMode === "Baby") aimMode = "Keyboard";
  });
  
  drawBack("MENU");
}

function drawDifficultySelect() {
  drawMenuBg(); drawTitle("DIFFICULTY");
  drawBtn("EASY (10 Stages)", width/2, 350, 500, 80, () => { difficulty="Easy"; maxStages=10; gameState="MODE"; });
  drawBtn("MEDIUM (20 Stages)", width/2, 450, 500, 80, () => { difficulty="Medium"; maxStages=20; gameState="MODE"; });
  drawBtn("HARD (30 Stages)", width/2, 550, 500, 80, () => { difficulty="Hard"; maxStages=30; gameState="MODE"; });
  drawBack("MENU");
}

function drawModeSelect() {
  drawMenuBg(); drawTitle("GAME MODE");
  drawBtn("CAMPAIGN\n(Reach end)", width/2, 400, 500, 100, () => { gameMode="Campaign"; gameState="SELECT_TYPE"; });
  drawBtn("ENDLESS\n(Survival)", width/2, 550, 500, 100, () => { gameMode="Endless"; gameState="SELECT_TYPE"; });
  drawBack("DIFFICULTY");
}

function drawTypeSelect() {
  drawMenuBg(); drawTitle("CHOOSE CLASS");
  let types = unlockedTypes; 
  let y = 180;
  
  for (let t of types) {
    let desc = "";
    if (t==="Fire") desc = "(Burn)";
    if (t==="Water") desc = "(AoE)";
    if (t==="Plant") desc = "(Regen)";
    if (t==="Light") desc = "(Shield)";
    if (t==="Dark") desc = "(Crit)";
    if (t==="Normal") desc = "(Neutral)";
    if (t==="Perfect") desc = "(+25% Dano Universal)";
    
    drawBtn(`${t} ${desc}`, width/2, y, 600, 55, () => { 
      playerType = t; 
      if (t === "Perfect") {
        playerRelic = "None"; 
        startGame();
      } else {
        gameState = "SELECT_RELIC"; 
      }
    }, getTypeColor(t), color(0));
    y += 70;
  }
  drawBack("MODE");
}

function drawRelicSelect() {
  drawMenuBg(); drawTitle("CHOOSE RELIC");
  drawBtn("RELIC OF LIFE\n(+2 Max HP)", width/2, 350, 500, 80, () => { playerRelic="Life"; startGame(); });
  drawBtn("RELIC OF DEATH\n(+10% Crit Chance)", width/2, 450, 500, 80, () => { playerRelic="Death"; startGame(); });
  drawBtn("RELIC OF GREED\n(Luck for Gold)", width/2, 550, 500, 80, () => { playerRelic="Greed"; startGame(); });
  drawBack("SELECT_TYPE");
}

function drawCustomize() {
  drawMenuBg(); drawTitle("COLOR");
  let colors = [
    color(0,255,255), color(255,0,0), color(0,255,0), 
    color(255,255,0), color(255,0,255), color(255),
    color(255,100,0), color(150,0,255), color(0), color(150), 
    color(0,0,255), color(50,100,0), color(70,35,0), color(255,150,255)
  ];
  
  let startX = width/2 - (7 * 100) + 50; 
  
  for(let i=0; i<colors.length; i++) {
    let x = startX + (i*100);
    fill(colors[i]);
    if (dist(mouseX, mouseY, x, height/2) < 30) {
      stroke(255); strokeWeight(3);
      if (mouseIsPressed) { playerColor = colors[i]; player.color = playerColor; }
    } else noStroke();
    ellipse(x, height/2, 60);
  }
  player.pos.set(width/2, 650); player.show();
  drawBack("MENU");
}

function drawShop() {
  background(30, 20, 20); drawTitle("MERCHANT");
  fill(255, 215, 0); textSize(24); textAlign(CENTER, CENTER); 
  text(`GOLD: ${inventory.gold}`, width/2, 140);
  
  let healCost = 2;
  let canHeal = inventory.gold >= healCost && player.hp < player.stats.maxHp;
  drawBtn(`FULL HEAL\n${healCost} Gold`, width/2 - 200, 400, 300, 150, () => {
    if (canHeal) { inventory.gold -= healCost; player.hp = player.stats.maxHp; }
  }, canHeal ? color(50, 150, 50) : color(100));
  
  let upCost = 1;
  let canUp = inventory.gold >= upCost;
  drawBtn(`UPGRADE\n${upCost} Gold`, width/2 + 200, 400, 300, 150, () => {
    if (canUp) { inventory.gold -= upCost; previousState = "SHOP"; gameState = "LEVEL_UP"; }
  }, canUp ? color(50, 100, 200) : color(100));
  
  drawBtn("NEXT STAGE", width/2, 700, 300, 80, () => { startStage(); gameState = "GAME"; });
}

function drawLevelUpOverlay() {
  fill(0, 0, 0, 220); rect(width/2, height/2, width, height);
  fill(255); textSize(50); text("LEVEL UP!", width/2, 100);
  textSize(24); text("Select Upgrade", width/2, 150);
  
  let stats = [
    {k:"maxHp", n:"Max HP"}, {k:"damage", n:"Damage"}, 
    {k:"speed", n:"Speed"}, {k:"range", n:"Range"},
    {k:"atkSpeed", n:"Atk Spd"}, {k:"critChance", n:"Crit %"},
    {k:"critDamage", n:"Crit Dmg"}, {k:"typeLvl", n:"Type"}
  ];
  
  let startY = 250;
  for(let i=0; i<stats.length; i++) {
    let s = stats[i];
    
    if (s.k === "typeLvl" && (playerType === "Normal" || playerType === "Perfect")) continue;

    let lvl = player.levels[s.k];
    let limit = (s.k === "typeLvl") ? TYPE_CAP : STAT_CAP;
    let isMax = lvl >= limit;
    
    if (s.k === "maxHp") isMax = false;

    let txt = isMax ? `${s.n} (MAX)` : `${s.n} ${lvl}`;
    if (s.k === "typeLvl" && lvl >= TYPE_CAP) txt = `${s.n} (EVOLVED)`;
    
    let col = (i % 2); 
    let row = floor(i / 2);
    let x = (col === 0) ? width/2 - 200 : width/2 + 200;
    let y = startY + row * 100;
    
    if (isMax) {
      fill(80); rect(x, y, 350, 80, 8); fill(150); textSize(20); text(txt, x, y);
    } else {
      drawBtn(txt, x, y, 350, 80, () => {
        player.upgradeStat(s.k);
        gameState = (previousState === "SHOP") ? "SHOP" : "GAME";
      });
    }
  }
}

function drawHUD() {
  fill(0, 150); rect(width/2, 40, width, 80);
  fill(255); textSize(24); textAlign(LEFT, CENTER);
  text(`HP: ${player.hp} / ${player.stats.maxHp}`, 40, 40);
  text(`GOLD: ${inventory.gold}`, 250, 40);
  textAlign(CENTER, CENTER);
  text(`STAGE ${currentStage}`, width/2, 30);
  fill(getTypeColor(getCurrentStageType())); textSize(18);
  text(`BIOME: ${getCurrentStageType()}`, width/2, 60);
  textAlign(RIGHT, CENTER); fill(255); textSize(20);
  text(gameMode, width-40, 30);
  textSize(16);
  text(`${playerType} (T${player.levels.typeLvl})`, width-40, 60);
}

function drawGameOver() {
  fill(0, 200); rect(width/2, height/2, width, height);
  textAlign(CENTER, CENTER); textStyle(BOLD); 
  fill(255, 50, 50); textSize(100); text("DEFEAT", width/2, height/2 - 100);
  textStyle(NORMAL); 
  fill(255); textSize(40); text(`Stage: ${currentStage}`, width/2, height/2 + 20);
  drawBtn("MENU", width/2, height/2 + 150, 300, 80, () => gameState = "MENU");
}

function drawVictory() {
  background(20, 50, 20); 
  textAlign(CENTER, CENTER); textStyle(BOLD); 
  fill(50, 255, 50); textSize(100); text("VICTORY", width/2, height/2 - 100);
  textStyle(NORMAL);
  
  if (gameMode === "Campaign" && !unlockedTypes.includes("Perfect")) {
    unlockedTypes.push("Perfect");
    createFloatText("TIPO PERFECT DESBLOQUEADO!", width/2, height/2 + 20, color(128, 0, 0), true);
  }
  
  drawBtn("MENU", width/2, height/2 + 150, 300, 80, () => gameState = "MENU");
}

function drawHowTo() {
  drawMenuBg(); drawTitle("INSTRUCTIONS");
  textAlign(LEFT, TOP); fill(200); textSize(24);
  
  let controls;
  if (aimMode === "Keyboard") controls = "WASD (Move), ARROWS (Aim), SPACEBAR (Shoot).";
  else if (aimMode === "Isaac") controls = "WASD (Move), ARROWS (Aim and Shoot automatically, 4-way only).";
  else if (aimMode === "Baby") controls = "WASD (Move), AUTO-AIM (Mira e atira no inimigo mais próximo).";
  else controls = "WASD (Move), MOUSE (Aim), LEFT CLICK (Shoot).";
    
  let txt = 
`${controls}

PASSIVES (Evolve at Type Lv3):
- Fire: Burn (Evolved: Spreads).
- Water: AoE (Evolved: 3x Size).
- Plant: Regen (Evolved: Poison + Heal 1/4 HP).
- Light: Shield (Evolved: 10s + AoE Push).
- Dark: Crit Stack (Evolved: Insta-Kill).
- Normal: No passive, no advantages.
- Perfect: +25% Universal Damage (No Passive).

MECHANICS:
- Water>Fire>Plant>Water.
- Light/Dark beat others.
- Perfect beat Any one`;
  
  text(txt, width/2 - 300, 250);
  textAlign(CENTER, CENTER);
  drawBack("MENU");
}

function drawUpdateLog() {
  drawMenuBg(); drawTitle("UPDATE LOG");
  textAlign(LEFT, TOP); fill(200); textSize(24);
  let txt = 
`

Update 0.3.0 BETA / Combat Aim

// Balancing
- BURN adjustment: 20% > 50% damage
- The evolved BURN's hitbox is larger.

// Added
-3 new aiming modes:
- Isaac: old classic style
- Keyboard: arrow keys and space bar
- Mouse: aim with the mouse and shoot with the left mouse button
- Baby: Auto-aim

- New "configurações" added to the main menu
- New "update log" added to the main menu

- 8 new Colors on Custom


`;
  
  text(txt, width/2 - 300, 250);
  textAlign(CENTER, CENTER);
  drawBack("MENU");
}

function drawMenuBg() {
  background(30); stroke(255, 10);
  for(let i=0; i<width; i+=40) line(i,0,i,height);
  for(let i=0; i<height; i+=40) line(0,i,width,i);
  noStroke();
  textAlign(CENTER, CENTER); 
  textStyle(NORMAL); 
}

function drawBtn(txt, x, y, w, h, callback, clr = color(50, 50, 50), txtClr = color(255)) {
  push();
  let over = mouseX > x - w/2 && mouseX < x + w/2 && mouseY > y - h/2 && mouseY < y + h/2;
  
  if (over) {
    clr = lerpColor(clr, color(150, 150, 150), 0.5);
    if (mouseIsPressed && mouseButton === LEFT) clr = color(0, 0, 0);
    if (mouseIsPressed && mouseButton === LEFT && !btnClicked) {
      callback();
      btnClicked = true;
    }
  }
  
  fill(clr);
  rect(x, y, w, h, 8);
  fill(txtClr); 
  textSize(24);
  text(txt, x, y);
  pop();
}

function drawTitle(txt) {
  fill(255);
  textSize(60);
  textStyle(BOLD);
  text(txt, width/2, 80);
  textStyle(NORMAL);
}

function drawBack(targetState) {
  drawBtn("BACK", 100, height - 60, 150, 60, () => gameState = targetState);
}

// ==========================================
// 7. AUXILIARY FUNCTIONS 
// ==========================================

function drawAimIndicator() {
  // Desativa o indicador de mira nos modos Isaac e Baby
  if (aimMode === "Isaac" || aimMode === "Baby") return; 
  
  let dir;
  
  if (aimMode === "Mouse") {
    // Modo Mouse: Calcula a direção do jogador para o cursor em tempo real
    let mouseX_world = mouseX + cam.x;
    let mouseY_world = mouseY + cam.y;
    dir = p5.Vector.sub(createVector(mouseX_world, mouseY_world), player.pos).normalize();
  } else {
    // Usa a direção suave (Keyboard)
    dir = player.shootDir; 
  }
  
  let angle = dir.heading();
  let orbitRadius = 40; 
  
  let aimX = player.pos.x + orbitRadius * cos(angle);
  let aimY = player.pos.y + orbitRadius * sin(angle);

  push();
  translate(aimX, aimY);
  rotate(angle); 
  
  // Desenho da Mira
  noFill(); stroke(255, 200); strokeWeight(2);
  let crossSize = 10;
  
  fill(255, 50); ellipse(0, 0, 10, 10);
  
  line(5, 0, 5 + crossSize, 0); 
  line(-crossSize/2, 0, crossSize/2, 0); 
  line(0, -crossSize/2, 0, crossSize/2); 
  
  pop();
}

function getCurrentStageType() {
  return STAGE_TYPES[(currentStage - 1) % STAGE_TYPES.length];
}

function spawnEnemy() {
  let type = getCurrentStageType();
  let angle = random(TWO_PI);
  let r = random(width/2 + 50, width/2 + 100);
  let x = player.pos.x + r * cos(angle);
  let y = player.pos.y + r * sin(angle);
  enemies.push(new Enemy(x, y, type));
}

function drawWorldGrid() {
  let stageType = getCurrentStageType();
  let c = getTypeColor(stageType);
  background(red(c)*0.2, green(c)*0.2, blue(c)*0.2);
  
  stroke(red(c)*0.5, green(c)*0.5, blue(c)*0.5, 100);
  for(let x=0; x<WORLD_W; x+=40) line(x, 0, x, WORLD_H);
  for(let y=0; y<WORLD_H; y+=40) line(0, y, WORLD_W, y);
  noStroke();
}

function createFloatText(txt, x, y, clr, isUI = false) {
  floatText.push(new FloatText(txt, x, y, clr, isUI));
}

function createExplosion(x, y, clr, type) {
  let count = (type === "CRIT") ? 20 : 10;
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, clr));
  }
}

function screenShake(intensity) {
  shakeAmount = intensity;
}

function updateShake() {
  shakeAmount = lerp(shakeAmount, 0, 0.2);
  if (shakeAmount < 0.5) shakeAmount = 0;
}

function completeStage() {
  currentStage++;
  let goldReward = 1; 
  if (playerRelic === "Greed") {
    goldReward += 1; 
  }
  inventory.gold += goldReward;
  
  createFloatText(`+${goldReward} GOLD`, width/2, 120, color(255, 215, 0), true);
  
  if (gameMode === "Campaign" && currentStage > maxStages) {
    gameState = "VICTORY";
  } else if ((currentStage - 1) % 5 === 0) {
    gameState = "SHOP"; 
  } else {
    startStage();
  }
}

function getTypeColor(t) {
  if (t==="Fire") return color(255, 80, 80);
  if (t==="Water") return color(80, 80, 255);
  if (t==="Plant") return color(80, 255, 80);
  if (t==="Light") return color(255, 255, 0);
  if (t==="Dark") return color(160, 50, 255);
  if (t==="Normal") return color(220);
  if (t==="Perfect") return color(128, 0, 0); 
  return color(200);
}

// ==========================================
// 8. MOUSE & KEY EVENT HANDLERS
// ==========================================

let btnClicked = false;
function mousePressed() {
  btnClicked = false;
  
  // Ativa o isShooting APENAS para o modo Keyboard, para que o tiro continue enquanto Espaço estiver pressionado.
  if (gameState === "GAME" && aimMode === "Keyboard" && keyCode === 32) { // 32 = SPACEBAR
    player.isShooting = true;
  }
}

function mouseReleased() {
  btnClicked = false;
  
  if (aimMode === "Keyboard") {
    player.isShooting = false;
  }
}

function keyPressed() {
  // Ativa o disparo ao pressionar a barra de espaço (APENAS modo Keyboard)
  if (gameState === "GAME" && aimMode === "Keyboard" && keyCode === 32) { 
    player.isShooting = true;
  }
}

function keyReleased() {
  // Para de disparar ao soltar a barra de espaço (APENAS modo Keyboard)
  if (aimMode === "Keyboard" && keyCode === 32) {
    player.isShooting = false;
  }
}
