from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from bot.run_bots import _bot_runner_lock


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar(self):
        return self.value


class FakeBind:
    class dialect:
        name = "postgresql"


class FakeSession:
    def __init__(self, acquired):
        self.bind = FakeBind()
        self.acquired = acquired
        self.executed = []
        self.closed = False

    def execute(self, statement, params=None):
        sql = str(statement)
        self.executed.append(sql)
        if "pg_try_advisory_lock" in sql:
            return FakeResult(self.acquired)
        if "pg_advisory_unlock" in sql:
            return FakeResult(True)
        return FakeResult(None)

    def close(self):
        self.closed = True


def test_bot_runner_lock_skips_when_postgres_lock_held(monkeypatch):
    session = FakeSession(False)
    monkeypatch.setattr("bot.run_bots.SessionLocal", lambda: session)

    with _bot_runner_lock() as should_run:
        assert should_run is False

    assert any("pg_try_advisory_lock" in sql for sql in session.executed)
    assert not any("pg_advisory_unlock" in sql for sql in session.executed)
    assert session.closed is True


def test_bot_runner_lock_releases_when_acquired(monkeypatch):
    session = FakeSession(True)
    monkeypatch.setattr("bot.run_bots.SessionLocal", lambda: session)

    with _bot_runner_lock() as should_run:
        assert should_run is True

    assert any("pg_try_advisory_lock" in sql for sql in session.executed)
    assert any("pg_advisory_unlock" in sql for sql in session.executed)
    assert session.closed is True
