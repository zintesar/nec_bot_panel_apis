import { Controller, Post, Body, Get, Put, Delete, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto, UserEmailDto } from '../../dto';

@Controller('v1/user')
export class UserController {
  constructor(private userService: UserService) {}

  @Post('/')
  async userCreate(@Body() reqbody: UserDto) {
    return await this.userService.create(reqbody);
  }

  @Put('/:id')
  async userEdit(@Param('id') id: string, @Body() reqbody: UserDto) {
    return await this.userService.update(id, reqbody);
  }

  @Delete('/:id')
  async userDelete(@Param('id') id: string) {
    return await this.userService.delete(id);
  }

  @Get('/')
  async userList() {
    return await this.userService.findAll();
  }

  @Get('/:id')
  async userFindById(@Param('id') id: string) {
    return await this.userService.findOneById(id);
  }



  // @Post('/findbyemail')
  // async userFind(@Body() reqbody: UserEmailDto) {
  //   return await this.userService.findOneByEmail(reqbody.email);
  // }

  // // @Post('/callstoreprocedure')
  // @Get('/callstoreprocedure')
  // async callStoreProcedure(@Body() reqbody: any) {
  //   // return await this.userService.callStoreProcedure(reqbody.the_input_paramenter)
  //   return await this.userService.callStoreProcedure('lll');
  // }
}
