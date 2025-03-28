import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthService } from './auth.service';
import { VerifySignatureDto } from './dto/verify-signature.dto';
import { GenerateNonceDto } from './dto/generate-nonce.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('nonce/:address')
  async generateNonce(@Param() params: GenerateNonceDto) {
    const nonce = await this.authService.generateNonce(params.address);
    return { nonce };
  }

  @Post('signature/verify')
  verifySignature(@Body() body: VerifySignatureDto) {
    return this.authService.verifySignature(body.address, body.signature);
  }

  // Testing Purposes Only
  @Post('nonce/sign')
  sign(@Body() body: { pk: string; message: string }) {
    return this.authService.signMessage(body.pk, body.message);
  }
}
