import { githubCache } from './github-cache.js';

describe('githubCache', () => {
  it('should work', () => {
    expect(githubCache()).toEqual('github-cache');
  });
});
