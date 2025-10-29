// E54-s1: Query pagination and safety guards

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PrismaQueryParams {
  take: number;
  skip: number;
  orderBy?: any;
}

export class QueryGuard {
  /**
   * Cap page size to prevent resource exhaustion.
   * Default to 20 items per page if not specified.
   */
  static capPageSize(pageSize?: number): number {
    if (!pageSize || pageSize <= 0) {
      return DEFAULT_PAGE_SIZE;
    }
    return Math.min(pageSize, MAX_PAGE_SIZE);
  }

  /**
   * Convert pagination params to Prisma query params.
   * Caps page size and calculates skip offset.
   */
  static toPrismaParams(params: PaginationParams): PrismaQueryParams {
    const page = Math.max(1, params.page || 1);
    const pageSize = this.capPageSize(params.pageSize);
    const skip = (page - 1) * pageSize;

    const result: PrismaQueryParams = {
      take: pageSize,
      skip,
    };

    // Add sorting if specified
    if (params.sortBy) {
      result.orderBy = {
        [params.sortBy]: params.sortOrder || 'desc',
      };
    } else {
      // Default sort by updatedAt desc for most queries
      result.orderBy = { updatedAt: 'desc' };
    }

    return result;
  }

  /**
   * Calculate pagination metadata for response.
   */
  static getPaginationMeta(
    page: number,
    pageSize: number,
    totalCount: number,
  ): {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const totalPages = Math.ceil(totalCount / pageSize);
    
    return {
      page,
      pageSize,
      totalPages,
      totalCount,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
