# -*- coding: utf-8 -*-
"""TaskEventBus —— 进程内任务事件队列（Phase 5）。

最小轻量方案（不引入 Celery / Redis / WebSocket）：
- 每个 task_id 一个线程安全 queue.Queue；TaskExecutor 在后台线程 publish。
- SSE 连接 consume；断线重连时队列仍在（maxsize 兜底），并可从 TaskStore 回放状态。
- 任务生命周期不依赖 SSE 连接：执行在独立线程中运行，前端断开不影响任务继续执行。
"""
from __future__ import annotations

import queue
import threading
import time
from typing import Optional


class TaskEventBus:
    _tasks: dict[int, "queue.Queue[dict]"] = {}
    _lock = threading.Lock()
    MAX_QUEUE = 2000  # 每个任务最多缓存事件数，防内存无限增长

    @classmethod
    def _queue(cls, task_id: int) -> "queue.Queue[dict]":
        with cls._lock:
            q = cls._tasks.get(task_id)
            if q is None:
                q = queue.Queue(maxsize=cls.MAX_QUEUE)
                cls._tasks[task_id] = q
            return q

    @classmethod
    def publish(cls, task_id: int, event: str, data: dict) -> None:
        payload = {
            "event": event,
            "task_id": task_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "data": data,
        }
        q = cls._queue(task_id)
        try:
            q.put_nowait(payload)
        except queue.Full:
            try:
                q.get_nowait()
            except queue.Empty:
                pass
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass

    @classmethod
    def consume(cls, task_id: int, timeout: float = 10.0) -> Optional[dict]:
        """阻塞等待下一条事件；超时返回 None。"""
        q = cls._queue(task_id)
        try:
            return q.get(timeout=timeout)
        except queue.Empty:
            return None

    @classmethod
    def drain(cls, task_id: int) -> list[dict]:
        """非阻塞取出当前所有积压事件（断线重连兜底）。"""
        with cls._lock:
            q = cls._tasks.get(task_id)
            if q is None:
                return []
            out: list[dict] = []
            while True:
                try:
                    out.append(q.get_nowait())
                except queue.Empty:
                    break
            return out

    @classmethod
    def pending_count(cls, task_id: int) -> int:
        with cls._lock:
            q = cls._tasks.get(task_id)
            return q.qsize() if q else 0
