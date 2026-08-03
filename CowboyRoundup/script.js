let translations = {};
let score = 0;
let timeLeft = 30;
let timerId;

const horse = document.getElementById("horse");
const gameArea = document.getElementById("gameArea");
const gameOverDisplay = document.getElementById("gameOver");
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
}

/**
 * Moves the horse to a random position within the game area.
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
            horse.style.display = 'none';
            const t = translations.game;
            gameOverDisplay.innerHTML = `
                <h2>${t.timeUp}</h2>
                <p>${t.roundedUp.replace('{score}', score)}</p>
                <button id="playAgain" class="avatarBtn">${t.playAgain}</button>
            `;
            document.getElementById("playAgain").addEventListener("click", startGame);
        }
    }, 1000);
}

horse.addEventListener("click", () => {
    score++;
    document.getElementById("gameScore").textContent = score;
    moveHorse();
});

// Initialize the game when the script loads
loadLanguage().then(startGame);