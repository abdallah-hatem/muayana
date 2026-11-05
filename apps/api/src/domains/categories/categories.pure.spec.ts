import { reorderProblem } from './categories.pure';

describe('reorderProblem', () => {
  const all = ['a', 'b', 'c'];

  it('accepts any permutation of every id', () => {
    expect(reorderProblem(['c', 'a', 'b'], all)).toBeNull();
  });

  it.each([
    ['a missing id', ['a', 'b']],
    ['an unknown id', ['a', 'b', 'x']],
    ['an extra unknown id', ['a', 'b', 'c', 'x']],
    ['a duplicate', ['a', 'a', 'b', 'c']],
  ])('refuses %s', (_case, ids) => {
    expect(reorderProblem(ids, all)).toEqual(expect.any(String));
  });
});
