// services/api/src/common/csv/csv.util.spec.ts
import { toCsvLine, toCsvString } from './csv.util';

describe('CSV Utility', () => {
  describe('toCsvLine', () => {
    it('should convert simple values without quotes', () => {
      const result = toCsvLine(['apple', 'banana', 'cherry']);
      expect(result).toBe('apple,banana,cherry');
    });

    it('should handle numeric values', () => {
      const result = toCsvLine([1, 2, 3]);
      expect(result).toBe('1,2,3');
    });

    it('should handle null and undefined as empty strings', () => {
      const result = toCsvLine(['a', null, undefined, 'b']);
      expect(result).toBe('a,,,b');
    });

    it('should quote values containing commas', () => {
      const result = toCsvLine(['hello', 'hello, world', 'goodbye']);
      expect(result).toBe('hello,"hello, world",goodbye');
    });

    it('should quote and escape values containing quotes', () => {
      const result = toCsvLine(['say "hello"', 'ok']);
      expect(result).toBe('"say ""hello""",ok');
    });

    it('should quote values containing newlines', () => {
      const result = toCsvLine(['line1\nline2', 'simple']);
      expect(result).toBe('"line1\nline2",simple');
    });

    it('should handle mixed types', () => {
      const result = toCsvLine(['text', 123, null, 'more, text']);
      expect(result).toBe('text,123,,"more, text"');
    });
  });

  describe('toCsvString', () => {
    it('should create CSV with headers and rows', () => {
      const headers = ['name', 'age', 'city'];
      const rows = [
        ['Alice', 30, 'New York'],
        ['Bob', 25, 'Los Angeles'],
      ];
      const result = toCsvString(headers, rows);
      expect(result).toBe('name,age,city\nAlice,30,New York\nBob,25,Los Angeles');
    });

    it('should handle empty rows', () => {
      const headers = ['col1', 'col2'];
      const rows: (string | number)[][] = [];
      const result = toCsvString(headers, rows);
      expect(result).toBe('col1,col2');
    });

    it('should properly escape complex data', () => {
      const headers = ['product', 'description'];
      const rows = [
        ['Widget', 'A "premium" widget, made in USA'],
        ['Gadget', 'Simple gadget\nMulti-line description'],
      ];
      const result = toCsvString(headers, rows);
      expect(result).toContain('Widget,"A ""premium"" widget, made in USA"');
      expect(result).toContain('"Simple gadget\nMulti-line description"');
    });

    it('should handle single row', () => {
      const headers = ['id'];
      const rows = [[123]];
      const result = toCsvString(headers, rows);
      expect(result).toBe('id\n123');
    });
  });
});
