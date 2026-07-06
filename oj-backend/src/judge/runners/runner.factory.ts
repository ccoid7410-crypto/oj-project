import { Injectable } from '@nestjs/common';
import { LanguageRunnerConfig } from './runner.types';

/**
 * 언어별 도커 이미지는 전부 amd64/arm64 멀티 아키텍처 공식 이미지를 사용합니다
 * (gcc, python, eclipse-temurin, node, golang 모두 두 아키텍처를 공식 지원).
 * DockerSandboxService가 이미지 이름만 넘기고 별도 --platform을 지정하지 않으므로,
 * 채점 워커가 돌아가는 호스트(서버)의 아키텍처에 맞는 이미지가 자동으로 pull된다.
 * amd64 서버든 ARM(예: Graviton, Apple Silicon 위 리눅스 VM) 서버든 별도 설정 없이 동작한다.
 */
// C/C++ 컴파일 시 제거하는 최적화 플래그.
// GCC는 -O2에서 조건 분기를 자동으로 branchless 코드로 바꾸거나(if-conversion),
// 반복문을 SIMD로 벡터화(tree-vectorize)해서, 소스가 if여도 실제로는 분기가 사라진다.
// 그 결과 "조건문 vs 산술" 방식의 실제 성능 차이(분기 예측 실패 비용)가 채점에서 관측되지 않는다.
// 이 저지는 그 차이를 유의미하게 드러내기 위해 해당 최적화만 비활성화한다(그 외 -O2 최적화는 유지).
const NO_BRANCHLESS_OPTS = ['-fno-tree-vectorize', '-fno-if-conversion', '-fno-if-conversion2'];

@Injectable()
export class RunnerFactory {
  private readonly configs: Record<string, LanguageRunnerConfig> = {
    C: {
      fileName: 'main.c',
      compileImage: 'gcc:13-bookworm',
      compileCmd: ['gcc', '-O2', ...NO_BRANCHLESS_OPTS, '-o', '/box/a.out', '/box/main.c'],
      runImage: 'gcc:13-bookworm',
      runCmd: ['/box/a.out'],
    },
    CPP: {
      fileName: 'main.cpp',
      compileImage: 'gcc:13-bookworm',
      compileCmd: ['g++', '-O2', '-std=c++17', ...NO_BRANCHLESS_OPTS, '-o', '/box/a.out', '/box/main.cpp'],
      runImage: 'gcc:13-bookworm',
      runCmd: ['/box/a.out'],
    },
    JAVA: {
      // public class 이름은 Main으로 고정한다고 가정
      fileName: 'Main.java',
      compileImage: 'eclipse-temurin:21-jdk-jammy',
      compileCmd: ['javac', '-d', '/box', '/box/Main.java'],
      runImage: 'eclipse-temurin:21-jdk-jammy',
      runCmd: ['java', '-cp', '/box', 'Main'],
    },
    PYTHON3: {
      fileName: 'main.py',
      compileCmd: null,
      runImage: 'python:3.12-slim',
      runCmd: ['python3', '/box/main.py'],
    },
    JAVASCRIPT: {
      fileName: 'main.js',
      compileCmd: null,
      runImage: 'node:20-slim',
      runCmd: ['node', '/box/main.js'],
    },
    GO: {
      fileName: 'main.go',
      compileImage: 'golang:1.22-bookworm',
      compileCmd: ['go', 'build', '-o', '/box/a.out', '/box/main.go'],
      runImage: 'golang:1.22-bookworm',
      runCmd: ['/box/a.out'],
    },
  };

  getConfig(language: string): LanguageRunnerConfig {
    const config = this.configs[language];
    if (!config) throw new Error(`지원하지 않는 언어입니다: ${language}`);
    return config;
  }

  /** 어드민 UI/설정 오버레이용: 언어별 기본 실행 설정 전체를 반환. */
  getAll(): Record<string, LanguageRunnerConfig> {
    return this.configs;
  }
}
