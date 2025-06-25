import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { GenerateNonceDto, VerifySignatureDto, SignMessageDto } from './dto';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';
import { DevelopmentOnlyGuard } from './development-only.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('generate-nonce/:address')
  async generateNonce(@Param() params: GenerateNonceDto) {
    const nonce = await this.authService.generateNonce(params.address);
    return { nonce };
  }

  @Public()
  @Post('login')
  verifySignature(@Body() body: VerifySignatureDto) {
    return this.authService.verifySignature(body.address, body.signature);
  }

  // Testing Purposes Only - RESTRICTED TO DEVELOPMENT ENVIRONMENTS
  @Public()
  @UseGuards(DevelopmentOnlyGuard)
  @Post('sign-message')
  sign(@Body() body: SignMessageDto) {
    return this.authService.signMessage(body.pk, body.message);
  }
}
