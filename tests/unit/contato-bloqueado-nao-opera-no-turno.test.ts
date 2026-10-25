import { describe, expect, it, vi } from "vitest";

import { runAgentTurn } from "@/lib/agent-engine/agent/inbound-turn";

// O contato já enviou STOP, mas a mensagem nova é uma pergunta comum. A regra
// não pode depender de encontrar de novo a palavra STOP no texto do cliente.
const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";
const CONVERSA = "33333333-3333-4333-8333-333333333333";
const CANAL = "44444444-4444-4444-8444-444444444444";
const JOB = "55555555-5555-4555-8555-555555555555";
const MENSAGEM = "66666666-6666-4666-8666-666666666666";
const AGORA = new Date("2026-10-06T15:00:00Z");
const PERGUNTA = "Qual é o endereço do showroom?";

function banco(bloqueado: boolean) {
  const mensagem = {
    direction: "inbound",
    type: "text",
    body: PERGUNTA,
    media_url: null,
    media_storage_path: null,
    media_mime: null,
    media_derived_text: null,
    sent_at: AGORA,
  };
  return {
    query: vi.fn(async (sql: string) => {
      if (/from contacts where organization_id = \$1 and id = \$2/.test(sql)) {
        return {
          rows: [
            {
              name: "Cliente",
              display_name: null,
              email: null,
              phone_number: null,
              tags: [],
              is_blocked: bloqueado,
              is_personal: false,
              source: "whatsapp",
              consent: null,
              is_anonymized: false,
            },
          ],
        };
      }
      if (
        sql.includes("from messages") &&
        (/and id = \$3/.test(sql) || sql.includes("media_mime"))
      ) {
        return { rows: [mensagem] };
      }
      if (sql.includes("playbook_pointers")) {
        return { rows: [{ layer: "platform", version_id: "v1", content: "plataforma" }] };
      }
      return { rows: [] };
    }),
  };
}

async function executar(bloqueado: boolean, kind = "inbound_turn", pool = banco(bloqueado)) {
  const send = vi.fn();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  await runAgentTurn(
    {
      log,
      llmCfg: {},
      crmCfg: {},
      knobs: { maxSteps: 1 },
      clock: () => AGORA,
      channel: () => ({ send }),
    } as never,
    {
      id: JOB,
      organization_id: ORG,
      contact_id: CONTATO,
      kind,
      payload: {},
      attempts: 1,
      claimed_by: "w",
      claimed_at: AGORA,
    } as never,
    pool as never,
    { workerId: "w" },
    {
      resolvedAgent: {
        config: {
          agentId: "agente-1",
          versionId: "v1",
          operationMode: "automatic",
          pausedAt: null,
          systemPrompt: "Atendimento",
          toolIds: [],
          casesEnabled: true,
          historyMessageWindow: 20,
          historyTokenWindow: 1000,
          handoffKeywords: [],
        },
        routerId: null,
        intentName: null,
        confidence: null,
        outcome: "fallback",
      },
      channelSessionId: CANAL,
      conversationId: CONVERSA,
      inboundMessageId: MENSAGEM,
      buildOpening: () => "",
    } as never,
  );
  return { pool, send };
}

describe("STOP já gravado: pergunta comum não abre operação nova", () => {
  it.each(["inbound_turn", "followup_turn", "case_reply_turn"])(
    "%s bloqueado encerra antes do modelo e das ferramentas",
    async (kind) => {
      const pool = banco(true);
      // A configuração vazia de LLM é uma sentinela: se o turno avançar até o
      // modelo, a exceção config LLM deixa o caso vermelho, antes de pagar API.
      await expect(executar(true, kind, pool)).rejects.toThrow(/opt.out|bloquead/i);
      const consultas = pool.query.mock.calls.map(([sql]) => sql);
      expect(
        consultas.some(
          (sql) => sql.includes("update job_queue") && sql.includes("status = 'failed'"),
        ),
      ).toBe(true);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("update cron_jobs"), [
        ORG,
        CONTATO,
      ]);
      expect(consultas.some((sql) => sql.includes("insert into agent_cases"))).toBe(false);
    },
  );

  it("controle: o mesmo texto sem bloqueio alcança a configuração do modelo", async () => {
    await expect(executar(false)).rejects.toThrow(/config LLM/);
  });
});
