import { criarAscii } from "./ascii.js";
import { criarPixel } from "./pixel.js";
import { criarAlta } from "./alta.js";

const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);

// As fontes precisam estar prontas antes de montar o atlas de letras e a
// textura da palavra em chamas; se não carregarem (sem internet), entra a de reserva.
async function esperarFontes() {
  try {
    await Promise.all([
      document.fonts.load('400 14px "JetBrains Mono"'),
      document.fonts.load('700 100px "Unbounded"'),
      document.fonts.load('300 100px "Unbounded"'),
    ]);
  } catch {
    /* segue com as fontes de reserva */
  }
}

function vigiar(secao, efeito) {
  if (reduzMovimento) {
    efeito.congelar();
    return;
  }
  new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) efeito.ligar();
        else efeito.desligar();
      }
    },
    { threshold: 0 }
  ).observe(secao);
}

await esperarFontes();

const secaoAscii = document.querySelector(".bloco-ascii");
const ascii = criarAscii(secaoAscii, $("cv-ascii"), {
  aoInformar: ({ texto, cols, rows }) => {
    $("info-ascii").textContent = texto;
    $("spec-ascii").textContent = `${cols} × ${rows}`;
  },
});
vigiar(secaoAscii, ascii);

const pixel = criarPixel($("cv-pixel"), {
  aoInformar: ({ texto }) => {
    $("info-pixel").textContent = texto;
  },
});
vigiar(document.querySelector(".bloco-pixel"), pixel);

const secaoAlta = document.querySelector(".bloco-alta");
let alta = null;
try {
  alta = criarAlta(secaoAlta, $("cv-alta"), {
    aoInformar: ({ largura, altura, texto }) => {
      $("info-alta").textContent = texto;
      $("spec-alta").textContent = `${largura} × ${altura}`;
    },
    aoMedir: (fps) => {
      $("fps-alta").textContent = `[ ${fps} quadros por segundo ]`;
    },
  });
} catch (erro) {
  console.error("Fogo em alta resolução falhou:", erro);
}
if (alta) {
  vigiar(secaoAlta, alta);
  if (reduzMovimento) $("fps-alta").textContent = "[ movimento reduzido: fogo parado ]";
} else {
  $("sem-webgl").hidden = false;
  $("fps-alta").textContent = "[ sem WebGL ]";
}
