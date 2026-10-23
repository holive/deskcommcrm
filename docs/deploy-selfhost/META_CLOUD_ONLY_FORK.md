# Meta Cloud API-only — deploy experimental

Esta branch desliga o WAHA por padrão, **não** desativa o WhatsApp no DeskcommCRM. Use a conexão oficial **Meta Cloud API** no onboarding.

## Mudanças

Manutenção do fork: [fluxo de sincronização com upstream](SYNC_UPSTREAM.md).

- `waha` pertence ao profile opt-in `waha`; `app` não depende mais dele no Compose.
- O `worker` recebe `WAHA_API_BASE_URL` vazia quando não configurada.
- Variáveis WAHA não bloqueiam mais o início em produção.
- `/api/v1/health` informa `waha: disabled`, sem tratar ausência intencional como erro.
- Preflight ARM64 ignora a imagem WAHA quando o profile está inativo.

## Antes de usar

**Não rode o instalador do upstream como se esta branch fosse uma release oficial do fork.** O kit padrão ainda aponta para imagens `ghcr.io/melgarafael/*`, e o código TypeScript modificado só é executado se a imagem do **fork** for construída e publicada.

Para um ambiente de teste, use um `.env` com a configuração de Supabase externo e segredos, e defina as imagens do fork explicitamente. Em uma máquina de build com Docker Compose:

```bash
# Não colocar 'waha' em COMPOSE_PROFILES.
docker compose -f docker-compose.prod.yml --env-file .env config --services
# Não deve listar "waha".
docker compose -f docker-compose.prod.yml --env-file .env config --quiet

# Build de teste em máquina com recursos suficientes (não na VPS de 4 GB sem swap):
docker compose -f docker-compose.prod.yml -f docker-compose.build.yml --env-file .env build app worker scheduler
```

No deploy, alinhe `APP_IMAGE`, `WORKER_IMAGE` e `SCHEDULER_IMAGE` à mesma revisão do fork. O `up` sem override de build usará as imagens definidas no `.env`. Não misture imagem de app do upstream com código desta branch.

## Checklist de validação

1. `bash -n hostgator-setup-kit/install.sh hostgator-setup-kit/_common.sh`.
2. `docker compose ... config --services` não inclui `waha`.
3. Next e worker iniciam sem WAHA, com `/api/v1/health` não degradado por ele.
4. Conectar canal `meta_cloud`, receber webhook assinado, testar mensagem recebida e enviada, mídia, template e ack.
5. Validar scripts de upgrade/rollback e watchdogs antes de produção.

## Limitações conhecidas

O instalador e o atualizador do upstream ainda utilizam registry e tags do upstream. Esta alteração é **preparatória**: não foi feita uma instalação E2E nem prova de processamento Meta-only. As referências WAHA no código permanecem para compatibilidade, sem container iniciado por padrão.
