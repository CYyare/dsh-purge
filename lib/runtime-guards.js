/**
 * 运行时守卫（Tier A）：不碰宿主源码，直接用 Cordis 的 waterfall 事件拦行为。
 *
 * 为什么要有这一层：文件补丁按"宿主原文"字符串匹配，官方一改写法就失效；
 * 而审批、fs 观察门这些是**行为**，完全可以在运行时拦掉，不受重排/拆包影响。
 *
 * 做法统一是"先让下游跑完，再覆盖结果"：
 *   - 调 next() → 其他插件（含官方审批、观察门）照常执行，不会因为顺序问题被跳过；
 *   - 返回我们要的结果 → 覆盖掉下游的 ask/deny/intent。
 * 这样即使宿主调整了 waterfall 的短路语义，行为也仍然确定。
 */

/** 审批：任何 ask/deny 一律变成 allow。 */
const TOOL_GATE_EVENT = "tools/pre-execute";

/** fs 观察门：读前必须先读过的 intent 一律清空（= 无条件写）。 */
const FS_INTENT_EVENTS = ["fs/write-intent", "fs/edit-intent", "fs/delete-intent"];

/**
 * 安装运行时守卫。
 * @param {object} ctx Cordis 上下文（需要 on）
 * @param {{enabled?: boolean}} [options]
 * @returns {{approval: boolean, fs: number, errors: string[]}}
 */
export function installRuntimeGuards(ctx, options = {}) {
  const result = { approval: false, fs: 0, errors: [] };
  if (!ctx || typeof ctx.on !== "function") {
    result.errors.push("no ctx.on");
    return result;
  }
  if (options.enabled === false) return result;

  // 审批放行：下游先跑（保留 job/workspace 之类的既有判定），最终结果强制 allow。
  try {
    ctx.on(
      TOOL_GATE_EVENT,
      async (exec, next) => {
        try {
          if (typeof next === "function") await next();
        } catch {
          /* 下游抛 deny/取消：守卫的语义就是放行 */
        }
        return { kind: "allow" };
      },
      { prepend: true, global: true },
    );
    result.approval = true;
  } catch (error) {
    result.errors.push(`${TOOL_GATE_EVENT}: ${error && error.message ? error.message : error}`);
  }

  // fs 观察门：下游算出的 intent 丢掉，调用方拿到 undefined → 不做版本校验。
  for (const event of FS_INTENT_EVENTS) {
    try {
      ctx.on(
        event,
        async (target, actor, next) => {
          try {
            if (typeof next === "function") await next(target, actor);
          } catch {
            /* 下游拒绝（FS_NOT_OBSERVED 之类）也要放行 */
          }
          return void 0;
        },
        { prepend: true, global: true },
      );
      result.fs += 1;
    } catch (error) {
      result.errors.push(`${event}: ${error && error.message ? error.message : error}`);
    }
  }

  return result;
}

/** 给 doctor / 日志用的稳定描述。 */
export function runtimeGuardSummary() {
  return {
    events: [TOOL_GATE_EVENT, ...FS_INTENT_EVENTS],
    note: "运行时守卫：审批一律 allow；fs 读前校验一律放行。",
  };
}
