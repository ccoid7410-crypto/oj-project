import { Logger } from '@nestjs/common';
import type { Server } from 'http';
import type { Request, Response } from 'express';
import httpProxy from 'http-proxy';

/**
 * 이 접두사로 시작하는 경로만 백엔드로 넘긴다. **화이트리스트다.**
 *
 * nginx가 `/api/(.*)` → `/$1` 로 접두사를 벗겨서 넘기므로, 여기 도착하는 경로는
 * 이미 `/users/me` 같은 형태다. 그래서 접두사 기반 화이트리스트가 아니라
 * "명시적으로 막을 것"을 정하는 블랙리스트가 필요하다(아래 BLOCKED_PREFIXES).
 */
const BLOCKED_PREFIXES = ['/internal'];

/** 프록시 단계에서 지워야 하는 헤더. 클라이언트가 내부용 헤더를 위조해 넣는 걸 막는다. */
const STRIPPED_REQUEST_HEADERS = ['x-internal-token', 'x-internal-user', 'x-judge-token'];

export interface PublicProxyOptions {
  target: string;
  /** 요청 하나가 이 크기를 넘으면 즉시 끊는다(바디를 버퍼링하지 않고 스트리밍 중에 판단). */
  maxBodyBytes: number;
}

/**
 * 프론트엔드 트래픽을 백엔드로 그대로 흘려보내는 얇은 프록시.
 *
 * 일부러 "멍청하게" 만들었다. 여기서 JWT를 다시 검증하지 않는 이유는, 의미 있는 검증
 * (authVersion / banned / 실시간 role)이 전부 DB를 필요로 하는데 인터체인저는 의도적으로
 * DB가 없기 때문이다. 바디를 다시 파싱하면 20MB 테스트케이스와 이미지가 두 번 버퍼링되면서
 * 지연만 늘고 보안 이득은 없다. 인증은 DB를 가진 API 한 곳에서만 판단한다.
 *
 * 대신 여기서만 할 수 있는 일에 집중한다: 내부 경로 차단, 위조 헤더 제거,
 * X-Forwarded-For 정확히 이어붙이기, 요청 크기 상한.
 */
export function createPublicProxy(options: PublicProxyOptions) {
  const logger = new Logger('PublicProxy');
  const proxy = httpProxy.createProxyServer({
    target: options.target,
    changeOrigin: false,
    xfwd: false, // 직접 붙인다. 라이브러리의 기본 동작은 체인을 잘못 이어붙일 수 있다.
    proxyTimeout: 120_000,
    timeout: 120_000,
  });

  proxy.on('error', (err, _req, res) => {
    logger.error(`프록시 오류: ${err.message}`);
    const response = res as Response | undefined;
    if (response && 'writeHead' in response && !response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ message: '백엔드에 연결하지 못했습니다.', statusCode: 502 }));
    }
  });

  const isBlocked = (url: string | undefined): boolean => {
    const path = (url ?? '').split('?')[0];
    return BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  };

  const prepare = (req: Request): void => {
    for (const header of STRIPPED_REQUEST_HEADERS) delete req.headers[header];

    // nginx가 붙여준 체인 뒤에 실제 원격 주소를 이어붙인다. 이 값이 정확해야
    // API 쪽 rate limit이 클라이언트별로 걸린다(trust proxy 홉 수와 짝을 이룬다).
    const existing = req.headers['x-forwarded-for'];
    const remote = req.socket.remoteAddress ?? '';
    req.headers['x-forwarded-for'] = existing ? `${existing}, ${remote}` : remote;
    req.headers['x-forwarded-proto'] ??= 'http';
  };

  const handle = (req: Request, res: Response): void => {
    if (isBlocked(req.url)) {
      res.status(404).json({ message: 'Not Found', statusCode: 404 });
      return;
    }
    prepare(req);

    // 스트리밍 도중 누적 크기를 보고 넘치면 끊는다(버퍼링 없이).
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > options.maxBodyBytes) {
      res.status(413).json({ message: '요청 본문이 너무 큽니다.', statusCode: 413 });
      return;
    }
    let received = 0;
    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > options.maxBodyBytes) req.destroy();
    });

    proxy.web(req, res);
  };

  /** WebSocket(socket.io) 업그레이드도 같은 규칙으로 넘긴다. */
  const attachUpgrade = (server: Server): void => {
    server.on('upgrade', (req, socket, head) => {
      if (isBlocked(req.url)) {
        socket.destroy();
        return;
      }
      prepare(req as unknown as Request);
      proxy.ws(req, socket, head);
    });
  };

  return { handle, attachUpgrade };
}
