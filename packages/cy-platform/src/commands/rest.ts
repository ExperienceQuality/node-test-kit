import { parseRestCommandArgs } from '../rest/parse.js';
import type { RestArgs, RestCommandArgs } from '../rest/types.js';

Cypress.Commands.add('rest', (...args: RestCommandArgs) => {
  const { alias, request } = parseRestCommandArgs(args);
  const api = cy.api as unknown as (
    ...request: RestArgs
  ) => Cypress.Chainable<Cypress.Response<unknown>>;

  const response = api(...request);
  if (!alias) return response;

  return response.then((value) => {
    return cy
      .wrap(value.body)
      .as(alias)
      .then(() => value);
  });
});
