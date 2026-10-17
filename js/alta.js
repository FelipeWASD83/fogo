// Fogo em alta resolução: a mesma ideia do ASCII (grade de calor), mas cada
// célula é um pixel pequeno (2 a 4 px da tela), com cor contínua em vez de
// letra. A chama sobe por advecção com turbulência (cada célula puxa o calor
// de baixo, deslocado por um campo de ondas), em vez de empurrar para cima.
// Por cima: brilho (bloom), faíscas com rastro, a tocha do mouse e um clarão
// no clique.

const ESCALA_CALOR = 1.5;
const LINHAS_POR_PASSO = 3;
const PARADAS = [
  [0, [10, 2, 2]],
  [0.12, [70, 8, 4]],
  [0.3, [160, 30, 6]],
  [0.5, [235, 80, 14]],
  [0.7, [255, 150, 40]],
  [0.86, [255, 215, 120]],
  [1, [255, 250, 225]],
];

function corDoCalor(h) {
  for (let i = 1; i < PARADAS.length; i++) {
    if (h <= PARADAS[i][0]) {
      const [h0, c0] = PARADAS[i - 1];
      const [h1, c1] = PARADAS[i];
      const k = (h - h0) / (h1 - h0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return PARADAS[PARADAS.length - 1][1];
}

// tabela de 256 cores já empacotadas (RGBA em little-endian) para escrever direto no ImageData
function montarTabela() {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    const h = Math.pow(i / 255, 0.72);
    const [r, g, b] = corDoCalor(h);
    const a = Math.min(255, Math.round(Math.min(1, h * 1.8) * 255));
    t[i] = (a << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r);
  }
  return t;
}

// ruído pré-sorteado: sortear dois números por célula a cada passo custava o dobro do tempo
const RUIDO = new Float32Array(65536);
for (let i = 0; i < RUIDO.length; i++) RUIDO[i] = Math.random();

export function criarAlta(secao, canvas, brilho, { aoInformar, aoMedir } = {}) {
  const ctx = canvas.getContext("2d");
  const ctxBrilho = brilho.getContext("2d");
  const sim = document.createElement("canvas");
  const simCtx = sim.getContext("2d");
  const tabela = montarTabela();

  let dpr = 1;
  let celula = 3;
  let cols = 0;
  let rows = 0;
  let calor = new Float32Array(0);
  let imagem = null;
  let pixels = null;
  let largura = 0;
  let altura = 0;
  let ligado = false;
  let ultimo = 0;
  let acumulado = 0;
  let tempo = 0;
  let vento = 0;
  let ventoAlvo = 0;
  let labareda = 0;
  let ponteiro = null; // { x, y } em px de tela
  let ultimoX = null;
  let semente = 2463534242;
  let quadros = 0;
  let ultimaMedida = performance.now();
  let contaLuz = 0;
  const fagulhas = [];
  let tabSy1 = new Float32Array(0);
  let tabSy2 = new Float32Array(0);
  let tabSx1 = new Float32Array(0);
  let tabSx2 = new Float32Array(0);

  // brilho de uma faísca, desenhado uma vez
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  {
    const s = sprite.getContext("2d");
    const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,240,200,1)");
    g.addColorStop(0.25, "rgba(255,160,60,0.6)");
    g.addColorStop(1, "rgba(255,80,20,0)");
    s.fillStyle = g;
    s.fillRect(0, 0, 64, 64);
  }

  function aleatorio() {
    semente ^= semente << 13;
    semente ^= semente >>> 17;
    semente ^= semente << 5;
    return (semente >>> 0) / 4294967296;
  }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = secao.clientWidth;
    const h = secao.clientHeight;
    celula = Math.max(2, Math.min(4, Math.round(w / 1150)));
    largura = Math.round(w * dpr);
    altura = Math.round(h * dpr);
    canvas.width = largura;
    canvas.height = altura;
    cols = Math.ceil(w / celula);
    rows = Math.ceil(h / celula);
    sim.width = cols;
    sim.height = rows;
    imagem = simCtx.createImageData(cols, rows);
    pixels = new Uint32Array(imagem.data.buffer);
    calor = new Float32Array(cols * rows);
    tabSy1 = new Float32Array(rows);
    tabSy2 = new Float32Array(rows);
    tabSx1 = new Float32Array(cols);
    tabSx2 = new Float32Array(cols);
    brilho.width = Math.max(16, Math.round(cols / 4));
    brilho.height = Math.max(16, Math.round(rows / 4));
    fagulhas.length = 0;
    for (let i = 0; i < rows + 20; i++) passo();
    desenhar();
    if (aoInformar) {
      aoInformar({
        texto: `${cols} × ${rows} células de ${celula} px · ${(cols * rows / 1000).toFixed(0)} mil pontos de calor`,
        cols,
        rows,
        largura,
        altura,
      });
    }
  }

  function passo() {
    const W = cols;
    const H = rows;
    const R = LINHAS_POR_PASSO;
    tempo += 1 / 60;
    const t = tempo;
    for (let y = 0; y < H; y++) {
      tabSy1[y] = Math.sin(y * 0.05 + t * 3.4);
      tabSy2[y] = Math.sin(y * 0.021 - t * 2.1);
    }
    for (let x = 0; x < W; x++) {
      tabSx1[x] = Math.sin(x * 0.045 + t * 1.7);
      tabSx2[x] = Math.sin(x * 0.017 - t * 1.1 + 1.3);
    }
    // fonte nas últimas linhas: línguas de fogo que andam
    const fonte = 1 + labareda * 0.7;
    for (let x = 0; x < W; x++) {
      const a = 0.5 + 0.5 * tabSx1[x] * tabSx2[x];
      const b = 0.5 + 0.5 * Math.sin(x * 0.19 + t * 3.3);
      const lingua = Math.pow(0.7 * a + 0.3 * b, 1.6);
      const v = (0.8 + 1.2 * lingua) * (0.9 + 0.2 * aleatorio()) * fonte;
      for (let k = 1; k <= R; k++) calor[(H - k) * W + x] = v;
    }
    // tocha do mouse
    if (ponteiro) {
      const raio = Math.max(6, Math.round(H * 0.045));
      const cx = Math.round(ponteiro.x / (celula * dpr));
      const cy = Math.round(ponteiro.y / (celula * dpr));
      for (let dy = -raio; dy <= raio; dy++) {
        const y = cy + dy;
        if (y < 0 || y >= H) continue;
        for (let dx = -raio; dx <= raio; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > raio * raio) continue;
          const x = cx + dx;
          if (x < 0 || x >= W) continue;
          const i = y * W + x;
          const v = 1.9 * (1 - (d2 / (raio * raio)) * 0.35);
          if (calor[i] < v) calor[i] = v;
        }
      }
    }
    vento += (ventoAlvo - vento) * 0.12;
    ventoAlvo *= 0.96;
    labareda *= 0.9;
    const resfriar = (R * 1.3) / (H * 0.5);
    // advecção: cada célula puxa o calor de R linhas abaixo, deslocado pela turbulência
    let k = (Math.random() * 65536) | 0;
    for (let y = 0; y < H - R; y++) {
      const amp = 0.4 + 1.8 * (1 - y / H);
      const linhaAbaixo = (y + R) * W;
      const linha = y * W;
      const sy1 = tabSy1[y] * 0.35;
      const sy2 = tabSy2[y];
      const ventoLinha = vento * 2.2 * (1 - y / H);
      for (let x = 0; x < W; x++) {
        const n1 = RUIDO[(k = (k + 1) & 65535)];
        const n2 = RUIDO[(k + 32771) & 65535];
        let sx = x + (sy1 + tabSx1[x] * 0.8 + sy2 * tabSx2[x] * 1.2 + (n1 - 0.5) * 1.1) * amp + ventoLinha;
        sx = sx < 1 ? 1 : sx > W - 2 ? W - 2 : sx;
        const p = linhaAbaixo + ((sx + 0.5) | 0);
        const v = (calor[p - 1] + 2 * calor[p] + calor[p + 1]) * 0.25 - resfriar * (0.35 + 1.3 * n2);
        calor[linha + x] = v > 0 ? v : 0;
      }
    }
    // faíscas: nascem de dentro da chama, sobem com rastro
    if (fagulhas.length < 260) lancar(aleatorio() < 0.5 ? 2 : 1, null);
    const dt = 1 / 60;
    for (let i = fagulhas.length - 1; i >= 0; i--) {
      const f = fagulhas[i];
      f.vx += (aleatorio() - 0.5) * 220 * dt * dpr + vento * 40 * dt * dpr;
      f.vy -= 40 * dt * dpr;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vida -= dt;
      if (f.vida <= 0 || f.y < -20) fagulhas.splice(i, 1);
    }
  }

  function lancar(n, em) {
    for (let i = 0; i < n; i++) {
      const base = em || { x: aleatorio() * largura, y: altura - aleatorio() * altura * 0.22 };
      fagulhas.push({
        x: base.x,
        y: base.y,
        vx: (aleatorio() - 0.5) * 140 * dpr,
        vy: -(260 + aleatorio() * 520) * dpr,
        vida: 0.9 + aleatorio() * 2.2,
        vidaMax: 3.1,
        tam: (1 + aleatorio() * 2.2) * dpr,
      });
    }
  }

  function desenhar() {
    const total = cols * rows;
    for (let i = 0; i < total; i++) {
      let h = calor[i] / ESCALA_CALOR;
      if (h > 1) h = 1;
      pixels[i] = tabela[(h * 255) | 0];
    }
    simCtx.putImageData(imagem, 0, 0);
    ctxBrilho.clearRect(0, 0, brilho.width, brilho.height);
    ctxBrilho.imageSmoothingEnabled = true;
    ctxBrilho.drawImage(sim, 0, 0, brilho.width, brilho.height);
    contaLuz++;
    if (contaLuz % 4 === 0) {
      let soma = 0;
      const n = Math.min(cols, 64);
      const linha = Math.max(0, rows - 40);
      for (let x = 0; x < n; x++) soma += calor[linha * cols + Math.floor((x / n) * cols)];
      secao.style.setProperty("--luz", Math.min(1, soma / n / 1.1).toFixed(2));
    }
  }

  function pintarQuadro() {
    ctx.clearRect(0, 0, largura, altura);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sim, 0, 0, largura, altura);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const f of fagulhas) {
      const k = Math.max(0, f.vida / f.vidaMax);
      ctx.globalAlpha = Math.min(1, k * 2.4);
      ctx.strokeStyle = `rgb(255,${Math.round(110 + 120 * k)},${Math.round(30 + 60 * k)})`;
      ctx.lineWidth = f.tam * (0.5 + k);
      ctx.beginPath();
      ctx.moveTo(f.x - f.vx * 0.06, f.y - f.vy * 0.06);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      const s = f.tam * 3.2;
      ctx.drawImage(sprite, f.x - s, f.y - s, s * 2, s * 2);
    }
    ctx.restore();
  }

  function quadro(agora) {
    if (!ligado) return;
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    acumulado += dt;
    let passos = 0;
    while (acumulado >= 1 / 60 && passos < 3) {
      passo();
      acumulado -= 1 / 60;
      passos++;
    }
    if (passos > 0) desenhar();
    pintarQuadro();
    quadros++;
    if (agora - ultimaMedida >= 500) {
      if (aoMedir) aoMedir(Math.round((quadros * 1000) / (agora - ultimaMedida)));
      quadros = 0;
      ultimaMedida = agora;
    }
    requestAnimationFrame(quadro);
  }

  secao.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    ponteiro = { x: (e.clientX - r.left) * (largura / r.width), y: (e.clientY - r.top) * (altura / r.height) };
    if (ultimoX !== null) ventoAlvo = Math.max(-1, Math.min(1, ventoAlvo + (e.clientX - ultimoX) / 30));
    ultimoX = e.clientX;
  });
  secao.addEventListener("pointerleave", () => {
    ponteiro = null;
    ultimoX = null;
  });
  secao.addEventListener("pointerdown", () => {
    labareda = 1;
    lancar(50, ponteiro ? { x: ponteiro.x, y: ponteiro.y } : null);
  });
  new ResizeObserver(medir).observe(secao);

  return {
    ligar() {
      if (ligado) return;
      ligado = true;
      ultimo = performance.now();
      quadros = 0;
      ultimaMedida = performance.now();
      requestAnimationFrame(quadro);
    },
    desligar() {
      ligado = false;
    },
    congelar() {
      ligado = false;
      for (let i = 0; i < 40; i++) passo();
      desenhar();
      pintarQuadro();
    },
  };
}
