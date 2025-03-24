import { Inject, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class UsersService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async generateNonce(address: string) {
    const randomStr = Math.random().toString(36).substring(2);
    const timestamp = new Date().toISOString();
    const nonce = `Sign this message to verify your ownership of address ${address}. Nonce: ${randomStr}. Timestamp: ${timestamp}`;

    await this.cacheManager.set(address, nonce);

    return nonce;
  }

  async getNonce(address: string) {
    return await this.cacheManager.get(address);
  }
}
