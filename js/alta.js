// Fogo em alta resolução: um shader que calcula cada pixel da tela.
// A palavra é desenhada num canvas 2D, vira textura, e as chamas nascem das
// letras: para cada pixel o shader olha para baixo, onde há letra, e soma
// o calor que sobe, entortado por ruído fractal. Faíscas e a tocha do mouse
// são calculadas no mesmo shader.

const PALAVRA = "RESOLUÇÃO";

const VERTICE = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENTO = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uText;
uniform vec2 uMouse;
uniform float uTocha;
uniform float uWind;
uniform float uRowY;
uniform float uReach;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v / 0.875;
}
vec3 rampa(float v) {
  vec3 c = vec3(0.0);
  c = mix(c, vec3(0.45, 0.03, 0.0), smoothstep(0.0, 0.25, v));
  c = mix(c, vec3(1.0, 0.28, 0.02), smoothstep(0.2, 0.55, v));
  c = mix(c, vec3(1.0, 0.66, 0.12), smoothstep(0.5, 0.85, v));
  c = mix(c, vec3(1.0, 0.93, 0.65), smoothstep(0.8, 1.15, v));
  c = mix(c, vec3(1.0, 1.0, 0.95), smoothstep(1.1, 1.5, v));
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y);
  float t = uTime;

  // turbulência que entorta a chama
  vec2 w = vec2(fbm3(vec2(p.x * 3.2, p.y * 2.0 - t * 0.7)),
                fbm3(vec2(p.x * 3.2 + 7.3, p.y * 2.0 - t * 0.9 + 3.1))) - 0.5;

  // calor que sobe das letras: soma de amostras da textura, de baixo para cima
  float acc = 0.0;
  for (int i = 0; i < 28; i++) {
    // posição sorteada dentro de cada fatia: troca as faixas visíveis por granulação fina
    float f = (float(i) + hash(frag * 0.73 + float(i) * 1.31)) / 28.0;
    vec2 q = uv;
    q.y -= f * uReach;
    q.x += (w.x * 0.11 * f + uWind * 0.12 * f * f) / asp * 1.6;
    q.x += (hash(frag * 1.37 + float(i) * 2.17) - 0.5) * 0.02 * (0.3 + f) / asp;
    q.y += w.y * 0.03 * f;
    float k = max(1.0 - f, 0.0);
    acc += texture2D(uText, q).a * k * sqrt(k);
  }
  acc *= 0.137;

  float n1 = fbm(vec2(p.x * 7.0 + w.x * 2.0, p.y * 4.5 - t * 2.2));
  float calor = acc * (0.5 + 1.0 * n1) - 0.1;

  // tocha do mouse: uma pluma que sobe acima do cursor
  vec2 dm = (uv - uMouse) * vec2(asp, 1.0);
  float acima = max(dm.y, 0.0);
  float abaixo = min(dm.y, 0.0);
  float dist = length(vec2(dm.x * (1.0 + acima * 2.5), acima * 0.45 + abaixo * 2.4));
  float tocha = exp(-dist * dist * 55.0) * uTocha * (0.45 + n1 * 0.9);
  calor += tocha * 0.95;
  calor = max(calor, 0.0);

  // letras incandescentes
  float letra = texture2D(uText, uv).a;
  vec3 corLetra = vec3(0.0);
  if (letra > 0.01) {
    float ln = fbm(p * 9.0 + t * 0.15);
    corLetra = mix(vec3(0.55, 0.06, 0.0), vec3(1.0, 0.55, 0.1), smoothstep(0.3, 0.75, ln)) * (1.0 + 0.5 * ln);
    corLetra *= 0.85 + 0.3 * noise(vec2(t * 3.0, p.x * 20.0));
  }

  // brilho ao redor
  float acm = clamp(acc, 0.0, 2.0);
  float luz = acm * sqrt(acm);
  vec3 fundo = vec3(0.035, 0.022, 0.018)
             + vec3(0.9, 0.28, 0.06) * luz * 0.35
             + vec3(0.25, 0.07, 0.01) * exp(-(uv.y - uRowY) * (uv.y - uRowY) * 6.25) * 0.35;

  vec3 col = fundo + rampa(calor * 1.15) + corLetra * letra * 0.95;

  // faíscas: três camadas de partículas que sobem
  float mascara = 0.0;
  if (uv.y > uRowY) {
    for (int k = -3; k <= 3; k++) {
      mascara += texture2D(uText, vec2(uv.x + float(k) * 0.01, uRowY)).a;
    }
    mascara = smoothstep(0.0, 3.0, mascara);
  }
  float nasce = smoothstep(uRowY, uRowY + 0.08, uv.y);
  float some = 1.0 - smoothstep(uRowY + 0.2, 0.98, uv.y);
  vec3 faiscas = vec3(0.0);
  for (int L = 0; L < 3; L++) {
    float sc = 16.0 + float(L) * 11.0;
    vec2 g = vec2(uv.x * asp, uv.y) * sc;
    g.y -= t * (1.3 + float(L) * 0.9);
    g.x += sin(t * 0.6 + float(L) * 2.0) * 0.7 + uWind * uv.y * sc * 0.25;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float h = hash(id + float(L) * 31.7);
    vec2 c = vec2(0.5 + 0.35 * sin(t * (1.0 + h * 3.0) + h * 40.0), 0.5 + 0.3 * cos(t * 1.3 + h * 20.0));
    float d = length(f - c);
    float raio = 0.05 + 0.07 * hash(id * 1.7);
    float visivel = step(0.74, h);
    float s = visivel * smoothstep(raio, raio * 0.2, d) * mascara * nasce * some * (0.6 + 0.4 * sin(t * 20.0 * h + h * 50.0));
    faiscas += s * mix(vec3(1.0, 0.4, 0.05), vec3(1.0, 0.85, 0.4), h) * 2.2;
  }
  col += faiscas;

  // brilho do cursor
  col += vec3(1.0, 0.7, 0.35) * exp(-dist * dist * 9000.0) * uTocha * 0.6;

  col = 1.0 - exp(-col * 1.35);
  col += (hash(frag + fract(t)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function criarAlta(secao, canvas, { aoInformar, aoMedir } = {}) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return null;

  function compilar(tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || "shader não compilou");
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VERTICE));
  gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FRAGMENTO));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) || "programa não ligou");
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  for (const nome of ["uRes", "uTime", "uText", "uMouse", "uTocha", "uWind", "uRowY", "uReach"]) {
    u[nome] = gl.getUniformLocation(prog, nome);
  }

  const textura = gl.createTexture();
  const LINHA = 0.3; // altura do centro das letras (0 = embaixo, 1 = em cima)
  const ALCANCE = 0.52;

  let ligado = false;
  let inicio = performance.now();
  let mouse = { x: 0.5, y: 0.5 };
  let mouseAlvo = { x: 0.5, y: 0.5 };
  let tocha = 0;
  let tochaAlvo = 0;
  let vento = 0;
  let ventoAlvo = 0;
  let ultimoX = null;
  let quadros = 0;
  let ultimaMedida = performance.now();
  let dpr = 1;

  function montarTextura() {
    const w = canvas.width;
    const h = canvas.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    const familia = '"Unbounded", "Arial Black", sans-serif';
    g.font = `700 100px ${familia}`;
    const larg100 = g.measureText(PALAVRA).width;
    let tam = (w * 0.9 * 100) / larg100;
    tam = Math.min(tam, h * 0.2);
    g.font = `700 ${tam}px ${familia}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    g.fillText(PALAVRA, w / 2, h * (1 - LINHA));
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(secao.clientWidth * dpr);
    canvas.height = Math.round(secao.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    montarTextura();
    if (aoInformar) {
      aoInformar({
        largura: canvas.width,
        altura: canvas.height,
        texto: `${canvas.width} × ${canvas.height} px · ${(canvas.width * canvas.height / 1e6).toFixed(1)} milhões de pixels por quadro`,
      });
    }
    desenhar((performance.now() - inicio) / 1000);
  }

  function desenhar(t) {
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, t);
    gl.uniform1i(u.uText, 0);
    gl.uniform2f(u.uMouse, mouse.x, mouse.y);
    gl.uniform1f(u.uTocha, tocha);
    gl.uniform1f(u.uWind, vento);
    gl.uniform1f(u.uRowY, LINHA);
    gl.uniform1f(u.uReach, ALCANCE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function quadro(agora) {
    if (!ligado) return;
    mouse.x += (mouseAlvo.x - mouse.x) * 0.25;
    mouse.y += (mouseAlvo.y - mouse.y) * 0.25;
    tocha += (tochaAlvo - tocha) * 0.12;
    vento += (ventoAlvo - vento) * 0.08;
    ventoAlvo *= 0.97;
    desenhar((agora - inicio) / 1000);
    quadros++;
    if (agora - ultimaMedida >= 500) {
      const fps = Math.round((quadros * 1000) / (agora - ultimaMedida));
      if (aoMedir) aoMedir(fps);
      quadros = 0;
      ultimaMedida = agora;
    }
    requestAnimationFrame(quadro);
  }

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouseAlvo.x = (e.clientX - r.left) / r.width;
    mouseAlvo.y = 1 - (e.clientY - r.top) / r.height;
    tochaAlvo = 1;
    if (ultimoX !== null) ventoAlvo = Math.max(-1, Math.min(1, ventoAlvo + (e.clientX - ultimoX) / 40));
    ultimoX = e.clientX;
  });
  canvas.addEventListener("pointerleave", () => {
    tochaAlvo = 0;
    ultimoX = null;
  });
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());

  new ResizeObserver(medir).observe(secao);

  return {
    ligar() {
      if (ligado) return;
      ligado = true;
      quadros = 0;
      ultimaMedida = performance.now();
      requestAnimationFrame(quadro);
    },
    desligar() {
      ligado = false;
    },
    congelar() {
      ligado = false;
      desenhar(3.2);
    },
  };
}
