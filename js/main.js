import { criarAscii } from "./ascii.js";
import { criarPixel } from "./pixel.js";
import { criarAlta } from "./alta.js";
import { criarOndas } from "./ondas.js";
import { criarAurora } from "./aurora.js";
import { criarLava } from "./lava.js";
import { criarFluxo } from "./fluxo.js";

const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);
const texto = (id, valor) => {
  const el = $(id);
  if (el) el.textContent = valor;
};

// As fontes precisam estar prontas antes de montar os atlas de letras; se não
// carregarem (sem internet), entra a fonte de reserva.
async function esperarFontes() {
  try {
    await Promise.all([
      document.fonts.load('400 14px "JetBrains Mono"'),
      document.fonts.load('500 14px "JetBrains Mono"'),
      document.fonts.load('300 100px "Unbounded"'),
    ]);
  } catch {
    /* segue com as fontes de reserva */
  }
}

// Cada efeito só roda enquanto a seção aparece; com movimento reduzido, para num quadro.
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

// Um efeito com defeito não derruba os outros.
function iniciar(nome, secao, fabrica) {
  try {
    const efeito = fabrica();
    if (efeito) vigiar(secao, efeito);
    return efeito;
  } catch (erro) {
    console.error(`Efeito "${nome}" falhou:`, erro);
    return null;
  }
}

await esperarFontes();

const bloco = (classe) => document.querySelector(`.${classe}`);

iniciar("ascii", bloco("bloco-ascii"), () =>
  criarAscii(bloco("bloco-ascii"), $("cv-ascii"), {
    aoInformar: ({ texto: t, cols, rows }) => {
      texto("info-ascii", t);
      texto("spec-ascii", `${cols} × ${rows}`);
    },
  })
);

iniciar("pixel", bloco("bloco-pixel"), () =>
  criarPixel($("cv-pixel"), { aoInformar: ({ texto: t }) => texto("info-pixel", t) })
);

iniciar("alta", bloco("bloco-alta"), () =>
  criarAlta(bloco("bloco-alta"), $("cv-alta"), $("cv-alta-brilho"), {
    aoInformar: ({ texto: t, cols, rows }) => {
      texto("info-alta", t);
      texto("spec-alta", `${cols} × ${rows}`);
    },
    aoMedir: (fps) => texto("fps-alta", `[ ${fps} quadros por segundo ]`),
  })
);
if (reduzMovimento) texto("fps-alta", "[ movimento reduzido: fogo parado ]");

iniciar("ondas", bloco("bloco-ondas"), () =>
  criarOndas(bloco("bloco-ondas"), $("cv-ondas"), {
    aoInformar: ({ texto: t }) => {
      texto("info-ondas", t);
      texto("spec-ondas", t.split(" células")[0]);
    },
  })
);

const aurora = iniciar("aurora", bloco("bloco-aurora"), () =>
  criarAurora(bloco("bloco-aurora"), $("cv-aurora"), {
    aoInformar: ({ texto: t }) => {
      texto("info-aurora", t);
      texto("spec-aurora", t.split(" px")[0]);
    },
  })
);
if (!aurora) {
  $("sem-webgl").hidden = false;
  texto("info-aurora", "sem WebGL");
}

iniciar("lava", bloco("bloco-lava"), () =>
  criarLava(bloco("bloco-lava"), $("cv-lava"), { aoInformar: ({ texto: t }) => texto("info-lava", t) })
);

iniciar("fluxo", bloco("bloco-fluxo"), () =>
  criarFluxo(bloco("bloco-fluxo"), $("cv-fluxo"), {
    aoInformar: ({ texto: t }) => {
      texto("info-fluxo", t);
      texto("spec-fluxo", t.split(" partículas")[0]);
    },
  })
);
