import { expect } from "vitest";
import { test } from "node-test-kit/vitest";

test("consumer drives a dummy backend through the kit facade", async ({
  kit,
}) => {
  await kit.rest.get("/health").expectStatus(200)

  const paymentStubId = await kit.stub.addInteraction({
    request: {
      method: "POST",
      path: "/payments",
      body: { productId: "product-1" },
    },
    response: {
      status: 201,
      body: { paymentId: "pay-123", status: "created" },
    },
  });

  await kit.rest
    .post("/orders")
    .withJson({ productId: "product-1" })
    .expectJsonMatch({
      id: "order-123",
      productId: "product-1",
      paymentId: "pay-123",
      status: "created",
    });

  const paymentInteraction = await kit.stub.getInteraction(paymentStubId);
  expect(paymentInteraction.exercised).toBe(true);
  expect(paymentInteraction.callCount).toBe(1);
});
