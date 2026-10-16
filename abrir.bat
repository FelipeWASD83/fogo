@echo off
rem Abre o fogo: sobe um servidorzinho na porta 4351 e abre o navegador.
rem Fecha esta janela preta quando cansar de olhar o fogo.
rem (Aberto direto do arquivo, o navegador nao deixa carregar os scripts.)
cd /d "%~dp0"
start "" "http://127.0.0.1:4351/"
python -m http.server 4351 --bind 127.0.0.1
