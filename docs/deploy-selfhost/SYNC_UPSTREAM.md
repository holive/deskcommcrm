# Sincronização do fork

O workflow [Sincronizar upstream](../../.github/workflows/sync-upstream.yml) verifica
`melgarafael/DeskcommCRM:main` todos os dias às 09:23 de Brasília. Também pode
ser iniciado em **Actions → Sincronizar upstream → Run workflow**. O GitHub pode
atrasar o disparo; o horário é uma programação, não uma garantia de pontualidade.

Ele mescla o upstream em `sync/upstream` e abre um único PR para a `main` do fork.
Execuções seguintes atualizam essa mesma branch por merge, preservando também as
resoluções manuais. Se não houver commits novos, não abre PR. Nunca usa force-push,
aprova PR, faz merge na `main` ou implanta em produção.

## Ativação

- O workflow precisa estar na `main` e o GitHub Actions precisa estar habilitado no fork.
- Em **Settings → Actions → General → Workflow permissions**, habilitar
  **Allow GitHub Actions to create and approve pull requests**. O workflow pede só
  `contents: write` e `pull-requests: write`; não precisa cadastrar token ou secret.
- PRs criados com o `GITHUB_TOKEN` podem exigir **Approve workflows to run** antes
  do CI. [Comportamento documentado pelo GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
- O GitHub pode desabilitar o agendamento após 60 dias sem atividade em um
  repositório público; nesse caso, reativar na página do workflow.

## Alertas de segurança das dependências

Em **Settings → Security → Advanced Security**, manter **Dependabot alerts** e
**Dependabot security updates** habilitados. Os alertas acompanham vulnerabilidades
conhecidas das dependências; quando houver uma correção compatível, o Dependabot
pode abrir um PR de segurança. Isso é independente da busca diária do upstream e
da agenda semanal de atualizações comuns em `dependabot.yml`.

Conferir o estado real no fork:

```bash
gh api --silent repos/holive/deskcommcrm/vulnerability-alerts
gh api repos/holive/deskcommcrm/automated-security-fixes
```

O primeiro comando termina com sucesso se os alertas estiverem habilitados; o
segundo informa `enabled`. Os avisos aparecem em **Security → Dependabot** e a
entrega de notificações segue as preferências da conta no GitHub. Priorizar os
alertas de segurança na revisão; nenhum PR é aprovado ou instalado automaticamente.

Fontes: [alertas](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-dependabot-alerts)
e [correções de segurança](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates).

## Revisão e integração

1. Liberar os workflows, se solicitado, e conferir o CI do PR.
2. Revisar separadamente o patch de runtime que permite operar sem WAHA e a
   configuração de deploy. O Compose de produção e o kit de instalação seguem o
   upstream, cujo Compose inicia WAHA e cujo kit usa imagens upstream. Isso não
   representa a topologia Meta-only mantida pela infraestrutura privada, que tem
   Compose e processo de promoção próprios.
3. Revisar migrations e mudanças de configuração antes de qualquer implantação.
4. Integrar usando **Create a merge commit**, preservando os commits originais.
   Não usar squash ou rebase nos PRs de sincronização: isso perde a ancestralidade
   usada para reconhecer o que já foi incorporado.

Se houver conflito, o job falha, lista os arquivos no resumo e deixa as branches
remotas intactas. Para resolver, parta da `sync/upstream` remota se ela já existir
(ou da `origin/main` caso contrário), mescle `origin/main` e a `main` atualizada do
upstream, resolva os conflitos preservando as alterações de runtime Meta-only e
faça push normal. Mantenha os arquivos de Compose e o kit alinhados ao upstream;
eles não definem a infraestrutura privada. Execute o workflow novamente para
abrir ou reutilizar o PR.

Se o GitHub recusar o push porque a atualização altera `.github/workflows/`,
faça esse merge e push pela sua sessão Git autenticada, na mesma branch, e rode
o workflow novamente. Alterar workflows exige a permissão específica
[Workflows](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app#choosing-permissions-for-git-access),
que não pode ser acrescentada ao `GITHUB_TOKEN` pelo bloco `permissions`.
Não descarte arquivos do upstream para contornar essa restrição.

## Limite desta automação

Enquanto o fork não publica releases próprias, o CI de banco busca no upstream
a release oficial mais recente e a tag histórica `v1.63.0` para conferir o kit de
atualização. O checkout do fork também é conferido. Isso prepara os testes e não
define quais imagens serão usadas na instalação.

A infraestrutura é mantida em um repositório privado separado, com Compose próprio
e seis serviços Meta-only (`app`, `worker`, `scheduler`, `redis`, `srh` e
`cloudflared`), sem WAHA nem Caddy. Este fluxo só atualiza o código do fork. O
Compose de produção e o kit deste repositório seguem o upstream: o Compose inclui
WAHA por padrão e o kit usa imagens upstream. Publicar imagens do fork de uma
mesma revisão para `app`, `worker` e `scheduler`, e promover essa revisão na
infraestrutura, são etapas separadas. Sincronizar não equivale a publicar nem a
implantar.
