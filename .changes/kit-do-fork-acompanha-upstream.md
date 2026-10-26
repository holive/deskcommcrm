---
impacto: exige_acao
secao: alterado
titulo: O Compose e o kit do fork voltam a acompanhar o upstream
---
O Compose de produção e o kit de instalação deste fork voltam a seguir o upstream, com WAHA no Compose padrão. Quem usava esses arquivos para uma instalação Meta-only precisa manter a topologia em um Compose próprio antes de atualizar. O runtime continua aceitando WAHA desativado; a infraestrutura privada Meta-only tem seu próprio Compose e não muda com esta limpeza. App, worker e scheduler devem usar imagens do fork construídas da mesma revisão.

## Requer atenção

Antes de atualizar uma instalação Meta-only que usava o Compose público deste fork, mantenha sua topologia em um Compose próprio sem WAHA. Confira as imagens de app, worker e scheduler da mesma revisão do fork. A infraestrutura privada que já usa Compose próprio continua com seus seis serviços.
