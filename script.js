const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(f, t = 'sine', d = 0.1) {
    try {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch (e) { }
}

const SYMBOLS = [
    // Tradicionales
    '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', // Caracteres
    '🀙', '🀚', '🀛', '🀜', '🀝', '🀞', // Círculos
    '🀐', '🀑', '🀒', '🀓', '🀔', '🀕', // Bambúes
    '🀀', '🀁', '🀂', '🀃',             // Vientos
    '🀄', '🀅', '🀆',                     // Dragones
    // Emojis
    '🌸', '🎋', '🌀', '⭐', '🔴', '🔷', '🐉', '🍀',
    '🍄', '🍋', '🔔', '🌙', '🔥', '🌊', '💎'
];

let level = 1, score = 0, tiles = [], selected = null, timeLeft = 100, timerInt;

// Asigna clase de color según el símbolo (Tradicionales + Emojis)
function assignColorClass(el, symbol) {
    el.classList.remove('bambu', 'circulo', 'caracter', 'viento', 'dragon-blanco', 'emoji-warm', 'emoji-cool');

    if (['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀅', '🎋', '🍀'].includes(symbol)) {
        el.classList.add('bambu');
    } else if (['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🔷', '🌊', '💎'].includes(symbol)) {
        el.classList.add('circulo');
    } else if (['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀄', '🔴', '🔥', '🍄'].includes(symbol)) {
        el.classList.add('caracter');
    } else if (['⭐', '🍋', '🔔', '🌸'].includes(symbol)) {
        el.classList.add('emoji-warm');
    } else if (['🌙', '🌀'].includes(symbol)) {
        el.classList.add('emoji-cool');
    } else if (['🀀', '🀁', '🀂', '🀃', '🐉'].includes(symbol)) {
        el.classList.add('viento');
    } else if (symbol === '🀆') {
        el.classList.add('dragon-blanco');
    }
}

// Explosión con color dinámico
function createExplosion(x, y, color = '#f1c40f') {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.backgroundColor = color;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        const tx = (Math.random() - 0.5) * 200;
        const ty = (Math.random() - 0.5) * 200;
        p.style.setProperty('--tx', `${tx}px`);
        p.style.setProperty('--ty', `${ty}px`);
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
    }
}

function checkIsFree(tile) {
    if (!tile.active) return false;
    const hasAbove = tiles.some(t => t.active && t.z === tile.z + 1 && t.x === tile.x && t.y === tile.y);
    if (hasAbove) return false;
    const hasLeft = tiles.some(t => t.active && t.z === tile.z && t.y === tile.y && t.x === tile.x - 1);
    const hasRight = tiles.some(t => t.active && t.z === tile.z && t.y === tile.y && t.x === tile.x + 1);
    return !hasLeft || !hasRight;
}

function updateStates() {
    tiles.forEach(t => {
        t.isFree = checkIsFree(t);
        t.el.classList.toggle("blocked", !t.isFree);
    });
}

function handleSelect(tile) {
    if (!tile.isFree) { playSfx(100, 'sawtooth'); return; }
    document.querySelectorAll('.hint-mode').forEach(el => el.classList.remove('hint-mode'));

    if (!selected) {
        selected = tile;
        tile.el.classList.add("selected");
        playSfx(440);
    } else if (selected === tile) {
        tile.el.classList.remove("selected");
        selected = null;
    } else if (selected.symbol === tile.symbol) {
        const rect1 = selected.el.getBoundingClientRect();
        const rect2 = tile.el.getBoundingClientRect();

        // Obtener color dinámico para la explosión
        const colorMatch = window.getComputedStyle(selected.el).color;

        createExplosion(rect1.left + 25, rect1.top + 35, colorMatch);
        createExplosion(rect2.left + 25, rect2.top + 35, colorMatch);

        playSfx(800, 'triangle', 0.2);
        score += 100;
        timeLeft = Math.min(100, timeLeft + 10);
        selected.active = tile.active = false;
        selected.el.style.display = tile.el.style.display = "none";
        selected = null;
        document.getElementById("pts-txt").textContent = score;
        updateStates();

        if (tiles.every(t => !t.active)) {
            level++;
            msg("¡NIVEL SUPERADO!");
            setTimeout(startLevel, 1000);
        }
    } else {
        selected.el.classList.remove("selected");
        selected = tile;
        tile.el.classList.add("selected");
        playSfx(440);
    }
}

function shuffleBoard(manual) {
    const active = tiles.filter(t => t.active);
    const syms = active.map(t => t.symbol).sort(() => Math.random() - 0.5);
    active.forEach((t, i) => {
        t.symbol = syms[i];
        t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]);
        t.el.classList.remove("selected");
    });
    if (manual) score = Math.max(0, score - 50);
    document.getElementById("pts-txt").textContent = score;
    updateStates();
}

function shuffleBoard(manual) {
    if (manual) {
        const confirmar = confirm("Mezclar las fichas te costará 50 puntos. ¿Deseas continuar?");
        if (!confirmar) return; // Si cancela, no hace nada
        score = Math.max(0, score - 50);
    }

    const active = tiles.filter(t => t.active);
    const syms = active.map(t => t.symbol).sort(() => Math.random() - 0.5);
    active.forEach((t, i) => {
        t.symbol = syms[i];
        t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]);
        t.el.classList.remove("selected");
    });

    document.getElementById("pts-txt").textContent = score;
    updateStates();
}

function startLevel() {
    const board = document.getElementById("board");
    board.innerHTML = ""; tiles = []; selected = null;
    document.getElementById("lvl-txt").textContent = level;

    const layers = Math.min(level, 3);
    for (let z = 0; z < layers; z++) {
        const size = 6 - z;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const el = document.createElement("div");
                el.className = "tile";
                const tileObj = { el, symbol: '', x, y, z, active: true, isFree: false };
                el.style.left = `calc(50% + ${(x - 2.5) * 58}px)`;
                el.style.top = `calc(50% + ${(y - 2.5) * 75}px)`;
                el.style.zIndex = z;
                el.onclick = () => handleSelect(tileObj);
                board.appendChild(el);
                tiles.push(tileObj);
            }
        }
    }

    // SOLUCIÓN AL BUG: Asegurar número par eliminando el huérfano
    if (tiles.length % 2 !== 0) {
        const last = tiles.pop();
        last.el.remove();
    }

    const syms = [];
    for (let i = 0; i < tiles.length / 2; i++) {
        const s = SYMBOLS[i % SYMBOLS.length];
        syms.push(s, s);
    }
    syms.sort(() => Math.random() - 0.5);

    tiles.forEach((t, i) => {
        t.symbol = syms[i];
        t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]);
    });

    updateStates();
    resetTimer();
}

function useHint() {
    const freeOnes = tiles.filter(t => t.active && t.isFree);
    for (let t of freeOnes) {
        for (let o of freeOnes) {
            if (t !== o && t.symbol === o.symbol) {
                t.el.classList.add("hint-mode");
                o.el.classList.add("hint-mode");
                playSfx(600);
                return;
            }
        }
    }
}

function resetTimer() {
    clearInterval(timerInt);
    timeLeft = 100;
    timerInt = setInterval(() => {
        timeLeft -= 0.12;
        document.getElementById("timer-bar").style.width = timeLeft + "%";
        if (timeLeft <= 0) {
            clearInterval(timerInt);
            msg("¡TIEMPO AGOTADO!");
            setTimeout(resetGame, 2000);
        }
    }, 100);
}

function msg(text) {
    const t = document.getElementById("toast");
    t.innerHTML = `<h2>${text}</h2>`; t.style.display = "block";
    setTimeout(() => t.style.display = "none", 2000);
}

//function resetGame() { level = 1; score = 0; startLevel(); }
function resetGame() {
    // Ventana de confirmación nativa
    const confirmar = confirm("¿Estás seguro de que quieres reiniciar el juego? Perderás tu puntuación y nivel actual.");

    if (confirmar) {
        level = 1;
        score = 0;
        document.getElementById("pts-txt").textContent = score;
        startLevel();
        msg("¡Juego reiniciado!");
    }
}

window.onload = startLevel;

// Lógica de Instalación PWA
let eventoInstalacion;
const botonInstalar = document.getElementById('btnInstalar');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    if (botonInstalar) botonInstalar.style.display = 'inline-block';
});

async function instalarPWA() {
    if (!eventoInstalacion) return;
    eventoInstalacion.prompt();
    const { outcome } = await eventoInstalacion.userChoice;
    eventoInstalacion = null;
    if (botonInstalar) botonInstalar.style.display = 'none';
}

