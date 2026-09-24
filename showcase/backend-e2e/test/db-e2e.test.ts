import { expect, test } from 'node-test-kit/vitest';

type TestDatabase = {
  payments: {
    id: string;
    order_id: string;
    amount: string;
    currency: string;
    status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'success';
    created_at: Date;
    updated_at: Date;
  };
};

test('reads payments through the typed kit database client', async ({ kit }) => {
  const payments = kit.db.get<TestDatabase>("payments");
  const captured = await payments.selectFrom("payments").selectAll().execute();

  await kit.rest.get("/payments").expectStatus(200).expectJsonLength(2);
  const res = await kit.rest.post("/payments").withBody({
    order_id: "order-1001",
    amount: 4999,
    currency: "VND",
    status: "captured",
  }).expectStatus(201).toss();
});
