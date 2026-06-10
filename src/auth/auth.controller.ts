import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  GenerateNonceDto,
  VerifySignatureDto,
  SignMessageDto,
  TestLoginDto,
} from './dto';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';
import { DevelopmentOnlyGuard } from './development-only.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('generate-nonce/:address')
  @ApiOperation({ summary: 'Generate a nonce for wallet signature authentication' })
  @ApiParam({ name: 'address', description: 'Ethereum wallet address (EIP-55 checksum)' })
  @ApiResponse({ status: 200, description: 'Nonce generated successfully' })
  async generateNonce(@Param() params: GenerateNonceDto) {
    const nonce = await this.authService.generateNonce(params.address);
    return { nonce };
  }

  @Public()
  @UseGuards(DevelopmentOnlyGuard)
  @Post('sign-message')
  @ApiOperation({ summary: 'Sign a message with a private key (dev only)' })
  @ApiResponse({ status: 201, description: 'Message signed successfully' })
  sign(@Body() body: SignMessageDto) {
    return this.authService.signMessage(body.pk, body.message);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Verify wallet signature and obtain a JWT token' })
  @ApiResponse({ status: 201, description: 'Authentication successful, JWT returned' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  verifySignature(@Body() body: VerifySignatureDto) {
    return this.authService.verifySignature(body.address, body.signature);
  }

  @Public()
  @UseGuards(DevelopmentOnlyGuard)
  @Post('test-login')
  @ApiOperation({
    summary: 'One-step login with private key (dev/staging only)',
    description:
      'Generates nonce, signs it, and returns a JWT in a single call. ' +
      'Only available in local/develop/staging environments.',
  })
  @ApiResponse({ status: 201, description: 'JWT access token' })
  @ApiResponse({ status: 403, description: 'Not available in production' })
  testLogin(@Body() body: TestLoginDto) {
    return this.authService.testLogin(body.address, body.pk);
  }
}
