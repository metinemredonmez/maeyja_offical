import { IsArray, IsString } from 'class-validator';

/** Body for drag-and-drop ordering endpoints: ids in their new order. */
export class ReorderDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}
