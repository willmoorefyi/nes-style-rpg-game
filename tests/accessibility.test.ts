import { describe, it, expect } from 'vitest';

describe('Accessibility', () => {
  it('index.html has lang attribute', async () => {
    const fs = await import('fs');
    const html = fs.readFileSync('index.html', 'utf-8');
    expect(html).toContain('lang="en"');
  });

  it('index.html has canvas focus style', async () => {
    const fs = await import('fs');
    const html = fs.readFileSync('index.html', 'utf-8');
    expect(html).toContain('canvas:focus');
  });
});
