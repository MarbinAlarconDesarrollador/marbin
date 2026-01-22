/* ==========================================
   1. SISTEMA DE AUDIO (Sintetizador)
   ========================================== */
// Crea el contexto de audio del navegador para generar sonidos sin archivos mp3 externos
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Genera un sonido simple usando osciladores.
 * @param {number} f - Frecuencia (tono) en Hertz.
 * @param {string} t - Tipo de onda ('sine', 'square', 'sawtooth', etc).
 * @param {number} d - Duración en segundos.
 */
function playSfx(f, t = 'sine', d = 0.1) {
    try {
        const o = audioCtx.createOscillator(); // Crea el generador de sonido
        const g = audioCtx.createGain();       // Crea el control de volumen
        o.type = t; 
        o.frequency.value = f;
        // Baja el volumen suavemente a 0 (efecto fade-out)
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
        o.connect(g); 
        g.connect(audioCtx.destination); // Conecta a los parlantes
        o.start(); 
        o.stop(audioCtx.currentTime + d);
    } catch (e) { console.error("Error de audio", e); }
}

/* ==========================================
   2. DATOS Y VARIABLES DE ESTADO
   ========================================== */
// Biblioteca de caracteres Unicode para usar como fichas
const SYMBOLS = [
    '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀙', '🀚', '🀛', '🀜', '🀝', '🀞',
    '🀐', '🀑', '🀒', '🀓', '🀔', '🀕', '🀀', '🀁', '🀂', '🀃', '🀄', '🀅', '🀆',
    '🌸', '🎋', '🌀', '⭐', '🔴', '🔷', '🐉', '🍀', '🍄', '🍋', '🔔', '🌙', '🔥', '🌊', '💎'
];

// Variables globales para controlar el estado del juego
let level = 1,          // Nivel actual
    score = 0,          // Puntaje acumulado
    tiles = [],         // Array con todos los objetos ficha del tablero actual
    selected = null,    // Ficha actualmente seleccionada (primer clic)
    timeLeft = 100,     // Porcentaje de tiempo restante
    timerInt;           // Referencia al intervalo del reloj (para poder pararlo)

/* ==========================================
   3. FUNCIONES VISUALES (Estilos y Efectos)
   ========================================== */

/**
 * Asigna clases CSS específicas según el símbolo para dar colores distintos.
 * Esto permite que los Bambú sean verdes, Círculos azules, etc.
 */
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

/**
 * Crea partículas pequeñas que explotan desde una posición (x, y).
 * Se usa cuando se hace un match exitoso.
 */
function createExplosion(x, y, color = '#f1c40f') {
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.backgroundColor = color;
        p.style.left = x + 'px'; p.style.top = y + 'px';
        // Variables CSS personalizadas para dirección aleatoria
        p.style.setProperty('--tx', `${(Math.random() - 0.5) * 150}px`);
        p.style.setProperty('--ty', `${(Math.random() - 0.5) * 150}px`);
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600); // Se eliminan del DOM tras la animación
    }
}

/* ==========================================
   4. LÓGICA DE MAHJONG (Reglas)
   ========================================== */

/**
 * Verifica si una ficha se puede seleccionar según las reglas del Mahjong.
 * Regla: No debe tener fichas encima (z+1) ni estar bloqueada por ambos lados (izquierda Y derecha).
 */
function checkIsFree(tile) {
    if (!tile.active) return false; // Si ya fue eliminada, no cuenta
    
    // Busca si hay alguna ficha activa justo encima (mismas coordenadas x,y pero z superior)
    const hasAbove = tiles.some(t => t.active && t.z === tile.z + 1 && t.x === tile.x && t.y === tile.y);
    if (hasAbove) return false;
    
    // Busca bloqueos laterales
    const hasLeft = tiles.some(t => t.active && t.z === tile.z && t.y === tile.y && t.x === tile.x - 1);
    const hasRight = tiles.some(t => t.active && t.z === tile.z && t.y === tile.y && t.x === tile.x + 1);
    
    // Está libre si NO tiene izquierda O NO tiene derecha (o ambas libres)
    return !hasLeft || !hasRight;
}

/**
 * Recorre todas las fichas y actualiza su estado visual (sombreado si está bloqueada).
 * Se llama cada vez que se eliminan fichas.
 */
function updateStates() {
    tiles.forEach(t => {
        t.isFree = checkIsFree(t);
        t.el.classList.toggle("blocked", !t.isFree);
    });
}

/**
 * Maneja la interacción principal del clic.
 * 1. Verifica si está bloqueada.
 * 2. Si no hay selección previa, selecciona la actual.
 * 3. Si hay selección previa:
 * - Si es la misma, deselecciona.
 * - Si es distinto símbolo, cambia selección.
 * - Si es mismo símbolo (MATCH): Elimina ambas, suma puntos, verifica victoria.
 */
function handleSelect(tile) {
    if (!tile.isFree) { playSfx(100, 'sawtooth'); return; } // Sonido de error
    
    if (!selected) {
        // Primera selección
        selected = tile; 
        tile.el.classList.add("selected"); 
        playSfx(440);
    } else if (selected === tile) {
        // Clic en la misma ficha (cancelar)
        tile.el.classList.remove("selected"); 
        selected = null;
    } else if (selected.symbol === tile.symbol) {
        // MATCH EXITOSO
        const r1 = selected.el.getBoundingClientRect();
        const colorMatch = window.getComputedStyle(selected.el).color;
        
        createExplosion(r1.left + 25, r1.top + 30, colorMatch); // Efecto visual
        playSfx(800, 'triangle', 0.2); // Sonido de éxito
        
        // Actualizar datos
        score += 100; 
        timeLeft = Math.min(100, timeLeft + 8); // Recuperar tiempo
        
        // Desactivar fichas (lógica y visualmente)
        selected.active = tile.active = false;
        selected.el.style.display = tile.el.style.display = "none";
        selected = null;
        
        document.getElementById("pts-txt").textContent = score;
        updateStates(); // Recalcular bloqueos
        
        // Verificar si ganó el nivel (todas inactivas)
        if (tiles.every(t => !t.active)) { 
            level++; 
            msg("¡NIVEL SUPERADO!"); 
            setTimeout(startLevel, 1000); 
        }
    } else {
        // Símbolos diferentes: Cambiar selección a la nueva ficha
        selected.el.classList.remove("selected");
        selected = tile; 
        tile.el.classList.add("selected"); 
        playSfx(440);
    }
}

/**
 * Función de ayuda: Mezcla las fichas restantes si no quedan movimientos.
 * Tiene una penalización de puntaje.
 */
function shuffleBoard(manual) {
    if (manual && !confirm("Mezclar cuesta 50 puntos. ¿Continuar?")) return;
    if (manual) score = Math.max(0, score - 50);
    
    const active = tiles.filter(t => t.active);
    // Extraer símbolos y barajar
    const syms = active.map(t => t.symbol).sort(() => Math.random() - 0.5);
    
    // Reasignar símbolos barajados a las posiciones existentes
    active.forEach((t, i) => {
        t.symbol = syms[i]; 
        t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]); 
        t.el.classList.remove("selected");
    });
    
    document.getElementById("pts-txt").textContent = score;
    updateStates();
}

/* ==========================================
   5. GENERACIÓN DE NIVELES (Algoritmo de Dificultad)
   ========================================== */

/**
 * Define la estructura 3D del nivel sin dibujarlo todavía.
 * Usa fórmulas matemáticas para crear patrones (pirámides, muros, etc).
 */
function generateLevelDesign(lvl) {
    const layout = [];
    // Aumenta el ancho y alto del tablero según el nivel (hasta un máximo de 8x10)
    const cols = Math.min(8, 4 + Math.floor(lvl / 3));
    const rows = Math.min(10, 5 + Math.floor(lvl / 3));

    // Aumenta la altura (capas Z) máxima cada 2 niveles
    const maxDepth = Math.min(6, 1 + Math.floor(lvl / 2));

    // Ciclo de 4 tipos de diseños diferentes
    const patternType = lvl % 4;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let height = 0;

            if (patternType === 0) {
                // PATRÓN 1: PIRÁMIDE (Más alto en el centro)
                const distX = Math.abs(x - cols / 2 + 0.5);
                const distY = Math.abs(y - rows / 2 + 0.5);
                const dist = Math.max(distX, distY);
                height = Math.max(0, maxDepth - Math.floor(dist));
            }
            else if (patternType === 1) {
                // PATRÓN 2: LA ARENA (Paredes altas alrededor, hueco en el centro)
                if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
                    height = maxDepth;
                } else {
                    height = 1; // Suelo bajo en el centro
                }
            }
            else if (patternType === 2) {
                // PATRÓN 3: AJEDREZ 3D (Columnas altas y bajas alternadas)
                if ((x + y) % 2 === 0) {
                    height = maxDepth;
                } else {
                    height = Math.floor(maxDepth / 2);
                }
            }
            else {
                // PATRÓN 4: CAOS (Alturas aleatorias, muy difícil)
                height = Math.floor(Math.random() * maxDepth) + 1;
            }

            // Agrega las coordenadas (x,y,z) al diseño
            for (let z = 0; z < height; z++) {
                // 10% de probabilidad de hueco para dar variedad
                if (Math.random() > 0.1) {
                    layout.push({ x, y, z });
                }
            }
        }
    }
    return layout;
}

/**
 * Función principal que construye el DOM del nivel.
 * 1. Limpia el tablero.
 * 2. Obtiene el diseño matemático.
 * 3. Centra el diseño en la pantalla.
 * 4. Crea los elementos HTML <div>.
 * 5. Asigna parejas de símbolos.
 */
function startLevel() {
    const board = document.getElementById("board");
    board.innerHTML = "";
    tiles = [];
    selected = null;
    document.getElementById("lvl-txt").textContent = level;

    // 1. Obtener diseño
    const design = generateLevelDesign(level);

    // 2. Definir espacio entre fichas (responsive)
    const isMobile = window.innerWidth < 500;
    const gapX = isMobile ? 42 : 54; 
    const gapY = isMobile ? 54 : 70;

    // 3. Matemáticas para centrar el bloque de fichas en la pantalla
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    design.forEach(d => {
        minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
        minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 4. Crear elementos visuales
    design.forEach(pos => {
        const el = document.createElement("div");
        el.className = "tile";
        
        const tileObj = {
            el,
            symbol: '',
            x: pos.x, y: pos.y, z: pos.z,
            active: true, isFree: false
        };

        // Posicionamiento CSS usando calc() desde el centro
        el.style.left = `calc(50% + ${(pos.x - centerX) * gapX}px)`;
        el.style.top = `calc(50% + ${(pos.y - centerY) * gapY}px)`;
        el.style.zIndex = 10 + pos.z; // Las capas superiores tapan a las inferiores

        el.onclick = () => handleSelect(tileObj);
        board.appendChild(el);
        tiles.push(tileObj);
    });

    // Seguridad: El total de fichas debe ser par para tener parejas
    if (tiles.length % 2 !== 0) {
        const last = tiles.pop();
        last.el.remove();
    }

    // 5. Asignar símbolos (Parejas)
    const syms = [];
    // A mayor nivel, usamos más tipos de símbolos (más difícil hacer match)
    const difficultySlice = Math.min(SYMBOLS.length, 10 + level * 2);
    const levelSymbols = SYMBOLS.slice(0, difficultySlice);

    // Crear duplicados para asegurar parejas
    for (let i = 0; i < tiles.length / 2; i++) {
        const s = levelSymbols[i % levelSymbols.length];
        syms.push(s, s);
    }
    syms.sort(() => Math.random() - 0.5); // Barajar

    tiles.forEach((t, i) => {
        t.symbol = syms[i];
        t.el.textContent = syms[i];
        assignColorClass(t.el, syms[i]);
    });

    updateStates(); // Calcular desbloqueados iniciales
    resetTimer();   // Iniciar reloj
}

/* ==========================================
   6. UTILIDADES Y SISTEMA
   ========================================== */

/**
 * Función de ayuda visual: Ilumina dos fichas iguales que estén libres.
 */
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

/**
 * Temporizador del juego.
 * La dificultad aumenta haciendo que el tiempo baje más rápido ("decayRate")
 * en niveles superiores.
 */
function resetTimer() {
    clearInterval(timerInt);
    timeLeft = 100;

    // Fórmula de dificultad: Nivel 1 baja 0.11 por tick, Nivel 10 baja 0.2
    const decayRate = 0.1 + (level * 0.01);

    timerInt = setInterval(() => {
        timeLeft -= decayRate;
        document.getElementById("timer-bar").style.width = timeLeft + "%";

        // Cambio de color a rojo si queda poco tiempo (<20%)
        const bar = document.getElementById("timer-bar");
        if (timeLeft < 20) bar.style.backgroundColor = "#e74c3c"; 
        else bar.style.backgroundColor = "#2ecc71"; 

        // Fin del juego
        if (timeLeft <= 0) {
            clearInterval(timerInt);
            msg("¡TIEMPO AGOTADO!");
            playSfx(100, 'sawtooth', 0.5); 
            setTimeout(resetGame, 2000);
        }
    }, 100); // Se ejecuta cada 100ms
}

// Muestra mensajes flotantes (Toast)
function msg(text) {
    const t = document.getElementById("toast");
    t.innerHTML = `<h2>${text}</h2>`; 
    t.style.display = "block";
    setTimeout(() => t.style.display = "none", 2000);
}

// Reinicio total
function resetGame() {
    if (confirm("¿Reiniciar el juego? Perderás el progreso.")) {
        level = 1; score = 0;
        document.getElementById("pts-txt").textContent = score;
        startLevel();
    }
}

// Iniciar al cargar la página
window.onload = startLevel;

/* ==========================================
   7. LÓGICA PWA (Instalación App)
   ========================================== */
let eventoInstalacion;

// Escucha si el navegador permite instalar la app
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    eventoInstalacion = e;
    // Muestra el botón de instalar solo si es posible
    document.getElementById('btnInstalar').style.display = 'inline-block';
});

// Función llamada por el botón de instalar
async function instalarPWA() {
    if (!eventoInstalacion) return;
    eventoInstalacion.prompt(); // Lanza el popup nativo del celular
    eventoInstalacion = null;
    document.getElementById('btnInstalar').style.display = 'none';
}