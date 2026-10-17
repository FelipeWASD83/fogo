// Lava em pixel art: metabolas num campo de 192 × 108 pixels, pintadas com
// seis cores e pontilhado de Bayer 4 × 4 entre uma faixa e outra. O campo
// preenche a seção inteira (escala inteira, cobrindo a tela). O mouse é uma
// bola maior que atrai as outras; o clique dá um empurrão em todas.

export const LARGURA = 192;
export const ALTURA = 108;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const limiar = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// do papel até a tinta
const PALETA = [
  [236, 227, 210],
  [242, 201, 164],
  [255, 138, 74],
  [255, 90, 31],
  [184, 51, 10],
  [26, 21, 18],
];

export function criarLava(secao, canvas, { aoInformar } = {}) {
  const ctx = canvas.getContext("2d");
  const imagem = ctx.createImageData(LARGURA, ALTURA);
  const dados = imagem.data;
  const campo = new Float32Array(LARGURA * ALTURA);
  const bolas = [];
  let ligado = false;
  let ultimo = 0;
  let tempo = 0;
  let escala = 1;
  let ponteiro = null; // em pixels da grade

  for (let i = 0; i < 8; i++) {
    bolas.push({
      x: Math.random() * LARGURA,
      y: Math.random() * ALTURA,
      vx: (Math.random() - 0.5) * 22,
      vy: (Math.random() - 0.5) * 22,
      r: 9 + Math.random() * 11,
      fase: Math.random() * 6.28,
    });
  }

  function passo(dt) {
    tempo += dt;
    for (const b of bolas) {
      // movimento próprio, ondulando, e rebate nas bordas
      b.vx += Math.sin(tempo * 0.7 + b.fase) * 6 * dt;
      b.vy += Math.cos(tempo * 0.5 + b.fase * 1.7) * 6 * dt;
      if (ponteiro) {
        const dx = ponteiro.x - b.x;
        const dy = ponteiro.y - b.y;
        const d = Math.hypot(dx, dy) + 8;
        b.vx += (dx / d) * 160 * dt / (1 + d * 0.04);
        b.vy += (dy / d) * 160 * dt / (1 + d * 0.04);
      }
      const v = Math.hypot(b.vx, b.vy);
      const max = 38;
      if (v > max) {
        b.vx *= max / v;
        b.vy *= max / v;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r * 0.4) b.vx = Math.abs(b.vx);
      if (b.x > LARGURA - b.r * 0.4) b.vx = -Math.abs(b.vx);
      if (b.y < b.r * 0.4) b.vy = Math.abs(b.vy);
      if (b.y > ALTURA - b.r * 0.4) b.vy = -Math.abs(b.vy);
    }
  }

  function desenhar() {
    const lista = ponteiro ? [...bolas, { x: ponteiro.x, y: ponteiro.y, r: 14 }] : bolas;
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        let f = 0;
        for (const b of lista) {
          const dx = x - b.x;
          const dy = y - b.y;
          f += (b.r * b.r) / (dx * dx + dy * dy + 4);
        }
        // faixas: 0 = papel, 5 = tinta no miolo das bolas
        const v = Math.min(5.99, Math.max(0, (f - 0.35) * 3.1) + (limiar(x, y) - 0.5) * 0.95);
        const faixa = v < 0 ? 0 : Math.floor(v);
        const c = PALETA[faixa];
        const k = (y * LARGURA + x) * 4;
        dados[k] = c[0];
        dados[k + 1] = c[1];
        dados[k + 2] = c[2];
        dados[k + 3] = 255;
      }
    }
    ctx.putImageData(imagem, 0, 0);
  }

  function ajustarEscala() {
    const w = secao.clientWidth;
    const h = secao.clientHeight;
    escala = Math.max(1, Math.ceil(Math.max(w / LARGURA, h / ALTURA)));
    const cw = LARGURA * escala;
    const ch = ALTURA * escala;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    canvas.style.left = `${Math.round((w - cw) / 2)}px`;
    canvas.style.top = `${Math.round((h - ch) / 2)}px`;
    if (aoInformar) aoInformar({ texto: `${LARGURA} × ${ALTURA} pixels · cada um com ${escala} × ${escala} da sua tela` });
  }

  function quadro(agora) {
    if (!ligado) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    passo(dt);
    desenhar();
    requestAnimationFrame(quadro);
  }

  function noGrade(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * LARGURA, y: ((e.clientY - r.top) / r.height) * ALTURA };
  }

  secao.addEventListener("pointermove", (e) => {
    ponteiro = noGrade(e);
  });
  secao.addEventListener("pointerleave", () => {
    ponteiro = null;
  });
  secao.addEventListener("pointerdown", (e) => {
    const p = noGrade(e);
    for (const b of bolas) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const d = Math.hypot(dx, dy) + 6;
      b.vx += (dx / d) * 260;
      b.vy += (dy / d) * 260;
    }
  });
  new ResizeObserver(ajustarEscala).observe(secao);
  ajustarEscala();
  for (let i = 0; i < 90; i++) passo(1 / 30);
  desenhar();

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
