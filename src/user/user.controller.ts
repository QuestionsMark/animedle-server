import { Controller, Get, Post, Body, Patch, Param, HttpCode, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UseHintDto } from './dto/use-hint.dto';
import { Auth, ServerSuccessfullResponse } from 'src/types';
import { AuthGuard } from '@nestjs/passport';
import { UserObject } from 'src/decorators/user.decorator';
import { User } from './entities/user.entity';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Post()
    @HttpCode(201)
    create(
        @Body() createUserDto: CreateUserDto,
    ): Promise<ServerSuccessfullResponse<string>> {
        return this.userService.create(createUserDto);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.userService.findOne(+id);
    }

    @Patch('/hint')
    @UseGuards(AuthGuard(Auth.Strategy.Jwt))
    update(
        @UserObject() user: User,
        @Body() useHintDto: UseHintDto,
    ) {
        return this.userService.useHint(user, useHintDto);
    }
}
