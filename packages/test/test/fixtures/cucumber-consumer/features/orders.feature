Feature: Cucumber consumer

  @smoke
  Scenario: submit nested order
    Given a scenario context exists
    When I access the namespaced health endpoint
    When I compose an order JSON table
      | customer.id | items[0].sku | items[0].quantity |
      | "cust-123"  | "SKU-1"      | 2                 |
    Then the nested order is available

  @json-assertion
  Scenario: assert the complete order from the request builder
    When I retrieve the order expecting this exact JSON:
      | id  | customer.id | customer.name | customer.email      | customer.private            | items[0].sku | items[0].quantity | items[1].sku | items[1].quantity | status    |
      | 123 | "cust-123"  | "Ada"         | "ada@example.test" | "actual-secret-sentinel" | "SKU-1"      | 2                 | "SKU-2"      | 1                 | "created" |

  @json-assertion
  Scenario: make multiple path-scoped assertions on one response
    When I retrieve the order
    Then the response JSON at "customer" exactly matches:
      | id         | name  | email                 | private                     |
      | "cust-123" | "Ada" | "ada@example.test"   | "actual-secret-sentinel" |
    And the response JSON at "items[0]" contains:
      | sku     | quantity |
      | "SKU-1" | 2        |

  @redaction-failure
  Scenario: redact expected and actual values from a failed response expectation
    When I assert a secret response value without printing it

  @smoke
  Scenario: another smoke scenario has its own context
    Given a scenario context exists
    When I access the namespaced health endpoint
    Then the scenario context remains local

  @slow
  Scenario: second scenario gets isolated context
    Given a scenario context exists

  @failure
  Scenario: invalid base URL fails before steps
    Given a scenario context exists

  @undefined
  Scenario: undefined step has native failure
    Given a step nobody has defined

  @before-failure
  Scenario: before hook failure remains failed
    Given a scenario context exists
