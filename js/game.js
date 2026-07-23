/**
 * Cowboy Roundup Game Logic
 *
 * This module contains all the functions and state management
 * for the horse roundup game.
 */

let translations = {};

export function setTranslations(newTranslations) {
    translations = newTranslations;
}

export function startRoundupGame() {
    // Initialize game variables
    let score = 0;
    let timeLeft = 30;

    const horse = document.getElementById("horse");
    const scoreLabel = document.getElementById("gameScore");
    const timerLabel = document.getElementById("time");
    const gameOver = document.getElementById("gameOver");
    const gameArea = document.getElementById("gameArea");

    // Reset the game display for a new game or replay
    gameOver.innerHTML = "";
    scoreLabel.innerHTML = "0";
    timerLabel.innerHTML = "30";

    // Make sure the horse is visible at the start
    horse.style.display = "block";

    // Function to move the horse to a random position within the game area
    function moveHorse() {
        const x = Math.random() * (gameArea.clientWidth - 120);
        const y = 70 + Math.random() * (gameArea.clientHeight - 180);

        horse.style.left = x + "px";
        horse.style.top = y + "px";
    }

    // Move the horse to its first position
    moveHorse();

    horse.onclick = function () {
        score++;
        scoreLabel.innerHTML = score;
        // Move the horse immediately after it's clicked
        moveHorse();
    };

    // A timer to automatically move the horse every 2 seconds if it's not clicked
    const moveTimer = setInterval(moveHorse, 2000);

    // The main game countdown timer, runs every second
    const countdown = setInterval(function () {
        timeLeft--;
        timerLabel.innerHTML = timeLeft;

        if (timeLeft <= 0) {
            // Stop the timers when time runs out
            clearInterval(moveTimer);
            clearInterval(countdown);

            // Hide the horse and show the game over message
            horse.style.display = "none";

            gameOver.innerHTML = `
                <h2 data-lang-key="game.timeUp">${translations.game.timeUp}</h2>
                <h3 data-lang-key="game.roundedUp">${translations.game.roundedUp.replace('{score}', score)}</h3>
                <button id="playAgain">${translations.game.playAgain}</button>
            `;

            // Add a listener to the "Play Again" button
            document.getElementById("playAgain").addEventListener("click", function () {
                // Remove the game over message and button
                gameOver.innerHTML = "";
                // Restart the game
                startRoundupGame();
            });
        }
    }, 1000);
}