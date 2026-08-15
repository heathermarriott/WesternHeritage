/**
 * Page Renderer Module
 *
 * This module is responsible for generating and rendering the HTML content
 * for all the different pages in the application.
 */


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
 * Fetches avatars from avatars.txt and renders the "Select Avatar" page.
 * @param {Object} context - The application context.
 */
async function renderSelectAvatarPage(context) {
    const { content, translations } = context;
    try {
        const response = await fetch('avatars.txt');
        const text = await response.text();

        const avatarButtons = text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                const [id, img, name] = line.split('|');
                const displayName = name ? name.trim() : id.trim(); // Use the name from the file, or fallback to the ID
                return `
                    <button class="avatarBtn" data-img="${img.trim()}" data-avatar-id="${id.trim()}">
                        ${displayName}
                    </button>
                `;
            }).join('');

        content.innerHTML = `
            <div id="avatarOverlay">
                <h2 style="color:white; text-shadow:calc(3px * var(--scale)) calc(3px * var(--scale)) calc(8px * var(--scale)) black; margin-bottom:calc(40px * var(--scale)); font-size:calc(34px * var(--scale));" data-lang-key="avatar.heading">
                    ${translations.avatar.heading}
                </h2>
                ${avatarButtons}
            </div>`;
        attachAvatarButtonListeners(content, context);
    } catch (error) {
        console.error("Failed to load and render avatars:", error);
        content.innerHTML = `<p>Error loading characters. Please try again.</p>`;
    }
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

        const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
        const header = lines.find(line => line.startsWith('## Format:'));
        const questions = lines.filter(line => !line.startsWith('#'));

        let textLangMap = {};  // Map for question text

        if (header) {
            const columns = header.substring('## Format:'.length).split('|').map(s => s.trim());
            for (let i = 0; i < columns.length; i++) {
                if (columns[i].startsWith('text:')) {
                    const langCode = columns[i].substring('text:'.length);
                    textLangMap[langCode] = i;
                }
            }
        }

        // Fallback to English text if not explicitly defined in header
        // Based on new format: avatarId(0)|videoFile(1)|text:en(2)|...
        textLangMap['en'] = textLangMap['en'] || 2;

        const lang = localStorage.getItem("language") || "en";
        const textIndex = textLangMap[lang] || textLangMap['en'];

        const questionButtons = questions
            .filter(line => line.split('|')[0].trim() === context.currentAvatarId)
            .map(line => {
                const parts = line.split('|');
                const questionText = (parts[textIndex] && parts[textIndex].trim()) ? parts[textIndex].trim() : parts[textLangMap['en']].trim();
                const videoFile = parts[1].trim(); // Video is always in the second column

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

/**
 * Renders the "Prescott Timeline" page: an interactive, tap-to-expand
 * history trail. Milestone copy (heading/intro/trailEnd/milestones) comes
 * from translations.timeline, so it's translated the same way as every
 * other page - see the JSON snippet provided alongside this file.
 * @param {Object} context - The application context.
 */
function renderTimelinePage(context) {
    const { content, translations } = context;
    const timeline = translations.timeline;

    const milestoneMarkup = timeline.milestones.map((m, index) => `
        <div class="milestone">
            <div class="milestone-marker">${m.year}</div>
            <div class="milestone-card" data-index="${index}">
                <div class="milestone-title">
                    <h2>${m.title}</h2>
                    <span class="milestone-caret">&#9660;</span>
                </div>
                <div class="milestone-body">${m.body}</div>
            </div>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="timelineHeader">
            <h2 data-lang-key="timeline.heading">${timeline.heading}</h2>
            <p data-lang-key="timeline.intro">${timeline.intro}</p>
        </div>
        <div class="trail" id="trail">
            ${milestoneMarkup}
        </div>
        <div class="trailEnd" data-lang-key="timeline.trailEnd">${timeline.trailEnd}</div>
    `;

    const trail = document.getElementById("trail");

    // Tap a card (or its year marker) to expand/collapse the description
    trail.addEventListener("click", (e) => {
        const card = e.target.closest(".milestone-card");
        const marker = e.target.closest(".milestone-marker");
        const targetCard = card || (marker ? marker.nextElementSibling : null);
        if (targetCard) {
            targetCard.classList.toggle("open");
        }
    });

    // Fade/slide each milestone in as it scrolls into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    }, { threshold: 0.15 });

    trail.querySelectorAll(".milestone").forEach(el => observer.observe(el));
}

/**
 * Renders the "First Professional Rodeo" page: an interactive, tap-to-expand
 * Q&A about Prescott, Arizona being home to the first professional rodeo,
 * staged during the July 4th, 1888 celebration. Copy comes from
 * translations.firstRodeo (heading/intro/trailEnd/questions), mirroring how
 * the Prescott Timeline page pulls from translations.timeline - see the JSON
 * snippet provided alongside this file. Reuses the .milestone/.trail CSS
 * classes so the card styling matches the Timeline page.
 * @param {Object} context - The application context.
 */
function renderFirstRodeoPage(context) {
    const { content, translations } = context;
    const firstRodeo = translations.firstRodeo;

    const questionMarkup = firstRodeo.questions.map((qa, index) => `
        <div class="milestone">
            <div class="milestone-marker">${qa.marker}</div>
            <div class="milestone-card" data-index="${index}">
                <div class="milestone-title">
                    <h2>${qa.question}</h2>
                    <span class="milestone-caret">&#9660;</span>
                </div>
                <div class="milestone-body">${qa.answer}</div>
            </div>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="timelineHeader">
            <h2 data-lang-key="firstRodeo.heading">${firstRodeo.heading}</h2>
            <p data-lang-key="firstRodeo.intro">${firstRodeo.intro}</p>
        </div>
        <div class="trail" id="rodeoTrail">
            ${questionMarkup}
        </div>
        <div class="trailEnd" data-lang-key="firstRodeo.trailEnd">${firstRodeo.trailEnd}</div>
    `;

    const trail = document.getElementById("rodeoTrail");

    // Tap a question (or its marker) to expand/collapse the answer
    trail.addEventListener("click", (e) => {
        const card = e.target.closest(".milestone-card");
        const marker = e.target.closest(".milestone-marker");
        const targetCard = card || (marker ? marker.nextElementSibling : null);
        if (targetCard) {
            targetCard.classList.toggle("open");
        }
    });

    // Fade/slide each question in as it scrolls into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    }, { threshold: 0.15 });

    trail.querySelectorAll(".milestone").forEach(el => observer.observe(el));
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
            context.switchVideo("videos/teddy/TeddyLowRes.webm");
        } else if (page === "Ask a Question") {
            // If a question video is playing (not looping), we're returning to the
            // list, so just show the static avatar. Otherwise, set up the
            // looping background video for the page.
            if (introVideo.loop) {
            // current avatar and use it as the looping background.
            (async () => {
                try {
                    const response = await fetch('questions.txt');
                    const text = await response.text();
                    const firstVideoForAvatar = text.split('\n')
                        .find(line => line.trim().startsWith(currentAvatarId + '|'))
                        ?.split('|')[1]?.trim();

                    introVideo.loop = true;
                    context.switchVideo(firstVideoForAvatar || "videos/teddy/TeddyLowRes.webm"); // Fallback if no video found
                } catch (error) {
                    console.error("Could not set background video for avatar:", error);
                    context.switchVideo("videos/teddy/TeddyLowRes.webm"); // Fallback on error
                }
            })();
            } else {
                // A question video was just playing. Show the static avatar.
                introVideo.style.display = 'none';
                introVideo.pause();
                stage.style.backgroundImage = `url('${currentAvatarImg}')`;
                stage.style.backgroundSize = 'cover';
                stage.style.backgroundPosition = 'center';
            }
        }
    } else {
        // Pages with a static avatar background
        // (Prescott Timeline falls into this branch automatically, same as
        // Trivia/Game/Settings - no changes needed here.)
        introVideo.style.display = 'none';
        introVideo.pause();
        stage.style.backgroundImage = `url('${currentAvatarImg}')`;
        stage.style.backgroundSize = 'cover';
        stage.style.backgroundPosition = 'center';
        content.classList.remove("transparent");
    }

    // --- Page-Specific Content ---

    if (page === "Select Avatar") {
        renderSelectAvatarPage(context);

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

    } else if (page === "Prescott Timeline") {
        renderTimelinePage(context);
    } else if (page === "First Professional Rodeo") {
        renderFirstRodeoPage(context);

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
                    <span>English</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="de" ${savedLanguage === 'de' ? 'checked' : ''}>
                    <span>Deutsch</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="es" ${savedLanguage === 'es' ? 'checked' : ''}>
                    <span>Español</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="fr" ${savedLanguage === 'fr' ? 'checked' : ''}>
                    <span>Français</span>
                </label>
                <br><br>

                <label>
                    <input type="radio" name="language" value="it" ${savedLanguage === 'it' ? 'checked' : ''}>
                    <span>Italiano</span>
                </label>
            </div>`;

        document.querySelectorAll('input[name="language"]').forEach(radio => {
            radio.addEventListener('change', function() {
                context.loadLanguage(this.value);
            });
        });
    }
}