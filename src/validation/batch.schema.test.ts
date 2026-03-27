import { createBatchSchema } from './batch.schema';

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
