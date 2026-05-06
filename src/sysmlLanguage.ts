// Monarch tokenizer and theme for SysML v2 (subset).
// Registered once in App via beforeMount.

export const SYSML_TOKENS = {
  keywords: [
    'package', 'interface', 'part', 'def', 'occurrence',
    'port', 'in', 'out', 'connect', 'to',
    'message', 'from',
    'action', 'behavior', 'flow',
  ],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/->/, 'operator'],
      [/[{}();]/, 'delimiter'],
      [/:/, 'delimiter'],
      [/\./, 'delimiter'],
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier',
        },
      }],
    ],
  },
};

export const SYSML_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'keyword',    foreground: 'c792ea', fontStyle: 'bold'  },
    { token: 'comment',    foreground: '546e7a', fontStyle: 'italic' },
    { token: 'identifier', foreground: 'cdd6f4'                      },
    { token: 'delimiter',  foreground: '89ddff'                      },
    { token: 'operator',   foreground: '89ddff'                      },
  ],
  colors: {
    'editor.background':                  '#1e1e2e',
    'editor.foreground':                  '#cdd6f4',
    'editorLineNumber.foreground':        '#45475a',
    'editorLineNumber.activeForeground':  '#cba6f7',
    'editor.lineHighlightBackground':     '#313244',
    'editor.selectionBackground':         '#45475a80',
    'editorGutter.background':            '#1e1e2e',
    'editorCursor.foreground':            '#f5c2e7',
    'editor.inactiveSelectionBackground': '#31324488',
  },
};
