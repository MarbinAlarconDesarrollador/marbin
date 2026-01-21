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
    '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀙', '🀚', '🀛', '🀜', '🀝', '🀞',
    '🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆',
    '🌸', '🎋', '🌀', '⭐', '🔴', '🔷', '🐉', '🍀', '🍄', '🍋', '🔔', '🌙', '🔥', '🌊', '💎'
];

let level = 1, score = 0, tiles = [], selected = null, timeLeft = 100, timerInt;

function assignColorClass(el, symbol) {
    el.classList.remove('bambu', 'circulo', 'caracter', 'viento', 'dragon-blanco', 'emoji-warm', 'emoji-cool');
    if (['🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀅', '🎋', '🍀'].includes(symbol)) el.classList.add('bambu');
    else if (['🀙', '🀚', '🀛', '🀜', '🀝', '🀞', '🔷', '🌊', '💎'].includes(symbol)) el.classList.add('circulo');
    else if (['🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀄', '🔴', '🔥', '🍄'].includes(symbol)) el.classList.add('caracter');
    else if (['⭐', '🍋', '🔔', '🌸'].includes(symbol)) el.classList.add('emoji-warm');
    else if (['🌙', '🌀'].includes(symbol)) el.classList.add('emoji-cool');
    else if (['🀀', '🀁', '🀂', '🀃', '🐉'].includes(symbol)) el.classList.add('viento');
    else if (symbol === '🀆') el.classList.add('dragon-blanco');
}

function createExplosion(x, y, color = '#f1c40f') {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.backgroundColor = color;
        p.style.left = x + 'px'; p.style.top = y + 'px';
        p.style.setProperty('--tx', `${(Math.random() - 0.5) * 150}px`);
        p.style.setProperty('--ty', `${(Math.random() - 0.5) * 150}px`);
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
    if (!selected) {
        selected = tile; tile.el.classList.add("selected"); playSfx(440);
    } else if (selected === tile) {
        tile.el.classList.remove("selected"); selected = null;
    } else if (selected.symbol === tile.symbol) {
        const r1 = selected.el.getBoundingClientRect();
        const colorMatch = window.getComputedStyle(selected.el).color;
        createExplosion(r1.left + 25, r1.top + 30, colorMatch);
        playSfx(800, 'triangle', 0.2);
        score += 100; timeLeft = Math.min(100, timeLeft + 8);
        selected.active = tile.active = false;
        selected.el.style.display = tile.el.style.display = "none";
        selected = null;
        document.getElementById("pts-txt").textContent = score;
        updateStates();
        if (tiles.every(t => !t.active)) { level++; msg("¡NIVEL SUPERADO!"); setTimeout(startLevel, 1000); }
    } else {
        selected.el.classList.remove("selected");
        selected = tile; tile.el.classList.add("selected"); playSfx(440);
    }
}

function shuffleBoard(manual) {
    if (manual && !confirm("Mezclar cuesta 50 puntos. ¿Continuar?")) return;
    if (manual) score = Math.max(0, score - 50);
    const active = tiles.filter(t => t.active);
    const syms = active.map(t => t.symbol).sort(() => Math.random() - 0.5);
    active.forEach((t, i) => {
        t.symbol = syms[i]; t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]); t.el.classList.remove("selected");
    });
    document.getElementById("pts-txt").textContent = score;
    updateStates();
}

function startLevel() {
    const board = document.getElementById("board");
    board.innerHTML = ""; tiles = []; selected = null;
    document.getElementById("lvl-txt").textContent = level;

    const layers = Math.min(level, 3);
    const gapX = window.innerWidth < 500 ? 48 : 54;
    const gapY = window.innerWidth < 500 ? 62 : 70;

    for (let z = 0; z < layers; z++) {
        const size = 6 - z;
        const offset = (size - 1) / 2; // Centro dinámico de la capa
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const el = document.createElement("div");
                el.className = "tile";
                const tileObj = { el, symbol: '', x, y, z, active: true, isFree: false };
                el.style.left = `calc(50% + ${(x - offset) * gapX}px)`;
                el.style.top = `calc(50% + ${(y - offset) * gapY}px)`;
                el.style.zIndex = z;
                el.onclick = () => handleSelect(tileObj);
                board.appendChild(el);
                tiles.push(tileObj);
            }
        }
    }

    if (tiles.length % 2 !== 0) tiles.pop().el.remove();

    const syms = [];
    for (let i = 0; i < tiles.length / 2; i++) {
        const s = SYMBOLS[i % SYMBOLS.length];
        syms.push(s, s);
    }
    syms.sort(() => Math.random() - 0.5);
    tiles.forEach((t, i) => {
        t.symbol = syms[i]; t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]);
    });
    updateStates(); resetTimer();
}

function useHint() {
    const free = tiles.filter(t => t.active && t.isFree);
    for (let t of free) {
        for (let o of free) {
            if (t !== o && t.symbol === o.symbol) {
                t.el.classList.add("hint-mode"); o.el.classList.add("hint-mode");
                playSfx(600); return;
            }
        }
    }
}

function resetTimer() {
    clearInterval(timerInt); timeLeft = 100;
    timerInt = setInterval(() => {
        timeLeft -= 0.15;
        document.getElementById("timer-bar").style.width = timeLeft + "%";
        if (timeLeft <= 0) { clearInterval(timerInt); msg("¡TIEMPO AGOTADO!"); setTimeout(resetGame, 2000); }
    }, 100);
}

function msg(text) {
    const t = document.getElementById("toast");
    t.innerHTML = `<h2>${text}</h2>`; t.style.display = "block";
    setTimeout(() => t.style.display = "none", 2000);
}

function resetGame() {
    if (confirm("¿Reiniciar el juego? Perderás el progreso.")) {
        level = 1; score = 0;
        document.getElementById("pts-txt").textContent = score;
        startLevel();
    }
}

window.onload = startLevel;

let eventoInstalacion;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); eventoInstalacion = e;
    document.getElementById('btnInstalar').style.display = 'inline-block';
});

async function instalarPWA() {
    if (!eventoInstalacion) return;
    eventoInstalacion.prompt();
    eventoInstalacion = null;
    document.getElementById('btnInstalar').style.display = 'none';
}