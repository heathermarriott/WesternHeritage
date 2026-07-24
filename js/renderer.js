/**
 * Page Renderer Module
 *
 * This module is responsible for generating and rendering the HTML content
 * for all the different pages in the application.
 */

import { startRoundupGame } from './game.js';

// --- PRIVATE HELPER FUNCTIONS ---

/**
 * A reusable function to attach click listeners to the avatar selection buttons.
 * It finds the buttons in the provided container and sets up their click events.
 * @param {HTMLElement} container - The parent element containing the avatar buttons.
 * @param {Object} context - The application context containing state and callbacks.
 */
function attachAvatarButtonListeners(container, context) {
    container.querySelectorAll(".avatarBtn").forEach(btn => {
        btn.addEventListener("click", function() {
            // Update the current avatar image and ID via the callback
            context.updateAvatar(this.dataset.img, this.dataset.avatarId);

            // Avatar has been picked - switch back to the card layout
            context.content.classList.remove("transparent");

            // Replace the buttons with a confirmation message
            context.content.innerHTML = `
                <img src="${this.dataset.img}" id="centerImage" alt="Avatar" style="max-width:min(60%, calc(220px * var(--scale))); margin: 0 auto calc(20px * var(--scale)); display:block;">
                <h2 data-lang-key="avatar.selectedHeading">${context.translations.avatar.selectedHeading}</h2>
                <p data-lang-key="avatar.selectedMessage">${context.translations.avatar.selectedMessage}</p>
            `;
        });
    });
}

/**
 * Fetches questions from questions.txt and renders the "Ask a Question" page.
 * @param {Object} context - The application context.
 */
async function renderAskAQuestionPage(context) {
    try {
        const response = await fetch('questions.txt');
        const text = await response.text();

        // Ask the service worker to sync the video cache.
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('SYNC_VIDEOS');
        }

        const lang = localStorage.getItem("language") || "en";
        const langIndex = lang === 'es' ? 1 : 0;

        const questionButtons = text.split('\n')
            .map(line => line.trim())
            .filter(line => line !== '' && !line.startsWith('#'))
            .filter(line => line.split('|')[0].trim() === context.currentAvatarId)
            .map(line => {
                const parts = line.split('|');
                const questionText = parts[langIndex + 1];
                const videoFile = parts[3];
                return `
                    <div class="question">
                        <button class="avatarBtn" style="width:100%;" data-video="${videoFile}">
                            ${questionText}
                        </button>
                    </div>
                `;
            }).join('');

        context.content.innerHTML = `
            <div id="askQuestionContainer">
                <button id="showQuestionsBtn">?</button>
                <div id="askQuestionList">
                    <h2 data-lang-key="menu.askQuestion">${context.translations.menu.askQuestion}</h2>
                    ${questionButtons}
                </div>
            </div>
        `;

        const questionList = document.getElementById("askQuestionList");
        const showQuestionsBtn = document.getElementById("showQuestionsBtn");

        document.querySelectorAll("#askQuestionList .avatarBtn").forEach(btn => {
            btn.addEventListener("click", function() {
                const videoPath = this.dataset.video;
                context.introVideo.loop = false;
                context.switchVideo(videoPath);
                questionList.classList.add("collapsed");
                showQuestionsBtn.classList.add("visible");
            });
        });

        showQuestionsBtn.addEventListener("click", function() {
            // Re-render the page to show the question list again
            renderPage("Ask a Question", context);
        });

    } catch (error) {
        console.error("Failed to load and render questions:", error);
        context.content.innerHTML = `<p>Error loading questions. Please try again.</p>`;
    }
}


// --- PUBLIC RENDER FUNCTION ---

/**
 * Renders the content for a given page.
 * @param {string} page - The name of the page to render.
 * @param {Object} context - An object containing all necessary state and helpers.
 */
export function renderPage(page, context) {
    const { content, introVideo, stage, translations, currentAvatarImg, currentAvatarId } = context;

    // --- Global Page Setup ---
    // This logic runs for all pages to set the background correctly.
    if (page === "Select Avatar" || page === "Ask a Question") {
        // Pages with a full-bleed video background
        introVideo.style.display = 'block';
        stage.style.backgroundImage = '';
        content.classList.add("transparent");
        if (page === "Select Avatar") {
            introVideo.loop = true;
            context.switchVideo("videos/teddy/TeddyLowRes.mp4");
        }
    } else {
        // Pages with a static avatar background
        introVideo.style.display = 'none';
        introVideo.pause();
        stage.style.backgroundImage = `url('${currentAvatarImg}')`;
        stage.style.backgroundSize = 'cover';
        stage.style.backgroundPosition = 'center';
        content.classList.remove("transparent");
    }

    // --- Page-Specific Content ---

    if (page === "Select Avatar") {
        content.innerHTML = `
            <div id="avatarOverlay">
                <h2 style="color:white; text-shadow:calc(3px * var(--scale)) calc(3px * var(--scale)) calc(8px * var(--scale)) black; margin-bottom:calc(40px * var(--scale)); font-size:calc(34px * var(--scale));">
                    ${translations.avatar.heading}
                </h2>
                <button class="avatarBtn" data-img="assets/teddy.png" data-avatar-id="teddy">
                    ${translations.avatar.theodoreRoosevelt}
                </button>
                <button class="avatarBtn" data-img="assets/annie.png" data-avatar-id="annie">
                    ${translations.avatar.annieOakley}
                </button>
                <button class="avatarBtn" data-img="assets/wyatt.png" data-avatar-id="wyatt">
                    ${translations.avatar.wyattEarp}
                </button>
            </div>`;
        attachAvatarButtonListeners(content, context);

    } else if (page === "Ask a Question") {
        renderAskAQuestionPage(context);

    } else if (page === "Prescott Trivia") {
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
                <button type="button" id="gradeQuiz" data-lang-key="trivia.submit">${translations.trivia.submit}</button>
            </form>
            <img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="max-width:min(50%, calc(200px * var(--scale))); margin: calc(30px * var(--scale)) auto 0; display:block;">
            <h3 id="triviaScore"></h3>`;

        document.getElementById("gradeQuiz").addEventListener("click", function() {
            const answers = { q1: "a", q2: "a", q3: "b", q4: "b", q5: "b" };
            let score = 0;
            for (const q in answers) {
                const selected = document.querySelector(`input[name="${q}"]:checked`);
                if (selected && selected.value === answers[q]) {
                    score++;
                }
            }
            document.getElementById("triviaScore").innerHTML = translations.trivia.scoreResult.replace("{score}", `<strong>${score}</strong>`);
        });

    } else if (page === "Cowboy Roundup Game") {
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
            </div>`;
        startRoundupGame();

    } else if (page === "Settings") {
        const savedLanguage = localStorage.getItem("language") || "en";
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
                    <input type="radio" name="language" value="de" ${savedLanguage === 'de' ? 'checked' : ''}>
                    <span data-lang-key="settings.german">${translations.settings.german}</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="es" ${savedLanguage === 'es' ? 'checked' : ''}>
                    <span data-lang-key="settings.spanish">${translations.settings.spanish}</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="fr" ${savedLanguage === 'fr' ? 'checked' : ''}>
                    <span data-lang-key="settings.french">${translations.settings.french}</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="it" ${savedLanguage === 'it' ? 'checked' : ''}>
                    <span data-lang-key="settings.italian">${translations.settings.italian}</span>
                </label>
            </div>
            <button id="saveSettings" style="padding:calc(12px * var(--scale)) calc(30px * var(--scale)); font-size:calc(18px * var(--scale)); background:#8b5a2b; color:white; border:none; border-radius:calc(8px * var(--scale)); cursor:pointer;" data-lang-key="settings.save">
                ${translations.settings.save}
            </button>
            <h3 id="settingsSaved" style="margin-top:calc(20px * var(--scale));color:#5a3b1d;"></h3>`;

        document.querySelectorAll('input[name="language"]').forEach(radio => {
            radio.addEventListener('change', function() {
                context.loadLanguage(this.value);
            });
        });

        document.getElementById("saveSettings").addEventListener("click", function() {
            const language = document.querySelector('input[name="language"]:checked').value;
            const languageNames = {
                en: translations.settings.english,
                de: translations.settings.german,
                es: translations.settings.spanish,
                fr: translations.settings.french,
                it: translations.settings.italian
            };

            document.getElementById("settingsSaved").innerHTML =
                `${translations.settings.saved}<br><br>
                <strong>${translations.settings.languageLabel}</strong> ${languageNames[language]}`;
          
        });
    }
}