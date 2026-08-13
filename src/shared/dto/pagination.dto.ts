import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Reference implementation of the DTO convention every module should
 * follow: plain class, `class-validator` decorators for constraints,
 * `class-transformer` for coercing query-string values into real types.
 * Pair with `@DQuery(PaginationDto)` — DolphJS validates and transforms it
 * automatically before the handler runs (see core/transformer.ts).
 */
export class PaginationDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page: number = 1;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    limit: number = 20;

    @IsIn(['ASC', 'DESC'])
    @IsOptional()
    order: 'ASC' | 'DESC' = 'DESC';
}
