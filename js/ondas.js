// Ondas em ASCII sobre papel: a equação da onda numa grade de letras.
// Cada célula guarda altura e velocidade; a letra e a cor vêm da altura
// (crista em tinta, vale em laranja de brasa). O mouse mexe na água, o
// clique joga uma pedra grande, e de tempos em tempos cai uma gota sozinha.

const RAMPA = " .,:;-=+*#%@";
const NIVEIS = 40;
const AMPLITUDE = 0.9;

function misturar(a, b, k) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * k));
}

export function criarOndas(secao, canvas, { aoInformar } = {}) {
  const ctx = canvas.getContext("2d");
  const PAPEL = [236, 227, 210];
  const TINTA = [26, 21, 18];
  const BRASA = [184, 51, 10];

  let dpr = 1;
  let cw = 8;
  let ch = 14;
  let tamFonte = 14;
  let cols = 0;
  let rows = 0;
  let altura = new Float32Array(0);
  let velocidade = new Float32Array(0);
  let atlas = null;
  let ligado = false;
  let ultimo = 0;
  let acumulado = 0;
  let proximaGota = 1;
  let ultimoPonto = null;

  function montarAtlas() {
    atlas = document.createElement("canvas");
    atlas.width = NIVEIS * 2 * cw;
    atlas.height = ch;
    const a = atlas.getContext("2d");
    a.font = `500 ${tamFonte}px "JetBrains Mono", Consolas, monospace`;
    a.textBaseline = "alphabetic";
    for (let l = 0; l < NIVEIS; l++) {
      const m = l / (NIVEIS - 1);
      const ci = Math.max(1, Math.min(RAMPA.length - 1, Math.round(Math.sqrt(m) * (RAMPA.length - 1))));
      for (let lado = 0; lado < 2; lado++) {
        const [r, g, b] = misturar(PAPEL, lado === 0 ? TINTA : BRASA, 0.3 + 0.7 * m);
        a.fillStyle = `rgb(${r},${g},${b})`;
        a.fillText(RAMPA[ci], (l * 2 + lado) * cw, ch * 0.78);
      }
    }
  }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = secao.clientWidth;
    const h = secao.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    tamFonte = Math.min(18, Math.max(11, w / 240)) * dpr;
    const sonda = document.createElement("canvas").getContext("2d");
    sonda.font = `500 ${tamFonte}px "JetBrains Mono", Consolas, monospace`;
    cw = Math.max(4, Math.round(sonda.measureText("M").width));
    ch = Math.round(tamFonte * 1.18);
    cols = Math.floor(canvas.width / cw);
    rows = Math.floor(canvas.height / ch);
    altura = new Float32Array(cols * rows);
    velocidade = new Float32Array(cols * rows);
    montarAtlas();
    soltar(Math.floor(cols * 0.5), Math.floor(rows * 0.55), 5, 3);
    for (let i = 0; i < 60; i++) passo();
    desenhar();
    if (aoInformar) aoInformar({ texto: `${cols} × ${rows} células · ${(cols * rows / 1000).toFixed(1)} mil letras` });
  }

  // abaixa a água num disco; valor negativo = afunda (e depois sobe, formando a onda)
  function soltar(cx, cy, raio, forca) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio * 2; dx <= raio * 2; dx++) {
        const d = Math.hypot(dx / 2, dy);
        if (d > raio) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) continue;
        altura[y * cols + x] -= forca * (1 - d / raio);
      }
    }
  }

  function passo() {
    const W = cols;
    const H = rows;
    // a célula é mais alta que larga; o peso vertical compensa para a onda sair redonda
    const wy = (cw / ch) * (cw / ch);
    const c = 0.42;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const lap = altura[i - 1] + altura[i + 1] - 2 * altura[i] + (altura[i - W] + altura[i + W] - 2 * altura[i]) * wy;
        velocidade[i] = (velocidade[i] + lap * c) * 0.994;
      }
    }
    for (let i = 0; i < altura.length; i++) altura[i] += velocidade[i];
  }

  function desenhar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = cols;
    for (let y = 0; y < rows; y++) {
      const py = y * ch;
      for (let x = 0; x < W; x++) {
        const a = altura[y * W + x];
        let m = Math.abs(a) / AMPLITUDE;
        if (m < 0.04) continue;
        if (m > 1) m = 1;
        const nivel = Math.round(m * (NIVEIS - 1));
        ctx.drawImage(atlas, (nivel * 2 + (a > 0 ? 0 : 1)) * cw, 0, cw, ch, x * cw, py, cw, ch);
      }
    }
  }

  function quadro(agora) {
    if (!ligado) return;
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    acumulado += dt;
    proximaGota -= dt;
    if (proximaGota <= 0) {
      soltar(2 + Math.floor(Math.random() * (cols - 4)), 2 + Math.floor(Math.random() * (rows - 4)), 3, 2.4);
      proximaGota = 1.2 + Math.random() * 1.6;
    }
    let passos = 0;
    while (acumulado >= 1 / 60 && passos < 3) {
      passo();
      acumulado -= 1 / 60;
      passos++;
    }
    if (passos > 0) desenhar();
    requestAnimationFrame(quadro);
  }

  function celulaDe(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * cols),
      y: Math.floor(((e.clientY - r.top) / r.height) * rows),
    };
  }

  secao.addEventListener("pointermove", (e) => {
    const p = celulaDe(e);
    if (ultimoPonto) {
      const v = Math.hypot(p.x - ultimoPonto.x, (p.y - ultimoPonto.y) * 0.6);
      if (v > 0.5) soltar(p.x, p.y, 2, Math.min(1.1, 0.25 + v * 0.08));
    }
    ultimoPonto = p;
  });
  secao.addEventListener("pointerleave", () => {
    ultimoPonto = null;
  });
  secao.addEventListener("pointerdown", (e) => {
    const p = celulaDe(e);
    soltar(p.x, p.y, 6, 7);
  });
  new ResizeObserver(medir).observe(secao);

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
    congelar() {
      ligado = false;
      desenhar();
    },
  };
}
