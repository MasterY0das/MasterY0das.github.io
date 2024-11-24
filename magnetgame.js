
// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 24;
const GRAVITY = 0.08;  // Reduced from 0.15
const MOVE_SPEED = 4;
const MAGNET_FORCE = 0.5;
const MAGNET_RANGE = 900;
const MAX_VELOCITY = 6;
const DRAG = 0.98;      
const MAGNET_MAX_DURATION = 180;
const MAGNET_RECHARGE_RATE = 1;
const MAGNET_DRAIN_RATE = 1;
const INACTIVITY_THRESHOLD = 180;
const MIN_MOVEMENT_SPEED = 0.5;
const BOX_SIZE = 30;
const POWERUP_SIZE = 20;
const POWERUP_SPAWN_RATE = 300;
const SPRITE_SIZE = 24;
const DEATH_ANIMATION_FRAMES = 8;
const DEATH_ANIMATION_SPEED = 3;
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Difficulty presets
const DIFFICULTY_SETTINGS = {
    easy: {
        boxSpawnRate: 60,
        maxBoxes: 8,
        boxSpeed: 2
    },
    medium: {
        boxSpawnRate: 40,
        maxBoxes: 10,
        boxSpeed: 3
    },
    hard: {
        boxSpawnRate: 20,
        maxBoxes: 15,
        boxSpeed: 4
    }
};



canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const gameState = {
    currentState: 'menu',
    difficulty: 'medium',
    player: {
        x: CANVAS_WIDTH / 4,
        y: CANVAS_HEIGHT / 2,
        vx: 0,
        vy: 0,
        facingRight: true,
        inactiveFrames: 0,
        powerups: {
            infiniteMagnet: false,
            invincibility: false
        },
        powerupTimers: {
            infiniteMagnet: 0,
            invincibility: 0
        }
    },
    mirrorPlayer: {
        x: (CANVAS_WIDTH * 3) / 4,
        y: CANVAS_HEIGHT / 2,
        vx: 0,
        vy: 0,
        facingRight: false
    },
    deathAnimation: {
        frame: 0,
        x: 0,
        y: 0,
        isPlaying: false
    },
    magnet: null,
    isPulling: false,
    magnetEnergy: MAGNET_MAX_DURATION,
    score: 0,
    gameOver: false,
    gameOverReason: '',
    boxes: [],
    powerups: [],
    frameCount: 0
};
function startDeathAnimation(x, y) {
    gameState.deathAnimation.isPlaying = true;
    gameState.deathAnimation.frame = 0;
    gameState.deathAnimation.x = x;
    gameState.deathAnimation.y = y;
}

const POWERUP_TYPES = {
    INFINITE_MAGNET: {
        color: '#00FF00',
        duration: 300, // 5 seconds
        effect: (player) => {
            player.powerups.infiniteMagnet = true;
            player.powerupTimers.infiniteMagnet = 300;
        }
    },
    INVINCIBILITY: {
        color: '#FFD700',
        duration: 300,
        effect: (player) => {
            player.powerups.invincibility = true;
            player.powerupTimers.invincibility = 300;
        }
    }
};
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && gameState.gameOver) {
        resetGame();
        return;
    }
    
    if (gameState.currentState !== 'playing' || gameState.gameOver) return;
    
    switch(e.code) {
        case 'ArrowLeft':
            gameState.player.vx = -MOVE_SPEED;
            // Mirror player moves in the same direction
            gameState.mirrorPlayer.vx = -MOVE_SPEED;
            gameState.player.facingRight = false;
            gameState.mirrorPlayer.facingRight = false;
            break;
        case 'ArrowRight':
            gameState.player.vx = MOVE_SPEED;
            // Mirror player moves in the same direction
            gameState.mirrorPlayer.vx = MOVE_SPEED;
            gameState.player.facingRight = true;
            gameState.mirrorPlayer.facingRight = true;
            break;
        case 'KeyE':
            e.preventDefault();
            if (gameState.magnet && (gameState.magnetEnergy > 0 || gameState.player.powerups.infiniteMagnet)) {
                gameState.isPulling = true;
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    if (gameState.currentState !== 'playing' || gameState.gameOver) return;
    
    switch(e.code) {
        case 'ArrowLeft':
            if (gameState.player.vx < 0) {
                gameState.player.vx = 0;
                gameState.mirrorPlayer.vx = 0;
            }
            break;
        case 'ArrowRight':
            if (gameState.player.vx > 0) {
                gameState.player.vx = 0;
                gameState.mirrorPlayer.vx = 0;
            }
            break;
        case 'KeyE':
            e.preventDefault();
            gameState.isPulling = false;
            break;
    }
});

canvas.addEventListener('click', (e) => {
    if (gameState.gameOver || gameState.currentState !== 'playing') return;
    
    // Get the correct mouse position relative to the canvas
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Clear existing magnet and force state
    gameState.isPulling = false;
    
    // Only set new magnet point if within canvas bounds
    if (x >= 0 && x <= CANVAS_WIDTH && y >= 0 && y <= CANVAS_HEIGHT) {
        gameState.magnet = {
            x: Math.min(Math.max(x, 0), CANVAS_WIDTH),
            y: Math.min(Math.max(y, 0), CANVAS_HEIGHT)
        };
    }
});

function applyMagnetForce(player, inverse = false) {
    if (!gameState.magnet || !gameState.isPulling || 
        (gameState.magnetEnergy <= 0 && !gameState.player.powerups.infiniteMagnet)) {
        return;
    }

    // Calculate distance from player center to magnet point
    const playerCenterX = player.x + PLAYER_SIZE / 2;
    const playerCenterY = player.y + PLAYER_SIZE / 2;
    const dx = gameState.magnet.x - playerCenterX;
    const dy = gameState.magnet.y - playerCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Add minimum distance check to prevent extreme forces
    const MIN_DISTANCE = 5;
    if (distance < MIN_DISTANCE) return;
    if (distance > MAGNET_RANGE) return;

    // Drain magnet energy if not infinite
    if (!gameState.player.powerups.infiniteMagnet) {
        gameState.magnetEnergy = Math.max(0, gameState.magnetEnergy - MAGNET_DRAIN_RATE);
    }
    
    // Calculate force with distance falloff and safety clamping
    const forceMagnitude = Math.min(
        MAGNET_FORCE,
        MAGNET_FORCE * (MAGNET_RANGE / Math.max(distance, MIN_DISTANCE))
    );
    
    // Calculate normalized direction vectors instead of using angles
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Calculate force components with safety checks
    let forceX = dirX * forceMagnitude;
    let forceY = dirY * forceMagnitude;
    
    // Invert force if needed (for mirror player)
    if (inverse) {
        forceX = -forceX;
        forceY = -forceY;
    }

    // Add force limiting
    const MAX_FORCE = 2;
    forceX = Math.max(-MAX_FORCE, Math.min(forceX, MAX_FORCE));
    forceY = Math.max(-MAX_FORCE, Math.min(forceY, MAX_FORCE));

    // Only apply force if the values are valid numbers
    if (isFinite(forceX) && isFinite(forceY) && !isNaN(forceX) && !isNaN(forceY)) {
        // Add force to velocity with additional clamping
        player.vx += forceX;
        player.vy += forceY;
        
        // Clamp velocity to maximum speed
        player.vx = Math.max(-MAX_VELOCITY, Math.min(player.vx, MAX_VELOCITY));
        player.vy = Math.max(-MAX_VELOCITY, Math.min(player.vy, MAX_VELOCITY));
    }
}

// Add this helper function to check for NaN values
function checkAndFixNaN() {
    if (isNaN(gameState.player.x) || isNaN(gameState.player.y) || 
        isNaN(gameState.player.vx) || isNaN(gameState.player.vy)) {
        gameState.player.x = CANVAS_WIDTH / 4;
        gameState.player.y = CANVAS_HEIGHT / 2;
        gameState.player.vx = 0;
        gameState.player.vy = 0;
    }
    
    if (isNaN(gameState.mirrorPlayer.x) || isNaN(gameState.mirrorPlayer.y) || 
        isNaN(gameState.mirrorPlayer.vx) || isNaN(gameState.mirrorPlayer.vy)) {
        gameState.mirrorPlayer.x = (CANVAS_WIDTH * 3) / 4;
        gameState.mirrorPlayer.y = CANVAS_HEIGHT / 2;
        gameState.mirrorPlayer.vx = 0;
        gameState.mirrorPlayer.vy = 0;
    }
}

// Fix the click handler
function handleClick(e) {
    if (gameState.gameOver || gameState.currentState !== 'playing') return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Ensure click is within canvas bounds
    if (x >= 0 && x <= CANVAS_WIDTH && y >= 0 && y <= CANVAS_HEIGHT) {
        // Update magnet position
        gameState.magnet = {
            x: Math.min(Math.max(x, 0), CANVAS_WIDTH),
            y: Math.min(Math.max(y, 0), CANVAS_HEIGHT)
        };
    }
}

canvas.addEventListener('click', handleClick);





function updateMagnetEnergy() {
    if (!gameState.isPulling && gameState.magnetEnergy < MAGNET_MAX_DURATION) {
        gameState.magnetEnergy = Math.min(MAGNET_MAX_DURATION, gameState.magnetEnergy + MAGNET_RECHARGE_RATE);
    } else if (gameState.isPulling && !gameState.player.powerups.infiniteMagnet) {
        gameState.magnetEnergy = Math.max(0, gameState.magnetEnergy - MAGNET_DRAIN_RATE);
        if (gameState.magnetEnergy <= 0) {
            gameState.isPulling = false;
        }
    }
}
function checkPlayerActivity() {
    const speed = Math.sqrt(gameState.player.vx * gameState.player.vx + gameState.player.vy * gameState.player.vy);
    if (speed < MIN_MOVEMENT_SPEED) {
        gameState.player.inactiveFrames++;
        if (gameState.player.inactiveFrames >= INACTIVITY_THRESHOLD) {
            gameOver("STOPPED MOVING!");
        }
    } else {
        gameState.player.inactiveFrames = 0;
    }
}
function checkCollisionWith(player, object) {
    return player.x < object.x + object.width &&
           player.x + PLAYER_SIZE > object.x &&
           player.y < object.y + object.height &&
           player.y + PLAYER_SIZE > object.y;
}

// Declare image variables
let fusionImage = new Image();
let gojoImage = new Image();

// Load images
fusionImage.src = 'zipper.png';  // Replace with your fusion image path
gojoImage.src = 'zipper.png';  // Replace with your Gojo image path

// Ensure images are loaded before using them
fusionImage.onload = () => {
    console.log("Fusion image loaded");
};

gojoImage.onload = () => {
    console.log("Gojo image loaded");
};

function checkCollisions() {
    // Wall collisions
    if (gameState.player.x < 0) {
        gameState.player.x = 0;
        gameState.player.vx = 0;
        gameState.gameOver = true;
        gameState.gameOverReason = "HIT LEFT WALL!";
        return;
    }
    if (gameState.player.x + PLAYER_SIZE > CANVAS_WIDTH) {
        gameState.player.x = CANVAS_WIDTH - PLAYER_SIZE;
        gameState.player.vx = 0;
        gameState.gameOver = true;
        gameState.gameOverReason = "HIT RIGHT WALL!";
        return;
    }
    if (gameState.player.y < 0) {
        gameState.player.y = 0;
        gameState.player.vy = 0;
        gameState.gameOver = true;
        gameState.gameOverReason = "HIT CEILING!";
        return;
    }
    if (gameState.player.y + PLAYER_SIZE > CANVAS_HEIGHT) {
        gameState.player.y = CANVAS_HEIGHT - PLAYER_SIZE;
        gameState.player.vy = 0;
        gameState.gameOver = true;
        gameState.gameOverReason = "FELL DOWN!";
        return;
    }

    // Box collisions
    for (const box of gameState.boxes) {
        if (checkCollisionWith(gameState.player, box)) {
            gameState.gameOver = true;
            gameState.gameOverReason = "HIT BY BOX!";
            return;
        }
    }

    // Player collision with mirror player (fusion into purple cube)
    if (checkCollisionWith(gameState.player, {
        x: gameState.mirrorPlayer.x,
        y: gameState.mirrorPlayer.y,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE
    })) {
        // Start fusion animation
        gameState.gameOver = true;
        gameState.gameOverReason = "PLAYERS COLLIDED! FUSION IN PROGRESS...";

        // Create a purple fusion cube (simulate merging)
        gameState.fusionCube = {
            x: (gameState.player.x + gameState.mirrorPlayer.x) / 2,
            y: (gameState.player.y + gameState.mirrorPlayer.y) / 2,
            size: PLAYER_SIZE * 1.5, // Bigger size to represent fusion
            alpha: 0, // Starting alpha for fade effect
        };

        // Trigger Gojo appearance
        setTimeout(() => {
            gameState.gojoAppeared = true; // This flag will trigger Gojo appearance
        }, 1000); // Delay to simulate the fusion animation before Gojo appears

        return;
    }
}


function update() {
    if (gameState.gameOver || gameState.currentState !== 'playing') return;
    
    checkAndFixNaN();
    
    gameState.frameCount++;
    if (gameState.frameCount % DIFFICULTY_SETTINGS[gameState.difficulty].boxSpawnRate === 0) {
        spawnBox();
    }

    if (gameState.frameCount % POWERUP_SPAWN_RATE === 0) {
        spawnPowerup();
    }
    
    updatePowerups();
    
    gameState.boxes = gameState.boxes.filter(box => {
        box.y += box.speed;
        return box.y < CANVAS_HEIGHT;
    });
    
    updateAndCheckPowerups();

    // Apply gravity to both players
    gameState.player.vy += GRAVITY;
    gameState.mirrorPlayer.vy += GRAVITY;
    
    updateMagnetEnergy();
    
    if (gameState.magnet && gameState.isPulling && 
        (gameState.magnetEnergy > 0 || gameState.player.powerups.infiniteMagnet)) {
        applyMagnetForce(gameState.player, false);
        applyMagnetForce(gameState.mirrorPlayer, false);
    }
    
    // Update positions
    gameState.player.x += gameState.player.vx;
    gameState.player.y += gameState.player.vy;
    gameState.mirrorPlayer.x += gameState.mirrorPlayer.vx;
    gameState.mirrorPlayer.y += gameState.mirrorPlayer.vy;
    
    // Apply drag to both players
    gameState.player.vx *= DRAG;
    gameState.player.vy *= DRAG;
    gameState.mirrorPlayer.vx *= DRAG;
    gameState.mirrorPlayer.vy *= DRAG;
    
    if (!gameState.player.powerups.invincibility) {
        checkCollisions();
    }
    
    checkPlayerActivity();
    
    if (!gameState.gameOver) {
        gameState.score++;
    }
}
function updatePowerups() {
    // Update powerup timers
    for (const [powerup, timer] of Object.entries(gameState.player.powerupTimers)) {
        if (timer > 0) {
            gameState.player.powerupTimers[powerup]--;
            if (gameState.player.powerupTimers[powerup] <= 0) {
                gameState.player.powerups[powerup] = false;
            }
        }
    }
}
function spawnPowerup() {
    const powerupTypes = Object.keys(POWERUP_TYPES);
    const randomType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    
    gameState.powerups.push({
        x: Math.random() * (CANVAS_WIDTH - POWERUP_SIZE),
        y: -POWERUP_SIZE,
        type: randomType,
        width: POWERUP_SIZE,
        height: POWERUP_SIZE,
        speed: DIFFICULTY_SETTINGS[gameState.difficulty].boxSpeed
    });
}
function updateAndCheckPowerups() {
    gameState.powerups = gameState.powerups.filter(powerup => {
        powerup.y += powerup.speed;
        
        // Check collision with player
        if (checkCollisionWith(gameState.player, powerup)) {
            POWERUP_TYPES[powerup.type].effect(gameState.player);
            return false;
        }
        
        return powerup.y < CANVAS_HEIGHT;
    });
}
function render() {
    // Clear the canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (gameState.gameOver && gameState.fusionCube) {
        // Draw the fusion image (purple cube)
        ctx.globalAlpha = gameState.fusionCube.alpha;
        ctx.drawImage(fusionImage, 
            gameState.fusionCube.x - gameState.fusionCube.size / 2, 
            gameState.fusionCube.y - gameState.fusionCube.size / 2, 
            gameState.fusionCube.size, 
            gameState.fusionCube.size);

        // Increase alpha for fade-in effect
        if (gameState.fusionCube.alpha < 1) {
            gameState.fusionCube.alpha += 0.02;
        }
    }

    // Draw Gojo when he should appear
    if (gameState.gojoAppeared) {
        // Draw Gojo image with a purple aura
        ctx.globalAlpha = 3.0;
        const gojoWidth = 600; // Width of the Gojo image
        const gojoHeight = 600; // Height of the Gojo image
        ctx.drawImage(gojoImage, 
            CANVAS_WIDTH / 2 - gojoWidth / 2, 
            CANVAS_HEIGHT / 2 - gojoHeight / 2, 
            gojoWidth, 
            gojoHeight);
    }
    // Draw falling boxes
    gameState.boxes.forEach(box => {
        ctx.fillStyle = '#FF0000'; // Red color for the drop
        ctx.beginPath();
        ctx.ellipse(box.x + box.width / 2, box.y + box.height, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw powerups
    for (const powerup of gameState.powerups) {
        ctx.fillStyle = POWERUP_TYPES[powerup.type].color;
        ctx.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
    }
    
    // Draw player with powerup effects
    ctx.fillStyle = gameState.player.powerups.invincibility ? 
        `rgba(65, 105, 225, ${0.5 + Math.sin(Date.now() / 100) * 0.5})` : 
        '#4169E1';
    ctx.fillRect(gameState.player.x, gameState.player.y, PLAYER_SIZE, PLAYER_SIZE);
    
    // Draw player eyes/direction indicator
    // Set player face to blue
ctx.fillStyle = 'blue';
ctx.beginPath();
ctx.arc(
    gameState.player.x + PLAYER_SIZE / 2, // Center X
    gameState.player.y + PLAYER_SIZE / 2, // Center Y
    PLAYER_SIZE / 2, // Radius
    0,
    Math.PI * 2
);
ctx.fill();

// Draw eyes
ctx.fillStyle = '#000000'; // Black eyes
const eyeSize = 2; // Smaller eyes to match the sprite
const eyeY = gameState.player.y + PLAYER_SIZE / 3;
const leftEyeX = gameState.player.x + PLAYER_SIZE / 3;
const rightEyeX = gameState.player.x + (PLAYER_SIZE * 2 / 3);
ctx.beginPath();
ctx.arc(leftEyeX, eyeY, eyeSize, 0, Math.PI * 2); // Left eye
ctx.arc(rightEyeX, eyeY, eyeSize, 0, Math.PI * 2); // Right eye
ctx.fill();

// Draw sad mouth
ctx.strokeStyle = '#000000'; // Black mouth
ctx.lineWidth = 1.5; // Thin stroke for the mouth
ctx.beginPath();
const mouthY = gameState.player.y + (PLAYER_SIZE * 2 / 3);
const mouthStartX = gameState.player.x + (PLAYER_SIZE / 3);
const mouthEndX = gameState.player.x + (PLAYER_SIZE * 2 / 3);
ctx.moveTo(mouthStartX, mouthY);
// Create a downward curve for the sad mouth
ctx.quadraticCurveTo(
    gameState.player.x + PLAYER_SIZE / 2, // Control point X (center)
    mouthY + 2, // Control point Y - slightly lower for sadness
    mouthEndX, // End X
    mouthY // End Y
);
ctx.stroke();

    
   // Draw red sprite
ctx.fillStyle = '#FF4444'; // Red color for the sprite
ctx.fillRect(gameState.mirrorPlayer.x, gameState.mirrorPlayer.y, PLAYER_SIZE, PLAYER_SIZE);

// Draw red sprite eyes
ctx.fillStyle = '#000000'; // Black eyes
const redSpriteEyeSize = 2; // Size of the eyes
const redSpriteEyeY = gameState.mirrorPlayer.y + PLAYER_SIZE / 3; // Y-position for the eyes

if (gameState.mirrorPlayer.facingRight) {
    // Eyes positioned to the right
    const redSpriteRightEyeX = gameState.mirrorPlayer.x + PLAYER_SIZE - redSpriteEyeSize * 4;
    const redSpriteLeftEyeX = gameState.mirrorPlayer.x + PLAYER_SIZE - redSpriteEyeSize * 7;
    ctx.fillRect(redSpriteRightEyeX, redSpriteEyeY, redSpriteEyeSize, redSpriteEyeSize); // Right eye
    ctx.fillRect(redSpriteLeftEyeX, redSpriteEyeY, redSpriteEyeSize, redSpriteEyeSize); // Left eye
} else {
    // Eyes positioned to the left
    const redSpriteLeftEyeX = gameState.mirrorPlayer.x + redSpriteEyeSize * 2;
    const redSpriteRightEyeX = gameState.mirrorPlayer.x + redSpriteEyeSize * 5;
    ctx.fillRect(redSpriteLeftEyeX, redSpriteEyeY, redSpriteEyeSize, redSpriteEyeSize); // Left eye
    ctx.fillRect(redSpriteRightEyeX, redSpriteEyeY, redSpriteEyeSize, redSpriteEyeSize); // Right eye
}

// Draw red sprite smiling mouth
ctx.strokeStyle = '#000000'; // Black mouth
ctx.lineWidth = 1.5; // Thin stroke for the mouth
ctx.beginPath();
const redSpriteMouthY = gameState.mirrorPlayer.y + (PLAYER_SIZE * 2 / 3); // Y-position for the mouth
const redSpriteMouthStartX = gameState.mirrorPlayer.x + (PLAYER_SIZE / 3); // Start X of the mouth
const redSpriteMouthEndX = gameState.mirrorPlayer.x + (PLAYER_SIZE * 2 / 3); // End X of the mouth
ctx.moveTo(redSpriteMouthStartX, redSpriteMouthY);
// Create an upward curve for the smiling mouth
ctx.quadraticCurveTo(
    gameState.mirrorPlayer.x + PLAYER_SIZE / 2, // Control point X (center)
    redSpriteMouthY - 2, // Control point Y - slightly higher for smiling
    redSpriteMouthEndX, // End X
    redSpriteMouthY // End Y
);
    
    // Draw magnet and related effects
    if (gameState.magnet) {
        const isActiveMagnet = gameState.isPulling && (gameState.magnetEnergy > 0 || gameState.player.powerups.infiniteMagnet);
        
        // Draw magnet point
        ctx.fillStyle = isActiveMagnet ? '#00FF00' : '#FFFFFF';
        ctx.beginPath();
        ctx.arc(gameState.magnet.x, gameState.magnet.y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        if (isActiveMagnet) {
            drawMagnetEffects();
        }
    }
    function drawMagnetEffects() {
        if (!gameState.magnet || !gameState.isPulling) return;
        
        // Draw lines from players to magnet point when active
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        
        // Line from blue player
        ctx.beginPath();
        ctx.moveTo(gameState.player.x + PLAYER_SIZE/2, gameState.player.y + PLAYER_SIZE/2);
        ctx.lineTo(gameState.magnet.x, gameState.magnet.y);
        ctx.stroke();
        
        // Line from red player
        ctx.beginPath();
        ctx.moveTo(gameState.mirrorPlayer.x + PLAYER_SIZE/2, gameState.mirrorPlayer.y + PLAYER_SIZE/2);
        ctx.lineTo(gameState.magnet.x, gameState.magnet.y);
        ctx.stroke();
        
        ctx.globalAlpha = 1.0;
    }
    
    // Draw UI elements
    drawUI();
    
    // Draw game over screen if needed
    if (gameState.gameOver) {
        drawGameOver();
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for crisp pixels
    initializeGame();
    gameLoop(); // Start the game loop immediately
});
function drawGameOver() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Game over text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER!', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 50);
    
    // Reason and score
    ctx.font = '24px Arial';
    ctx.fillText(gameState.gameOverReason, CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
    ctx.fillText(`Final Score: ${gameState.score}`, CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 40);
    ctx.fillText('Press R to Restart', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 80);
    
    // Reset text alignment
    ctx.textAlign = 'left';
}
function drawUI() {
    // Draw score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${gameState.score}`, 20, 30);
    
    // Draw powerup indicators
    let yOffset = 60;
    if (gameState.player.powerups.infiniteMagnet) {
        ctx.fillStyle = POWERUP_TYPES.INFINITE_MAGNET.color;
        ctx.fillText('∞ Magnet', 20, yOffset);
        yOffset += 25;
    }
    if (gameState.player.powerups.invincibility) {
        ctx.fillStyle = POWERUP_TYPES.INVINCIBILITY.color;
        ctx.fillText('⭐ Invincible', 20, yOffset);
    }
    
    // Draw magnet energy bar (if not infinite)
    if (!gameState.player.powerups.infiniteMagnet) {
        const barWidth = 200;
        const barHeight = 10;
        const barX = 20;
        const barY = CANVAS_HEIGHT - 30;
        
        // Background bar
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Energy level
        const energyPercentage = gameState.magnetEnergy / MAGNET_MAX_DURATION;
        ctx.fillStyle = energyPercentage > 0.3 ? '#00FF00' : '#FF0000';
        ctx.fillRect(barX, barY, barWidth * energyPercentage, barHeight);
    }
}

function gameOver(reason) {
    gameState.gameOver = true;
    gameState.gameOverReason = reason;
    if (!gameState.gameOver) {
        startDeathAnimation(gameState.player.x, gameState.player.y);
        gameState.gameOver = true;
        gameState.gameOverReason = reason;
    }
}

function resetGame() {
    gameState.player.x = CANVAS_WIDTH / 4;
    gameState.player.y = CANVAS_HEIGHT / 2;
    gameState.player.vx = 0;
    gameState.player.vy = 0;
    gameState.player.inactiveFrames = 0;
    
    gameState.mirrorPlayer.x = (CANVAS_WIDTH * 3) / 4;
    gameState.mirrorPlayer.y = CANVAS_HEIGHT / 2;
    gameState.mirrorPlayer.vx = 0;
    gameState.mirrorPlayer.vy = 0;
    
    gameState.magnet = null;
    gameState.isPulling = false;
    gameState.magnetEnergy = MAGNET_MAX_DURATION;
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.gameOverReason = '';
    gameState.boxes = [];
    gameState.frameCount = 0;
    gameState.fusionCube = null;
    gameState.gojoAppeared = false;
    
    gameState.player.x = CANVAS_WIDTH / 4;
    gameState.player.y = CANVAS_HEIGHT / 2;
    
}

function gameLoop() {
    if (gameState.currentState === 'playing') {
        update();
        render();
    }
    requestAnimationFrame(gameLoop);
}
document.getElementById('homeScreen').innerHTML = `
    <h1>Magnetic Mirror</h1>
    <div class="menu-item" id="startGame">Start Game</div>
    <div class="menu-item" id="difficulty">Difficulty</div>
    <div class="menu-item" id="controls">Controls</div>
`;
document.getElementById('difficulty').addEventListener('click', () => {
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.innerHTML = `
        <h2>Select Difficulty</h2>
        <div class="difficulty-container">
            <div class="menu-item" id="easyMode">Easy</div>
            <div class="menu-item" id="mediumMode">Medium</div>
            <div class="menu-item" id="hardMode">Hard</div>
        </div>
        <div class="menu-item" id="backToMenu">Back to Menu</div>
    `;
    
    // Add difficulty selection handlers
    ['easy', 'medium', 'hard'].forEach(diff => {
        document.getElementById(`${diff}Mode`).addEventListener('click', () => {
            gameState.difficulty = diff;
            // Return to main menu
            document.getElementById('backToMenu').click();
        });
    });
    
    // Add back button handler
    document.getElementById('backToMenu').addEventListener('click', () => {
        // Restore original menu and reattach event listeners
        restoreMainMenu();
    });
});
function restoreMainMenu() {
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.innerHTML = `
        <h1>Magnetic Mirror</h1>
        <div class="menu-item" id="startGame">Start Game</div>
        <div class="menu-item" id="difficulty">Difficulty</div>
        <div class="menu-item" id="controls">Controls</div>
    `;
    
    // Reattach all menu event listeners
    attachMenuListeners();
}

function attachMenuListeners() {
    document.getElementById('startGame').addEventListener('click', () => {
        document.getElementById('homeScreen').style.display = 'none';
        gameState.currentState = 'playing';
        resetGame();
        gameLoop();
    });
    
    document.getElementById('difficulty').addEventListener('click', () => {
        document.getElementById('difficulty').click();
    });
    
    document.getElementById('controls').addEventListener('click', () => {
        document.getElementById('controls').click();
    });
}

// Add some CSS for the new elements
const style = document.createElement('style');
style.textContent = `
    .difficulty-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin: 20px 0;
    }
    
    .powerup-indicator {
        display: flex;
        align-items: center;
        margin: 5px 0;
        color: white;
        font-size: 14px;
    }
    
    .powerup-indicator .icon {
        width: 12px;
        height: 12px;
        margin-right: 8px;
        display: inline-block;
    }
`;
document.head.appendChild(style);
document.getElementById('startGame').addEventListener('click', () => {
    document.getElementById('homeScreen').style.display = 'none';
    gameState.currentState = 'playing';
    resetGame();
    gameLoop();
});
document.getElementById('controls').addEventListener('click', () => {
    const homeScreen = document.getElementById('homeScreen');
    const startButton = document.getElementById('startGame');
    const controlsButton = document.getElementById('controls');
    
    // Store the original menu HTML
    const originalMenu = homeScreen.innerHTML;
    
    // Hide the main menu buttons
    startButton.style.display = 'none';
    controlsButton.style.display = 'none';
    
    // Add controls content
    homeScreen.innerHTML += `
        <h2>Controls</h2>
        <div class="controls-container">
            <p>← → : Move left/right</p>
            <p>Mouse Click: Place magnet point</p>
            <p>E (Hold): Activate magnet</p>
            <p>R: Restart game (when game over)</p>
        </div>
        <div class="menu-item" id="backTFoMenu">Back to Menu</div>
    `;
    
    document.getElementById('backToMenu').addEventListener('click', () => {
        // Restore original menu content
        homeScreen.innerHTML = originalMenu;
        
        // Re-attach event listeners since we replaced the HTML
        // Re-attach the controls listener
        document.getElementById('controls').addEventListener('click', () => {
            // The event listener will handle the controls display
            document.getElementById('controls').click();
        });
    });
});
function initializeGame() {
    // Set up the home screen HTML
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.innerHTML = `
        <div class="menu-container">
            <h1>Magnetic Mirror</h1>
            <div class="menu-item" id="startGame">Start Game</div>
            <div class="menu-item" id="difficultyButton">Difficulty: ${gameState.difficulty}</div>
            <div class="menu-item" id="controlsButton">Controls</div>
        </div>
    `;

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
        #gameCanvas {
            cursor: crosshair;  /* Add this to show it's clickable */
        }
        .menu-container {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: white;
        }
        .menu-item {
            margin: 20px;
            padding: 10px 20px;
            background-color: #4169E1;
            cursor: pointer;
            border-radius: 5px;
            transition: background-color 0.3s;
        }
        .menu-item:hover {
            background-color: #2149C1;
        }
        .difficulty-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin: 20px 0;
        }
    `;
    document.head.appendChild(style);

    // Attach menu event listeners
    attachMenuListeners();
}

function showDifficultyScreen() {
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.innerHTML = `
        <div class="menu-container">
            <h2>Select Difficulty</h2>
            <div class="difficulty-container">
                <div class="menu-item" id="easyMode">Easy</div>
                <div class="menu-item" id="mediumMode">Medium</div>
                <div class="menu-item" id="hardMode">Hard</div>
            </div>
            <div class="menu-item" id="backToMenu">Back to Menu</div>
        </div>
    `;

    // Add difficulty selection handlers
    ['easy', 'medium', 'hard'].forEach(diff => {
        document.getElementById(`${diff}Mode`).addEventListener('click', () => {
            gameState.difficulty = diff;
            showMainMenu();
        });
    });

    document.getElementById('backToMenu').addEventListener('click', showMainMenu);
}


function showControlsScreen() {
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.innerHTML = `
        <div class="menu-container">
            <h2>Controls</h2>
            <div class="controls-container">
                <p>← → : Move left/right</p>
                <p>Mouse Click: Place magnet point</p>
                <p>E (Hold): Activate magnet</p>
                <p>R: Restart game (when game over)</p>
            </div>
            <div class="menu-item" id="backToMenu">Back to Menu</div>
        </div>
    `;

    document.getElementById('backToMenu').addEventListener('click', showMainMenu);
}

function showMainMenu() {
    const homeScreen = document.getElementById('homeScreen');
    homeScreen.style.display = 'block';
    homeScreen.innerHTML = `
        <div class="menu-container">
            <h1>Magnetic Mirror</h1>
            <div class="menu-item" id="startGame">Start Game</div>
            <div class="menu-item" id="difficultyButton">Difficulty: ${gameState.difficulty}</div>
            <div class="menu-item" id="controlsButton">Controls</div>
        </div>
    `;
    attachMenuListeners();
}

function attachMenuListeners() {
    document.getElementById('startGame').addEventListener('click', () => {
        document.getElementById('homeScreen').style.display = 'none';
        gameState.currentState = 'playing';
        resetGame();
        gameLoop();
    });

    document.getElementById('difficultyButton').addEventListener('click', showDifficultyScreen);
    document.getElementById('controlsButton').addEventListener('click', showControlsScreen);
}

// Function to start the game
function gameLoop() {
    if (gameState.currentState === 'playing') {
        update();
        render();
    }
    requestAnimationFrame(gameLoop);
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    initializeGame();
});

function spawnBox() {
    const settings = DIFFICULTY_SETTINGS[gameState.difficulty];
    if (gameState.boxes.length >= settings.maxBoxes) return;
    
    const x = Math.random() * (CANVAS_WIDTH - BOX_SIZE);
    gameState.boxes.push({
        x: x,
        y: -BOX_SIZE,
        width: BOX_SIZE,
        height: BOX_SIZE,
        speed: settings.boxSpeed + Math.random() * 2, // Random speed variation
        shape: 'drop', // Indicating this is a water drop
    });
}
