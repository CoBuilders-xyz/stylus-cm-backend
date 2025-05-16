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
    const randomStr = Math.random().toString(36).substring(2);
    const timestamp = new Date().toISOString();
    const nonce = `Sign this message to verify your ownership of address ${address}. Nonce: ${randomStr}. Timestamp: ${timestamp}`;

    const nonceExpiration = this.configService.get<number>(
      'AUTH_NONCE_EXPIRATION',
      10000,
    );
    await this.cacheManager.set(address, nonce, nonceExpiration);
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
    if (!nonceMessage)
      throw new NotFoundException('Nonce not found or expired');

    this.logger.debug(
      'Attempting to verify signature with message:',
      nonceMessage,
    );

    // Verify the signature using ethers.verifyMessage
    const recoveredAddress = ethers.verifyMessage(nonceMessage, signature);

    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      this.logger.debug('Signature verification successful!');

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
