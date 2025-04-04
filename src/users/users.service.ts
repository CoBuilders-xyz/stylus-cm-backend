import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  findOne(address: string) {
    return this.usersRepository.findOne({ where: { address } });
  }

  create(address: string) {
    const newUser = this.usersRepository.create({ address });
    return this.usersRepository.save(newUser);
  }

  findOrCreate(address: string) {
    const user = this.findOne(address);
    if (user) {
      return user;
    }
    const newUser = this.create(address);
    return newUser;
  }
}
