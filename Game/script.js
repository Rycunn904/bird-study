const birds = [
    "American Robin",
    "Bald Eagle",
    "Barn Owl",
    "Barred Owl",
    "Black Capped Chickadee",
    "Black Vulture",
    "Blue Jay",
    "Bluebird",
    "Bobwhite Quail",
    "Carolina Wren",
    "Catbird",
    "Crow",
    "Downy Woodpecker",
    "Female Northern Cardinal",
    "Female Wild Turkey",
    "Goldfinch",
    "Great Horned Owl",
    "Male Northern Cardinal",
    "Male Wild Turkey",
    "Mockingbird",
    "Mourning Dove",
    "Northern Bob White",
    "Pileated Woodpecker",
    "Purple Martin",
    "Red Bellied Woodpecker",
    "Red Headed Woodpecker",
    "Ruffed Grouse",
    "Turkey Vulture"
];

let currentIndex = 0;
let currentMode = 'sound';
let appMode = 'study';

const modeInputs = document.querySelectorAll('input[name="mode"]');
const appModeInputs = document.querySelectorAll('input[name="app-mode"]');
const studyModeSelection = document.getElementById('study-mode-selection');
const birdNameEl = document.getElementById('bird-name');
const birdImageEl = document.getElementById('bird-image');
const birdAudioEl = document.getElementById('bird-audio');
const imageMessageEl = document.getElementById('image-message');
const audioMessageEl = document.getElementById('audio-message');
const controlsEl = document.getElementById('controls');
const quizStartSection = document.getElementById('quiz-start');

birdImageEl.addEventListener('error', () => {
    birdImageEl.style.display = 'none';
    imageMessageEl.textContent = 'No image available for this bird.';
});

birdAudioEl.addEventListener('error', () => {
    birdAudioEl.style.display = 'none';
    audioMessageEl.textContent = 'No audio available for this bird.';
});
const quizSection = document.getElementById('quiz-section');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const submitGuessBtn = document.getElementById('submit-guess');
const startQuizBtn = document.getElementById('start-quiz');
const birdGuessInput = document.getElementById('bird-guess');
const feedbackEl = document.getElementById('feedback');
const uploadForm = document.getElementById('upload-form');
let quizStarted = false;

// Load birds from localStorage if any
const storedBirds = localStorage.getItem('customBirds');
if (storedBirds) {
    const customBirds = JSON.parse(storedBirds);
    birds.push(...customBirds.map(b => b.name));
}

function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function normalize(str) {
    return str.toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
}

const availabilityCache = {
    image: {},
    sound: {}
};

function getAssetPaths(bird) {
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    const customBird = customBirds.find(b => b.name === bird);
    if (customBird) {
        return { image: customBird.image, sound: customBird.sound };
    }
    return {
        image: `Birds/${bird}/Image.png`,
        sound: `Birds/${bird}/Sound.mp3`
    };
}

function checkImageAvailable(bird) {
    if (availabilityCache.image[bird] !== undefined) {
        return Promise.resolve(availabilityCache.image[bird]);
    }
    const { image } = getAssetPaths(bird);
    if (image.startsWith('data:')) {
        availabilityCache.image[bird] = true;
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            availabilityCache.image[bird] = true;
            resolve(true);
        };
        img.onerror = () => {
            availabilityCache.image[bird] = false;
            resolve(false);
        };
        img.src = image;
    });
}

function checkSoundAvailable(bird) {
    if (availabilityCache.sound[bird] !== undefined) {
        return Promise.resolve(availabilityCache.sound[bird]);
    }
    const { sound } = getAssetPaths(bird);
    if (sound.startsWith('data:')) {
        availabilityCache.sound[bird] = true;
        return Promise.resolve(true);
    }
    return new Promise(resolve => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            availabilityCache.sound[bird] = true;
            resolve(true);
        };
        audio.onerror = () => {
            availabilityCache.sound[bird] = false;
            resolve(false);
        };
        audio.src = sound;
    });
}

async function isBirdValidForMode(bird) {
    if (currentMode === 'sound') {
        return checkSoundAvailable(bird);
    }
    if (currentMode === 'image') {
        return checkImageAvailable(bird);
    }
    const [imageOk, soundOk] = await Promise.all([
        checkImageAvailable(bird),
        checkSoundAvailable(bird)
    ]);
    return imageOk && soundOk;
}

function isCorrectGuess(guess, correct) {
    const normGuess = normalize(guess);
    const normCorrect = normalize(correct);
    if (normGuess === normCorrect) return true;
    const distance = levenshtein(normGuess, normCorrect);
    return distance <= 2;
}

function updateDisplay() {
    const bird = birds[currentIndex];
    birdNameEl.textContent = bird;
    
    // Reset messages and visibility before loading new assets
    imageMessageEl.textContent = '';
    audioMessageEl.textContent = '';
    birdImageEl.style.display = 'none';
    birdAudioEl.style.display = 'none';
    birdImageEl.src = '';
    birdAudioEl.src = '';
    
    // Check if it's a custom bird
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    const customBird = customBirds.find(b => b.name === bird);
    
    if (customBird) {
        birdImageEl.src = customBird.image;
        birdAudioEl.src = customBird.sound;
    } else {
        birdImageEl.src = `Birds/${bird}/Image.png`;
        birdAudioEl.src = `Birds/${bird}/Sound.mp3`;
    }
    
    if (appMode === 'study') {
        birdNameEl.style.display = 'block';
        controlsEl.style.display = 'block';
        quizStartSection.style.display = 'none';
        quizSection.style.display = 'none';
        if (currentMode === 'sound') {
            birdImageEl.style.display = 'none';
            birdAudioEl.style.display = 'block';
        } else if (currentMode === 'image') {
            birdImageEl.style.display = 'block';
            birdAudioEl.style.display = 'none';
        } else {
            birdImageEl.style.display = 'block';
            birdAudioEl.style.display = 'block';
        }
    } else {
        birdNameEl.style.display = 'none';
        if (!quizStarted) {
            controlsEl.style.display = 'none';
            quizStartSection.style.display = 'block';
            quizSection.style.display = 'none';
            birdImageEl.style.display = 'none';
            birdAudioEl.style.display = 'none';
        } else {
            controlsEl.style.display = 'block';
            quizStartSection.style.display = 'none';
            quizSection.style.display = 'block';
            feedbackEl.textContent = '';
            birdGuessInput.value = '';
            if (currentMode === 'sound') {
                birdImageEl.style.display = 'none';
                birdAudioEl.style.display = 'block';
            } else if (currentMode === 'image') {
                birdImageEl.style.display = 'block';
                birdAudioEl.style.display = 'none';
            } else {
                birdImageEl.style.display = 'block';
                birdAudioEl.style.display = 'block';
            }
        }
    }
}

function changeMode(mode) {
    currentMode = mode;
    updateDisplay();
}

function changeAppMode(mode) {
    appMode = mode;
    quizStarted = false;
    studyModeSelection.style.display = 'block';
    updateDisplay();
}

async function chooseValidQuizBird() {
    const validBirds = [];
    for (const bird of birds) {
        if (await isBirdValidForMode(bird)) {
            validBirds.push(bird);
        }
    }
    if (validBirds.length === 0) {
        feedbackEl.textContent = 'No birds are available for the selected quiz mode.';
        feedbackEl.style.color = 'red';
        return false;
    }
    const newBird = validBirds[Math.floor(Math.random() * validBirds.length)];
    currentIndex = birds.indexOf(newBird);
    feedbackEl.textContent = '';
    updateDisplay();
    return true;
}

async function startQuiz() {
    quizStarted = true;
    const ok = await chooseValidQuizBird();
    if (!ok) {
        quizStarted = false;
    }
}

async function nextRandomBird() {
    const currentBird = birds[currentIndex];
    const validBirds = [];
    for (const bird of birds) {
        if (bird === currentBird) continue;
        if (await isBirdValidForMode(bird)) {
            validBirds.push(bird);
        }
    }
    if (validBirds.length === 0) {
        return;
    }
    const newBird = validBirds[Math.floor(Math.random() * validBirds.length)];
    currentIndex = birds.indexOf(newBird);
    feedbackEl.textContent = '';
    updateDisplay();
}

function nextBird() {
    currentIndex = (currentIndex + 1) % birds.length;
    updateDisplay();
}

function prevBird() {
    currentIndex = (currentIndex - 1 + birds.length) % birds.length;
    updateDisplay();
}

function submitGuess() {
    const guess = birdGuessInput.value.trim();
    const correct = birds[currentIndex];
    if (isCorrectGuess(guess, correct)) {
        feedbackEl.textContent = 'Correct!';
        feedbackEl.style.color = 'green';
        setTimeout(() => {
            nextRandomBird();
        }, 1000);
    } else {
        feedbackEl.textContent = `Incorrect. The correct answer is: ${correct}`;
        feedbackEl.style.color = 'red';
    }
}

modeInputs.forEach(input => {
    input.addEventListener('change', (e) => changeMode(e.target.value));
});

appModeInputs.forEach(input => {
    input.addEventListener('change', (e) => changeAppMode(e.target.value));
});

prevBtn.addEventListener('click', prevBird);
nextBtn.addEventListener('click', nextBird);
submitGuessBtn.addEventListener('click', submitGuess);
startQuizBtn.addEventListener('click', startQuiz);

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('bird-name-input').value;
    const imageFile = document.getElementById('bird-image-input').files[0];
    const soundFile = document.getElementById('bird-sound-input').files[0];
    
    if (!name || !imageFile || !soundFile) return;
    
    // Convert files to data URLs
    const imageData = await fileToDataURL(imageFile);
    const soundData = await fileToDataURL(soundFile);
    
    const customBird = { name, image: imageData, sound: soundData };
    
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    customBirds.push(customBird);
    localStorage.setItem('customBirds', JSON.stringify(customBirds));
    
    birds.push(name);
    currentIndex = birds.length - 1;
    updateDisplay();
    
    // Reset form
    uploadForm.reset();
});

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Initialize
updateDisplay();