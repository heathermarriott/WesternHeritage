// Get references to the main interactive elements on the page
const hatButton = document.getElementById("hatButton");
const menu = document.getElementById("menu");
const stage = document.getElementById("stage");
const closeBtn = document.getElementById("closeBtn");
const content = document.getElementById("content");
const introVideo = document.getElementById("introVideo");

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        introVideo.play().catch(() => {});
    }
});
function switchVideo(filename) {
    const source = introVideo.querySelector("source");
    source.src = filename;
    introVideo.load();
    introVideo.style.display = 'block'; // Make sure video is visible
    introVideo.play().catch(() => {});
}

function showStaticAvatar() {
    introVideo.style.display = 'none'; // Hide video
    introVideo.pause();
    // Use the existing content div to show the image, ensuring it covers the area
    content.innerHTML = `<img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">`;
}

// --- STATE VARIABLES ---
let currentAvatarImg = "assets/teddy.png";
let currentAvatarId = "teddy"; // Add an ID for the current avatar
let currentPage = "Select Avatar"; // Track the current page for language switching
let translations = {}; // To store the loaded language JSON

let askQuestionCollapsed = false;
let lastAskedLabel = "";

// --- MENU CONTROLS ---

// Event listener to open the menu when the hat button is clicked
hatButton.addEventListener("click", () => {
    menu.classList.add("open");
    document.body.classList.add("menu-open");
});

// Event listener to close the menu when the close button is clicked
closeBtn.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
});

// --- PAGE AND CONTENT LOGIC ---

// A reusable function to attach click listeners to the avatar selection buttons
function attachAvatarButtonListeners(){
    document.querySelectorAll(".avatarBtn").forEach(btn => {
        btn.addEventListener("click", function(){
            // Update the current avatar image and ID
            currentAvatarImg = this.dataset.img;
            currentAvatarId = this.dataset.avatarId;

            // Avatar has been picked - switch back to the card layout for the
            // confirmation message (video keeps playing behind it either way)
            content.classList.remove("transparent");

            // Replace the buttons with a confirmation message
            content.innerHTML = `
                <img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="max-width:min(60%, calc(220px * var(--scale))); margin: 0 auto calc(20px * var(--scale)); display:block;">
                <h2 data-lang-key="avatar.selectedHeading">${translations.avatar.selectedHeading}</h2>
                <p data-lang-key="avatar.selectedMessage">${translations.avatar.selectedMessage}</p>
            `;
        });
    });
}

// --- DYNAMIC PAGE LOADING ---
// Based on the 'data-page' attribute of the clicked link, generate the appropriate HTML.
function renderPage(page) {
    currentPage = page; // Update the current page tracker

    if (page === "Select Avatar") {
        // Full-bleed video look for avatar selection: strip the card styling
        introVideo.style.display = 'block';
        stage.style.backgroundImage = ''; // Clear any static background image
        content.classList.add("transparent");

        // Generate the HTML for the avatar selection page (video itself lives
        // at the stage root now and is already playing behind this)
        introVideo.loop = true;
        // When returning to avatar select, stop any question video and play the default.
        switchVideo("videos/teddy/TeddyLowRes.mp4");
    } else {
        // For all other pages, stop the video and show the static avatar image.
        introVideo.style.display = 'none';
        introVideo.pause();
        stage.style.backgroundImage = `url('${currentAvatarImg}')`;
        stage.style.backgroundSize = 'cover';
        stage.style.backgroundPosition = 'center';
        content.classList.remove("transparent");
    }

    if (page === "Select Avatar") {
        content.innerHTML = `
<div id="avatarOverlay">

    <h2 style="
        color:white;
        text-shadow:calc(3px * var(--scale)) calc(3px * var(--scale)) calc(8px * var(--scale)) black;
        margin-bottom:calc(40px * var(--scale));
        font-size:calc(34px * var(--scale));
    ">
        ${translations.avatar.heading}
    </h2>

    <button class="avatarBtn"
            data-img="assets/teddy.png"
            data-avatar-id="teddy">
        ${translations.avatar.theodoreRoosevelt}
    </button>

    <button class="avatarBtn"
            data-img="assets/annie.png"
            data-avatar-id="annie">
        ${translations.avatar.annieOakley}
    </button>

    <button class="avatarBtn"
            data-img="assets/wyatt.png"
            data-avatar-id="wyatt">
        ${translations.avatar.wyattEarp}
    </button>

</div>
`;
        attachAvatarButtonListeners();
    
 } else if (page === "Prescott Trivia") {
        // Generate the HTML for the trivia page
        content.innerHTML = `
            <h2 data-lang-key="trivia.heading">${translations.trivia.heading}</h2>
            <p data-lang-key="trivia.intro">${translations.trivia.intro}</p>

            <form id="triviaForm">
                <div class="question">
                    <p><strong>1. ${translations.trivia.q1}</strong></p>
                    <label><input type="radio" name="q1" value="a"> ${translations.trivia.q1True}</label><br>
                    <label><input type="radio" name="q1" value="b"> ${translations.trivia.q1False}</label>
                </div>

                <div class="question">
                    <p><strong>2. ${translations.trivia.q2}</strong></p>
                    <label><input type="radio" name="q2" value="a"> ${translations.trivia.q2A}</label><br>
                    <label><input type="radio" name="q2" value="b"> ${translations.trivia.q2B}</label><br>
                    <label><input type="radio" name="q2" value="c"> ${translations.trivia.q2C}</label><br>
                    <label><input type="radio" name="q2" value="d"> ${translations.trivia.q2D}</label>
                </div>

                <div class="question">
                    <p><strong>3. ${translations.trivia.q3}</strong></p>
                    <label><input type="radio" name="q3" value="a"> ${translations.trivia.q3A}</label><br>
                    <label><input type="radio" name="q3" value="b"> ${translations.trivia.q3B}</label><br>
                    <label><input type="radio" name="q3" value="c"> ${translations.trivia.q3C}</label><br>
                    <label><input type="radio" name="q3" value="d"> ${translations.trivia.q3D}</label>
                </div>

                <div class="question">
                    <p><strong>4. ${translations.trivia.q4}</strong></p>
                    <label><input type="radio" name="q4" value="a"> ${translations.trivia.q4A}</label><br>
                    <label><input type="radio" name="q4" value="b"> ${translations.trivia.q4B}</label><br>
                    <label><input type="radio" name="q4" value="c"> ${translations.trivia.q4C}</label><br>
                    <label><input type="radio" name="q4" value="d"> ${translations.trivia.q4D}</label>
                </div>

                <div class="question">
                    <p><strong>5. ${translations.trivia.q5}</strong></p>
                    <label><input type="radio" name="q5" value="a"> ${translations.trivia.q5A}</label><br>
                    <label><input type="radio" name="q5" value="b"> ${translations.trivia.q5B}</label><br>
                    <label><input type="radio" name="q5" value="c"> ${translations.trivia.q5C}</label><br>
                    <label><input type="radio" name="q5" value="d"> ${translations.trivia.q5D}</label>
                </div>
                <br>
                <button type="button" id="gradeQuiz" data-lang-key="trivia.submit">
                    ${translations.trivia.submit}
                </button>
            </form>

            <img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="max-width:min(50%, calc(200px * var(--scale))); margin: calc(30px * var(--scale)) auto 0; display:block;">
            <h3 id="triviaScore"></h3>
        `;

        // Add a click listener to the "Submit Quiz" button
        document.getElementById("gradeQuiz").addEventListener("click", function () {
        const answers = {
            q1: "a",
            q2: "a",
            q3: "b",
            q4: "b",
            q5: "b"
        };
        let score = 0;

        // Loop through the correct answers and check the user's selections
        for (const question in answers) {
            const selected = document.querySelector(
                `input[name="${question}"]:checked`
            );

            if(selected && selected.value === answers[question]){
                score++;
            }
        }

        // Display the final score
        document.getElementById("triviaScore").innerHTML = translations.trivia.scoreResult.replace("{score}", `<strong>${score}</strong>`);
        });

    } else if (page === "Cowboy Roundup Game") {
        // Generate the HTML for the game page
        content.innerHTML = `
            <img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="max-width:min(30%, calc(120px * var(--scale))); margin: 0 auto calc(12px * var(--scale)); display:block;">
            <div id="gameArea">
                <h2 data-lang-key="game.heading">${translations.game.heading}</h2>
                <div id="gameStats">
                    <span data-lang-key="game.time">${translations.game.time}</span> <span id="time">30</span> <span data-lang-key="game.seconds">${translations.game.seconds}</span> |
                    <span data-lang-key="game.horsesCollected">${translations.game.horsesCollected}</span>
                    <span id="gameScore">0</span>
                </div>
                <img src="assets/horse.png" id="horse">
                <div id="gameOver"></div>
            </div>
        `;
        // Call the function to start the game logic
        startRoundupGame();

    } else if (page === "Settings") {
        const savedDisplaySize = localStorage.getItem("displaySize") || "website";
        const savedLanguage = localStorage.getItem("language") || "en";
        // Generate the HTML for the settings page
        content.innerHTML = `
            <img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="max-width:min(50%, calc(200px * var(--scale))); margin: 0 auto calc(20px * var(--scale)); display:block;">
            <h2 data-lang-key="settings.heading">${translations.settings.heading}</h2>

            <div class="question">
                <h3 data-lang-key="settings.languageHeading">${translations.settings.languageHeading}</h3>
                <p data-lang-key="settings.languageIntro">${translations.settings.languageIntro}</p>
                <label>
                    <input type="radio" name="language" value="en" ${savedLanguage === 'en' ? 'checked' : ''}>
                    <span data-lang-key="settings.english">${translations.settings.english}</span>
                </label>
                <br><br>
                <label>
                    <input type="radio" name="language" value="es" ${savedLanguage === 'es' ? 'checked' : ''}>
                    <span data-lang-key="settings.spanish">${translations.settings.spanish}</span>
                </label>
            </div>

            <button id="saveSettings" style="padding:calc(12px * var(--scale)) calc(30px * var(--scale)); font-size:calc(18px * var(--scale)); background:#8b5a2b; color:white; border:none; border-radius:calc(8px * var(--scale)); cursor:pointer;" data-lang-key="settings.save">
                ${translations.settings.save}
            </button>

            <h3 id="settingsSaved" style="margin-top:calc(20px * var(--scale));color:#5a3b1d;"></h3>
        `;

        // Add event listener for language change
        document.querySelectorAll('input[name="language"]').forEach(radio => {
            radio.addEventListener('change', function() {
                loadLanguage(this.value);
            });
        });

        // Add a click listener to the "Save Settings" button
        document.getElementById("saveSettings").addEventListener("click", function () {
        const display =
            document.querySelector('input[name="displaySize"]:checked').value;
            const language = document.querySelector('input[name="language"]:checked').value;

            // Persist settings to localStorage
            // (Note: whatever the user picks here, the background video is
            // never tied to this setting - it keeps playing regardless.)
            localStorage.setItem("displaySize", display);

            // Display a confirmation message with the selected settings
            document.getElementById("settingsSaved").innerHTML =
                `${translations.settings.saved}<br><br>
                 <strong>${translations.settings.displayLabel}</strong> ${display === "proto" ? translations.settings.protoLuma : translations.settings.website}<br>
                 <strong>${translations.settings.languageLabel}</strong> ${language === "en" ? translations.settings.english : translations.settings.spanish}`;
        });
 } else if (page === "Ask a Question") {
        content.classList.add("transparent"); // Make content transparent for this page

        // Fetch questions from the text file and render them.
        fetch('questions.txt')
            .then(response => response.text())
            .then(text => {
                // Ask the already-running service worker to re-check
                // questions.txt for new/removed videos. This runs on every
                // visit to this page, not just when the service worker file
                // itself changes, so cache updates don't require a full app
                // update to take effect.
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage('SYNC_VIDEOS');
                }

                const lang = localStorage.getItem("language") || "en";
                const langIndex = lang === 'es' ? 1 : 0;

                const questionButtons = text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line !== '' && !line.startsWith('#'))
                    // Filter for questions matching the current avatar
                    .filter(line => line.split('|')[0].trim() === currentAvatarId)
                    .map(line => {
                    const parts = line.split('|');
                    const questionText = parts[langIndex + 1]; // +1 to account for avatar ID
                    const videoFile = parts[3];
                    return `
                        <div class="question">
                            <button class="avatarBtn" style="width:100%;" data-video="${videoFile}">
                                ${questionText}
                            </button>
                        </div>
                    `;
                }).join('');

                content.innerHTML = `
                    <div id="askQuestionContainer">
                        <button id="showQuestionsBtn">?</button>
                        <div id="askQuestionList">
                            <h2 data-lang-key="menu.askQuestion">${translations.menu.askQuestion}</h2>
                            ${questionButtons}
                        </div>
                    </div>
                `;

                const questionList = document.getElementById("askQuestionList");
                const showQuestionsBtn = document.getElementById("showQuestionsBtn");

                document.querySelectorAll("#askQuestionList .avatarBtn").forEach(btn => {
                    btn.addEventListener("click", function () {
                        const videoPath = this.dataset.video;
                        introVideo.loop = false; // Play video once
                        switchVideo(videoPath);
                        askQuestionCollapsed = true; // Update state
                        questionList.classList.add("collapsed");
                        showQuestionsBtn.classList.add("visible");
                    });
                });

                introVideo.addEventListener('ended', function() {
                    if (!introVideo.loop) { // Only if we are not looping (i.e., after a question video)
                        showStaticAvatar();
                        // Re-add the show questions button over the static image
                        const showBtn = document.createElement('button');
                        showBtn.id = 'showQuestionsBtn';
                        showBtn.className = 'visible';
                        showBtn.textContent = '?';
                        content.appendChild(showBtn);
                    }
                });

                // When showing the list again, go back to default looping video
                showQuestionsBtn.addEventListener("click", function() {
                    askQuestionCollapsed = false; // Update state
                    // Re-render the page to show the question list again over a static image
                    renderPage("Ask a Question");
                });
            });

    } else {
 }
} /*end renderPage */
// --- LANGUAGE AND TRANSLATION ---

async function loadLanguage(language) {
    try {
        const response = await fetch(`${language}.json`);
        translations = await response.json();
        localStorage.setItem("language", language);
        applyTranslations();
    } catch (error) {
        console.error("Error loading language file:", error);
    }
}

function applyTranslations() {
    document.documentElement.lang = localStorage.getItem("language") || "en";
    
    // Update all elements with a data-lang-key attribute
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        const keys = key.split('.');
        let text = translations;
        for (const k of keys) {
            text = text[k];
        }
        if (text) {
            element.textContent = text;
        }
    });

    // Re-render the current page with the new translations
    renderPage(currentPage);
}

// --- COWBOY ROUNDUP GAME LOGIC ---
function startRoundupGame(){

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
function moveHorse(){

    const x = Math.random() * (gameArea.clientWidth-120);
    const y = 70 + Math.random() * (gameArea.clientHeight-180);

    horse.style.left = x + "px";
    horse.style.top = y + "px";

}

// Move the horse to its first position
moveHorse();

horse.onclick=function(){

    score++;

    scoreLabel.innerHTML=score;

    // Move the horse immediately after it's clicked
    moveHorse();

};

// A timer to automatically move the horse every 2 seconds if it's not clicked
const moveTimer = setInterval(moveHorse, 2000);

// The main game countdown timer, runs every second
const countdown=setInterval(function(){

    timeLeft--;

    timerLabel.innerHTML=timeLeft;

    if(timeLeft<=0){

        // Stop the timers when time runs out
        clearInterval(moveTimer);
        clearInterval(countdown);

        // Hide the horse and show the game over message
        horse.style.display="none";

        gameOver.innerHTML=`
        <h2 data-lang-key="game.timeUp">${translations.game.timeUp}</h2>
        <h3 data-lang-key="game.roundedUp">${translations.game.roundedUp.replace('{score}', score)}</h3>

        <button id="playAgain">
            ${translations.game.playAgain}
        </button>
        `;

        // Add a listener to the "Play Again" button
        document.getElementById("playAgain").addEventListener("click", function(){

    // Remove the game over message and button
    gameOver.innerHTML = "";

    // Restart the game
    startRoundupGame();

});

}

},1000);

}

// --- INITIALIZATION ---

// Add a click listener to every link in the navigation menu
document.querySelectorAll("#menu a").forEach(item => {
    item.addEventListener("click", function(e){
        e.preventDefault();
        const page = this.dataset.page;
        renderPage(page);
        menu.classList.remove("open");
        document.body.classList.remove("menu-open");
    });
});

// Load the saved language (or default to English) and render the initial page
async function initializeApp() {
    const savedLanguage = localStorage.getItem("language") || "en";
    await loadLanguage(savedLanguage);
}

initializeApp();

// --- SERVICE WORKER REGISTRATION ---
// Register the service worker to enable video caching for offline use and
// improved performance. This makes the app more resilient and faster after

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => console.log('Service Worker registered:', registration))
            .catch(error => console.log('Service Worker registration failed:', error));
    });
}

// --- STAGE SCALING (device preview) ---
// Shrinks/grows the fixed --device-width x --device-height stage to fit
// whatever browser window it's actually running in, preserving the true
// aspect ratio - so you always see the exact composition, just scaled,
// rather than a cropped slice of it. On the real device (where the browser
// window IS the device's screen) this resolves to a scale of ~1.
const stageEl = document.getElementById("stage");

function fitStage(){
    const rootStyles = getComputedStyle(document.documentElement);
    const deviceWidth = parseFloat(rootStyles.getPropertyValue("--device-width"));
    const deviceHeight = parseFloat(rootStyles.getPropertyValue("--device-height"));

    const scale = Math.min(
        window.innerWidth / deviceWidth,
        window.innerHeight / deviceHeight
    );

    stageEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener("resize", fitStage);
fitStage();