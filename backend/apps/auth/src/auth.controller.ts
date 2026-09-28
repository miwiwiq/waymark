import { CurrentUser, type AuthUser } from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto, RegisterDto, SessionResponse } from './dto.js';
import { googleEnabled } from './google.strategy.js';
import {
  clearRefreshCookie,
  REFRESH_COOKIE,
  setRefreshCookie,
} from './refresh-cookie.js';
import { TokenService, type Session } from './token.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post('register')
  @ApiOkResponse({ type: SessionResponse })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return respondWithSession(res, await this.auth.register(dto));
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(AuthGuard('local'))
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: SessionResponse })
  async login(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return respondWithSession(res, await this.tokens.startSession(user.id));
  }

  /** Reads the refresh cookie; the web app calls this on page load and after a 401. */
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponse })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = token ? await this.tokens.refresh(token) : null;
    if (!result) {
      clearRefreshCookie(res);
      throw new UnauthorizedException();
    }
    return result;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await this.tokens.revoke(token);
    }
    clearRefreshCookie(res);
  }

  /** Lets the login page hide the Google button when no keys are configured. */
  @Get('providers')
  providers(): { google: boolean } {
    return { google: googleEnabled() };
  }
}

function respondWithSession(res: Response, session: Session): SessionResponse {
  setRefreshCookie(res, session.refreshToken);
  return { accessToken: session.accessToken, userId: session.userId };
}
