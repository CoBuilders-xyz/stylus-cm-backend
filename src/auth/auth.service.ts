import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from './auth.config';
import crypto from 'crypto';

@Injectable()
export class AuthService {
  logger = new Logger('AuthService');

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateNonce(address: string) {
    const nonce = `Hello, `;

    const authConfig = this.configService.get<AuthConfig>('auth')!;
    this.logger.debug(
      `Setting nonce expiration to: ${authConfig.nonceExpiration}ms`,
    );

    await this.cacheManager.set(address, nonce, authConfig.nonceExpiration);
    return nonce;
  }

  async getNonce(address: string) {
    return await this.cacheManager.get(address);
  }

  // Testing Purposes Only
  async signMessage(pk: string, message: string) {
    const wallet = new ethers.Wallet(pk);
    const signature = await wallet.signMessage(message);
    return { signature };
  }

  async verifySignature(address: string, signature: string) {
    // Get the stored nonce message from redis
    const nonceMessage = (await this.getNonce(address)) as string;
    if (!nonceMessage) {
      throw new NotFoundException('Nonce not found or expired');
    }

    this.logger.debug(
      `Attempting to verify signature with message: ${nonceMessage.replaceAll(
        '\n',
        ' ',
      )}`,
    );

    // Verify the signature using ethers.verifyMessage
    const recoveredAddress = ethers.verifyMessage(nonceMessage, signature);

    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      this.logger.debug('Signature verification successful!');

      // CRITICAL: Delete the nonce immediately after successful verification
      await this.cacheManager.del(address);
      this.logger.debug(`Nonce deleted for address: ${address}`);

      const user = await this.usersService.findOrCreate(address);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const accessToken = await this.jwtService.signAsync({
        userId: user.id,
        userAddress: user.address,
      });
      return { accessToken };
    } else {
      this.logger.error(
        'Signature verification FAILED - addresses do not match',
      );
      this.logger.error(`Expected: ${address.toLowerCase()}`);
      this.logger.error(`Recovered: ${recoveredAddress.toLowerCase()}`);

      throw new BadRequestException(
        `Error verifying signature: ${signature} for address: ${address}`,
      );
    }
  }
}
