# CLAUDE.md: fogo

Página de efeitos: o mesmo fogo em ASCII, pixel art e alta resolução, mais ondas, aurora, lava e fluxo. Pessoal, sem deploy, sem celular (roda só no PC dele). Regras gerais da pasta valem; aqui só o que é deste projeto. Repositório público (MIT).

## Como rodar
`abrir.bat` (porta 4351) ou o preview `fogo`. Não abre por `file://` (módulos ES).

## Arquivos
- `index.html` e `css/estilo.css`: estrutura e visual. Cores, espaços e fontes são variáveis no topo do CSS.
- `js/ascii.js`: fogo 1. Simulação de calor em grade ("doom fire") e atlas de letras pré-desenhadas por nível de calor.
- `js/pixel.js`: fogo 2. Cena 160 × 90 desenhada por código, quantizada em 8 níveis por canal com pontilhado de Bayer; chama de 34 × 46 com 8 cores.
- `js/alta.js`: fogo 3. A mesma ideia do ASCII com pontos de 2 a 4 px: cada célula puxa o calor de 3 linhas abaixo, deslocado por um campo de ondas; cor por tabela de 256 entradas; brilho (canvas pequeno borrado por CSS e somado com `screen`); faíscas com rastro; tocha e clarão. Ruído vem de uma tabela pré-sorteada (sortear por célula custava o dobro: ~11 ms contra ~5 ms por passo a 3440 × 1440).
- `js/ondas.js`: equação da onda em grade de letras, sobre papel.
- `js/aurora.js`: shader WebGL 1 (cortinas, estrelas, montanhas, lago com reflexo).
- `js/lava.js`: metabolas em 192 × 108, seis cores, Bayer; preenche a seção com escala inteira.
- `js/fluxo.js`: partículas em correntes sem divergência (rotacional de um potencial), rastro por fade com transparência dependente do dt.
- `js/main.js`: espera as fontes, liga cada efeito só enquanto a seção aparece, preenche os números do HUD e do rodapé. Um efeito que falha não derruba os outros.

## Decisões que não se desfazem sem motivo
- Fundos alternam por tom: escuro, claro, escuro, claro, escuro, claro, escuro, claro (rodapé incluso). Medir a luminância se mexer em seção ou acrescentar uma: sempre entra uma de cada tom, alternando.
- Sem imagem pronta: tudo é calculado. Sem biblioteca.
- `prefers-reduced-motion` congela todos num quadro.
- O fogo em alta resolução foi trocado do shader (que ficou feio) pela grade de calor, por ideia dele: "pegar o código do ASCII, trocar caracteres por pixels, aplicar mais efeitos e aumentar a escala". Não voltar ao shader.

## Armadilhas
- **Shader (aurora):** `pow(x, y)` e `sqrt(x)` com x que pode ser 0 ou levemente negativo (como `1.0 - f` no fim de um laço) dão NaN na placa e a tela fica preta. Usar `max(x, 0.0)` ou multiplicação. `smoothstep` com bordas invertidas também é indefinido: escrever `1.0 - smoothstep(a, b, x)`.
- O preview só anima de verdade com o painel do navegador visível; escondido, o fps cai para 3 e o `ResizeObserver` demora, então os números do HUD e a escala do pixel art atrasam. Para conferir efeito, o painel precisa estar aberto.
- O fps na RTX 3060 dele **não foi medido**. Se pesar no ultrawide, cortar custo no passo do fogo em alta (mais linhas por passo, menos passos por segundo) ou no número de partículas do fluxo, nunca baixar a resolução sem ele mandar.
- No `fluxo.js` os rastros dependem do fps real: em quadro lento viram pontinhos (aconteceu no preview).
