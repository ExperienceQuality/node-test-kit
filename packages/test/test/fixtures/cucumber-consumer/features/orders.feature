Feature: Cucumber consumer

  @smoke
  Scenario: submit nested order
    Given a scenario context exists
    When I access the namespaced health endpoint
    When I compose an order JSON table
      | customer.id | items[0].sku | items[0].quantity |
      | "cust-123"  | "SKU-1"      | 2                 |
    Then the nested order is available

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
