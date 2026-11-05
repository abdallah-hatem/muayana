import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Patch,
  Post,
} from '@nestjs/common';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateMeDto } from './dto/update-me.dto';

/** Sign-in and the engineer's own account. There is no sign-up (business §2). */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Get('me')
  me(@GetUser('id') userId: string) {
    return this.auth.me(userId);
  }

  @Patch('me')
  updateMe(@GetUser('id') userId: string, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(userId, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @GetUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(userId, dto);
  }
}
