import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FloorService } from './floor.service';
import { UpdateTableStatusDto } from './floor.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { User } from '../me/user.decorator';

@Controller('floor')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FloorController {
  constructor(private floorService: FloorService) {}

  @Get()
  @Roles('L1')
  async getFloor(@User() user: { branchId: string }): Promise<unknown> {
    return this.floorService.getFloor(user.branchId);
  }
}

@Controller('tables')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TableController {
  constructor(private floorService: FloorService) {}

  @Patch(':id')
  @Roles('L1')
  async updateTableStatus(
    @Param('id') tableId: string,
    @Body() dto: UpdateTableStatusDto,
  ): Promise<unknown> {
    return this.floorService.updateTableStatus(tableId, dto.status);
  }
}
