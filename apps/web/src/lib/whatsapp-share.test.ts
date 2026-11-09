import { describe, expect, it } from 'vitest';
import { packetContent, planShares, type IssuePhotos } from './whatsapp-share';

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const item = (number: number, count: number, missing = false) => ({
  issue: { number },
  files: Array.from({ length: count }, (_, i) =>
    file(`#${number}-${i + 1}.jpg`),
  ),
  missing,
});
const names = (packets: IssuePhotos<{ number: number }>[][]) =>
  packets.map((p) => p.flatMap((i) => i.files.map((f) => f.name)));

describe('planShares', () => {
  const atMost = (n: number) => (files: readonly File[]) => files.length <= n;

  it('packs whole issues in order into as few shares as the browser takes (§5.5)', () => {
    const packets = planShares(
      [item(1, 2), item(2, 0), item(3, 2), item(4, 1)],
      atMost(3),
    );
    expect(names(packets)).toEqual([
      ['#1-1.jpg', '#1-2.jpg'],
      ['#3-1.jpg', '#3-2.jpg', '#4-1.jpg'],
    ]);
    // The photo-less issue rides in the first share's caption.
    expect(packetContent(packets[0]).issues.map((i) => i.number)).toEqual([
      1, 2,
    ]);
  });

  it('one issue with more photos than a share takes → split across shares, the missing note once', () => {
    const packets = planShares([item(7, 5, true)], atMost(2));
    expect(names(packets)).toEqual([
      ['#7-1.jpg', '#7-2.jpg'],
      ['#7-3.jpg'],
      ['#7-4.jpg', '#7-5.jpg'],
    ]);
    expect(packets.map((p) => packetContent(p).missingPhotos)).toEqual([
      [7],
      [],
      [],
    ]);
  });
});
