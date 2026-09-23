import pactum from 'pactum';
import type { RestCapture, RestClient, RestClientOptions } from './rest-client.js';

const { events } = pactum;

interface PactumRequest {
  readonly method?: string;
  readonly url?: string;
  headers?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

interface PactumResponse {
  readonly statusCode?: number;
  readonly [key: string]: unknown;
}

interface ResponseEvent {
  readonly request: PactumRequest;
  readonly response: PactumResponse;
}

interface ResponseErrorEvent extends ResponseEvent {
  readonly error: unknown;
}

type CaptureOwner = WeakRef<RestClient>;

export class PactumCaptureRegistry {
  private readonly owners = new Map<string, CaptureOwner>();
  private readonly captures = new WeakMap<object, RestCapture>();
  private installed = false;

  register(client: RestClient, captureKey: string): void {
    this.install();
    this.owners.set(captureKey, new WeakRef(client));
    console.log('[node-test-kit] Pactum capture client registered', {
      captureKey,
      namespace: client.config.namespace
    });
  }

  private install(): void {
    if (this.installed) return;

    events.pactumEvents.on(events.EVENT_TYPES.BEFORE_REQUEST, (event: { request: PactumRequest }) => {
      const owner = this.findOwner(event.request);
      if (!owner) return;

      event.request.headers ??= {};
      event.request.headers[owner.config.namespaceHeader] = owner.config.namespace;
      delete event.request.headers[CAPTURE_HEADER];
      const capture: RestCapture = { request: undefined };
      owner.captures.push(capture);
      this.captures.set(event.request, capture);
    });

    events.pactumEvents.on(events.EVENT_TYPES.AFTER_RESPONSE, (event: ResponseEvent) => {
      const capture = this.captures.get(event.request);
      if (!capture) return;

      capture.request = structuredClone(event.request);
      capture.response = event.response;
      console.log('[node-test-kit] Pactum request/response captured', {
        request: capture.request,
        response: capture.response
      });
    });

    events.pactumEvents.on(events.EVENT_TYPES.AFTER_RESPONSE_ERROR, (event: ResponseErrorEvent) => {
      const capture = this.captures.get(event.request);
      if (!capture) return;

      capture.error = event.error;
      capture.response = event.response;
      console.log('[node-test-kit] Pactum request/response error captured', {
        request: capture.request,
        response: capture.response,
        error: capture.error
      });
    });

    this.installed = true;
    console.log('[node-test-kit] Pactum capture events registered', {
      events: [
        events.EVENT_TYPES.BEFORE_REQUEST,
        events.EVENT_TYPES.AFTER_RESPONSE,
        events.EVENT_TYPES.AFTER_RESPONSE_ERROR
      ]
    });
  }

  private findOwner(request: PactumRequest): RestClient | undefined {
    const captureKey = this.getHeader(request, CAPTURE_HEADER);
    if (!captureKey) return undefined;

    const ownerRef = this.owners.get(captureKey);
    const owner = ownerRef?.deref();
    if (!owner) {
      this.owners.delete(captureKey);
    }
    return owner;
  }

  private getHeader(request: PactumRequest, name: string): string | undefined {
    const header = Object.entries(request.headers ?? {})
      .find(([key]) => key.toLowerCase() === name);
    return typeof header?.[1] === 'string' ? header[1] : undefined;
  }
}

export const CAPTURE_HEADER = 'x-node-test-kit-capture-id';
