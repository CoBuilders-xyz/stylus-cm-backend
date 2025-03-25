import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

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

  async upsert(address: string) {
    const user = await this.usersRepository.findOne({ where: { address } });
    if (user) {
      return user;
    }
    const newUser = this.usersRepository.create({ address });
    return await this.usersRepository.save(newUser);
  }

  async generateNonce(address: string) {
    const randomStr = Math.random().toString(36).substring(2);
    const timestamp = new Date().toISOString();
    const nonce = `Sign this message to verify your ownership of address ${address}. Nonce: ${randomStr}. Timestamp: ${timestamp}`;

    await this.cacheManager.set(address, nonce, 5000); // TODO Change expiration time make it env

    return nonce;
  }

  async getNonce(address: string) {
    return await this.cacheManager.get(address);
  }
}
