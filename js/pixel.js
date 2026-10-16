// Fogueira em pixel art: cena de 160 × 90 desenhada por código, com cor
// quantizada (6 níveis por canal) e pontilhado de Bayer 4 × 4. A chama é uma
// grade pequena de calor que vira oito cores da paleta; a luz dela sobe
// pelas pedras, pinheiros e chão.

export const LARGURA = 160;
export const ALTURA = 90;

const FOGO_X = 80;
const BASE_Y = 69;
const FW = 34;
const FH = 46;
const NIVEIS_COR = 8;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const limiar = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

// índice 0 = vazio
const PALETA_FOGO = [
  null,
  [70, 10, 8],
  [122, 20, 8],
  [184, 40, 10],
  [232, 88, 22],
  [255, 142, 40],
  [255, 200, 72],
  [255, 244, 176],
];

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function misturar(a, b, k) {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function criarPixel(canvas, { aoInformar } = {}) {
  const ctx = canvas.getContext("2d");
  const imagem = ctx.createImageData(LARGURA, ALTURA);
  const dados = imagem.data;

  const base = new Float32Array(LARGURA * ALTURA * 3);
  const luzFator = new Float32Array(LARGURA * ALTURA); // luz da fogueira que cada pixel recebe
  const emissivo = new Uint8Array(LARGURA * ALTURA); // 1 = tronco de trás (brasa viva)
  const frente = []; // pixels que ficam na frente da chama: { i, r, g, b, brasa }
  const estrelas = [];

  const calor = new Float32Array(FW * FH);
  const fagulhas = [];
  let tempo = 0;
  let vento = 0;
  let ventoAlvo = 0;
  let labareda = 0;
  let ligado = false;
  let ultimo = 0;
  let acumulado = 0;
  let proximaCadente = 6;
  let cadente = null;
  let ultimoX = null;
  let escala = 1;

  function pintar(x, y, rgb) {
    if (x < 0 || x >= LARGURA || y < 0 || y >= ALTURA) return;
    const i = (y * LARGURA + x) * 3;
    base[i] = rgb[0];
    base[i + 1] = rgb[1];
    base[i + 2] = rgb[2];
  }

  function pinheiro(cx, baseY, altura, cor) {
    for (let r = 0; r < altura; r++) {
      const meia = Math.floor(r * 0.42) + 1;
      const y = baseY - altura + r;
      for (let x = cx - meia; x <= cx + meia; x++) {
        const ruido = hash(x, y) * 6;
        pintar(x, y, [cor[0] + ruido, cor[1] + ruido, cor[2] + ruido * 1.4]);
      }
    }
    for (let y = baseY - 3; y < baseY; y++) {
      pintar(cx, y, [20, 14, 12]);
      pintar(cx + 1, y, [20, 14, 12]);
    }
  }

  function montarCena() {
    // céu
    for (let y = 0; y < ALTURA; y++) {
      const k = Math.min(1, y / 62);
      const topo = [6, 6, 20];
      const meio = [26, 18, 48];
      const horizonte = [66, 34, 58];
      const cor = k < 0.6 ? misturar(topo, meio, k / 0.6) : misturar(meio, horizonte, (k - 0.6) / 0.4);
      for (let x = 0; x < LARGURA; x++) pintar(x, y, cor);
    }
    // lua com cratera e halo
    const lx = 126;
    const ly = 17;
    for (let y = ly - 14; y <= ly + 14; y++) {
      for (let x = lx - 14; x <= lx + 14; x++) {
        const d = Math.hypot(x - lx, y - ly);
        const i = (y * LARGURA + x) * 3;
        if (d < 7) {
          let c = [236, 230, 200];
          if (hash(x, y) > 0.82 || Math.hypot(x - (lx - 2), y - (ly + 1)) < 1.6) c = [196, 190, 164];
          pintar(x, y, c);
        } else if (d < 13) {
          const k = (1 - (d - 7) / 6) * 0.35;
          base[i] += 90 * k;
          base[i + 1] += 90 * k;
          base[i + 2] += 110 * k;
        }
      }
    }
    // estrelas (animadas depois, só guardamos a posição)
    for (let n = 0; n < 70; n++) {
      const x = 2 + Math.floor(hash(n, 1) * (LARGURA - 4));
      const y = 2 + Math.floor(hash(n, 2) * 48);
      if (Math.hypot(x - lx, y - ly) < 15) continue;
      estrelas.push({ x, y, fase: hash(n, 3) * 6.28, vel: 0.8 + hash(n, 4) * 2.4, forte: hash(n, 5) > 0.8 });
    }
    // colinas ao fundo, pinheiros distantes, colina da frente, chão
    for (let x = 0; x < LARGURA; x++) {
      const topo = Math.round(57 + 4 * Math.sin(x * 0.045 + 0.6) + 2.5 * Math.sin(x * 0.12 + 2));
      for (let y = topo; y < ALTURA; y++) pintar(x, y, [26, 20, 40]);
    }
    for (const [cx, by, h] of [[22, 61, 12], [46, 60, 9], [112, 60, 10], [140, 61, 13], [96, 59, 8]]) {
      pinheiro(cx, by, h, [14, 14, 30]);
    }
    for (let x = 0; x < LARGURA; x++) {
      const topo = Math.round(65 + 2.5 * Math.sin(x * 0.07 + 3) + 1.5 * Math.sin(x * 0.19));
      for (let y = topo; y < ALTURA; y++) {
        const capim = hash(x >> 1, y) > 0.7 ? 6 : 0;
        pintar(x, y, [28 + capim, 21 + capim, 28 + capim]);
      }
    }
    for (const [cx, by, h] of [[10, 76, 26], [30, 80, 20], [150, 78, 28], [132, 82, 19]]) {
      pinheiro(cx, by, h, [8, 9, 15]);
    }
    // reflexão de cada pixel: o chão e as copas perto da fogueira pegam muita luz, o céu pouca
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const dx = x - FOGO_X;
        const dy = (y - (BASE_Y - 3)) * 1.55;
        const d2 = dx * dx + dy * dy;
        const reflete = y > 52 ? 1 : 0.18;
        luzFator[y * LARGURA + x] = Math.exp(-d2 / (2 * 26 * 26)) * reflete;
      }
    }
    montarPedrasETroncos();
  }

  function montarPedrasETroncos() {
    function troncoBase(x, y, i) {
      const brilho = hash(x, y) > 0.6 ? 1 : 0;
      return brilho ? [92, 60, 34] : [58, 36, 20];
    }
    const segmento = (ax, ay, bx, by, espessura, naFrente) => {
      const vx = bx - ax;
      const vy = by - ay;
      const comp2 = vx * vx + vy * vy;
      for (let y = Math.min(ay, by) - 3; y <= Math.max(ay, by) + 3; y++) {
        for (let x = Math.min(ax, bx) - 3; x <= Math.max(ax, bx) + 3; x++) {
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / comp2));
          const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
          if (d > espessura / 2) continue;
          let cor = troncoBase(x, y);
          if (d > espessura / 2 - 1) cor = misturar(cor, [24, 14, 8], 0.5);
          if (naFrente) {
            const i = y * LARGURA + x;
            frente.push({ i, r: cor[0], g: cor[1], b: cor[2], brasa: true });
          } else {
            pintar(x, y, cor);
            emissivo[y * LARGURA + x] = 1;
          }
        }
      }
    };
    segmento(66, 72, 95, 66, 4, false);
    segmento(66, 66, 95, 72, 4, true);
    // anel de pedras
    const n = 12;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + 0.3;
      const px = Math.round(FOGO_X + Math.cos(ang) * 21);
      const py = Math.round(BASE_Y + 2 + Math.sin(ang) * 5.5);
      const gris = 22 + Math.floor(hash(k, 9) * 16);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 5; x++) {
          if ((x === 0 || x === 4) && (y === 0 || y === 2)) continue;
          const cor = [gris + (y === 0 ? 10 : 0), gris - 2 + (y === 0 ? 10 : 0), gris + 8 + (y === 0 ? 10 : 0)];
          const xx = px + x - 2;
          const yy = py + y - 1;
          if (yy >= BASE_Y + 1) {
            frente.push({ i: yy * LARGURA + xx, r: cor[0], g: cor[1], b: cor[2], brasa: false });
          } else {
            pintar(xx, yy, cor);
          }
        }
      }
    }
  }

  function ruidoSuave(t, f) {
    return 0.5 + 0.5 * (Math.sin(t * f) * 0.5 + Math.sin(t * f * 2.3 + 1.7) * 0.3 + Math.sin(t * f * 4.1 + 0.4) * 0.2);
  }

  function passoFogo() {
    tempo += 1 / 24;
    const centro = (FW - 1) / 2;
    const fli = 0.85 + 0.3 * ruidoSuave(tempo, 5);
    for (let x = 0; x < FW; x++) {
      const d = (x - centro) / (FW / 2);
      const lambida = 0.5 + 0.9 * ruidoSuave(tempo * 1.4 + x * 0.9, 7);
      const fonte = 1.3 * Math.exp(-d * d * 4.2) * fli * lambida * (0.85 + 0.3 * Math.random()) + labareda * 0.5;
      calor[(FH - 1) * FW + x] = fonte;
      calor[(FH - 2) * FW + x] = Math.max(calor[(FH - 2) * FW + x], fonte * 0.9);
    }
    vento += (ventoAlvo - vento) * 0.12;
    ventoAlvo *= 0.95;
    labareda *= 0.88;
    for (let y = 0; y < FH - 2; y++) {
      for (let x = 0; x < FW; x++) {
        let deslocamento = 0;
        if (Math.random() < Math.abs(vento)) deslocamento = vento < 0 ? 1 : -1; // vento da esquerda empurra a chama para a direita
        const sx = Math.max(0, Math.min(FW - 1, x + deslocamento));
        const sxl = Math.max(0, sx - 1);
        const sxr = Math.min(FW - 1, sx + 1);
        const abaixo = (y + 1) * FW;
        const media = (calor[abaixo + sxl] + 2 * calor[abaixo + sx] + calor[abaixo + sxr]) / 4;
        const lateral = Math.abs(x - centro) / (FW / 2);
        const queda = Math.random() * 0.042 + 0.006 + lateral * lateral * 0.045;
        const v = media - queda;
        calor[y * FW + x] = v > 0 ? v : 0;
      }
    }
    // faíscas
    if (fagulhas.length < 70 && Math.random() < 0.28) lancar(1);
    for (let i = fagulhas.length - 1; i >= 0; i--) {
      const f = fagulhas[i];
      f.x += f.vx / 24 + vento * 0.25;
      f.y += f.vy / 24;
      f.vx += (Math.random() - 0.5) * 3;
      f.vida -= 1 / 24;
      if (f.vida <= 0 || f.y < 2) fagulhas.splice(i, 1);
    }
    // estrela cadente
    proximaCadente -= 1 / 24;
    if (proximaCadente <= 0 && !cadente) {
      cadente = { x: 20 + Math.random() * 60, y: 4 + Math.random() * 16, vida: 0 };
      proximaCadente = 9 + Math.random() * 7;
    }
    if (cadente) {
      cadente.vida += 1 / 24;
      cadente.x += 80 / 24;
      cadente.y += 36 / 24;
      if (cadente.vida > 0.9) cadente = null;
    }
  }

  function lancar(n) {
    for (let i = 0; i < n; i++) {
      fagulhas.push({
        x: FOGO_X + (Math.random() - 0.5) * 12,
        y: BASE_Y - 8 - Math.random() * 22,
        vx: (Math.random() - 0.5) * 12,
        vy: -(9 + Math.random() * 20),
        vida: 1.4 + Math.random() * 2.4,
        vidaMax: 3.8,
      });
    }
  }

  function quantizar(c, x, y, canal) {
    const v = (c / 255) * (NIVEIS_COR - 1);
    const lo = Math.floor(v);
    const frac = v - lo;
    const t = limiar(x + canal * 2, y + canal);
    const nivel = lo + (frac > t ? 1 : 0);
    return Math.min(255, Math.round((nivel * 255) / (NIVEIS_COR - 1)));
  }

  function pixel(x, y, r, g, b) {
    if (x < 0 || x >= LARGURA || y < 0 || y >= ALTURA) return;
    const k = (y * LARGURA + x) * 4;
    dados[k] = r;
    dados[k + 1] = g;
    dados[k + 2] = b;
    dados[k + 3] = 255;
  }

  function desenhar() {
    const flick = 0.82 + 0.3 * ruidoSuave(tempo, 6.5) + labareda * 0.35;
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const p = y * LARGURA + x;
        const i = p * 3;
        const l = Math.min(1, luzFator[p] * flick);
        let r = base[i] * (1 + 2.2 * l) + 78 * l;
        let g = base[i + 1] * (1 + 2.2 * l) + 34 * l;
        let b = base[i + 2] * (1 + 2.2 * l) + 10 * l;
        if (emissivo[p]) {
          const brasa = ruidoSuave(tempo * 1.3 + x * 0.7 + y * 1.9, 3) * Math.min(1, luzFator[p] * 2.2);
          r += 255 * brasa * 0.6;
          g += 70 * brasa * 0.6;
          b += 10 * brasa * 0.6;
        }
        pixel(x, y, quantizar(Math.min(255, r), x, y, 0), quantizar(Math.min(255, g), x, y, 1), quantizar(Math.min(255, b), x, y, 2));
      }
    }
    // estrelas
    for (const e of estrelas) {
      const v = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tempo * e.vel + e.fase));
      const c = Math.round((e.forte ? 255 : 190) * v);
      pixel(e.x, e.y, c, c, Math.min(255, c + 30));
      if (e.forte && v > 0.85) {
        pixel(e.x - 1, e.y, c * 0.5, c * 0.5, c * 0.6);
        pixel(e.x + 1, e.y, c * 0.5, c * 0.5, c * 0.6);
        pixel(e.x, e.y - 1, c * 0.5, c * 0.5, c * 0.6);
        pixel(e.x, e.y + 1, c * 0.5, c * 0.5, c * 0.6);
      }
    }
    if (cadente) {
      for (let k = 0; k < 12; k++) {
        const f = 1 - k / 12;
        const a = (1 - cadente.vida / 0.9) * f;
        const c = Math.round(255 * a);
        pixel(Math.round(cadente.x - k * 1.8), Math.round(cadente.y - k * 0.8), c, c, c);
      }
    }
    // chama (oito cores, pontilhada entre uma banda e outra)
    const x0 = FOGO_X - Math.floor(FW / 2);
    const y0 = BASE_Y - FH + 3;
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const h = calor[y * FW + x];
        if (h < 0.05) continue;
        const px = x0 + x;
        const py = y0 + y;
        const idx = Math.min(7, Math.floor(h * 7 + (limiar(px, py) - 0.5) * 1.1));
        if (idx < 1) continue;
        const c = PALETA_FOGO[idx];
        pixel(px, py, c[0], c[1], c[2]);
      }
    }
    // tronco da frente e pedras da frente
    for (const f of frente) {
      const x = f.i % LARGURA;
      const y = (f.i / LARGURA) | 0;
      const l = Math.min(1, luzFator[f.i] * flick);
      let r = f.r * (1 + 2.2 * l) + 78 * l;
      let g = f.g * (1 + 2.2 * l) + 34 * l;
      let b = f.b * (1 + 2.2 * l) + 10 * l;
      if (f.brasa) {
        const brasa = ruidoSuave(tempo * 1.3 + x * 0.7 + y * 1.9, 3) * 0.8;
        r += 255 * brasa * 0.5;
        g += 70 * brasa * 0.5;
      }
      pixel(x, y, quantizar(Math.min(255, r), x, y, 0), quantizar(Math.min(255, g), x, y, 1), quantizar(Math.min(255, b), x, y, 2));
    }
    // faíscas
    for (const f of fagulhas) {
      const k = Math.max(0, f.vida / f.vidaMax);
      const idx = Math.max(2, Math.min(7, Math.round(2 + k * 6)));
      if (k < 0.3 && Math.random() < 0.4) continue;
      const c = PALETA_FOGO[idx];
      pixel(Math.round(f.x), Math.round(f.y), c[0], c[1], c[2]);
    }
    ctx.putImageData(imagem, 0, 0);
  }

  function quadro(agora) {
    if (!ligado) return;
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    acumulado += dt;
    const intervalo = 1 / 24;
    let passos = 0;
    while (acumulado >= intervalo && passos < 3) {
      passoFogo();
      acumulado -= intervalo;
      passos++;
    }
    if (passos > 0) desenhar();
    requestAnimationFrame(quadro);
  }

  function ajustarEscala() {
    const pai = canvas.closest(".bloco");
    const disponivelL = (pai ? pai.clientWidth : window.innerWidth) * 0.92;
    const disponivelA = window.innerHeight * 0.74;
    escala = Math.max(1, Math.floor(Math.min(disponivelL / LARGURA, disponivelA / ALTURA)));
    canvas.style.width = `${LARGURA * escala}px`;
    canvas.style.height = `${ALTURA * escala}px`;
    if (aoInformar) {
      aoInformar({ texto: `${LARGURA} × ${ALTURA} pixels · cada um com ${escala} × ${escala} da sua tela`, escala });
    }
  }

  canvas.addEventListener("pointermove", (e) => {
    if (ultimoX !== null) ventoAlvo = Math.max(-1, Math.min(1, ventoAlvo + (e.clientX - ultimoX) / 30));
    ultimoX = e.clientX;
  });
  canvas.addEventListener("pointerleave", () => {
    ultimoX = null;
  });
  canvas.addEventListener("pointerdown", () => {
    labareda = 1;
    lancar(26);
  });

  montarCena();
  ajustarEscala();
  new ResizeObserver(ajustarEscala).observe(canvas.closest(".bloco") || document.body);
  for (let i = 0; i < 80; i++) passoFogo();
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
