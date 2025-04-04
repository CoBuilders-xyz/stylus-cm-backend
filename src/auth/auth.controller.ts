import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { GenerateNonceDto } from './dto/generate-nonce.dto';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';
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

  // Testing Purposes Only
  @Public()
  @Post('sign-message')
  sign(@Body() body: { pk: string; message: string }) {
    return this.authService.signMessage(body.pk, body.message);
  }
}
