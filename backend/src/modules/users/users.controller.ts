import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { ADMIN_ROLES, Roles } from '../../common/decorators/roles.decorator';
import { AddressDto, AdminUpdateUserDto, AdminUserQueryDto, CreateStaffDto, UpdateAddressDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Account')
@ApiBearerAuth()
@Controller('me')
export class AccountController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Delete()
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.users.deleteAccount(user.id);
  }

  @Get('addresses')
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.users.listAddresses(user.id);
  }

  @Post('addresses')
  createAddress(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.users.createAddress(user.id, dto);
  }

  @Patch('addresses/:id')
  updateAddress(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.users.updateAddress(user.id, id, dto);
  }

  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.deleteAddress(user.id, id);
  }
}

@ApiTags('Admin · Users')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() q: AdminUserQueryDto) {
    return this.users.adminList(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.adminGet(id);
  }

  @Patch(':id')
  update(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.adminUpdate(actor, id, dto);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  createStaff(@Body() dto: CreateStaffDto) {
    return this.users.createStaff(dto);
  }
}
