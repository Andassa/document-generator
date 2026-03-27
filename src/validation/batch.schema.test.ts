import { createBatchSchema, createBatchUserIdsSchema } from './batch.schema';

describe('createBatchSchema', () => {
  it('accepte un lot valide', () => {
    const parsed = createBatchSchema.safeParse({
      documents: [{ title: 'x', content: 'y' }],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejette une liste vide', () => {
    const parsed = createBatchSchema.safeParse({ documents: [] });
    expect(parsed.success).toBe(false);
  });
});

describe('createBatchUserIdsSchema', () => {
  it('accepte des userIds valides', () => {
    const parsed = createBatchUserIdsSchema.safeParse({ userIds: ['a', 'b'] });
    expect(parsed.success).toBe(true);
  });

  it('rejette userIds vide', () => {
    const parsed = createBatchUserIdsSchema.safeParse({ userIds: [] });
    expect(parsed.success).toBe(false);
  });
});
