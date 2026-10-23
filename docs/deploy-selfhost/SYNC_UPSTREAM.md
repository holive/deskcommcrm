# Sincronização do fork

O workflow [Sincronizar upstream](../../.github/workflows/sync-upstream.yml) verifica
`melgarafael/DeskcommCRM:main` toda segunda-feira às 09:23 de Brasília. Também pode
ser iniciado em **Actions → Sincronizar upstream → Run workflow**.

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

## Revisão e integração

1. Liberar os workflows, se solicitado, e conferir o CI do PR.
2. Verificar que o app e os workers continuam funcionando sem WAHA. Merge sem
   conflito não garante que o comportamento Meta-only foi preservado.
3. Revisar migrations e mudanças de configuração antes de qualquer implantação.
4. Integrar usando **Create a merge commit**, preservando os commits originais.
   Não usar squash ou rebase nos PRs de sincronização: isso perde a ancestralidade
   usada para reconhecer o que já foi incorporado.

Se houver conflito, o job falha, lista os arquivos no resumo e deixa as branches
remotas intactas. Para resolver, parta da `sync/upstream` remota se ela já existir
(ou da `origin/main` caso contrário), mescle `origin/main` e a `main` atualizada do
upstream, resolva os conflitos preservando o patch Meta-only e faça push normal.
Execute o workflow novamente para abrir ou reutilizar o PR.

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

A infraestrutura ficará em um repositório privado separado. Este fluxo só atualiza
o código do fork. Publicação de imagens próprias e promoção de uma versão para a
infraestrutura são etapas separadas; sincronizar não equivale a fazer deploy.
