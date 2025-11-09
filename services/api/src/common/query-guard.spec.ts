// E54-s1: QueryGuard unit tests
import { QueryGuard } from './query-guard';

describe('QueryGuard', () => {
  describe('capPageSize', () => {
    it('should return default size (20) when not specified', () => {
      expect(QueryGuard.capPageSize()).toBe(20);
      expect(QueryGuard.capPageSize(undefined)).toBe(20);
      expect(QueryGuard.capPageSize(0)).toBe(20);
      expect(QueryGuard.capPageSize(-1)).toBe(20);
    });

    it('should cap to MAX_PAGE_SIZE (100)', () => {
      expect(QueryGuard.capPageSize(150)).toBe(100);
      expect(QueryGuard.capPageSize(200)).toBe(100);
      expect(QueryGuard.capPageSize(1000)).toBe(100);
    });

    it('should allow valid page sizes under the cap', () => {
      expect(QueryGuard.capPageSize(10)).toBe(10);
      expect(QueryGuard.capPageSize(50)).toBe(50);
      expect(QueryGuard.capPageSize(100)).toBe(100);
    });
  });

  describe('toPrismaParams', () => {
    it('should convert pagination params with defaults', () => {
      const result = QueryGuard.toPrismaParams({});

      expect(result.take).toBe(20); // default page size
      expect(result.skip).toBe(0); // page 1
      expect(result.orderBy).toEqual({ updatedAt: 'desc' }); // default sort
    });

    it('should calculate skip correctly for pages', () => {
      const page1 = QueryGuard.toPrismaParams({ page: 1, pageSize: 20 });
      expect(page1.skip).toBe(0);

      const page2 = QueryGuard.toPrismaParams({ page: 2, pageSize: 20 });
      expect(page2.skip).toBe(20);

      const page3 = QueryGuard.toPrismaParams({ page: 3, pageSize: 10 });
      expect(page3.skip).toBe(20);
    });

    it('should respect custom sort parameters', () => {
      const result = QueryGuard.toPrismaParams({
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      expect(result.orderBy).toEqual({ createdAt: 'asc' });
    });

    it('should cap page size in params', () => {
      const result = QueryGuard.toPrismaParams({ pageSize: 500 });

      expect(result.take).toBe(100); // capped to max
    });
  });

  describe('getPaginationMeta', () => {
    it('should calculate pagination metadata correctly', () => {
      const meta = QueryGuard.getPaginationMeta(2, 20, 100);

      expect(meta.page).toBe(2);
      expect(meta.pageSize).toBe(20);
      expect(meta.totalPages).toBe(5);
      expect(meta.totalCount).toBe(100);
      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle first page correctly', () => {
      const meta = QueryGuard.getPaginationMeta(1, 20, 100);

      expect(meta.hasNext).toBe(true);
      expect(meta.hasPrev).toBe(false);
    });

    it('should handle last page correctly', () => {
      const meta = QueryGuard.getPaginationMeta(5, 20, 100);

      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(true);
    });

    it('should handle partial pages', () => {
      const meta = QueryGuard.getPaginationMeta(1, 20, 15);

      expect(meta.totalPages).toBe(1);
      expect(meta.hasNext).toBe(false);
      expect(meta.hasPrev).toBe(false);
    });
  });
});
