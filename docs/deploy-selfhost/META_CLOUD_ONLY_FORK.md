# Meta Cloud API no fork

Este fork mantém alterações no runtime para operar com WAHA desativado: a validação de ambiente e o endpoint `/api/v1/health` reconhecem WAHA desativado. Isso permite usar a conexão oficial **Meta Cloud API** no onboarding. Não desativa o suporte a WhatsApp.

Manutenção do fork: [fluxo de sincronização com upstream](SYNC_UPSTREAM.md).

## Compose e kit do upstream

`docker-compose.prod.yml` e o kit em `hostgator-setup-kit/` seguem o upstream. O Compose padrão inicia WAHA; o kit padrão usa imagens e tags do upstream. Não use o Compose padrão como prova de uma topologia Meta-only e não implante por esse kit como se ele instalasse a infraestrutura deste fork.

O runtime alterado só entra em execução com imagens do fork. Para cada revisão implantada, publique e use imagens correspondentes de `app`, `worker` e `scheduler`, todas construídas da mesma revisão. Não misture imagens do upstream com código do fork.

## Infraestrutura do fork

A infraestrutura de deploy tem Compose próprio, separado deste repositório. Sua topologia Meta-only usa seis serviços: `app`, `worker`, `scheduler`, `redis`, `srh` e `cloudflared`; não inclui WAHA nem Caddy. A promoção de imagens e a atualização dessa infraestrutura são operações separadas da sincronização de código.

## Escopo das alterações

- O runtime aceita WAHA desativado e informa `waha: disabled` em `/api/v1/health` nesse estado.
- Os arquivos do Compose de produção e do kit de instalação/atualização acompanham o upstream, incluindo o WAHA padrão.
- As alterações de runtime não mudam a topologia nem o procedimento de deploy da infraestrutura privada.

Não trate a descrição desta topologia como evidência de deploy ou de validação operacional; confira o processo de release e implantação antes de promover uma revisão.
