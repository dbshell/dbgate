import { SplitterOptions, defaultSplitterOptions } from './options';

const SEMICOLON = ';';

interface SplitExecutionContext {
  options: SplitterOptions;
  source: string;
  position: number;
  currentDelimiter: string;
  output: string[];
  end: number;
  wasDataOnLine: boolean;
  currentCommandStart: number;

  //   unread: string;
  //   currentStatement: string;
  //   semicolonKeyTokenRegex: RegExp;
}

function isStringEnd(s: string, pos: number, endch: string, escapech: string) {
  if (!escapech) {
    return s[pos] == endch;
  }
  if (endch == escapech) {
    return s[pos] == endch && s[pos + 1] != endch;
  } else {
    return s[pos] == endch && s[pos - 1] != escapech;
  }
}

interface Token {
  type: 'string' | 'delimiter' | 'whitespace' | 'eoln' | 'data' | 'set_delimiter' | 'comment' | 'go_delimiter';
  length: number;
  value?: string;
}

const WHITESPACE_TOKEN: Token = {
  type: 'whitespace',
  length: 1,
};
const EOLN_TOKEN: Token = {
  type: 'eoln',
  length: 1,
};
const DATA_TOKEN: Token = {
  type: 'data',
  length: 1,
};

function scanDollarQuotedString(context: SplitExecutionContext): Token {
  if (!context.options.allowDollarDollarString) return null;

  let pos = context.position;
  const s = context.source;

  const match = /^(\$[a-zA-Z0-9_]*\$)/.exec(s.slice(pos));
  if (!match) return null;
  const label = match[1];
  pos += label.length;

  while (pos < context.end) {
    if (s.slice(pos).startsWith(label)) {
      return {
        type: 'string',
        length: pos + label.length - context.position,
      };
    }
    pos++;
  }

  return null;
}

function scanToken(context: SplitExecutionContext): Token {
  let pos = context.position;
  const s = context.source;
  const ch = s[pos];

  if (context.options.stringsBegins.includes(ch)) {
    pos++;
    const endch = context.options.stringsEnds[ch];
    const escapech = context.options.stringEscapes[ch];
    while (pos < context.end && !isStringEnd(s, pos, endch, escapech)) {
      if (endch == escapech && s[pos] == endch && s[pos + 1] == endch) {
        pos += 2;
      } else {
        pos++;
      }
    }
    return {
      type: 'string',
      length: pos - context.position + 1,
    };
  }

  if (context.currentDelimiter && s.slice(pos).startsWith(context.currentDelimiter)) {
    return {
      type: 'delimiter',
      length: context.currentDelimiter.length,
    };
  }

  if (ch == ' ' || ch == '\t' || ch == '\r') {
    return WHITESPACE_TOKEN;
  }

  if (ch == '\n') {
    return EOLN_TOKEN;
  }

  if (ch == '-' && s[pos + 1] == '-') {
    while (pos < context.end && s[pos] != '\n') pos++;
    return {
      type: 'comment',
      length: pos - context.position,
    };
  }

  if (ch == '/' && s[pos + 1] == '*') {
    pos += 2;
    while (pos < context.end) {
      if (s[pos] == '*' && s[pos + 1] == '/') break;
      pos++;
    }
    return {
      type: 'comment',
      length: pos - context.position + 2,
    };
  }

  if (context.options.allowCustomDelimiter && !context.wasDataOnLine) {
    const m = s.slice(pos).match(/^DELIMITER[ \t]+([^\n]+)/i);
    if (m) {
      return {
        type: 'set_delimiter',
        value: m[1].trim(),
        length: m[0].length,
      };
    }
  }

  if (context.options.allowGoDelimiter && !context.wasDataOnLine) {
    const m = s.slice(pos).match(/^GO[\t\r ]*(\n|$)/i);
    if (m) {
      return {
        type: 'go_delimiter',
        length: m[0].length - 1,
      };
    }
  }

  const dollarString = scanDollarQuotedString(context);
  if (dollarString) return dollarString;

  return DATA_TOKEN;
}

function pushQuery(context) {
  const sql = context.source.slice(context.currentCommandStart, context.position);
  const trimmed = sql.trim();
  if (trimmed) context.output.push(trimmed);
}

export function splitQuery(sql: string, options: SplitterOptions = null): string[] {
  const usedOptions = {
    ...defaultSplitterOptions,
    ...options,
  };

  if (usedOptions.noSplit) {
    return [sql];
  }

  const context: SplitExecutionContext = {
    source: sql,
    end: sql.length,
    currentDelimiter: options?.allowSemicolon === false ? null : SEMICOLON,
    position: 0,
    currentCommandStart: 0,
    output: [],
    wasDataOnLine: false,
    options: usedOptions,
  };

  while (context.position < context.end) {
    const token = scanToken(context);
    if (!token) {
      // nothing special, move forward
      context.position += 1;
      continue;
    }
    switch (token.type) {
      case 'string':
        context.position += token.length;
        context.wasDataOnLine = true;
        break;
      case 'comment':
        context.position += token.length;
        context.wasDataOnLine = true;
        break;
      case 'eoln':
        context.position += token.length;
        context.wasDataOnLine = false;
        break;
      case 'data':
        context.position += token.length;
        context.wasDataOnLine = true;
        break;
      case 'whitespace':
        context.position += token.length;
        break;
      case 'set_delimiter':
        pushQuery(context);
        context.currentDelimiter = token.value;
        context.position += token.length;
        context.currentCommandStart = context.position;
        break;
      case 'go_delimiter':
        pushQuery(context);
        context.position += token.length;
        context.currentCommandStart = context.position;
        break;
      case 'delimiter':
        pushQuery(context);
        context.position += token.length;
        context.currentCommandStart = context.position;
        break;
    }
  }

  if (context.end > context.currentCommandStart) {
    pushQuery(context);
  }

  //   context.semicolonKeyTokenRegex = buildKeyTokenRegex(SEMICOLON, context);
  //   let findResult: FindExpResult = {
  //     expIndex: -1,
  //     exp: null,
  //     nextIndex: 0,
  //   };
  //   let lastUnreadLength;
  //   do {
  //     // console.log('context.unread', context.unread);
  //     lastUnreadLength = context.unread.length;
  //     findResult = findKeyToken(context.unread, context.currentDelimiter, context);
  //     handleKeyTokenFindResult(context, findResult);
  //     // Prevent infinite loop by returning incorrect result
  //     if (lastUnreadLength === context.unread.length) {
  //       read(context, context.unread.length);
  //     }
  //   } while (context.unread !== '');
  //   publishStatement(context);

  // console.log('RESULT', context.output);

  return context.output;
}
