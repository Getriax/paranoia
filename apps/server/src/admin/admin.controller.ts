import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from './admin.guard.js';
import { AdminService, ALL_INCLUDE, type IncludeKey } from './admin.service.js';

const VALID_INCLUDE_KEYS = new Set<string>(ALL_INCLUDE);
const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 1000;

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('export')
  async export(
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
    @Query('include') includeStr?: string,
    @Query('limit') limitStr?: string,
    @Res() res?: Response,
  ): Promise<void> {
    // Validate from/to
    let from: Date | undefined;
    let to: Date | undefined;

    if (fromStr !== undefined) {
      from = new Date(fromStr);
      if (isNaN(from.getTime())) {
        throw new BadRequestException('Invalid "from" timestamp');
      }
    }
    if (toStr !== undefined) {
      to = new Date(toStr);
      if (isNaN(to.getTime())) {
        throw new BadRequestException('Invalid "to" timestamp');
      }
    }
    if (from && to && from > to) {
      throw new BadRequestException('"from" must be before "to"');
    }

    // Validate limit
    let limit = DEFAULT_LIMIT;
    if (limitStr !== undefined) {
      const parsed = parseInt(limitStr, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new BadRequestException('Invalid "limit" — must be a positive integer');
      }
      limit = Math.min(parsed, MAX_LIMIT);
    }

    // Validate include
    let include: Set<IncludeKey>;
    if (includeStr !== undefined && includeStr.trim() !== '') {
      const parts = includeStr.split(',').map((s) => s.trim());
      const invalid = parts.filter((p) => !VALID_INCLUDE_KEYS.has(p));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Unknown include values: ${invalid.join(', ')}. Valid: ${ALL_INCLUDE.join(', ')}`,
        );
      }
      include = new Set(parts as IncludeKey[]);
    } else {
      include = new Set(ALL_INCLUDE);
    }

    res!.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res!.setHeader('Transfer-Encoding', 'chunked');
    res!.flushHeaders();

    for await (const line of this.adminService.streamGames({ from, to, limit }, include)) {
      res!.write(line);
    }

    res!.end();
  }
}
