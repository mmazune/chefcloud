import { IsEnum } from 'class-validator';

export class UpdateTableStatusDto {
  @IsEnum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'])
  status!: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
}
