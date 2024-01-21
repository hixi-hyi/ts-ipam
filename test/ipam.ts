import { Manager } from '../src/ipam';

describe('Manager', () => {
  test('constructor should initialize correctly', () => {
    const manager = new Manager({ start: 1, end: 2 });
    manager.test();
  });
});
