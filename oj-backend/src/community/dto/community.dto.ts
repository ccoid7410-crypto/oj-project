import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MinLength(1, { message: '제목을 입력해주세요.' })
  @MaxLength(200, { message: '제목은 200자 이하여야 합니다.' })
  title: string;

  @IsString()
  @MinLength(1, { message: '내용을 입력해주세요.' })
  @MaxLength(20000, { message: '내용은 20000자 이하여야 합니다.' })
  content: string;
}

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: '내용을 입력해주세요.' })
  @MaxLength(5000, { message: '댓글은 5000자 이하여야 합니다.' })
  content: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class VoteDto {
  // 1 = 좋아요, -1 = 싫어요. 같은 값을 다시 보내면 취소(토글)된다.
  @IsIn([1, -1], { message: '좋아요(1) 또는 싫어요(-1)만 가능합니다.' })
  value: 1 | -1;
}
