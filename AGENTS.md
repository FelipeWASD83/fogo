# AGENTS.md: fogo

As regras deste projeto estão em **`CLAUDE.md`**, nesta mesma pasta. Ler antes de mexer.

Resumo do que não pode ser esquecido:

- No shader (`js/alta.js`), `pow` e `sqrt` de valor que pode ser zero ou negativo dão NaN e a tela fica preta: usar `max(x, 0.0)`.
- Fundos dos blocos alternam por tom (carvão, papel, carvão, papel); medir se mexer em seção.
- Não abre por `file://`: usar `abrir.bat` ou o preview na porta 4351 (registrada no `.claude/launch.json` da raiz).
- Sem celular nem otimização por perda de qualidade: roda só no PC dele.
