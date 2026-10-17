# AGENTS.md: fogo

As regras deste projeto estão em **`CLAUDE.md`**, nesta mesma pasta. Ler antes de mexer.

Resumo do que não pode ser esquecido:

- Fundos dos blocos alternam por tom (escuro, claro, escuro, claro...); medir se mexer em seção ou acrescentar uma.
- No shader da aurora (`js/aurora.js`), `pow` e `sqrt` de valor que pode ser zero ou negativo dão NaN e a tela fica preta: usar `max(x, 0.0)`.
- O fogo em alta resolução (`js/alta.js`) é a grade de calor do ASCII com pixels, não um shader. Não voltar ao shader.
- Não abre por `file://`: usar `abrir.bat` ou o preview na porta 4351 (registrada no `.claude/launch.json` da raiz).
- Sem celular nem otimização por perda de qualidade: roda só no PC dele.
