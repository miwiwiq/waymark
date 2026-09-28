import { IsBirthDate, IsUsername } from '@app/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @Length(8, 128)
  password: string;

  /** Checked for format only; User Service owns usernames (decision I1). */
  @ApiProperty({ example: 'ana.travels' })
  @IsUsername()
  username: string;

  @ApiProperty({ example: '1995-06-15' })
  @IsBirthDate()
  dateOfBirth: string;
}

/** Documents the body for Swagger; Passport's local strategy reads it. */
export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  email: string;

  @ApiProperty()
  password: string;
}

export class SessionResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  userId: string;
}
