# -*- coding: utf-8 -*-
"""TaskExecutor —— 按计划逐步执行 Tool，支持 HITL（Phase 4）。

规则：
- 只执行 TOOL_REGISTRY 中 permission ∈ {READ, ANALYZE, GENERATE} 的工具。
- requires_confirmation=True 或 permission ∈ {WRITE, DELETE} 的步骤：
  不执行，任务进入 waiting_confirmation（等待用户确认）。
- 确认通过后从该步骤继续执行；拒绝则任务取消。
- 步骤结果（含 evidence_ids）持久化到 agent_task_steps。
"""
from __future__ import annotations

from typing import Any, Callable, Optional

from backend.agent import planner as planner_mod
from backend.agent import task_store
from backend.agent import tools as tools_mod
from backend.agent import orchestrator as orch_mod
from backend.agent.context import ContextBuilder
from backend.agent.task_store import TaskStore, _now

# 工具调用参数：Phase 4 尽量由 Context 推导；页面级 job_id 可传入
def _params_for(step: dict, ctx: dict) -> dict:
    params: dict[str, Any] = {}
    tool = step.get("tool")
    if tool in ("job.get", "match.analyze", "match.skill_gap", "match.what_if",
                "career.evolution", "career.snapshot", "career.forecast"):
        job_id = ctx.get("current_job_id")
        if job_id is not None:
            params["job_id"] = job_id
    if tool in ("resume.get_text", "resume.analyze", "resume.optimize"):
        resume_id = ctx.get("current_resume_id")
        if resume_id is not None:
            params["resume_id"] = resume_id
    if tool == "knowledge.ask":
        params["query"] = ctx.get("message") or ""
    return params


def _build_message(task: dict, completed: int, evidence_count: int) -> str:
    if task.get("status") == "completed":
        return f"任务已完成：共执行 {task.get('total_steps', 0)} 个步骤，成功 {completed} 步，收集 {evidence_count} 条证据。"
    if task.get("status") == "waiting_confirmation":
        return "任务已暂停，等待你确认后续操作。"
    if task.get("status") == "failed":
        return f"任务执行失败：{task.get('error') or '未知原因'}"
    if task.get("status") == "cancelled":
        return "任务已取消。"
    return "任务处理中。"


def _collect_evidence(result: dict, evidence: list[dict], seen: set) -> list[str]:
    ids: list[str] = []
    for e in result.get("evidence") or []:
        eid = e.get("evidence_id")
        if eid is None:
            continue
        key = str(eid)
        ids.append(key)
        if key not in seen:
            seen.add(key)
            evidence.append(e)
    return ids


def _short_summary(data: Any) -> str:
    try:
        import json as _json
        s = _json.dumps(data, ensure_ascii=False, default=str)
        return s[:120] + ("..." if len(s) > 120 else "")
    except Exception:
        return str(type(data).__name__)


class TaskExecutor:
    def __init__(self) -> None:
        self.store = TaskStore()

    # ---------------- 主入口 ----------------
    def execute_task(self, user: dict, task: dict, ctx: dict,
                     start_index: int = 0, bypass_confirmation: bool = False,
                     emit: Optional[Callable[[str, dict], None]] = None) -> dict:
        """执行任务计划。遇到需确认步骤即暂停。

        emit(event, data)：SSE 事件推送回调（Phase 5）。
        返回 {status, task, steps, message, confirmation, evidence}。
        """
        def _emit(event: str, data: dict) -> None:
            if emit:
                try:
                    emit(event, data)
                except Exception:
                    pass

        user_id = str(user.get("username") or "")
        task_id = task["id"]
        # 已结束的任务禁止再次执行（取消后不能继续）
        if task.get("status") in ("completed", "failed", "cancelled"):
            return {"status": task["status"], "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务已结束，无法继续执行。",
                    "confirmation": None, "evidence": []}
        plan = task.get("plan") or []
        validated = planner_mod.validate_plan(plan)
        total = len(validated)

        self.store.update_task(task_id, user_id, status="running",
                               current_step=start_index, total_steps=total)
        _emit("task.started", {"task_id": task_id, "intent": task.get("intent"),
                               "total_steps": total, "status": "running"})
        evidence: list[dict] = []
        seen: set = set()
        completed = 0

        for index in range(start_index, total):
            step = validated[index]
            tool_name = step.get("tool")

            # 取消边界检查：任务被取消则停止后续 step
            current_task = self.store.get_task(task_id, user_id) or task
            if current_task["status"] == "cancelled":
                _emit("task.cancelled", {"task_id": task_id, "status": "cancelled"})
                return {"status": "cancelled", "task": current_task,
                        "steps": self.store.get_steps(task_id, user_id),
                        "message": "任务已取消。", "confirmation": None, "evidence": evidence}

            if step.get("requires_confirmation") and not bypass_confirmation:
                msg = step.get("confirmation_message") or f"即将执行 {tool_name}，是否继续？"
                self.store.create_step(user_id, task_id, index, tool_name,
                                       step.get("permission"), step.get("input"),
                                       status="waiting_confirmation",
                                       requires_confirmation=True,
                                       confirmation_message=msg)
                self.store.update_task(task_id, user_id, status="waiting_confirmation",
                                       current_step=index,
                                       requires_confirmation=True,
                                       confirmation_message=msg)
                _emit("waiting_confirmation", {"task_id": task_id, "step_index": index,
                                               "tool_name": tool_name, "required": True,
                                               "message": msg})
                task = self.store.get_task(task_id, user_id) or task
                return {
                    "status": "waiting_confirmation",
                    "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务已暂停，等待你的确认。",
                    "confirmation": {"required": True, "message": msg},
                    "evidence": evidence,
                }

            tool = tools_mod.get_tool(tool_name)
            if not tool:
                self.store.create_step(user_id, task_id, index, tool_name,
                                       "UNKNOWN", step.get("input"), status="blocked",
                                       error="工具不存在")
                self.store.update_task(task_id, user_id, status="failed",
                                       current_step=index, error=f"步骤 {index} 工具不存在: {tool_name}")
                _emit("task.failed", {"task_id": task_id, "status": "failed",
                                      "error": f"步骤 {index} 工具不存在: {tool_name}"})
                task = self.store.get_task(task_id, user_id) or task
                return {"status": "failed", "task": task,
                        "steps": self.store.get_steps(task_id, user_id),
                        "message": _build_message(task, completed, len(evidence)),
                        "confirmation": None, "evidence": evidence}

            if tool["permission"] in tools_mod.WRITE_PERMISSIONS:
                # Phase 4/5 铁律：即使 bypass 确认也绝不执行写操作
                self.store.create_step(user_id, task_id, index, tool_name,
                                       tool["permission"], step.get("input"), status="blocked",
                                       error="Phase 4 禁止执行写操作")
                self.store.update_task(task_id, user_id, status="failed",
                                       current_step=index,
                                       error=f"尝试执行写操作 {tool_name} 已被拒绝")
                _emit("task.failed", {"task_id": task_id, "status": "failed",
                                      "error": f"尝试执行写操作 {tool_name} 已被拒绝"})
                task = self.store.get_task(task_id, user_id) or task
                return {"status": "failed", "task": task,
                        "steps": self.store.get_steps(task_id, user_id),
                        "message": _build_message(task, completed, len(evidence)),
                        "confirmation": None, "evidence": evidence}

            # 执行（幂等 upsert 步骤：已存在则复用，避免重复创建）
            existing = self.store.get_steps(task_id, user_id)
            if not any(s["step_index"] == index for s in existing):
                self.store.create_step(user_id, task_id, index, tool_name,
                                       tool["permission"], step.get("input"), status="running")
            else:
                self.store.update_step(task_id, user_id, index, status="running",
                                       started_at=_now())
            self.store.update_task(task_id, user_id, current_step=index)
            _emit("step.started", {"step_index": index, "tool_name": tool_name, "status": "running"})
            _emit("tool.started", {"tool_name": tool_name})
            _emit("reasoning", {"step_index": index, "summary": f"正在执行 {tool_name}"})

            try:
                result = tool["handler"](user=user, params=_params_for(step, ctx), ctx=ctx)
            except Exception as exc:  # noqa: BLE001
                result = {"ok": False, "tool": tool_name,
                          "error": {"code": "TOOL_ERROR", "message": "工具执行异常"}}

            if result.get("ok"):
                ids = _collect_evidence(result, evidence, seen)
                for ev in result.get("evidence") or []:
                    _emit("evidence", {
                        "evidence_id": ev.get("evidence_id"),
                        "type": ev.get("type"),
                        "title": ev.get("title"),
                        "source_name": ev.get("source_name"),
                        "source_url": ev.get("source_url"),
                        "relevance": ev.get("relevance"),
                        "confidence": ev.get("confidence"),
                        "is_demo": bool(ev.get("is_demo")),
                        "content": (ev.get("content") or "")[:300],
                    })
                self.store.update_step(task_id, user_id, index, status="completed",
                                       result=result.get("data"),
                                       evidence_ids=ids, completed_at=_now())
                completed += 1
                _emit("tool.completed", {"tool_name": tool_name, "status": "ok",
                                         "summary": _short_summary(result.get("data")),
                                         "evidence_ids": ids})
                _emit("step.completed", {"step_index": index, "tool_name": tool_name,
                                         "status": "completed", "evidence_ids": ids})
            else:
                err_msg = (result.get("error") or {}).get("message") or "未知错误"
                self.store.update_step(task_id, user_id, index, status="failed",
                                       error=err_msg, completed_at=_now())
                _emit("tool.completed", {"tool_name": tool_name, "status": "error",
                                         "summary": err_msg, "evidence_ids": []})
                # 步骤失败但任务已被取消：保留 cancelled，不覆盖
                task = self.store.get_task(task_id, user_id) or task
                if task["status"] == "cancelled":
                    _emit("task.cancelled", {"task_id": task_id, "status": "cancelled"})
                    return {"status": "cancelled", "task": task,
                            "steps": self.store.get_steps(task_id, user_id),
                            "message": "任务已取消。", "confirmation": None, "evidence": evidence}
                self.store.update_task(task_id, user_id, status="failed",
                                       current_step=index, error=f"步骤 {index}（{tool_name}）失败：{err_msg}")
                _emit("task.failed", {"task_id": task_id, "status": "failed", "error": err_msg})
                return {"status": "failed", "task": task,
                        "steps": self.store.get_steps(task_id, user_id),
                        "message": _build_message(task, completed, len(evidence)),
                        "confirmation": None, "evidence": evidence}

        # 全部完成
        task = self.store.get_task(task_id, user_id) or task
        if task["status"] == "cancelled":
            _emit("task.cancelled", {"task_id": task_id, "status": "cancelled"})
            return {"status": "cancelled", "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务已取消。", "confirmation": None, "evidence": evidence}
        steps_done = self.store.get_steps(task_id, user_id)
        # 生成自然语言回复（基于真实执行结果 + evidence，不重复执行工具、不暴露 CoT）
        reply = orch_mod.build_final_reply(user, task, steps_done, evidence, completed, total)
        self.store.update_task(task_id, user_id, status="completed",
                               current_step=total, total_steps=total,
                               result={"evidence": evidence, "message": reply},
                               completed_at=_now())
        task = self.store.get_task(task_id, user_id) or task
        _emit("task.completed", {"task_id": task_id, "status": "completed",
                                 "result": {"message": reply,
                                            "evidence_ids": [e.get("evidence_id") for e in evidence]},
                                 "evidence_ids": [e.get("evidence_id") for e in evidence],
                                 "citations": []})
        return {"status": "completed", "task": task,
                "steps": steps_done,
                "message": reply,
                "confirmation": None, "evidence": evidence}

    # ---------------- HITL ----------------
    def confirm_task(self, user: dict, task_id: int, approved: bool,
                     emit: Optional[Callable[[str, dict], None]] = None) -> dict:
        """HITL 确认：原子状态转换，防重复确认。返回当前任务状态。"""
        def _emit(event: str, data: dict) -> None:
            if emit:
                try:
                    emit(event, data)
                except Exception:
                    pass

        user_id = str(user.get("username") or "")
        task = self.store.get_task(task_id, user_id)
        if not task:
            return {"status": "not_found", "message": "任务不存在或无权限"}
        if task["status"] != "waiting_confirmation":
            return {"status": task["status"], "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务当前不在等待确认状态，无法重复确认。",
                    "confirmation": None, "evidence": []}

        if not approved:
            self.store.update_task(task_id, user_id, status="cancelled",
                                   error="用户拒绝了此次操作", completed_at=_now())
            task = self.store.get_task(task_id, user_id) or task
            _emit("task.cancelled", {"task_id": task_id, "status": "cancelled",
                                     "reason": "用户拒绝了此次操作"})
            return {"status": "cancelled", "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "用户拒绝了此次操作，任务已取消。",
                    "confirmation": None, "evidence": []}

        # 原子抢锁：waiting_confirmation → running（仅成功者继续执行）
        if not self.store.transition_status(task_id, user_id, "waiting_confirmation", "running"):
            task = self.store.get_task(task_id, user_id) or task
            return {"status": task["status"], "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务状态已变化，跳过本次确认。",
                    "confirmation": None, "evidence": []}

        # 更新该步骤为 pending，然后从当前步骤继续（bypass 确认）
        steps = self.store.get_steps(task_id, user_id)
        for s in steps:
            if s["status"] == "waiting_confirmation":
                self.store.update_step(task_id, user_id, s["step_index"],
                                       status="pending",
                                       requires_confirmation=False,
                                       confirmation_message=None)
                resume_index = s["step_index"]
                break
        else:
            resume_index = task.get("current_step") or 0

        task = self.store.get_task(task_id, user_id) or task
        # 从任务 input 重建上下文（用户消息 + 页面上下文），保持与首次执行一致
        task_input = task.get("input") or {}
        ctx = ContextBuilder.build(
            user,
            page=task_input.get("page"),
            tab=task_input.get("tab"),
            resume_id=task_input.get("resume_id"),
            job_id=task_input.get("job_id"),
        )
        ctx["message"] = task_input.get("message") or ""
        return self.execute_task(user, task, ctx, start_index=resume_index,
                                 bypass_confirmation=True, emit=emit)

    # ---------------- 取消 ----------------
    def cancel_task(self, user: dict, task_id: int) -> dict:
        user_id = str(user.get("username") or "")
        task = self.store.get_task(task_id, user_id)
        if not task:
            return {"status": "not_found", "message": "任务不存在或无权限"}
        if task["status"] in ("completed", "failed", "cancelled"):
            return {"status": task["status"], "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务已结束，无法取消。", "confirmation": None, "evidence": []}
        if not self.store.transition_status(task_id, user_id, task["status"], "cancelled"):
            task = self.store.get_task(task_id, user_id) or task
            return {"status": task["status"], "task": task,
                    "steps": self.store.get_steps(task_id, user_id),
                    "message": "任务状态已变化，无法取消。", "confirmation": None, "evidence": []}
        self.store.update_task(task_id, user_id, completed_at=_now())
        task = self.store.get_task(task_id, user_id) or task
        return {"status": "cancelled", "task": task,
                "steps": self.store.get_steps(task_id, user_id),
                "message": "任务已取消。", "confirmation": None, "evidence": []}
