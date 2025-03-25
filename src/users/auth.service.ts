import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';

import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  logger = new Logger('AuthService');

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async generateNonce(address: string) {
    // Generate and store a nonce for the address
    const nonce = await this.usersService.generateNonce(address);
    return { nonce };
  }

  // Testing Purposes Only
  async signMessage(pk: string, message: string) {
    const wallet = new ethers.Wallet(pk);
    const signature = await wallet.signMessage(message);
    return { signature };
  }

  async verifySignature(address: string, signature: string) {
    // Get the stored nonce message from redis
    const nonceMessage = (await this.usersService.getNonce(address)) as string;
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
