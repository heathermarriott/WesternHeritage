let translations = {};
let score = 0;
let timeLeft = 30;
let timerId;
let hopTimerId;

// Speed modes control how long the horse waits in one spot before hopping
// to a new one on its own - this is what actually makes "fast" mode harder,
// since clicking is still worth the same one point either way. Selected on
// the start screen and remembered between rounds (via "Play Again").
const SPEED_SETTINGS = {
    slow: 2200,
    medium: 1400,
    fast: 800
};
let currentSpeed = "medium";

const horse = document.getElementById("horse");
const gameArea = document.getElementById("gameArea");
const gameOverDisplay = document.getElementById("gameOver");
const speedSelectDisplay = document.getElementById("speedSelect");
let scoreDisplay = document.getElementById("gameScore");
const gameHeading = document.getElementById("gameHeading");
const gameStats = document.getElementById("gameStats"); // This is the container now

/**
 * Fetches and loads the language translations from a JSON file.
 * Defaults to English if the saved language is not found.
 */
async function loadLanguage() {
    const savedLanguage = localStorage.getItem("language") || "en";
    try {
        const response = await fetch(`../${savedLanguage}.json`);
        if (!response.ok) {
            // Fallback to English if the language file doesn't exist
            const enResponse = await fetch('../en.json');
            translations = await enResponse.json();
        } else {
            translations = await response.json();
        }
        applyTranslations();
    } catch (error) {
        console.error("Failed to load language file, falling back to English.", error);
        try {
            const enResponse = await fetch('../en.json');
            translations = await enResponse.json();
            applyTranslations();
        } catch (e) {
            console.error("Failed to load even the English language file.", e);
        }
    }
}

/**
 * Applies the loaded translations to the game's UI elements.
 */
function applyTranslations() {
    const t = translations.game;
    if (!t) return;

    // Apply to static elements with data-lang-key attributes
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        const keys = key.split('.');
        let text = translations;
        for (const k of keys) {
            text = text ? text[k] : undefined;
        }
        if (text) {
            element.textContent = text;
        }
    });

    // Apply to dynamically generated content
    gameStats.innerHTML = `
        <div class="stat-item">
            <span>${t.time}</span> <span><span id="time">${timeLeft}</span> ${t.seconds}</span>
        </div>
        <div class="stat-item">
            <span>${t.horsesCollected}</span> <span id="gameScore" class="score-value">${score}</span>
        </div>
    `;
    scoreDisplay = document.getElementById("gameScore");

    // Re-render the speed select screen too, if it's currently showing, so
    // a language switch mid-selection doesn't leave it in English.
    if (speedSelectDisplay && speedSelectDisplay.classList.contains("visible")) {
        renderSpeedSelect();
    }
}

/**
 * Shows the speed-selection screen and wires up its three buttons. Shown on
 * first load and again after "Change Speed" from the game-over screen.
 */
function renderSpeedSelect() {
    const t = translations.game;
    if (!t || !speedSelectDisplay) return;

    horse.style.display = 'none';
    gameOverDisplay.innerHTML = "";
    clearInterval(timerId);
    clearTimeout(hopTimerId);

    speedSelectDisplay.innerHTML = `
        <h2>${t.selectSpeed}</h2>
        <div class="speed-options">
            <button id="speedSlow" class="avatarBtn speed-btn${currentSpeed === 'slow' ? ' speed-selected' : ''}">${t.speedSlow}</button>
            <button id="speedMedium" class="avatarBtn speed-btn${currentSpeed === 'medium' ? ' speed-selected' : ''}">${t.speedMedium}</button>
            <button id="speedFast" class="avatarBtn speed-btn${currentSpeed === 'fast' ? ' speed-selected' : ''}">${t.speedFast}</button>
        </div>
    `;
    speedSelectDisplay.classList.add("visible");

    ["slow", "medium", "fast"].forEach(speed => {
        document.getElementById(`speed${speed.charAt(0).toUpperCase()}${speed.slice(1)}`)
            .addEventListener("click", () => {
                currentSpeed = speed;
                speedSelectDisplay.classList.remove("visible");
                startGame();
            });
    });
}

/**
 * Moves the horse to a random position within the game area, and (re)arms
 * the auto-hop timer so the horse also wanders off on its own after
 * SPEED_SETTINGS[currentSpeed] ms if it isn't clicked first. Called both on
 * a successful click (reward: it jumps immediately) and by the hop timer
 * itself (penalty: no click needed).
 */
function moveHorse() {
    if (!gameArea || !horse) return;
    const gameAreaRect = gameArea.getBoundingClientRect();
    const horseSize = horse.getBoundingClientRect();

    const maxX = gameAreaRect.width - horseSize.width;
    const maxY = gameAreaRect.height - horseSize.height;

    const randomX = Math.random() * maxX;
    const randomY = Math.random() * maxY;

    horse.style.left = `${randomX}px`;
    horse.style.top = `${randomY}px`;

    clearTimeout(hopTimerId);
    if (timeLeft > 0) {
        hopTimerId = setTimeout(moveHorse, SPEED_SETTINGS[currentSpeed]);
    }
}

/**
 * Starts the game timer and the main game loop.
 */
function startGame() {
    score = 0;
    timeLeft = 30;
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (document.getElementById("time")) document.getElementById("time").textContent = timeLeft;
    gameOverDisplay.innerHTML = "";
    horse.style.display = 'block';

    moveHorse();

    timerId = setInterval(() => {
        timeLeft--;
        if (document.getElementById("time")) document.getElementById("time").textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerId);
            clearTimeout(hopTimerId);
            horse.style.display = 'none';
            const t = translations.game;
            gameOverDisplay.innerHTML = `
                <h2>${t.timeUp}</h2>
                <p>${t.roundedUp.replace('{score}', score)}</p>
                <button id="playAgain" class="avatarBtn">${t.playAgain}</button>
                <button id="changeSpeed" class="avatarBtn speed-btn">${t.changeSpeed}</button>
            `;
            document.getElementById("playAgain").addEventListener("click", startGame);
            document.getElementById("changeSpeed").addEventListener("click", renderSpeedSelect);
        }
    }, 1000);
}

horse.addEventListener("click", () => {
    score++;
    document.getElementById("gameScore").textContent = score;
    moveHorse();
});

// Initialize the game when the script loads - show the speed picker first
// rather than jumping straight into a round.
loadLanguage().then(renderSpeedSelect);