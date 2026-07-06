import type { Language } from '../api/types';

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'CPP', label: 'C++17' },
  { value: 'C', label: 'C' },
  { value: 'JAVA', label: 'Java (class Main)' },
  { value: 'PYTHON3', label: 'Python 3' },
  { value: 'JAVASCRIPT', label: 'Node.js' },
  { value: 'GO', label: 'Go' },
];

export const DEFAULT_TEMPLATE: Record<Language, string> = {
  CPP: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  C: '#include <stdio.h>\n\nint main(void) {\n    \n    return 0;\n}\n',
  JAVA: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n',
  PYTHON3: 'import sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n',
  JAVASCRIPT:
    'const lines = require("fs").readFileSync("/dev/stdin", "utf8").split("\\n");\n\n// TODO\n',
  GO: 'package main\n\nimport "fmt"\n\nfunc main() {\n\n}\n',
};
