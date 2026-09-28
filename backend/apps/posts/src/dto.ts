import { IsCalendarDate, PageQuery } from '@app/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO31661Alpha2,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_MEDIA, MEDIA_TYPES, type MediaKind } from './media-rules.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UploadRequestDto {
  @ApiProperty({ enum: Object.keys(MEDIA_TYPES) })
  @IsIn(Object.keys(MEDIA_TYPES))
  contentType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsInt()
  @Min(1)
  size: number;
}

export class PresignDto {
  @ApiProperty({ type: [UploadRequestDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MEDIA)
  @ValidateNested({ each: true })
  @Type(() => UploadRequestDto)
  files: UploadRequestDto[];
}

export class LocationDto {
  /** ISO 3166-1 alpha-2 code; the web app shows the name and flag (P1). */
  @ApiProperty({ example: 'PT' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2()
  country: string;

  @ApiProperty({ example: 'Lisbon' })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  city: string;

  @ApiPropertyOptional({ example: 38.72 })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: -9.14 })
  @IsOptional()
  @IsLongitude()
  lng?: number;
}

/**
 * One file of a post. Colour and size are read by the browser from the local
 * file before upload (P2); they only drive placeholders, so they aren't checked
 * against the file.
 */
export class MediaInputDto {
  @ApiProperty({ description: 'A key returned by POST /api/posts/uploads' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ example: '#c9785a', description: 'Average colour' })
  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  color?: string;

  @ApiPropertyOptional({ example: 1600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;
}

export class CreatePostDto {
  @ApiProperty({ example: 'Three days in Lisbon' })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title: string;

  @ApiPropertyOptional({ maxLength: 2200 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({ example: '2026-05-01' })
  @IsCalendarDate()
  tripStart: string;

  @ApiProperty({ example: '2026-05-03' })
  @IsCalendarDate()
  tripEnd: string;

  @ApiProperty({ type: [MediaInputDto], description: 'In display order; the first is the cover' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MEDIA)
  @ArrayUnique((item: MediaInputDto) => item.key)
  @ValidateNested({ each: true })
  @Type(() => MediaInputDto)
  media: MediaInputDto[];
}

/**
 * Every field can change; `media`, when present, is the complete new list.
 * Omitted fields stay as they are; null is validated like any other value, so
 * it's rejected rather than saved.
 */
export class UpdatePostDto extends PartialType(CreatePostDto, { skipNullProperties: false }) {}

export class AuthorPostsQuery extends PageQuery {
  @ApiProperty()
  @IsUUID()
  authorId: string;
}

export class InternalQueryDto {
  @IsArray()
  @IsUUID('all', { each: true })
  authorIds: string[];

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CanViewQuery {
  @IsOptional()
  @IsUUID()
  viewerId?: string;
}

export type PostView = {
  id: string;
  authorId: string;
  authorUsername: string;
  title: string;
  caption: string;
  location: { country: string; city: string; lat?: number; lng?: number };
  tripStart: string;
  tripEnd: string;
  /** `url` is a signed link valid for an hour (P3); `key` lets the editor keep a file. */
  media: {
    key: string;
    type: MediaKind;
    url: string;
    color?: string;
    width?: number;
    height?: number;
  }[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};
