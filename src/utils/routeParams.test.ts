import { firstRouteParam } from './routeParams';

describe('firstRouteParam', () => {
  it('retourne la chaîne telle quelle', () => {
    expect(firstRouteParam('abc')).toBe('abc');
  });

  it('retourne le premier élément d’un tableau', () => {
    expect(firstRouteParam(['x', 'y'])).toBe('x');
  });

  it('retourne une chaîne vide si absent', () => {
    expect(firstRouteParam(undefined)).toBe('');
  });
});
