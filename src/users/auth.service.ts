import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  logger = new Logger('AuthService');

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async generateNonce(address: string) {
    const randomStr = Math.random().toString(36).substring(2);
    const timestamp = new Date().toISOString();
    const nonce = `Sign this message to verify your ownership of address ${address}. Nonce: ${randomStr}. Timestamp: ${timestamp}`;

    await this.cacheManager.set(address, nonce, 10000); // TODO Change expiration time make it env
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
      throw new HttpException(
        'Nonce not found or expired',
        HttpStatus.NOT_FOUND,
      );

    this.logger.debug(
      'Attempting to verify signature with message:',
      nonceMessage,
    );

    // Verify the signature using ethers.verifyMessage
    const recoveredAddress = ethers.verifyMessage(nonceMessage, signature);

    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      this.logger.debug('Signature verification SUCCESSFUL!');
      const token = await this.jwtService.signAsync({ address: address });

      const user = await this.usersService.upsert(address);

      return { token, user };
    } else {
      this.logger.error(
        'Signature verification FAILED - addresses do not match',
      );
      this.logger.error(`Expected: ${address.toLowerCase()}`);
      this.logger.error(`Recovered: ${recoveredAddress.toLowerCase()}`);

      throw new HttpException(
        `Error verifying signature: ${signature} for address: ${address}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
