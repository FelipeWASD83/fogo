# CLAUDE.md: fogo

Página de efeitos: o mesmo fogo em ASCII, pixel art e alta resolução. Pessoal, sem deploy, sem celular (roda só no PC dele). Regras gerais da pasta valem; aqui só o que é deste projeto.

## Como rodar
`abrir.bat` (porta 4351) ou o preview `fogo`. Não abre por `file://` (módulos ES).

## Arquivos
- `index.html` e `css/estilo.css`: estrutura e visual. Cores, espaços e fontes são variáveis no topo do CSS.
- `js/ascii.js`: simulação de calor em grade ("doom fire") e atlas de letras pré-desenhadas por nível de calor.
- `js/pixel.js`: cena 160 × 90 desenhada por código, quantizada em 8 níveis por canal com pontilhado de Bayer; chama de 34 × 46 com 8 cores.
- `js/alta.js`: shader WebGL 1. A palavra vira textura num canvas 2D e as chamas são a soma de amostras da textura de baixo para cima, entortadas por ruído.
- `js/main.js`: espera as fontes, liga cada efeito só enquanto a seção aparece, e preenche os números do HUD e do rodapé.

## Decisões que não se desfazem sem motivo
- Fundos alternam por tom: carvão, papel, carvão, papel (rodapé incluso). Medir a luminância se mexer em seção.
- Sem imagem pronta: tudo é calculado. Sem biblioteca.
- Acessibilidade: `prefers-reduced-motion` congela os três num quadro.

## Armadilhas
- **Shader:** `pow(x, y)` e `sqrt(x)` com x que pode ser 0 ou levemente negativo (por erro de ponto flutuante, como `1.0 - f` no fim do laço) dão NaN na placa e a tela fica preta. Usar `max(x, 0.0)` ou multiplicação. Foi o que deixou o fogo invisível na primeira versão.
- As faixas visíveis nas chamas vinham das 24 amostras fixas; o sorteio de posição por pixel (`hash`) troca isso por granulação fina. Não voltar para amostras fixas.
- O preview só anima com o painel do navegador visível. Para conferir o shader, o painel precisa estar aberto.
- O fps na RTX 3060 dele **não foi medido**: o preview mostrou 125 fps a 1009 × 768 e 23 fps a 3425 × 1440, mas pode ter rodado em outra GPU. Se pesar de verdade no monitor ultrawide, as saídas são menos amostras no laço ou menos oitavas de ruído, nunca baixar a resolução sem ele mandar.
