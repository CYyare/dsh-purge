/**
 * 从社区分支（CallMeGuLab/dsh-purge-safe，Apache-2.0）学来的补丁，按本分支的
 * 锚点与标记重写；编号沿用他们的 90/91/97/98/99，方便以后按编号交叉对照。
 *
 * 两组：
 *   97/98/99 —— 复用空白会话时沿用日志里记下的预设（红队模式不再被 standard 悄悄覆盖）
 *   90/91    —— 把插件挂着的提示词塞进模型的原生 system 槽（OpenAI messages[0].role=system /
 *               Anthropic params.system），宿主改拼装方式时这层仍然生效
 *
 * 与他们的差异：我们的 `__dshPurgeHungPrompt` 是**函数**（他们的是字符串），
 * 所以取值统一走 `readHung()`，两种形态都认。
 */

const T = '\t';
const L = (...lines) => lines.join('\n');

/** 读插件挂着的提示词：函数 / 字符串两种形态都兼容。 */
const HUNG_READ = [
  'const hungText = (typeof globalThis.__dshPurgeHungPrompt === "function")',
  '  ? String(globalThis.__dshPurgeHungPrompt() || "")',
  '  : (typeof globalThis.__dshPurgeHungPrompt === "string" ? globalThis.__dshPurgeHungPrompt : "");',
].join('\n');

/** 探测前 96 字，避免宿主已经带上了这段时重复注入。 */
const HUNG_PREPEND = [
  'if (hungText) {',
  '  const probe = hungText.slice(0, 96);',
  '  if (!promptText.includes(probe)) promptText = promptText ? (hungText + "\\n\\n" + promptText) : hungText;',
  '} // [dsh-purge-{ID}] hung into native system',
].join('\n');

const presetCold = L(
  T + T + T + T + 'reusable = request.reusable(sessionId) && !observed.events.some((event) => event.type === "turn/start");',
  T + T + T + T + '// [dsh-purge-97] 请求没点名预设、且日志里已经记了预设 → 沿用记下的那个。',
  T + T + T + T + '// 否则下拉里刚选的红队模式会被部署默认（standard）静默覆盖。',
  T + T + T + T + '// 只在名册确实认这个预设时才沿用；插件卸载留下的墓碑 id 走原来的默认路径。',
  T + T + T + T + 'if (request.agentPreset === void 0 && this.ctx.get("agentPresets") !== void 0) {',
  T + T + T + T + T + 'let recorded = observed.projections?.values?.agentPreset;',
  T + T + T + T + T + 'if (typeof recorded !== "string" || recorded.length === 0) {',
  T + T + T + T + T + T + 'for (const event of observed.events) if (event.type === "agent-preset/selected") recorded = event.data.agentPreset;',
  T + T + T + T + T + '}',
  T + T + T + T + T + 'if (typeof recorded === "string" && recorded.length > 0) {',
  T + T + T + T + T + T + 'let known = false;',
  T + T + T + T + T + T + 'try { known = (await this.ctx.get("agentPresets").resolve(recorded)).id === recorded; } catch { known = false; }',
  T + T + T + T + T + T + 'if (known) request = { ...request, agentPreset: recorded };',
  T + T + T + T + T + '}',
  T + T + T + T + '}',
);

const presetLive = L(
  T + T + 'if (live !== void 0) {',
  T + T + T + 'if (live.session.header.cwd !== request.cwd) throw new ApiSessionCwdConflict(live.id, request.cwd, live.session.header.cwd);',
  T + T + T + '// [dsh-purge-98] 活着的空白会话同样沿用已记下的预设，堵住 reuseLive() 把红队写回 standard。',
  T + T + T + 'if (request.agentPreset === void 0 && this.ctx.get("agentPresets") !== void 0) {',
  T + T + T + T + 'const recorded = this.presetForSession(live.session);',
  T + T + T + T + 'if (typeof recorded === "string" && recorded.length > 0) {',
  T + T + T + T + T + 'let known = false;',
  T + T + T + T + T + 'try { known = (await this.ctx.get("agentPresets").resolve(recorded)).id === recorded; } catch { known = false; }',
  T + T + T + T + T + 'if (known) request = { ...request, agentPreset: recorded };',
  T + T + T + T + '}',
  T + T + T + '}',
  T + T + T + 'const composition = await this.composeAgent(request.agentPreset);',
);

const S16 = '                '; // types/agent.js 用 16 空格
const typesCold = L(
  S16 + "reusable = request.reusable(sessionId) && !observed.events.some(event => event.type === 'turn/start');",
  S16 + '// [dsh-purge-99] 请求没点名预设时沿用日志里记下的那个（同 97）。',
  S16 + "if (request.agentPreset === undefined && this.ctx.get('agentPresets') !== undefined) {",
  S16 + '    let recorded = observed.projections?.values?.agentPreset;',
  S16 + "    if (typeof recorded !== 'string' || recorded.length === 0) {",
  S16 + "        for (const event of observed.events) if (event.type === 'agent-preset/selected') recorded = event.data.agentPreset;",
  S16 + '    }',
  S16 + "    if (typeof recorded === 'string' && recorded.length > 0) {",
  S16 + '        let known = false;',
  S16 + "        try { known = (await this.ctx.get('agentPresets').resolve(recorded)).id === recorded; } catch { known = false; }",
  S16 + '        if (known) request = { ...request, agentPreset: recorded };',
  S16 + '    }',
  S16 + '}',
);

const typesLive = L(
  '        if (live !== undefined) {',
  '            if (live.session.header.cwd !== request.cwd) {',
  '                throw new ApiSessionCwdConflict(live.id, request.cwd, live.session.header.cwd);',
  '            }',
  '            // [dsh-purge-99] 活着的空白会话沿用已记下的预设（同 98）。',
  "            if (request.agentPreset === undefined && this.ctx.get('agentPresets') !== undefined) {",
  '                const recorded = this.presetForSession(live.session);',
  "                if (typeof recorded === 'string' && recorded.length > 0) {",
  '                    let known = false;',
  "                    try { known = (await this.ctx.get('agentPresets').resolve(recorded)).id === recorded; } catch { known = false; }",
  '                    if (known) request = { ...request, agentPreset: recorded };',
  '                }',
  '            }',
  '            const composition = await this.composeAgent(request.agentPreset);',
);

const streamSeed = (id, compatFn) =>
  L(
    'export const stream = (model, context, options) => {',
    '    const stream = new AssistantMessageEventStream();',
    '    ' + HUNG_READ,
    '    let promptText = (typeof context.systemPrompt === "string" && context.systemPrompt.length > 0) ? context.systemPrompt : ((typeof context.system === "string" && context.system.length > 0) ? context.system : "");',
    '    ' + HUNG_PREPEND.replace('{ID}', id),
    '    // 只保证 system 文本里有载荷，不额外造一条 role=system 消息：',
    '    // 宿主自己会把 systemPrompt 写进原生槽，多造一条会变成两条 system。',
    `    const normalizedContext = { ...(promptText ? { ...context, systemPrompt: promptText } : context), ...resolveTranscript(promptText ? { ...context, systemPrompt: promptText } : context, ${compatFn}(model).supportsMidConvoSystemMessages) };`,
  );

export const EXTRA_PATCHES = [
  {
    id: 97,
    name: 'BLANK_REUSE_KEEPS_RECORDED_PRESET',
    layer: '代码',
    layer_en: 'Code',
    desc: '复用空白会话时沿用日志里记下的预设，不再被部署默认（standard）静默覆盖',
    file: ['api-session-controller'],
    optional: true,
    skipIfMarked: true,
    replacements: [
      {
        pattern: T + T + T + T + 'reusable = request.reusable(sessionId) && !observed.events.some((event) => event.type === "turn/start");',
        replace: presetCold,
      },
    ],
    markers: ['[dsh-purge-97] 请求没点名预设'],
  },
  {
    id: 98,
    name: 'LIVE_BLANK_REUSE_KEEPS_RECORDED_PRESET',
    layer: '代码',
    layer_en: 'Code',
    desc: '活着的空白会话同样沿用已记下的预设，堵住 reuseLive() 把红队写回 standard',
    file: ['api-session-controller'],
    optional: true,
    skipIfMarked: true,
    replacements: [
      {
        pattern: L(
          T + T + 'if (live !== void 0) {',
          T + T + T + 'if (live.session.header.cwd !== request.cwd) throw new ApiSessionCwdConflict(live.id, request.cwd, live.session.header.cwd);',
          T + T + T + 'const composition = await this.composeAgent(request.agentPreset);',
        ),
        replace: presetLive,
      },
    ],
    markers: ['[dsh-purge-98] 活着的空白会话'],
  },
  {
    id: 99,
    name: 'TYPES_AGENT_CLAIM_KEEPS_RECORDED_PRESET',
    layer: '代码',
    layer_en: 'Code',
    desc: 'lib/types/agent.js 里的同一份 claim() 也要沿用已记下的预设（独立入口，16 空格缩进）',
    file: ['api-session-controller', 'api-session-controller-types'],
    optional: true,
    skipIfMarked: true,
    replacements: [
      {
        pattern: L(
          '        if (live !== undefined) {',
          '            if (live.session.header.cwd !== request.cwd) {',
          '                throw new ApiSessionCwdConflict(live.id, request.cwd, live.session.header.cwd);',
          '            }',
          '            const composition = await this.composeAgent(request.agentPreset);',
        ),
        replace: typesLive,
      },
      {
        pattern: S16 + "reusable = request.reusable(sessionId) && !observed.events.some(event => event.type === 'turn/start');",
        replace: typesCold,
      },
    ],
    markers: ['[dsh-purge-99]'],
  },
  {
    id: 90,
    name: 'OPENAI_NATIVE_SYSTEM_ROLE',
    layer: '代码',
    layer_en: 'Code',
    desc: 'openai-completions：把挂着的提示词塞进原生 messages[0].role=system',
    file: ['pi-ai-completions'],
    optional: true,
    skipIfMarked: true,
    replacements: [
      {
        pattern: L(
          'export const stream = (model, context, options) => {',
          '    const stream = new AssistantMessageEventStream();',
          '    const normalizedContext = resolveTranscript(context, getCompat(model).supportsMidConvoSystemMessages);',
        ),
        replace: streamSeed(90, 'getCompat'),
      },
    ],
    markers: ['[dsh-purge-90] hung into native system'],
  },
  {
    id: 91,
    name: 'ANTHROPIC_NATIVE_PARAMS_SYSTEM',
    layer: '代码',
    layer_en: 'Code',
    desc: 'anthropic-messages：把挂着的提示词塞进原生 params.system',
    file: ['pi-ai-anthropic-messages'],
    optional: true,
    skipIfMarked: true,
    replacements: [
      {
        pattern: L(
          'export const stream = (model, context, options) => {',
          '    const stream = new AssistantMessageEventStream();',
          '    const normalizedContext = resolveTranscript(context, getAnthropicCompat(model).supportsMidConvoSystemMessages);',
        ),
        replace: streamSeed(91, 'getAnthropicCompat'),
      },
    ],
    markers: ['[dsh-purge-91] hung into native system'],
  },
];
