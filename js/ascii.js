// Fogo em ASCII: simulação de calor em grade (o "doom fire") e cada célula
// vira uma letra cuja forma e cor saem só do calor.

const RAMPA = " .,:;-=+*#%@";
const NIVEIS = 64;
const VARIANTES = 3;
const ESCALA_CALOR = 1.6; // o calor da fonte passa de 1; só o miolo mais quente chega ao branco
const PARADAS = [
  [0, [24, 6, 4]],
  [0.15, [96, 14, 6]],
  [0.35, [184, 40, 8]],
  [0.55, [240, 98, 18]],
  [0.75, [255, 172, 52]],
  [0.9, [255, 228, 142]],
  [1, [255, 250, 228]],
];

function corDoCalor(h) {
  for (let i = 1; i < PARADAS.length; i++) {
    if (h <= PARADAS[i][0]) {
      const [h0, c0] = PARADAS[i - 1];
      const [h1, c1] = PARADAS[i];
      const k = (h - h0) / (h1 - h0);
      return c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
    }
  }
  return PARADAS[PARADAS.length - 1][1];
}

export function criarAscii(secao, canvas, { aoInformar } = {}) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let cw = 8;
  let ch = 14;
  let tamFonte = 14;
  let cols = 0;
  let rows = 0;
  let calor = new Float32Array(0);
  let variante = new Uint8Array(0);
  let atlas = null;
  let ligado = false;
  let ultimo = 0;
  let acumulado = 0;
  let tempo = 0;
  let vento = 0;
  let ventoAlvo = 0;
  let ponteiro = null; // { col, row }
  let ultimoX = null;
  const fagulhas = [];

  function montarAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = NIVEIS * VARIANTES * cw;
    atlas.height = ch;
    const a = atlas.getContext("2d");
    a.font = `400 ${tamFonte}px "JetBrains Mono", Consolas, monospace`;
    a.textBaseline = "alphabetic";
    for (let l = 0; l < NIVEIS; l++) {
      const h = l / (NIVEIS - 1);
      const [r, g, b] = corDoCalor(h);
      a.fillStyle = `rgb(${r},${g},${b})`;
      for (let v = 0; v < VARIANTES; v++) {
        const ci = Math.max(1, Math.min(RAMPA.length - 1, Math.round(h * (RAMPA.length - 1)) + v - 1));
        a.fillText(RAMPA[ci], (l * VARIANTES + v) * cw, ch * 0.78);
      }
    }
  }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = secao.clientWidth;
    const h = secao.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const fontCss = Math.min(18, Math.max(11, w / 240));
    tamFonte = fontCss * dpr;
    const sonda = document.createElement("canvas").getContext("2d");
    sonda.font = `400 ${tamFonte}px "JetBrains Mono", Consolas, monospace`;
    cw = Math.max(4, Math.round(sonda.measureText("M").width));
    ch = Math.round(tamFonte * 1.18);
    cols = Math.floor(canvas.width / cw);
    rows = Math.floor(canvas.height / ch);
    calor = new Float32Array(cols * rows);
    variante = new Uint8Array(cols * rows);
    for (let i = 0; i < variante.length; i++) variante[i] = (Math.random() * VARIANTES) | 0;
    montarAtlas();
    // aquece a grade antes do primeiro quadro, para não nascer vazia
    for (let i = 0; i < rows + 10; i++) passo();
    desenhar();
    if (aoInformar) {
      aoInformar({
        texto: `${cols} × ${rows} células · ${(cols * rows / 1000).toFixed(1)} mil letras`,
        cols,
        rows,
      });
    }
  }

  function passo() {
    const W = cols;
    const H = rows;
    const decaimentoMax = (2 * 1.15) / (H * 0.42);
    // fonte de calor na linha de baixo, com línguas de fogo que andam
    for (let x = 0; x < W; x++) {
      const a = 0.5 + 0.5 * Math.sin(x * 0.07 + tempo * 2.1) * Math.sin(x * 0.021 - tempo * 1.3 + 1.7);
      const b = 0.5 + 0.5 * Math.sin(x * 0.19 + tempo * 3.3);
      const lingua = Math.pow(0.7 * a + 0.3 * b, 1.6);
      calor[(H - 1) * W + x] = (0.8 + 1.2 * lingua) * (0.9 + 0.2 * Math.random());
    }
    // tocha do mouse
    if (ponteiro) {
      const R = Math.max(4, Math.round(H * 0.06));
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue;
          const x = ponteiro.col + dx;
          const y = ponteiro.row + dy;
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const i = y * W + x;
          if (calor[i] < 1.6) calor[i] = 1.6;
        }
      }
    }
    vento += (ventoAlvo - vento) * 0.15;
    ventoAlvo *= 0.96;
    const aVento = Math.abs(vento);
    const dirVento = vento < 0 ? -1 : 1;
    for (let y = 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const origem = calor[y * W + x];
        const sorte = Math.random();
        let dx = sorte < 0.2 ? -1 : sorte > 0.8 ? 1 : 0;
        if (Math.random() < aVento) dx += dirVento;
        let nx = x + dx;
        if (nx < 0) nx = 0;
        else if (nx >= W) nx = W - 1;
        const v = origem - Math.random() * decaimentoMax;
        calor[(y - 1) * W + nx] = v > 0 ? v : 0;
      }
    }
    tempo += 1 / 40;
    // faíscas que sobem acima da chama
    if (fagulhas.length < 140 && Math.random() < 0.55) {
      fagulhas.push({
        x: Math.random() * W,
        y: H - 2 - Math.random() * H * 0.25,
        vy: 0.35 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 0.3,
        vida: 1,
        glifo: ".'*`,"[(Math.random() * 5) | 0],
      });
    }
    for (let i = fagulhas.length - 1; i >= 0; i--) {
      const f = fagulhas[i];
      f.y -= f.vy;
      f.x += f.vx + vento * 0.5 + (Math.random() - 0.5) * 0.35;
      f.vida -= 0.012 + Math.random() * 0.01;
      if (f.vida <= 0 || f.y < 0) fagulhas.splice(i, 1);
    }
  }

  function desenhar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = cols;
    const H = rows;
    for (let y = 0; y < H; y++) {
      const py = y * ch;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let h = calor[i] / ESCALA_CALOR;
        if (h < 0.03) continue;
        if (h > 1) h = 1;
        h = Math.pow(h, 0.65);
        const nivel = (h * (NIVEIS - 1)) | 0;
        ctx.drawImage(atlas, (nivel * VARIANTES + variante[i]) * cw, 0, cw, ch, x * cw, py, cw, ch);
      }
    }
    ctx.font = `400 ${tamFonte}px "JetBrains Mono", Consolas, monospace`;
    ctx.textBaseline = "alphabetic";
    for (const f of fagulhas) {
      const [r, g, b] = corDoCalor(0.35 + 0.5 * f.vida);
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, f.vida * 1.6)})`;
      ctx.fillText(f.glifo, f.x * cw, f.y * ch + ch * 0.78);
    }
  }

  function quadro(agora) {
    if (!ligado) return;
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    const taxa = Math.min(90, Math.max(30, rows * 0.5));
    acumulado += dt;
    const intervalo = 1 / taxa;
    let passos = 0;
    while (acumulado >= intervalo && passos < 4) {
      passo();
      acumulado -= intervalo;
      passos++;
    }
    if (passos > 0) desenhar();
    requestAnimationFrame(quadro);
  }

  function aoMover(e) {
    const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * canvas.width;
    const py = ((e.clientY - r.top) / r.height) * canvas.height;
    ponteiro = { col: Math.floor(px / cw), row: Math.floor(py / ch) };
    if (ultimoX !== null) {
      const d = (e.clientX - ultimoX) / 25;
      ventoAlvo = Math.max(-1, Math.min(1, ventoAlvo + d));
    }
    ultimoX = e.clientX;
  }

  function aoSair() {
    ponteiro = null;
    ultimoX = null;
  }

  secao.addEventListener("pointermove", aoMover);
  secao.addEventListener("pointerleave", aoSair);
  new ResizeObserver(() => medir()).observe(secao);

  return {
    ligar() {
      if (ligado) return;
      ligado = true;
      ultimo = performance.now();
      requestAnimationFrame(quadro);
    },
    desligar() {
      ligado = false;
    },
    // movimento reduzido: aquece e para num quadro só
    congelar() {
      ligado = false;
      for (let i = 0; i < rows; i++) passo();
      desenhar();
    },
    medir,
  };
}
