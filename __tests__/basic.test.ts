describe('Basic functionality', () => {
  it('should perform basic math operations', () => {
    expect(2 + 2).toBe(4);
    expect(10 * 5).toBe(50);
  });

  it('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
    expect('world'.length).toBe(5);
  });
});