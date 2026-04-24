const birds = [];

// Bird file format: JSON with base64 encoded images and sounds
// { version: 1, birds: [{ name, image, sound }, ...] }
const BIRD_FILE_VERSION = 1;

// In-memory bird file data
let birdFileData = null;

function getBirdFileData() {
    return birdFileData;
}

function setBirdFileData(data) {
    birdFileData = data;
    // Add birds from file to the birds array
    if (data && data.birds) {
        data.birds.forEach(bird => {
            if (!birds.includes(bird.name)) {
                birds.push(bird.name);
            }
        });
    }
    updateDisplay();
    updateDeleteDropdown();
}

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
const addBirdBtn = document.getElementById('add-bird-btn');
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
    // Check custom birds in localStorage first
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    const customBird = customBirds.find(b => b.name === bird);
    if (customBird) {
        return { image: customBird.image, sound: customBird.sound };
    }
    
    // Check bird file data
    if (birdFileData && birdFileData.birds) {
        const fileBird = birdFileData.birds.find(b => b.name === bird);
        if (fileBird) {
            return { image: fileBird.image, sound: fileBird.sound };
        }
    }
    
    // No fallback - birds must come from bird file or custom upload
    return { image: '', sound: '' };
}

function checkImageAvailable(bird) {
    if (availabilityCache.image[bird] !== undefined) {
        return Promise.resolve(availabilityCache.image[bird]);
    }
    const { image } = getAssetPaths(bird);
    // No image path means bird data not available
    if (!image) {
        availabilityCache.image[bird] = false;
        return Promise.resolve(false);
    }
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
    // No sound path means bird data not available
    if (!sound) {
        availabilityCache.sound[bird] = false;
        return Promise.resolve(false);
    }
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
    // Show message if no birds available
    if (birds.length === 0) {
        birdNameEl.textContent = 'No birds loaded';
        birdImageEl.style.display = 'none';
        birdAudioEl.style.display = 'none';
        imageMessageEl.textContent = 'Upload a bird file or add birds to get started';
        audioMessageEl.textContent = '';
        controlsEl.style.display = 'none';
        return;
    }
    
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
    
    let hasImage = false;
    let hasSound = false;
    
    if (customBird) {
        hasImage = !!customBird.image;
        hasSound = !!customBird.sound;
        birdImageEl.src = customBird.image || '';
        birdAudioEl.src = customBird.sound || '';
    } else if (birdFileData && birdFileData.birds) {
        const fileBird = birdFileData.birds.find(b => b.name === bird);
        if (fileBird) {
            hasImage = !!fileBird.image;
            hasSound = !!fileBird.sound;
            birdImageEl.src = fileBird.image || '';
            birdAudioEl.src = fileBird.sound || '';
        }
    }
    
    if (appMode === 'study') {
        birdNameEl.style.display = 'block';
        controlsEl.style.display = 'block';
        quizStartSection.style.display = 'none';
        quizSection.style.display = 'none';
        if (currentMode === 'sound') {
            birdImageEl.style.display = 'none';
            imageMessageEl.textContent = '';
            if (hasSound) {
                birdAudioEl.style.display = 'block';
                audioMessageEl.textContent = '';
            } else {
                birdAudioEl.style.display = 'none';
                audioMessageEl.textContent = 'No sound available for this bird';
            }
        } else if (currentMode === 'image') {
            if (hasImage) {
                birdImageEl.style.display = 'block';
                imageMessageEl.textContent = '';
            } else {
                birdImageEl.style.display = 'none';
                imageMessageEl.textContent = 'No image available for this bird';
            }
            birdAudioEl.style.display = 'none';
            audioMessageEl.textContent = '';
        } else {
            if (hasImage) {
                birdImageEl.style.display = 'block';
                imageMessageEl.textContent = '';
            } else {
                birdImageEl.style.display = 'none';
                imageMessageEl.textContent = 'No image available for this bird';
            }
            if (hasSound) {
                birdAudioEl.style.display = 'block';
                audioMessageEl.textContent = '';
            } else {
                birdAudioEl.style.display = 'none';
                audioMessageEl.textContent = 'No sound available for this bird';
            }
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
                imageMessageEl.textContent = '';
                if (hasSound) {
                    birdAudioEl.style.display = 'block';
                    audioMessageEl.textContent = '';
                } else {
                    birdAudioEl.style.display = 'none';
                    audioMessageEl.textContent = 'No sound available for this bird';
                }
            } else if (currentMode === 'image') {
                if (hasImage) {
                    birdImageEl.style.display = 'block';
                    imageMessageEl.textContent = '';
                } else {
                    birdImageEl.style.display = 'none';
                    imageMessageEl.textContent = 'No image available for this bird';
                }
                birdAudioEl.style.display = 'none';
                audioMessageEl.textContent = '';
            } else {
                if (hasImage) {
                    birdImageEl.style.display = 'block';
                    imageMessageEl.textContent = '';
                } else {
                    birdImageEl.style.display = 'none';
                    imageMessageEl.textContent = 'No image available for this bird';
                }
                if (hasSound) {
                    birdAudioEl.style.display = 'block';
                    audioMessageEl.textContent = '';
                } else {
                    birdAudioEl.style.display = 'none';
                    audioMessageEl.textContent = 'No sound available for this bird';
                }
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

addBirdBtn.addEventListener('click', async () => {
    const name = document.getElementById('bird-name-input').value;
    const imageFile = document.getElementById('bird-image-input').files[0];
    const soundFile = document.getElementById('bird-sound-input').files[0];
    
    if (!name) {
        alert('Please enter a bird name');
        return;
    }
    
    if (!imageFile && !soundFile) {
        alert('Please select at least an image or a sound file');
        return;
    }
    
    // Convert files to data URLs (empty string if no file)
    const imageData = imageFile ? await fileToDataURL(imageFile) : '';
    const soundData = soundFile ? await fileToDataURL(soundFile) : '';
    
    const customBird = { name, image: imageData, sound: soundData };
    
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    customBirds.push(customBird);
    localStorage.setItem('customBirds', JSON.stringify(customBirds));
    
    birds.push(name);
    currentIndex = birds.length - 1;
    updateDisplay();
    updateDeleteDropdown();
    
    // Reset form
    document.getElementById('bird-name-input').value = '';
    document.getElementById('bird-image-input').value = '';
    document.getElementById('bird-sound-input').value = '';
});

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function clearCustomBirds() {
    if (confirm('Are you sure you want to clear all custom birds? This cannot be undone.')) {
        localStorage.removeItem('customBirds');
        updateDeleteDropdown();
        updateDisplay();
    }
}

function printBirds() {
    console.log('Current birds:', birds);
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    console.log('Custom birds in localStorage:', customBirds);
    console.log('Bird file data:', birdFileData);
}

// Export bird file - download all birds as a single JSON file
function exportBirdFile() {
    const allBirds = [];
    
    // Get custom birds from localStorage
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    allBirds.push(...customBirds);
    
    // Get birds from bird file
    if (birdFileData && birdFileData.birds) {
        birdFileData.birds.forEach(bird => {
            if (!allBirds.find(b => b.name === bird.name)) {
                allBirds.push(bird);
            }
        });
    }
    
    if (allBirds.length === 0) {
        alert('No birds to export. Add birds or load a bird file first.');
        return;
    }
    
    const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        birds: allBirds
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bird-file.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Import bird file - upload a JSON file
async function importBirdFile(file) {
    clearCustomBirds();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate file format
                if (!data.birds || !Array.isArray(data.birds)) {
                    reject(new Error('Invalid bird file format'));
                    return;
                }
                
                // Validate each bird has required fields
                for (const bird of data.birds) {
                    if (!bird.name && (!bird.image || !bird.sound)) {
                        reject(new Error('Bird missing required fields (name, image, sound)'));
                        return;
                    }
                }
                
                // Set the bird file data
                setBirdFileData(data);
                updateDeleteDropdown();
                
                resolve(data);
            } catch (err) {
                reject(new Error('Failed to parse bird file: ' + err.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
        updateDeleteDropdown();
    });
}

// Initialize
updateDisplay();

// Bird file upload/download handlers
const birdFileInput = document.getElementById('bird-file-input');
const loadBirdFileBtn = document.getElementById('load-bird-file');
const downloadBirdFileBtn = document.getElementById('download-bird-file');
const fileLoadMessage = document.getElementById('file-load-message');

// Delete bird elements
const birdDeleteSelect = document.getElementById('bird-delete-select');
const deleteBirdBtn = document.getElementById('delete-bird-btn');
const deleteMessage = document.getElementById('delete-message');

function updateDeleteDropdown() {
    // Clear existing options except the first
    while (birdDeleteSelect.options.length > 1) {
        birdDeleteSelect.remove(1);
    }
    
    // Get custom birds from localStorage only (not bird file birds)
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    
    // Add each custom bird to the dropdown
    customBirds.forEach((bird, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = bird.name;
        birdDeleteSelect.appendChild(option);
    });
}

function deleteBird() {
    const selectedIndex = birdDeleteSelect.value;
    
    if (selectedIndex === '') {
        deleteMessage.textContent = 'Please select a bird to delete';
        deleteMessage.style.color = 'orange';
        return;
    }
    
    const customBirds = JSON.parse(localStorage.getItem('customBirds') || '[]');
    const birdToDelete = customBirds[selectedIndex].name;
    
    if (confirm(`Are you sure you want to delete "${birdToDelete}"? This cannot be undone.`)) {
        // Remove the bird
        customBirds.splice(selectedIndex, 1);
        localStorage.setItem('customBirds', JSON.stringify(customBirds));
        
        // Remove from birds array
        const birdIndex = birds.indexOf(birdToDelete);
        if (birdIndex > -1) {
            birds.splice(birdIndex, 1);
        }
        
        // Adjust current index if needed
        if (currentIndex >= birds.length) {
            currentIndex = Math.max(0, birds.length - 1);
        }
        
        updateDeleteDropdown();
        updateDisplay();
        
        deleteMessage.textContent = `"${birdToDelete}" has been deleted`;
        deleteMessage.style.color = 'green';
        
        // Clear message after 3 seconds
        setTimeout(() => {
            deleteMessage.textContent = '';
        }, 3000);
    }
}

deleteBirdBtn.addEventListener('click', deleteBird);

// Initialize delete dropdown
updateDeleteDropdown();

loadBirdFileBtn.addEventListener('click', async () => {
    const file = birdFileInput.files[0];
    if (!file) {
        fileLoadMessage.textContent = 'Please select a file first';
        fileLoadMessage.style.color = 'orange';
        return;
    }
    
    try {
        const data = await importBirdFile(file);
        fileLoadMessage.textContent = `Loaded ${data.birds.length} birds successfully!`;
        fileLoadMessage.style.color = 'green';
        birdFileInput.value = ''; // Reset file input
    } catch (err) {
        fileLoadMessage.textContent = err.message;
        fileLoadMessage.style.color = 'red';
    }
});

downloadBirdFileBtn.addEventListener('click', () => {
    try {
        exportBirdFile();
    } catch (err) {
        alert('Failed to download: ' + err.message);
    }
});