// Fluxo: milhares de partículas seguindo um campo de correntes que muda com
// o tempo, deixando rastro de luz. O mouse é um redemoinho que puxa e gira as
// partículas ao redor; o clique solta uma onda de choque que as afasta.

const GRUPOS = [
  { cor: "rgba(255,90,31,0.9)", parte: 0.45 },
  { cor: "rgba(255,176,64,0.8)", parte: 0.35 },
  { cor: "rgba(243,234,217,0.6)", parte: 0.2 },
];
const FUNDO = "13,11,10";

export function criarFluxo(secao, canvas, { aoInformar } = {}) {
  const ctx = canvas.getContext("2d");
  let dpr = 1;
  let w = 0;
  let h = 0;
  let n = 0;
  let px = new Float32Array(0);
  let py = new Float32Array(0);
  let ax = new Float32Array(0);
  let ay = new Float32Array(0);
  let vida = new Float32Array(0);
  let grupo = new Uint8Array(0);
  let ligado = false;
  let ultimo = 0;
  let tempo = 0;
  let ponteiro = null;
  let choque = null; // { x, y, t }

  function nascer(i, espalhar) {
    px[i] = Math.random() * w;
    py[i] = Math.random() * h;
    ax[i] = px[i];
    ay[i] = py[i];
    vida[i] = espalhar ? Math.random() * 5 : 2 + Math.random() * 4;
  }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(secao.clientWidth * dpr);
    h = Math.round(secao.clientHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    n = Math.max(5000, Math.min(22000, Math.round((secao.clientWidth * secao.clientHeight) / 160)));
    px = new Float32Array(n);
    py = new Float32Array(n);
    ax = new Float32Array(n);
    ay = new Float32Array(n);
    vida = new Float32Array(n);
    grupo = new Uint8Array(n);
    let acumulado = 0;
    let g = 0;
    for (let i = 0; i < n; i++) {
      if (i / n >= acumulado + GRUPOS[g].parte && g < GRUPOS.length - 1) {
        acumulado += GRUPOS[g].parte;
        g++;
      }
      grupo[i] = g;
      nascer(i, true);
    }
    ctx.fillStyle = `rgb(${FUNDO})`;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) passo(1 / 60, false);
    if (aoInformar) aoInformar({ texto: `${n.toLocaleString("pt-BR")} partículas com rastro` });
  }

  function passo(dt, desenhar = true) {
    tempo += dt;
    const t = tempo;
    const esc = 1 / (900 * dpr);
    if (choque) {
      choque.t += dt;
      if (choque.t > 1.2) choque = null;
    }
    for (let i = 0; i < n; i++) {
      ax[i] = px[i];
      ay[i] = py[i];
      const x = px[i] * esc;
      const y = py[i] * esc;
      // correntes sem divergência (rotacional de um potencial): as partículas não se juntam em fios
      const f1 = x * 5.2 + t * 0.22;
      const f2 = y * 6.1 - t * 0.17;
      const f3 = (x + y) * 3.1 + t * 0.1;
      let vx = (-6.1 * Math.sin(f1) * Math.sin(f2) * 0.65 + 3.1 * Math.cos(f3) * 0.55) * 30 * dpr;
      let vy = (-5.2 * Math.cos(f1) * Math.cos(f2) * 0.65 - 3.1 * Math.cos(f3) * 0.55) * 30 * dpr;
      if (ponteiro) {
        const dx = ponteiro.x - px[i];
        const dy = ponteiro.y - py[i];
        const d2 = dx * dx + dy * dy;
        const raio = 380 * dpr;
        if (d2 < raio * raio) {
          const d = Math.sqrt(d2) + 20 * dpr;
          const f = 1 - d / raio;
          // puxa para o mouse e gira ao redor dele
          vx += (dx / d) * 260 * f * dpr + (-dy / d) * 340 * f * dpr;
          vy += (dy / d) * 260 * f * dpr + (dx / d) * 340 * f * dpr;
        }
      }
      if (choque) {
        const dx = px[i] - choque.x;
        const dy = py[i] - choque.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 1;
        const frente = choque.t * 1500 * dpr;
        const dist = Math.abs(d - frente);
        if (dist < 140 * dpr) {
          const f = (1 - dist / (140 * dpr)) * (1 - choque.t / 1.2);
          vx += (dx / d) * 1400 * f * dpr;
          vy += (dy / d) * 1400 * f * dpr;
        }
      }
      px[i] += vx * dt;
      py[i] += vy * dt;
      vida[i] -= dt;
      if (vida[i] <= 0 || px[i] < -10 || px[i] > w + 10 || py[i] < -10 || py[i] > h + 10) nascer(i, false);
    }
    if (!desenhar) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(${FUNDO},${(1 - Math.exp(-dt * 1.4)).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = Math.max(1.4, dpr * 1.4);
    ctx.lineCap = "round";
    for (let g = 0; g < GRUPOS.length; g++) {
      ctx.strokeStyle = GRUPOS[g].cor;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (grupo[i] !== g) continue;
        if (Math.abs(px[i] - ax[i]) > 80 || Math.abs(py[i] - ay[i]) > 80) continue;
        ctx.moveTo(ax[i], ay[i]);
        ctx.lineTo(px[i], py[i]);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function quadro(agora) {
    if (!ligado) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    passo(dt);
    requestAnimationFrame(quadro);
  }

  function noCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h };
  }

  secao.addEventListener("pointermove", (e) => {
    ponteiro = noCanvas(e);
  });
  secao.addEventListener("pointerleave", () => {
    ponteiro = null;
  });
  secao.addEventListener("pointerdown", (e) => {
    const p = noCanvas(e);
    choque = { x: p.x, y: p.y, t: 0 };
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
      for (let i = 0; i < 160; i++) passo(1 / 60);
    },
  };
}
