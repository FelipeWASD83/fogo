// Aurora boreal sobre um lago: shader de tela cheia. Três cortinas de luz
// feitas de ruído com raios verticais, estrelas que cintilam, montanhas e o
// reflexo na água com ondulação. O mouse puxa as cortinas para os lados.

const VERTICE = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENTO = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseOn;

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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

vec3 aurora(vec2 uv, float asp) {
  vec2 p = vec2(uv.x * asp + (uMouse.x - 0.5) * 0.5 * uMouseOn, uv.y);
  float t = uTime * 0.1;
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float off = fi * 3.7;
    float onda = fbm(vec2(p.x * 0.8 + off, t + fi));
    float centro = 0.6 + (onda - 0.5) * 0.45 + 0.04 * sin(p.x * 2.1 + t * 5.0 + fi * 2.0) + fi * 0.05
                 + (uMouse.y - 0.5) * 0.08 * uMouseOn;
    float d = uv.y - centro;
    float k = d > 0.0 ? 9.0 : 220.0;
    float cortina = exp(-d * d * k);
    float raios = 0.45 + 0.55 * noise(vec2(p.x * 45.0 + off * 7.0 + sin(t * 8.0 + fi) * 2.0, t * 6.0 + fi));
    float vive = smoothstep(0.25, 0.65, fbm(vec2(p.x * 1.3 + off * 2.0, t * 2.0 + fi * 5.0)));
    float inten = cortina * raios * (0.3 + 0.95 * vive);
    vec3 cor = mix(vec3(0.1, 1.0, 0.55), vec3(0.55, 0.25, 0.95), clamp(d * 4.0 + 0.2, 0.0, 1.0));
    cor = mix(cor, vec3(0.2, 0.9, 0.95), 0.25 * fi);
    col += cor * inten * (0.6 - 0.1 * fi);
  }
  return col;
}

vec3 estrelas(vec2 uv, float asp) {
  vec2 g = vec2(uv.x * asp, uv.y) * 70.0;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hash(id);
  float on = step(0.968, h);
  vec2 c = vec2(0.2 + 0.6 * hash(id + 1.3), 0.2 + 0.6 * hash(id + 2.9));
  float d = length(f - c);
  float tw = 0.55 + 0.45 * sin(uTime * (1.0 + 3.0 * h) + h * 50.0);
  return vec3(0.8, 0.9, 1.0) * on * (1.0 - smoothstep(0.0, 0.13, d)) * tw;
}

vec3 cenario(vec2 uv, float asp, float hor) {
  vec3 ceu = mix(vec3(0.02, 0.04, 0.085), vec3(0.003, 0.006, 0.02), clamp((uv.y - hor) * 1.7, 0.0, 1.0));
  vec3 col = ceu + aurora(uv, asp) + estrelas(uv, asp);
  float montanha = hor + 0.04 + 0.08 * fbm(vec2(uv.x * asp * 2.0 + 4.0, 1.0)) + 0.025 * sin(uv.x * asp * 5.0);
  float m = 1.0 - smoothstep(montanha - 0.004, montanha + 0.004, uv.y);
  return mix(col, vec3(0.004, 0.008, 0.012), m);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  float asp = uRes.x / uRes.y;
  float hor = 0.24;
  vec3 col;
  if (uv.y > hor) {
    col = cenario(uv, asp, hor);
  } else {
    float prof = hor - uv.y;
    vec2 r = vec2(uv.x + sin(uv.y * 110.0 + uTime * 1.4) * 0.0035 * (0.3 + prof * 8.0), hor + prof * 1.15);
    col = cenario(r, asp, hor) * 0.55;
    col += vec3(0.02, 0.05, 0.07) * (0.5 + 0.5 * sin(uv.y * 380.0 - uTime * 2.0 + noise(vec2(uv.x * 40.0, uv.y * 6.0)) * 6.0)) * (1.0 - prof * 3.0);
    col = max(col, vec3(0.0));
  }
  col = 1.0 - exp(-col * 1.7);
  vec2 q = uv - 0.5;
  col *= 1.0 - 0.5 * dot(q, q);
  col += (hash(frag + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function criarAurora(secao, canvas, { aoInformar } = {}) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return null;

  function compilar(tipo, fonte) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader não compilou");
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VERTICE));
  gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FRAGMENTO));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "programa não ligou");
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  for (const nome of ["uRes", "uTime", "uMouse", "uMouseOn"]) u[nome] = gl.getUniformLocation(prog, nome);

  let ligado = false;
  const inicio = performance.now();
  let mouse = { x: 0.5, y: 0.5 };
  let alvo = { x: 0.5, y: 0.5 };
  let presente = 0;
  let presenteAlvo = 0;

  function desenhar(t) {
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, t);
    gl.uniform2f(u.uMouse, mouse.x, mouse.y);
    gl.uniform1f(u.uMouseOn, presente);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(secao.clientWidth * dpr);
    canvas.height = Math.round(secao.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (aoInformar) aoInformar({ texto: `${canvas.width} × ${canvas.height} px calculados a cada quadro` });
    desenhar((performance.now() - inicio) / 1000);
  }

  function quadro(agora) {
    if (!ligado) return;
    mouse.x += (alvo.x - mouse.x) * 0.06;
    mouse.y += (alvo.y - mouse.y) * 0.06;
    presente += (presenteAlvo - presente) * 0.05;
    desenhar((agora - inicio) / 1000);
    requestAnimationFrame(quadro);
  }

  secao.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    alvo.x = (e.clientX - r.left) / r.width;
    alvo.y = 1 - (e.clientY - r.top) / r.height;
    presenteAlvo = 1;
  });
  secao.addEventListener("pointerleave", () => {
    presenteAlvo = 0;
  });
  new ResizeObserver(medir).observe(secao);

  return {
    ligar() {
      if (ligado) return;
      ligado = true;
      requestAnimationFrame(quadro);
    },
    desligar() {
      ligado = false;
    },
    congelar() {
      ligado = false;
      desenhar(12);
    },
  };
}
