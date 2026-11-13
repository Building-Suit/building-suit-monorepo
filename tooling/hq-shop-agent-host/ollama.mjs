import { employeeInstructions, intentSchema, reviewInstructions, reviewSchema } from './model.mjs'

const LOCAL_ORIGIN = 'http://127.0.0.1:11434'
const MAX_RESPONSE_BYTES = 128_000

async function boundedJson(response) {
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => {})
    throw new Error('local-inference-request-failed')
  }
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > MAX_RESPONSE_BYTES) throw new Error('local-inference-response-too-large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
}

export async function createOllamaAdapter(config, fetcher = fetch) {
  const { model, modelDigest } = config

  async function checkModel(signal) {
    const response = await fetcher(LOCAL_ORIGIN + '/api/tags', { redirect: 'error', signal })
    const { models } = await boundedJson(response)
    const installed = Array.isArray(models) && models.some(entry =>
      entry?.name === model && entry.digest === modelDigest &&
      !entry.remote_model && !entry.remote_host)
    if (!installed) throw new Error('approved-local-model-not-installed')
  }

  async function chat(messages, format, signal) {
    await checkModel(signal)
    const response = await fetcher(LOCAL_ORIGIN + '/api/chat', {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        format,
        stream: false,
        think: false,
        truncate: false,
        shift: false,
        options: { temperature: 0, num_predict: 1_200 },
      }),
    })
    const result = await boundedJson(response)
    if (result?.done !== true || result.done_reason !== 'stop' || result.model !== model ||
        result.message?.role !== 'assistant' || typeof result.message.content !== 'string' ||
        result.message.tool_calls?.length) {
      throw new Error('invalid-local-inference-response')
    }
    return JSON.parse(result.message.content)
  }

  await checkModel(AbortSignal.timeout(5_000))

  return {
    inferEmployee({ employee, messages, feedback, outcome, docs, signal }) {
      return chat([
        {
          role: 'system',
          content: employeeInstructions + '\n' + JSON.stringify({ template: employee.template, feedback, outcome, docs }),
        },
        ...messages,
      ], intentSchema, signal)
    },
    reviewEmployee({ messages, intent, outcome, docs, signal }) {
      // Review one shop's work per inference, even when the queue leases a batch.
      return chat([
        { role: 'system', content: reviewInstructions },
        { role: 'user', content: JSON.stringify({ messages, intent, outcome, docs }) },
      ], reviewSchema, signal)
    },
  }
}
