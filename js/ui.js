/**
 * UI Module
 *
 * This module handles general UI controls like the navigation menu,
 * background video management, and stage scaling.
 */

let menu, hatButton, closeBtn, stage, introVideo, content;

/**
 * Switches the background video source and plays it.
 * @param {string} filename - The path to the new video file.
 */
export function switchVideo(filename) {
    const source = introVideo.querySelector("source");
    source.src = filename;
    introVideo.load();
    introVideo.style.display = 'block';
    introVideo.play().catch(() => {});
}

/**
 * Hides the video and displays the current avatar as a static background.
 * @param {string} currentAvatarImg - The path to the avatar image.
 */
export function showStaticAvatar(currentAvatarImg) {
    introVideo.style.display = 'none';
    introVideo.pause();
    content.innerHTML = `<img src="${currentAvatarImg}" id="centerImage" alt="Avatar" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">`;
}

/**
 * Sets up event listeners for the navigation menu.
 */
function initializeMenuControls() {
    hatButton.addEventListener("click", () => {
        menu.classList.add("open");
        document.body.classList.add("menu-open");
    });

    closeBtn.addEventListener("click", () => {
        menu.classList.remove("open");
        document.body.classList.remove("menu-open");
    });

    stage.addEventListener("click", (event) => {
        if (menu.classList.contains("open") && !menu.contains(event.target) && event.target !== hatButton && !hatButton.contains(event.target)) {
            menu.classList.remove("open");
            document.body.classList.remove("menu-open");
        }
    });
}

/**
 * Sets up the stage scaling logic to fit the viewport.
 */
function initializeStageScaling() {
    function fitStage() {
        const rootStyles = getComputedStyle(document.documentElement);
        const deviceWidth = parseFloat(rootStyles.getPropertyValue("--device-width"));
        const deviceHeight = parseFloat(rootStyles.getPropertyValue("--device-height"));

        const scale = Math.min(
            window.innerWidth / deviceWidth,
            window.innerHeight / deviceHeight
        );

        stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    window.addEventListener("resize", fitStage);
    fitStage();
}

/**
 * Initializes the UI module with necessary DOM elements and sets up controls.
 * @param {Object} elements - An object containing required DOM element references.
 */
export function initializeUI(elements) {
    menu = elements.menu;
    hatButton = elements.hatButton;
    closeBtn = elements.closeBtn;
    stage = elements.stage;
    introVideo = elements.introVideo;
    content = elements.content;

    initializeMenuControls();
    initializeStageScaling();
}