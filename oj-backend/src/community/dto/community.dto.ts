import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const BOARDS = ['OJ', 'HOME'] as const;
export type Board = (typeof BOARDS)[number];

export const POST_TYPES = ['NORMAL', 'UPDATE_LOG', 'NOTICE'] as const;
export type PostType = (typeof POST_TYPES)[number];

export class CreatePostDto {
  @IsIn(BOARDS, { message: '게시판 구분이 올바르지 않습니다.' })
  board: Board;

  @IsString()
  @MinLength(1, { message: '제목을 입력해주세요.' })
  @MaxLength(200, { message: '제목은 200자 이하여야 합니다.' })
  title: string;

  @IsString()
  @MinLength(1, { message: '내용을 입력해주세요.' })
  @MaxLength(20000, { message: '내용은 20000자 이하여야 합니다.' })
  content: string;

  @IsOptional()
  @IsIn(POST_TYPES, { message: '게시글 유형이 올바르지 않습니다.' })
  type?: PostType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: '태그는 최대 10개까지 선택할 수 있습니다.' })
  @IsString({ each: true })
  @MaxLength(20, { each: true, message: '태그는 20자 이하여야 합니다.' })
  tags?: string[];
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

// 카톡 공감처럼 고를 수 있는 이모지 목록(프론트와 동일해야 한다).
export const REACTION_EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '😡'] as const;

export class ReactionDto {
  // 같은 이모지를 다시 보내면 취소(토글), 다른 이모지면 교체된다.
  @IsIn(REACTION_EMOJIS, { message: '지원하지 않는 이모지입니다.' })
  emoji: string;
}

export class CreateTagDto {
  @IsIn(BOARDS, { message: '게시판 구분이 올바르지 않습니다.' })
  board: Board;

  @IsString()
  @MinLength(1, { message: '태그 이름을 입력해주세요.' })
  @MaxLength(20, { message: '태그는 20자 이하여야 합니다.' })
  name: string;
}
