import { Module } from '@nestjs/common';
import { AccountController, AdminUsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [AccountController, AdminUsersController],
  providers: [UsersService],
})
export class UsersModule {}
