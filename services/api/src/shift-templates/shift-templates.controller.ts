import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShiftTemplatesService } from './shift-templates.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * M2-SHIFTS: Controller for shift templates
 * L4/L5 for create/update/delete, L3 for view
 */
@Controller('shift-templates')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ShiftTemplatesController {
  constructor(private readonly templatesService: ShiftTemplatesService) {}

  @Post()
  @Roles('L4', 'L5')
  async create(@Req() req: any, @Body() dto: CreateShiftTemplateDto) {
    return this.templatesService.create(req.user.orgId, dto);
  }

  @Get()
  @Roles('L3', 'L4', 'L5')
  async findAll(@Req() req: any, @Query('includeInactive') includeInactive?: string) {
    return this.templatesService.findAll(req.user.orgId, includeInactive === 'true');
  }

  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.templatesService.findOne(req.user.orgId, id);
  }

  @Patch(':id')
  @Roles('L4', 'L5')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateShiftTemplateDto) {
    return this.templatesService.update(req.user.orgId, id, dto);
  }

  @Delete(':id')
  @Roles('L4', 'L5')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.templatesService.remove(req.user.orgId, id);
  }
}
