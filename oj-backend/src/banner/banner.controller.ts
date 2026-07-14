import { Controller, Get } from '@nestjs/common';
import { BannerService } from './banner.service';

/** 배너 노출 여부/이미지는 로그인 여부와 무관하게 누구나 볼 수 있어야 하므로 가드를 걸지 않는다. */
@Controller('site-banner')
export class BannerController {
  constructor(private readonly banner: BannerService) {}

  @Get()
  get() {
    return this.banner.getPublic();
  }
}
