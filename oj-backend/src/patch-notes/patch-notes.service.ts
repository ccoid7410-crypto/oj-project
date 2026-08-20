import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PatchNotesService {
  private readonly logger = new Logger(PatchNotesService.name);
  private cachedCommits: any[] = [];
  private lastFetchTime: number = 0;
  // 24시간 캐시 유지 (단위: ms)
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000;

  async getCommits() {
    const now = Date.now();
    
    // 캐시가 유효하다면 즉시 반환
    if (this.cachedCommits.length > 0 && now - this.lastFetchTime < this.CACHE_DURATION) {
      return this.cachedCommits;
    }

    try {
      this.logger.log('Fetching new commits from GitHub API...');
      const response = await fetch('https://api.github.com/repos/ccoid7410-crypto/oj-project/commits?per_page=15', {
        headers: {
          'User-Agent': 'durunuri-oj-backend',
        }
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API responded with status ${response.status}`);
      }

      const data = await response.json();
      this.cachedCommits = data;
      this.lastFetchTime = now;
      this.logger.log(`Successfully fetched and cached ${data.length} commits.`);
      
      return this.cachedCommits;
    } catch (error) {
      this.logger.error('Failed to fetch commits from GitHub', error);
      // 에러 발생 시, 실패하더라도 기존 캐시가 있으면 기존 캐시를 유지해서 반환
      return this.cachedCommits;
    }
  }
}
