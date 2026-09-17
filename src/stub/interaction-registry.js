import { randomUUID } from 'node:crypto';

export class InteractionRegistry {
  #interactions = new Map();

  add(input) {
    const responses = input.responses ?? null;
    const interaction = Object.freeze({
      id: randomUUID(),
      method: String(input.method ?? 'GET').toUpperCase(),
      path: input.path ?? '/',
      headers: Object.freeze({ ...(input.headers ?? {}) }),
      body: input.body,
      response: responses?.[0] ?? input.response ?? { status: 200, body: {} },
      responses: responses ? Object.freeze([...responses]) : null,
      remaining: input.times ?? null,
      namespace: input.namespace ?? null
    });

    this.#interactions.set(interaction.id, interaction);
    return interaction;
  }

  get(id) { return this.#interactions.get(id); }

  remove(id) { return this.#interactions.delete(id); }

  clear(namespace = null) {
    for (const [id, interaction] of this.#interactions) {
      if (namespace === null || interaction.namespace === namespace) this.#interactions.delete(id);
    }
  }

  find(request) {
    for (const interaction of this.#interactions.values()) {
      if (interaction.method !== request.method || interaction.path !== request.path) continue;
      if (interaction.namespace !== null && interaction.namespace !== request.namespace) continue;
      if (!matchesHeaders(interaction.headers, request.headers)) continue;
      if (interaction.body !== undefined && JSON.stringify(interaction.body) !== JSON.stringify(request.body)) continue;
      if (interaction.remaining !== null && interaction.remaining < 1) continue;
      if (interaction.responses !== null && interaction.responses.length === 0) continue;

      if (interaction.remaining !== null || interaction.responses !== null) {
        const nextResponses = interaction.responses?.slice(1) ?? null;
        this.#interactions.set(interaction.id, Object.freeze({
          ...interaction,
          response: nextResponses?.[0] ?? interaction.response,
          responses: nextResponses,
          remaining: interaction.remaining === null ? null : interaction.remaining - 1
        }));
      }
      return interaction;
    }
  }
}

function matchesHeaders(expected, actual) {
  return Object.entries(expected).every(([name, value]) => actual[name.toLowerCase()] === String(value).toLowerCase());
}
