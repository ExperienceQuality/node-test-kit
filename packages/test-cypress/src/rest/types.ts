export type RestArgs =
  | [url: string, body?: Cypress.RequestBody]
  | [method: Cypress.HttpMethod, url: string, body?: Cypress.RequestBody]
  | [options: Partial<Cypress.RequestOptions>];

export type RestCommandArgs =
  | RestArgs
  | [alias: string, url: string, body?: Cypress.RequestBody]
  | [alias: string, method: Cypress.HttpMethod, url: string, body?: Cypress.RequestBody]
  | [alias: string, options: Partial<Cypress.RequestOptions>];

declare global {
  namespace Cypress {
    interface Chainable {
      rest(...args: RestCommandArgs): Chainable<Cypress.Response<unknown>>;
    }
  }
}

export {};
